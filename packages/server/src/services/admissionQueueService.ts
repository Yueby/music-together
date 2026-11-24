import { EVENTS, type AdmissionCancelledEvent, type AdmissionQueuedEvent, type ClientKind } from '@music-together/shared'
import { config } from '../config.js'
import type { TypedServer, TypedSocket } from '../middleware/types.js'
import { roomRepo } from '../repositories/roomRepository.js'
import { logger } from '../utils/logger.js'
import { canAdmitClient, getPublicServerCapacity, notifyCapacityChanged, type AdmissionDecision } from './serverLoadService.js'

export type QueuedAdmissionPayload =
  | {
      action: 'create'
      nickname: string
      roomName?: string
      password?: string
    }
  | {
      action: 'join'
      roomId: string
      nickname: string
      password?: string
      rejoinToken?: string
    }

export interface QueuedAdmissionEntry {
  identityUserId: string
  socketId: string
  clientKind: ClientKind
  payload: QueuedAdmissionPayload
  reason: AdmissionQueuedEvent['reason']
  enqueuedAt: number
  disconnectedAt?: number
  disconnectTimer?: ReturnType<typeof setTimeout>
}

type QueueEntry = QueuedAdmissionEntry & { socket: TypedSocket; blockedBy?: AdmissionDecision['reason'] }

export type AdmissionExecutor = (
  io: TypedServer,
  socket: TypedSocket,
  entry: QueuedAdmissionEntry,
) => Promise<void> | void

const DISCONNECT_GRACE_MS = 15_000
const MAX_QUEUE_WAIT_MS = 30 * 60_000

/**
 * Bounded FIFO waiting queue for room creation / joining when the server is at capacity.
 * - Deduplicates by `identityUserId` (opening multiple tabs cannot consume multiple slots).
 * - Holds a brief reconnect grace window for web clients.
 * - Skips requests blocked by mini-app relay congestion or by a room's mini-app listener limit.
 */
export class AdmissionQueue {
  private entries: QueueEntry[] = []
  private readonly maxQueueLength: number
  private readonly disconnectGraceMs: number
  private draining = false
  private drainAgain = false
  private executor: AdmissionExecutor | null = null

  constructor(options?: { maxQueueLength?: number; disconnectGraceMs?: number }) {
    this.maxQueueLength = options?.maxQueueLength ?? config.capacity.maxQueue
    this.disconnectGraceMs = options?.disconnectGraceMs ?? DISCONNECT_GRACE_MS
  }

  get length(): number {
    return this.entries.length
  }

  hasWaitingForCapacity(): boolean {
    return this.entries.some((entry) =>
      (entry.blockedBy ?? entry.reason) === 'capacity' && entry.disconnectedAt === undefined && entry.socket.connected,
    )
  }

  setExecutor(executor: AdmissionExecutor): void {
    this.executor = executor
  }

  findByIdentity(identityUserId: string): { entry: QueueEntry; position: number } | null {
    const idx = this.entries.findIndex((e) => e.identityUserId === identityUserId)
    if (idx < 0) return null
    return { entry: this.entries[idx]!, position: idx + 1 }
  }

  enqueue(
    io: TypedServer,
    socket: TypedSocket,
    payload: QueuedAdmissionPayload,
    reason: QueuedAdmissionEntry['reason'],
  ): { ok: true; position: number; queueLength: number } | { ok: false } {
    const identityUserId = socket.data.identityUserId
    const clientKind: ClientKind = socket.data.clientKind ?? (identityUserId.startsWith('mapp_') ? 'mapp' : 'web')
    const existingIdx = this.entries.findIndex((e) => e.identityUserId === identityUserId)

    if (existingIdx >= 0) {
      const existing = this.entries[existingIdx]!
      if (existing.disconnectTimer) {
        clearTimeout(existing.disconnectTimer)
        existing.disconnectTimer = undefined
      }
      // If the user queued from another tab, notify the replaced tab so its UI clears cleanly.
      if (existing.socketId !== socket.id) {
        const oldSocket = io.sockets.sockets.get(existing.socketId)
        oldSocket?.emit(EVENTS.ADMISSION_CANCELLED, { reason: 'replaced', message: '已在其他标签页更新排队请求' })
      }
      existing.socketId = socket.id
      existing.socket = socket
      existing.clientKind = clientKind
      existing.payload = payload
      existing.reason = reason
      existing.blockedBy = undefined
      existing.disconnectedAt = undefined
      const position = existingIdx + 1
      this.emitQueued(io, existing, position)
      return { ok: true, position, queueLength: this.entries.length }
    }

    if (this.entries.length >= this.maxQueueLength) {
      return { ok: false }
    }

    const entry = {
      identityUserId,
      socketId: socket.id,
      socket,
      clientKind,
      payload,
      reason,
      blockedBy: undefined,
      enqueuedAt: Date.now(),
    }
    this.entries.push(entry)
    const position = this.entries.length
    this.emitQueued(io, entry, position)
    notifyCapacityChanged()
    return { ok: true, position, queueLength: this.entries.length }
  }

