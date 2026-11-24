import { monitorEventLoopDelay, performance, type EventLoopUtilization } from 'node:perf_hooks'
import { EVENTS, type AdmissionQueuedEvent, type ClientKind, type ServerCapacityStatus, type ServerLoadLevel } from '@music-together/shared'
import { config } from '../config.js'
import type { TypedServer } from '../middleware/types.js'
import { roomRepo } from '../repositories/roomRepository.js'
import { logger } from '../utils/logger.js'
import { readContainerResourceSample, type ContainerResourceSample } from './containerMetrics.js'
import { getStreamSlotsSnapshot, type StreamSlotsSnapshot } from './platformMediaService.js'

export interface LoadSampleInput {
  memoryRatio: number
  eventLoopDelayP95Ms: number
  eventLoopUtilization: number
  cpuThrottledRatio: number
  streams: StreamSlotsSnapshot
  webInRoom: number
  mappInRoom: number
  mappPeakRoom?: number
  activeRooms: number
  queueLength: number
  now: number
}

export interface AdmissionDecision {
  allowed: boolean
  reason?: AdmissionQueuedEvent['reason'] | 'create_restricted'
}

export interface CapacityControllerConfig {
  enabled: boolean
  minUnits: number
  maxUnits: number
  baseUnits?: number
  mappWeight: number
  relaySlots?: number
  relayMaxQueued?: number
  mappRoomBase?: number
  maxQueue: number
  /** Container limits used to derive initial baseUnits when baseUnits is not explicitly configured. */
  initialMemoryLimitBytes: number
  initialCpuLimitCores: number
}

const EWMA_ALPHA = 0.35
const OVERLOAD_TICKS_TO_SHRINK = 2
const HEALTHY_TICKS_TO_GROW = 5
const MAPP_GROW_COOLDOWN_MS = 30_000
const MAX_RELAY_DEFERRED_SHRINKS = 2
const MIN_ROOMS_FOR_CREATE_RESTRICTION = 5
export const ELD_RESOLUTION_MS = 20