  cancelByIdentity(
    io: TypedServer,
    identityUserId: string,
    reason: AdmissionCancelledEvent['reason'],
    message?: string,
  ): boolean {
    const idx = this.entries.findIndex((e) => e.identityUserId === identityUserId)
    if (idx < 0) return false
    const [removed] = this.entries.splice(idx, 1)
    if (removed?.disconnectTimer) clearTimeout(removed.disconnectTimer)
    if (removed) {
      io.sockets.sockets.get(removed.socketId)?.emit(EVENTS.ADMISSION_CANCELLED, { reason, message })
    }
    this.broadcastPositions(io)
    notifyCapacityChanged()
    return true
  }

  /** Remove a queued request when the user enters a room directly. */
  dropByIdentity(io: TypedServer, identityUserId: string, currentSocketId?: string): boolean {
    const idx = this.entries.findIndex((e) => e.identityUserId === identityUserId)
    if (idx < 0) return false
    const [removed] = this.entries.splice(idx, 1)
    if (removed?.disconnectTimer) clearTimeout(removed.disconnectTimer)
    if (removed && removed.socketId !== currentSocketId) {
      io.sockets.sockets.get(removed.socketId)?.emit(EVENTS.ADMISSION_CANCELLED, {
        reason: 'replaced',
        message: '已在其他标签页进入房间',
      })
    }
    this.broadcastPositions(io)
    notifyCapacityChanged()
    return true
  }

  cancelForRoom(io: TypedServer, roomId: string): number {
    let removedCount = 0
    const kept: QueueEntry[] = []
    for (const entry of this.entries) {
      if (entry.payload.action === 'join' && entry.payload.roomId === roomId) {
        if (entry.disconnectTimer) clearTimeout(entry.disconnectTimer)
        io.sockets.sockets.get(entry.socketId)?.emit(EVENTS.ADMISSION_CANCELLED, {
          reason: 'room_closed',
          message: '目标房间已关闭',
        })
        removedCount++
      } else {
        kept.push(entry)
      }
    }
    if (removedCount > 0) {
      this.entries = kept
      this.broadcastPositions(io)
      notifyCapacityChanged()
    }
    return removedCount
  }

  handleDisconnect(io: TypedServer, socketId: string, identityUserId: string): void {
    const entry = this.entries.find((e) => e.identityUserId === identityUserId && e.socketId === socketId)
    if (!entry) return
    if (entry.clientKind === 'mapp') {
      this.dropByIdentity(io, identityUserId, socketId)
      return
    }
    entry.disconnectedAt = Date.now()
    if (entry.disconnectTimer) clearTimeout(entry.disconnectTimer)
    entry.disconnectTimer = setTimeout(() => {
      const idx = this.entries.indexOf(entry)
      if (idx >= 0 && entry.disconnectedAt !== undefined) {
        this.entries.splice(idx, 1)
        this.broadcastPositions(io)
        notifyCapacityChanged()
      }
    }, this.disconnectGraceMs)
    entry.disconnectTimer.unref?.()
  }

  handleReconnect(io: TypedServer, socket: TypedSocket): void {
    const identityUserId = socket.data.identityUserId
    const found = this.findByIdentity(identityUserId)
    if (!found) return
    const { entry, position } = found
    const oldSocket = io.sockets.sockets.get(entry.socketId)
    if (entry.disconnectedAt === undefined || oldSocket?.connected) return
    if (entry.disconnectTimer) {
      clearTimeout(entry.disconnectTimer)
      entry.disconnectTimer = undefined
    }
    entry.socketId = socket.id
    entry.socket = socket
    entry.disconnectedAt = undefined
    this.emitQueued(io, entry, position)
  }

  async drain(
    io: TypedServer,
    canAdmitFn: typeof canAdmitClient = canAdmitClient,
  ): Promise<number> {
    if (!this.executor || this.entries.length === 0) return 0
    if (this.draining) {
      this.drainAgain = true
      return 0
    }
    this.draining = true
    let admitted = 0
    let mutated = false
    try {
      const skippedIdentities = new Set<string>()
      let capacityBlocked = false
      let i = 0
      while (i < this.entries.length) {
        const index = i++
        const entry = this.entries[index]!
        const socket = io.sockets.sockets.get(entry.socketId)
        const expired = Date.now() - entry.enqueuedAt >= MAX_QUEUE_WAIT_MS
        const stale = entry.disconnectedAt === undefined && !socket?.connected
        if (expired || stale) {
          if (entry.disconnectTimer) clearTimeout(entry.disconnectTimer)
          this.entries.splice(index, 1)
          mutated = true
          i = 0
          if (expired && socket?.connected) {
            socket.emit(EVENTS.ADMISSION_CANCELLED, { reason: 'expired', message: '排队等候已超时，请重新尝试' })
          }
          continue
        }
        if (
          !socket?.connected ||
          entry.disconnectedAt !== undefined ||
          capacityBlocked ||
          skippedIdentities.has(entry.identityUserId)
        ) continue

        const existingMapping = entry.payload.action === 'join' ? roomRepo.getSocketMapping(entry.socketId) : undefined
        const roomSwitch = Boolean(
          existingMapping && entry.payload.action === 'join' && existingMapping.roomId !== entry.payload.roomId,
        )
        const decision = canAdmitFn(entry.clientKind, {
          isCreate: entry.payload.action === 'create',
          targetRoomId: entry.payload.action === 'join' ? entry.payload.roomId : undefined,
          ...(roomSwitch ? { roomSwitch: true } : {}),
        })
        if (!decision.allowed) {
          const nextBlockedBy = decision.reason ?? 'capacity'
          if (entry.blockedBy !== nextBlockedBy) {
            entry.blockedBy = nextBlockedBy
            mutated = true
          }
          if (decision.reason && decision.reason !== 'create_restricted' && entry.reason !== decision.reason) {
            entry.reason = decision.reason
            mutated = true
          }
          // Relay, room and creation gates can leave later requests eligible.
          if (decision.reason === 'mapp_stream' || decision.reason === 'mapp_room' || decision.reason === 'create_restricted') {
            skippedIdentities.add(entry.identityUserId)
            continue
          }
          // General server capacity is full; preserve FIFO order so heavier clients aren't starved.
          capacityBlocked = true
          continue
        }

        // Remove before executing so re-entrant broadcasts see the updated queue length.
        this.entries.splice(index, 1)
        mutated = true
        i = 0
        if (entry.disconnectTimer) clearTimeout(entry.disconnectTimer)
        try {
          await this.executor(io, socket, entry)
          admitted++
        } catch (err) {
          logger.error('Queued admission execution failed', err, {
            socketId: entry.socketId,
            action: entry.payload.action,
          })
          socket.emit(EVENTS.ADMISSION_CANCELLED, { reason: 'expired', message: '自动进入房间失败，请重试' })
        }
      }
      if (mutated) {
        this.broadcastPositions(io)
        notifyCapacityChanged(true)
      }
    } finally {
      this.draining = false
      if (this.drainAgain) {
        this.drainAgain = false
        void this.drain(io, canAdmitFn)
      }
    }
    return admitted
  }

  clear(): void {
    for (const entry of this.entries) {
      if (entry.disconnectTimer) clearTimeout(entry.disconnectTimer)
    }
    this.entries = []
  }

  private emitQueued(io: TypedServer, entry: QueuedAdmissionEntry, position: number): void {
    const socket = io.sockets.sockets.get(entry.socketId)
    if (!socket || !socket.connected) return
    socket.emit(EVENTS.ADMISSION_QUEUED, {
      position,
      queueLength: this.entries.length,
      action: entry.payload.action,
      roomId: entry.payload.action === 'join' ? entry.payload.roomId : undefined,
      reason: entry.reason,
      capacity: getPublicServerCapacity(),
    })
  }

  private broadcastPositions(io: TypedServer): void {
    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i]!
      if (entry.disconnectedAt === undefined) {
        this.emitQueued(io, entry, i + 1)
      }
    }
  }
}

export const admissionQueue = new AdmissionQueue()