export function normalizeEventLoopDelayMs(p95Ns: number, resolutionMs = ELD_RESOLUTION_MS): number {
  if (!Number.isFinite(p95Ns) || p95Ns <= 0) return 0
  return Math.max(0, p95Ns / 1e6 - resolutionMs)
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function clamp01(value: number): number {
  return clamp(value, 0, 1)
}

function ramp(value: number, low: number, high: number): number {
  if (high <= low) return value >= high ? 1 : 0
  return clamp01((value - low) / (high - low))
}

function mapStreamPressureToPercent(pressure: number): number {
  if (pressure <= 0.45) return 60 * ramp(pressure, 0, 0.45)
  if (pressure <= 0.8) return 60 + 25 * ramp(pressure, 0.45, 0.8)
  return 85 + 15 * ramp(pressure, 0.8, 1)
}

/**
 * Derive an initial weighted-unit baseline from container memory and CPU limits.
 * On the production container (512 MiB RAM, 0.75 CPU), this lands near ~105 units
 * and then adapts continuously via AIMD.
 */
export function deriveBaselineUnits(
  memoryLimitBytes: number,
  cpuLimitCores: number,
  minUnits: number,
  maxUnits: number,
): number {
  const memMb = memoryLimitBytes / (1024 * 1024)
  // Reserve ~140 MiB for Node/V8 runtime + static buffers; ~3.5 MiB per weighted unit headroom.
  const memCap = Math.floor(Math.max(0, memMb - 140) / 3.5)
  // ~140 weighted units per full CPU core (0.75 core -> 105).
  const cpuCap = Math.floor(Math.max(0.25, cpuLimitCores) * 140)
  return clamp(Math.min(memCap, cpuCap), minUnits, maxUnits)
}

/**
 * Pure, deterministic dynamic capacity controller (EWMA smoothing + multi-dimensional pressure + AIMD hysteresis).
 * Separate from timers and OS globals so every transition can be unit-tested deterministically.
 */
export class CapacityController {
  private readonly cfg: CapacityControllerConfig
  private effectiveCap: number
  private readonly relaySlots: number
  private readonly maxMappRoomCap: number
  private mappRoomCap: number
  private initialized = false
  private ewmaMemRatio = 0
  private ewmaElDelayP95Ms = 0
  private ewmaElu = 0
  private ewmaThrottleRatio = 0
  private ewmaMappStreamPressure = 0
  private ewmaRelayUtil = 0
  private overloadTicks = 0
  private healthyTicks = 0
  private mappOverloadTicks = 0
  private mappHealthyTicks = 0
  private mappGrowCooldownUntil = 0
  private relayDeferredShrinks = 0
  private lastGeneralPressure = 0
  private lastMappStreamPressure = 0
  private lastUpdatedAt = 0

  constructor(cfg: CapacityControllerConfig) {
    this.cfg = cfg
    this.relaySlots = cfg.relaySlots ?? 8
    this.maxMappRoomCap = this.relaySlots + (cfg.relayMaxQueued ?? 64)
    this.mappRoomCap = clamp(cfg.mappRoomBase ?? this.relaySlots * 2, this.relaySlots, this.maxMappRoomCap)
    this.effectiveCap = cfg.baseUnits
      ? clamp(cfg.baseUnits, cfg.minUnits, cfg.maxUnits)
      : deriveBaselineUnits(cfg.initialMemoryLimitBytes, cfg.initialCpuLimitCores, cfg.minUnits, cfg.maxUnits)
  }

  private smooth(prev: number, next: number): number {
    return this.initialized ? prev * (1 - EWMA_ALPHA) + next * EWMA_ALPHA : next
  }

  /** Advance one sampling interval (e.g. every 2s) and adjust effectiveCap using AIMD with hysteresis. */
  recordSample(sample: LoadSampleInput): void {
    const maxStreams = Math.max(1, sample.streams.maxStreams)
    const waitRatio = ramp(sample.streams.waitingCount / maxStreams, 0.5, 2.0)
    const waitLatency = ramp(sample.streams.recentWaitP95Ms, 2_000, 7_000)
    const busyPressure = clamp01(sample.streams.recentBusyCount / 2)
    const rawMappStreamPressure = Math.max(waitRatio, waitLatency, busyPressure)

    this.ewmaMemRatio = this.smooth(this.ewmaMemRatio, clamp01(sample.memoryRatio))
    this.ewmaElDelayP95Ms = this.smooth(this.ewmaElDelayP95Ms, Math.max(0, sample.eventLoopDelayP95Ms))
    this.ewmaElu = this.smooth(this.ewmaElu, clamp01(sample.eventLoopUtilization))
    this.ewmaThrottleRatio = this.smooth(this.ewmaThrottleRatio, clamp01(sample.cpuThrottledRatio))
    this.ewmaMappStreamPressure = this.smooth(this.ewmaMappStreamPressure, rawMappStreamPressure)
    const relayUtil = clamp01((sample.streams.activeStreams + sample.streams.waitingCount) / maxStreams)
    this.ewmaRelayUtil = this.smooth(this.ewmaRelayUtil, relayUtil)
    this.initialized = true
    this.lastUpdatedAt = sample.now

    // Compute bottleneck pressure (weakest-link / barrel effect).
    const memPressure = ramp(this.ewmaMemRatio, 0.6, 0.85)
    const elDelayPressure = ramp(this.ewmaElDelayP95Ms, 25, 80)
    const eluPressure = ramp(this.ewmaElu, 0.55, 0.85)
    const throttlePressure = ramp(this.ewmaThrottleRatio, 0.1, 0.35)
    // Immediate memory spike safeguard: if raw RSS/cgroup ratio hits >= 0.88, don't wait for EWMA lag.
    const urgentMemPressure = sample.memoryRatio >= 0.88 ? 1 : 0

    this.lastGeneralPressure = Math.max(memPressure, elDelayPressure, eluPressure, throttlePressure, urgentMemPressure)
    this.lastMappStreamPressure = Math.max(this.ewmaMappStreamPressure, rawMappStreamPressure >= 0.9 ? rawMappStreamPressure : 0)

    const usedUnits = this.computeUsedUnits(sample.webInRoom, sample.mappInRoom)
    const mappPeakRoom = sample.mappPeakRoom ?? sample.mappInRoom
    const shrunkMappThisTick = this.adjustMappRoomCap(sample, mappPeakRoom)

    // AIMD + hysteresis: shrink fast under overload, freeze when elevated, grow slowly when sustainably healthy.
    const relayAttributed = this.ewmaRelayUtil >= 0.5 && urgentMemPressure === 0
    if (this.lastGeneralPressure < 0.65) this.relayDeferredShrinks = 0
    if (this.lastGeneralPressure >= 0.85) {
      this.overloadTicks++
      this.healthyTicks = 0
      if (this.overloadTicks >= OVERLOAD_TICKS_TO_SHRINK || urgentMemPressure === 1) {
        if (relayAttributed && !shrunkMappThisTick) this.shrinkMappRoomCap(mappPeakRoom)
        if (relayAttributed && this.relayDeferredShrinks < MAX_RELAY_DEFERRED_SHRINKS) {
          this.relayDeferredShrinks++
        } else {
          const multiplicative = Math.floor(this.effectiveCap * 0.85)
          const target = Math.min(multiplicative, Math.max(this.cfg.minUnits, Math.floor(usedUnits)))
          this.effectiveCap = clamp(target, this.cfg.minUnits, this.cfg.maxUnits)
        }
        this.overloadTicks = 0
      }
    } else if (this.lastGeneralPressure >= 0.65) {
      // Elevated zone: hold ceiling steady to avoid oscillation.
      this.overloadTicks = 0
      this.healthyTicks = 0
    } else if (this.lastGeneralPressure < 0.5) {
      this.overloadTicks = 0
      this.healthyTicks = usedUnits >= this.effectiveCap * 0.8 ? this.healthyTicks + 1 : 0
      if (this.healthyTicks >= HEALTHY_TICKS_TO_GROW) {
        const step = Math.max(2, Math.ceil(this.effectiveCap * 0.05))
        this.effectiveCap = clamp(this.effectiveCap + step, this.cfg.minUnits, this.cfg.maxUnits)
        this.healthyTicks = 0
      }
    } else {
      // Mid-band (0.50–0.65): clear overload counter without growing yet.
      this.overloadTicks = 0
    }
  }

  private shrinkMappRoomCap(mappPeakRoom: number): void {
    const target = Math.min(Math.floor(this.mappRoomCap * 0.85), Math.max(this.relaySlots, mappPeakRoom))
    this.mappRoomCap = clamp(target, this.relaySlots, this.maxMappRoomCap)
  }

  private adjustMappRoomCap(sample: LoadSampleInput, mappPeakRoom: number): boolean {
    if (this.lastMappStreamPressure >= 0.8) {
      this.mappOverloadTicks++
      this.mappHealthyTicks = 0
      if (this.mappOverloadTicks >= OVERLOAD_TICKS_TO_SHRINK) {
        this.shrinkMappRoomCap(mappPeakRoom)
        this.mappOverloadTicks = 0
        return true
      }
      return false
    }

    this.mappOverloadTicks = 0
    const canGrow =
      this.lastMappStreamPressure < 0.3 &&
      this.lastGeneralPressure < 0.65 &&
      sample.streams.recentWaitP95Ms > 0 &&
      mappPeakRoom >= Math.ceil(this.mappRoomCap * 0.8) &&
      sample.now >= this.mappGrowCooldownUntil
    this.mappHealthyTicks = canGrow ? this.mappHealthyTicks + 1 : 0
    if (this.mappHealthyTicks >= HEALTHY_TICKS_TO_GROW) {
      const step = Math.max(2, Math.ceil(this.mappRoomCap * 0.05))
      this.mappRoomCap = clamp(this.mappRoomCap + step, this.relaySlots, this.maxMappRoomCap)
      this.mappHealthyTicks = 0
      this.mappGrowCooldownUntil = sample.now + MAPP_GROW_COOLDOWN_MS
    }
    return false
  }

  computeUsedUnits(webInRoom: number, mappInRoom: number): number {
    return webInRoom + mappInRoom + (this.cfg.mappWeight - 1) * Math.min(mappInRoom, this.relaySlots)
  }

  private mappMarginalCost(mappInRoom: number): number {
    return mappInRoom < this.relaySlots ? this.cfg.mappWeight : 1
  }

  /**
   * Evaluate whether a client can enter/create a room right now.
   * Rejoins and room switches pass `bypass: true` and are never queued.
   */
  canAdmit(
    clientKind: ClientKind,
    live: {
      webInRoom: number
      mappInRoom: number
      activeRooms: number
      reservedUnits?: number
      mappInTargetRoom?: number
    },
    options?: { isCreate?: boolean; bypass?: boolean; roomSwitch?: boolean },
  ): AdmissionDecision {
    if (!this.cfg.enabled || options?.bypass) return { allowed: true }

    const targetRoomFull =
      clientKind === 'mapp' && !options?.isCreate && (live.mappInTargetRoom ?? 0) + 1 > this.mappRoomCap
    // A room switch has zero net membership cost, but the destination still needs room for the listener.
    if (options?.roomSwitch) {
      return targetRoomFull ? { allowed: false, reason: 'mapp_room' } : { allowed: true }
    }

    const weight = clientKind === 'mapp' ? this.mappMarginalCost(live.mappInRoom) : 1
    const usedUnits = this.computeUsedUnits(live.webInRoom, live.mappInRoom) + (live.reservedUnits ?? 0)

    // Mapp-only audio relay pool isolation: congested audio streams never block web clients.
    if (clientKind === 'mapp' && this.lastMappStreamPressure >= 0.8) {
      return { allowed: false, reason: 'mapp_stream' }
    }

    if (this.lastGeneralPressure >= 0.85 || usedUnits + weight > this.effectiveCap) {
      return { allowed: false, reason: 'capacity' }
    }

    if (targetRoomFull) return { allowed: false, reason: 'mapp_room' }

    if (options?.isCreate && this.isCreateRestricted(live.activeRooms)) {
      return { allowed: false, reason: 'create_restricted' }
    }

    return { allowed: true }
  }

  private isCreateRestricted(activeRooms: number): boolean {
    return this.cfg.enabled && this.lastGeneralPressure >= 0.75 && activeRooms >= MIN_ROOMS_FOR_CREATE_RESTRICTION
  }

  getPublicStatus(live: {
    webInRoom: number
    mappInRoom: number
    activeRooms: number
    queueLength: number
    capacityWaiting?: boolean
    now?: number
  }): ServerCapacityStatus {
    const usedUnits = this.computeUsedUnits(live.webInRoom, live.mappInRoom)
    const remainingUnits = Math.max(0, this.effectiveCap - usedUnits)
    const mappMarginal = this.mappMarginalCost(live.mappInRoom)
    const generalFull = this.cfg.enabled && (this.lastGeneralPressure >= 0.85 || remainingUnits < 1)
    const generalBusy =
      this.cfg.enabled &&
      (this.lastGeneralPressure >= 0.6 || usedUnits >= this.effectiveCap * 0.75 || Boolean(live.capacityWaiting))
    const level: ServerLoadLevel = generalFull ? 'full' : generalBusy ? 'busy' : 'normal'

    const mappFull =
      this.cfg.enabled &&
      (generalFull || this.lastMappStreamPressure >= 0.8 || remainingUnits < mappMarginal)
    const mappBusy =
      this.cfg.enabled &&
      (generalBusy ||
        this.lastMappStreamPressure >= 0.45 ||
        usedUnits + mappMarginal >= this.effectiveCap * 0.75)
    const mappLevel: ServerLoadLevel = mappFull ? 'full' : mappBusy ? 'busy' : 'normal'

    const estimatedWebRemaining = generalFull || live.capacityWaiting ? 0 : Math.floor(remainingUnits)
    const weightedMappSlots = Math.max(0, this.relaySlots - live.mappInRoom)
    const weightedMappUnits = this.cfg.mappWeight * weightedMappSlots
    const availableMappSlots = remainingUnits <= weightedMappUnits
      ? Math.floor(remainingUnits / this.cfg.mappWeight)
      : weightedMappSlots + Math.floor(remainingUnits - weightedMappUnits)
    const estimatedMappRemaining = mappFull || live.capacityWaiting ? 0 : availableMappSlots

    const unitPressure = this.effectiveCap > 0 ? usedUnits / this.effectiveCap : 1
    const rawGeneralPct = Math.round(clamp01(Math.max(this.lastGeneralPressure, unitPressure)) * 100)
    const pressurePercent = Math.max(rawGeneralPct, level === 'full' ? 85 : level === 'busy' ? 60 : 0)
    const mappPressurePercent = Math.max(
      pressurePercent,
      Math.round(mapStreamPressureToPercent(this.lastMappStreamPressure)),
      mappLevel === 'full' ? 85 : mappLevel === 'busy' ? 60 : 0,
    )

    return {
      level,
      mappLevel,
      onlineUsers: live.webInRoom + live.mappInRoom,
      activeRooms: live.activeRooms,
      usedUnits: Math.round(usedUnits),
      effectiveCap: this.effectiveCap,
      estimatedWebRemaining,
      estimatedMappRemaining,
      queueLength: live.queueLength,
      maxQueueLength: this.cfg.maxQueue,
      pressurePercent,
      mappPressurePercent,
      mappRoomLimit: this.mappRoomCap,
      createRestricted: this.isCreateRestricted(live.activeRooms),
      updatedAt: live.now ?? (this.lastUpdatedAt || Date.now()),
    }
  }

  getDiagnostics() {
    return {
      effectiveCap: this.effectiveCap,
      mappRoomCap: this.mappRoomCap,
      ewmaRelayUtil: Number(this.ewmaRelayUtil.toFixed(3)),
      relayDeferredShrinks: this.relayDeferredShrinks,
      ewmaMemRatio: Number(this.ewmaMemRatio.toFixed(3)),
      ewmaElDelayP95Ms: Number(this.ewmaElDelayP95Ms.toFixed(1)),
      ewmaElu: Number(this.ewmaElu.toFixed(3)),
      ewmaThrottleRatio: Number(this.ewmaThrottleRatio.toFixed(3)),
      generalPressure: Number(this.lastGeneralPressure.toFixed(3)),
      mappStreamPressure: Number(this.lastMappStreamPressure.toFixed(3)),
    }
  }
}

// ---------------------------------------------------------------------------
// Live singleton service
// ---------------------------------------------------------------------------

const SAMPLE_INTERVAL_MS = 2_000
const LOG_SNAPSHOT_INTERVAL_MS = 60_000
const BROADCAST_MIN_INTERVAL_MS = 2_000

const PLATFORM_USER_PREFIX = 'mapp_'

export function countInRoomUsers() {
  let webInRoom = 0
  let mappInRoom = 0
  let activeRooms = 0
  let mappPeakRoom = 0
  const mappByRoom = new Map<string, number>()
  for (const [roomId, room] of roomRepo.getAll()) {
    let roomMappCount = 0
    if (room.users.length > 0) activeRooms++
    for (const user of room.users) {
      if (user.id.startsWith(PLATFORM_USER_PREFIX)) roomMappCount++
      else webInRoom++
    }
    if (roomMappCount > 0) {
      mappByRoom.set(roomId, roomMappCount)
      mappInRoom += roomMappCount
      mappPeakRoom = Math.max(mappPeakRoom, roomMappCount)
    }
  }
  return { webInRoom, mappInRoom, activeRooms, mappByRoom, mappPeakRoom }
}

const initialContainer = readContainerResourceSample({
  configuredMemoryLimitMb: config.capacity.memoryLimitMb,
})

const controller = new CapacityController({
  enabled: config.capacity.enabled,
  minUnits: config.capacity.minUnits,
  maxUnits: config.capacity.maxUnits,
  baseUnits: config.capacity.baseUnits,
  mappWeight: config.capacity.mappWeight,
  relaySlots: config.mapp.maxStreams,
  relayMaxQueued: getStreamSlotsSnapshot().maxQueued,
  mappRoomBase: config.capacity.mappRoomBase,
  maxQueue: config.capacity.maxQueue,
  initialMemoryLimitBytes: initialContainer.memoryLimitBytes,
  initialCpuLimitCores: initialContainer.cpuLimitCores,
})

let ioRef: TypedServer | null = null
let sampleTimer: ReturnType<typeof setInterval> | null = null
let elHistogram: ReturnType<typeof monitorEventLoopDelay> | null = null
let prevElu: EventLoopUtilization | null = null
let prevContainer: { sample: ContainerResourceSample; at: number } | null = null
let lastLogAt = 0
let lastBroadcastAt = 0
let lastBroadcastSignature = ''
let queueLengthProvider: () => number = () => 0
let capacityWaitersProvider: () => boolean = () => false
let tickListener: (() => void) | null = null

function statusSignature(status: ServerCapacityStatus): string {
  return [
    status.level,
    status.mappLevel,
    status.onlineUsers,
    status.activeRooms,
    status.effectiveCap,
    status.queueLength,
    status.createRestricted ? 1 : 0,
    Math.round(status.pressurePercent / 5),
    Math.round(status.mappPressurePercent / 5),
    status.mappRoomLimit,
  ].join('|')
}

function sampleOnce(): void {
  const now = Date.now()
  const container = readContainerResourceSample({
    configuredMemoryLimitMb: config.capacity.memoryLimitMb,
  })

  let cpuThrottledRatio = 0
  if (
    prevContainer &&
    container.cpuThrottledUsec !== null &&
    prevContainer.sample.cpuThrottledUsec !== null
  ) {
    const deltaWallUs = Math.max(1, (now - prevContainer.at) * 1000)
    const deltaThrottled = Math.max(0, container.cpuThrottledUsec - prevContainer.sample.cpuThrottledUsec)
    cpuThrottledRatio = clamp01(deltaThrottled / (deltaWallUs * Math.max(0.25, container.cpuLimitCores)))
  }
  prevContainer = { sample: container, at: now }

  let eventLoopDelayP95Ms = 0
  if (elHistogram) {
    eventLoopDelayP95Ms = normalizeEventLoopDelayMs(elHistogram.percentile(95))
    elHistogram.reset()
  }

  let elu = 0
  const currentElu = performance.eventLoopUtilization()
  if (prevElu) {
    elu = performance.eventLoopUtilization(currentElu, prevElu).utilization
  }
  prevElu = currentElu

  const live = countInRoomUsers()
  const streams = getStreamSlotsSnapshot()
  const queueLength = queueLengthProvider()

  controller.recordSample({
    memoryRatio: container.memoryRatio,
    eventLoopDelayP95Ms,
    eventLoopUtilization: elu,
    cpuThrottledRatio,
    streams,
    webInRoom: live.webInRoom,
    mappInRoom: live.mappInRoom,
    mappPeakRoom: live.mappPeakRoom,
    activeRooms: live.activeRooms,
    queueLength,
    now,
  })

  if (tickListener) tickListener()

  const status = getPublicServerCapacity()
  maybeBroadcastCapacity(status, now)

  if (now - lastLogAt >= LOG_SNAPSHOT_INTERVAL_MS && (status.onlineUsers > 0 || status.queueLength > 0 || status.level !== 'normal')) {
    lastLogAt = now
    logger.info('Server load snapshot', {
      source: container.source,
      memMb: Math.round(container.memoryUsedBytes / (1024 * 1024)),
      memLimitMb: Math.round(container.memoryLimitBytes / (1024 * 1024)),
      cpuCores: Number(container.cpuLimitCores.toFixed(2)),
      ...controller.getDiagnostics(),
      webInRoom: live.webInRoom,
      mappInRoom: live.mappInRoom,
      activeRooms: live.activeRooms,
      queueLength: status.queueLength,
      mappActiveStreams: streams.activeStreams,
      mappWaitingStreams: streams.waitingCount,
      level: status.level,
      mappLevel: status.mappLevel,
    })
  }
}

function maybeBroadcastCapacity(status: ServerCapacityStatus, now = Date.now(), force = false): void {
  if (!ioRef) return
  const sig = statusSignature(status)
  if (!force && sig === lastBroadcastSignature) return
  if (!force && now - lastBroadcastAt < BROADCAST_MIN_INTERVAL_MS) return
  lastBroadcastSignature = sig
  lastBroadcastAt = now
  ioRef.emit(EVENTS.SERVER_CAPACITY_UPDATE, status)
}

export function getPublicServerCapacity(): ServerCapacityStatus {
  const live = countInRoomUsers()
  return controller.getPublicStatus({
    ...live,
    queueLength: queueLengthProvider(),
    capacityWaiting: capacityWaitersProvider(),
    now: Date.now(),
  })
}

export function canAdmitClient(
  clientKind: ClientKind,
  options?: { isCreate?: boolean; bypass?: boolean; reservedUnits?: number; targetRoomId?: string; roomSwitch?: boolean },
): AdmissionDecision {
  const live = countInRoomUsers()
  return controller.canAdmit(
    clientKind,
    {
      ...live,
      reservedUnits: options?.reservedUnits,
      mappInTargetRoom: options?.targetRoomId ? live.mappByRoom.get(options.targetRoomId) ?? 0 : 0,
    },
    options,
  )
}

/** Notify connected clients immediately when room membership or queue length changes. */
export function notifyCapacityChanged(force = false): void {
  maybeBroadcastCapacity(getPublicServerCapacity(), Date.now(), force)
}

export function setCapacityQueueHooks(hooks: {
  getQueueLength: () => number
  hasCapacityWaiters?: () => boolean
  onTick: () => void
}): void {
  queueLengthProvider = hooks.getQueueLength
  capacityWaitersProvider = hooks.hasCapacityWaiters ?? (() => false)
  tickListener = hooks.onTick
}

export function startServerLoadMonitor(io: TypedServer): void {
  stopServerLoadMonitor()
  ioRef = io
  elHistogram = monitorEventLoopDelay({ resolution: ELD_RESOLUTION_MS })
  elHistogram.enable()
  prevElu = performance.eventLoopUtilization()
  prevContainer = {
    sample: readContainerResourceSample({ configuredMemoryLimitMb: config.capacity.memoryLimitMb }),
    at: Date.now(),
  }
  sampleOnce()
  sampleTimer = setInterval(sampleOnce, SAMPLE_INTERVAL_MS)
  sampleTimer.unref()
  const { effectiveCap, mappRoomCap, ewmaRelayUtil, relayDeferredShrinks } = controller.getDiagnostics()
  logger.info('Server capacity monitor started', {
    enabled: config.capacity.enabled,
    source: initialContainer.source,
    memLimitMb: Math.round(initialContainer.memoryLimitBytes / (1024 * 1024)),
    cpuLimitCores: Number(initialContainer.cpuLimitCores.toFixed(2)),
    initialEffectiveCap: effectiveCap,
    mappRoomCap,
    ewmaRelayUtil,
    relayDeferredShrinks,
    mappWeight: config.capacity.mappWeight,
    maxQueue: config.capacity.maxQueue,
  })
}

export function stopServerLoadMonitor(): void {
  if (sampleTimer) {
    clearInterval(sampleTimer)
    sampleTimer = null
  }
  if (elHistogram) {
    elHistogram.disable()
    elHistogram = null
  }
  prevElu = null
  prevContainer = null
  ioRef = null
  lastBroadcastSignature = ''
}
