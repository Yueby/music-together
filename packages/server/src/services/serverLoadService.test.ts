import { describe, expect, it } from 'vitest'
import {
  CapacityController,
  deriveBaselineUnits,
  ELD_RESOLUTION_MS,
  normalizeEventLoopDelayMs,
  type CapacityControllerConfig,
  type LoadSampleInput,
} from './serverLoadService.js'

const IDLE_STREAMS = {
  activeStreams: 0,
  maxStreams: 8,
  waitingCount: 0,
  maxQueued: 64,
  recentWaitP95Ms: 0,
  recentBusyCount: 0,
}

function makeSample(overrides: Partial<LoadSampleInput> = {}): LoadSampleInput {
  return {
    memoryRatio: 0.35,
    eventLoopDelayP95Ms: 5,
    eventLoopUtilization: 0.15,
    cpuThrottledRatio: 0,
    streams: IDLE_STREAMS,
    webInRoom: 10,
    mappInRoom: 2,
    activeRooms: 3,
    queueLength: 0,
    now: 1_000,
    ...overrides,
  }
}

function makeController(overrides: Partial<CapacityControllerConfig> = {}) {
  return new CapacityController({
    enabled: true,
    minUnits: 12,
    maxUnits: 300,
    baseUnits: 100,
    mappWeight: 3,
    maxQueue: 100,
    initialMemoryLimitBytes: 512 * 1024 * 1024,
    initialCpuLimitCores: 0.75,
    ...overrides,
  })
}

function recordTicks(ctrl: CapacityController, sample: LoadSampleInput, ticks: number) {
  for (let tick = 0; tick < ticks; tick++) {
    ctrl.recordSample({ ...sample, now: sample.now + tick * 2_000 })
  }
}

describe('deriveBaselineUnits', () => {
  it('computes ~105 units for a 512 MiB / 0.75 CPU container', () => {
    const cap = deriveBaselineUnits(512 * 1024 * 1024, 0.75, 12, 300)
    expect(cap).toBe(105)
  })
})

describe('CapacityController', () => {
  it('caps relay overhead and charges one unit after the relay slots are accounted for', () => {
    const ctrl = makeController({ baseUnits: 30 })
    expect(ctrl.computeUsedUnits(5, 7)).toBe(5 + 7 * 3)
    expect(ctrl.computeUsedUnits(5, 8)).toBe(5 + 8 * 3)
    expect(ctrl.computeUsedUnits(5, 9)).toBe(5 + 9 + 2 * 8)
    expect(ctrl.canAdmit('mapp', { webInRoom: 7, mappInRoom: 7, activeRooms: 1 })).toEqual({
      allowed: false,
      reason: 'capacity',
    })
    expect(ctrl.canAdmit('mapp', { webInRoom: 6, mappInRoom: 7, activeRooms: 1 })).toEqual({ allowed: true })
    expect(ctrl.canAdmit('mapp', { webInRoom: 5, mappInRoom: 8, activeRooms: 1 })).toEqual({ allowed: true })
    expect(ctrl.canAdmit('mapp', { webInRoom: 4, mappInRoom: 9, activeRooms: 1 })).toEqual({ allowed: true })
  })

  it.each([
    { webInRoom: 0, mappInRoom: 0 },
    { webInRoom: 94, mappInRoom: 1 },
    { webInRoom: 76, mappInRoom: 7 },
    { webInRoom: 77, mappInRoom: 7 },
    { webInRoom: 74, mappInRoom: 8 },
    { webInRoom: 15, mappInRoom: 20 },
    { webInRoom: 64, mappInRoom: 20 },
  ])('estimates successive admissions from %j across the relay boundary', (counts) => {
    const ctrl = makeController()
    const live = { ...counts, activeRooms: 3, queueLength: 0 }
    const status = ctrl.getPublicStatus(live)

    for (const kind of ['web', 'mapp'] as const) {
      const current = { ...live }
      let admitted = 0
      while (admitted <= status.effectiveCap && ctrl.canAdmit(kind, current).allowed) {
        if (kind === 'web') current.webInRoom++
        else current.mappInRoom++
        admitted++
      }
      expect(admitted).toBe(kind === 'web' ? status.estimatedWebRemaining : status.estimatedMappRemaining)
    }
  })

  it.each([
    { recentWaitP95Ms: 4_250, expectedLevel: 'busy', minPercent: 60 },
    { recentWaitP95Ms: 6_000, expectedLevel: 'full', minPercent: 85 },
  ])('reports consistent mini-app pressure and $expectedLevel level', ({ recentWaitP95Ms, expectedLevel, minPercent }) => {
    const ctrl = makeController()
    const sample = makeSample({ streams: { ...IDLE_STREAMS, recentWaitP95Ms } })
    ctrl.recordSample(sample)
    const status = ctrl.getPublicStatus(sample)

    expect(status.level).toBe('normal')
    expect(status.mappLevel).toBe(expectedLevel)
    expect(status.mappPressurePercent).toBe(minPercent)
    expect(status.mappPressurePercent).toBeGreaterThan(status.pressurePercent)
    if (expectedLevel === 'full') expect(status.estimatedMappRemaining).toBe(0)
    else expect(status.estimatedMappRemaining).toBeGreaterThan(0)
  })

  it('shows zero available places and a busy level when there are general capacity waiters', () => {
    const ctrl = makeController()
    const sample = makeSample({ queueLength: 1 })
    expect(ctrl.getPublicStatus(sample)).toMatchObject({ level: 'normal', mappLevel: 'normal' })
    expect(ctrl.getPublicStatus({ ...sample, capacityWaiting: true })).toMatchObject({
      level: 'busy',
      mappLevel: 'busy',
      estimatedWebRemaining: 0,
      estimatedMappRemaining: 0,
      pressurePercent: 60,
      mappPressurePercent: 60,
    })
  })

  it('applies the room limit only to new mini-app joins in the saturated room', () => {
    const ctrl = makeController()
    const live = { webInRoom: 5, mappInRoom: 16, mappInTargetRoom: 16, activeRooms: 2 }
    expect(ctrl.getPublicStatus({ ...live, queueLength: 0 }).mappRoomLimit).toBe(16)
    expect(ctrl.canAdmit('mapp', live)).toEqual({ allowed: false, reason: 'mapp_room' })
    expect(ctrl.canAdmit('web', live)).toEqual({ allowed: true })
    expect(ctrl.canAdmit('mapp', { ...live, mappInTargetRoom: 15 })).toEqual({ allowed: true })
    expect(ctrl.canAdmit('mapp', live, { isCreate: true })).toEqual({ allowed: true })
    const atCapacity = { ...live, webInRoom: 10_000 }
    expect(ctrl.canAdmit('mapp', atCapacity)).toEqual({ allowed: false, reason: 'capacity' })
    expect(ctrl.canAdmit('mapp', atCapacity, { roomSwitch: true })).toEqual({ allowed: false, reason: 'mapp_room' })
    expect(ctrl.canAdmit('mapp', { ...atCapacity, mappInTargetRoom: 15 }, { roomSwitch: true })).toEqual({ allowed: true })
    expect(ctrl.canAdmit('mapp', live, { bypass: true })).toEqual({ allowed: true })
  })

  it.each([
    { mappRoomBase: 1, expectedLimit: 8 },
    { mappRoomBase: 30, expectedLimit: 18 },
  ])('clamps room base $mappRoomBase to the relay slot and queue bounds', ({ mappRoomBase, expectedLimit }) => {
    const ctrl = makeController({ mappRoomBase, relayMaxQueued: 10 })
    expect(ctrl.getDiagnostics().mappRoomCap).toBe(expectedLimit)
  })

  it('shrinks only the room limit when relay pressure is sustained', () => {
    const ctrl = makeController()
    const sample = makeSample({
      mappInRoom: 30,
      mappPeakRoom: 10,
      streams: { ...IDLE_STREAMS, activeStreams: 8, recentBusyCount: 2 },
    })
    ctrl.recordSample(sample)
    expect(ctrl.getDiagnostics()).toMatchObject({ mappRoomCap: 16, effectiveCap: 100 })
    ctrl.recordSample(sample)
    expect(ctrl.getDiagnostics()).toMatchObject({ mappRoomCap: 10, effectiveCap: 100 })
    recordTicks(ctrl, sample, 4)
    expect(ctrl.getDiagnostics()).toMatchObject({ mappRoomCap: 8, effectiveCap: 100 })
  })

  it('defers two general shrinks to the room limit while relay utilization is high', () => {
    const ctrl = makeController({ mappRoomBase: 32 })
    const sample = makeSample({
      eventLoopDelayP95Ms: 80,
      webInRoom: 50,
      mappInRoom: 28,
      streams: { ...IDLE_STREAMS, activeStreams: 3, waitingCount: 1 },
    })

    recordTicks(ctrl, sample, 2)
    expect(ctrl.canAdmit('web', sample)).toEqual({ allowed: false, reason: 'capacity' })
    expect(ctrl.getDiagnostics()).toMatchObject({
      mappRoomCap: 27, effectiveCap: 100, ewmaRelayUtil: 0.5, relayDeferredShrinks: 1,
    })
    recordTicks(ctrl, sample, 2)
    expect(ctrl.getDiagnostics()).toMatchObject({ mappRoomCap: 22, effectiveCap: 100, relayDeferredShrinks: 2 })
    recordTicks(ctrl, sample, 2)
    expect(ctrl.getDiagnostics()).toMatchObject({ mappRoomCap: 18, effectiveCap: 85, relayDeferredShrinks: 2 })
  })

  it('shrinks general capacity immediately at the urgent memory threshold even under relay load', () => {
    const ctrl = makeController()
    const sample = makeSample({ streams: { ...IDLE_STREAMS, activeStreams: 8 } })
    ctrl.recordSample(sample)
    ctrl.recordSample({ ...sample, memoryRatio: 0.88 })
    expect(ctrl.getDiagnostics()).toMatchObject({
      effectiveCap: 16, mappRoomCap: 16, ewmaRelayUtil: 1, relayDeferredShrinks: 0,
    })
  })

  it('shrinks general capacity after two overload ticks when the relay is idle', () => {
    const ctrl = makeController()
    const sample = makeSample({ eventLoopDelayP95Ms: 80 })
    ctrl.recordSample(sample)
    expect(ctrl.getDiagnostics().effectiveCap).toBe(100)
    ctrl.recordSample(sample)
    expect(ctrl.getDiagnostics()).toMatchObject({ effectiveCap: 16, mappRoomCap: 16, relayDeferredShrinks: 0 })
  })

  it('resets relay deferrals after general pressure cools below 0.65', () => {
    const ctrl = makeController({ mappRoomBase: 32 })
    const sample = makeSample({
      eventLoopUtilization: 0.85,
      mappInRoom: 28,
      streams: { ...IDLE_STREAMS, activeStreams: 8 },
    })
    recordTicks(ctrl, sample, 4)
    expect(ctrl.getDiagnostics().relayDeferredShrinks).toBe(2)
    ctrl.recordSample({ ...sample, eventLoopUtilization: 0 })
    expect(ctrl.getDiagnostics().relayDeferredShrinks).toBe(0)
    recordTicks(ctrl, sample, 6)
    expect(ctrl.getDiagnostics()).toMatchObject({ effectiveCap: 100, relayDeferredShrinks: 1 })
  })

  it.each([
    { memoryRatio: 0.35, mappPeakRoom: 13, recentWaitP95Ms: 0 },
    { memoryRatio: 0.35, mappPeakRoom: 12, recentWaitP95Ms: 500 },
    { memoryRatio: 0.78, mappPeakRoom: 13, recentWaitP95Ms: 500 },
    { memoryRatio: 0.35, mappPeakRoom: 13, recentWaitP95Ms: 4_000 },
  ])('holds the room limit when growth prerequisites are unmet for %j', ({ memoryRatio, mappPeakRoom, recentWaitP95Ms }) => {
    const ctrl = makeController()
    recordTicks(ctrl, makeSample({
      memoryRatio,
      mappInRoom: 20,
      mappPeakRoom,
      streams: { ...IDLE_STREAMS, recentWaitP95Ms },
    }), 6)
    expect(ctrl.getDiagnostics().mappRoomCap).toBe(16)
  })

  it('requires five eligible ticks to grow the room limit and enforces a 30s cooldown', () => {
    const ctrl = makeController()
    const sample = makeSample({
      mappInRoom: 15,
      mappPeakRoom: 15,
      streams: { ...IDLE_STREAMS, recentWaitP95Ms: 500 },
    })
    recordTicks(ctrl, sample, 4)
    expect(ctrl.getDiagnostics().mappRoomCap).toBe(16)
    ctrl.recordSample({ ...sample, now: 9_000 })
    expect(ctrl.getDiagnostics().mappRoomCap).toBe(18)
    recordTicks(ctrl, { ...sample, now: 11_000 }, 14)
    expect(ctrl.getDiagnostics().mappRoomCap).toBe(18)
    recordTicks(ctrl, { ...sample, now: 39_000 }, 4)
    expect(ctrl.getDiagnostics().mappRoomCap).toBe(18)
    ctrl.recordSample({ ...sample, now: 47_000 })
    expect(ctrl.getDiagnostics().mappRoomCap).toBe(20)
  })

  it('grows only after healthy samples at or above 80% utilization', () => {
    const ctrl = new CapacityController({
      enabled: true,
      minUnits: 12,
      maxUnits: 300,
      baseUnits: 100,
      mappWeight: 3,
      maxQueue: 100,
      initialMemoryLimitBytes: 512 * 1024 * 1024,
      initialCpuLimitCores: 0.75,
    })
    const atThreshold = makeSample({ webInRoom: 80, mappInRoom: 0 })
    for (let i = 0; i < 4; i++) ctrl.recordSample(atThreshold)
    for (let i = 0; i < 10; i++) ctrl.recordSample(makeSample({ webInRoom: 0, mappInRoom: 0 }))
    for (let i = 0; i < 4; i++) ctrl.recordSample(atThreshold)
    expect(ctrl.getDiagnostics().effectiveCap).toBe(100)

    ctrl.recordSample(atThreshold)
    expect(ctrl.getDiagnostics().effectiveCap).toBe(105)
  })

  it('shrinks effectiveCap on sustained overload and recovers slowly when healthy', () => {
    const ctrl = new CapacityController({
      enabled: true,
      minUnits: 12,
      maxUnits: 300,
      baseUnits: 100,
      mappWeight: 3,
      maxQueue: 100,
      initialMemoryLimitBytes: 512 * 1024 * 1024,
      initialCpuLimitCores: 0.75,
    })

    // First sample initializes EWMA in healthy state
    ctrl.recordSample(makeSample({ memoryRatio: 0.4, webInRoom: 20, mappInRoom: 5 }))
    expect(ctrl.getDiagnostics().effectiveCap).toBe(100)

    // Sustained severe memory pressure (>= 0.88 triggers immediate safeguard)
    ctrl.recordSample(makeSample({ memoryRatio: 0.9, webInRoom: 20, mappInRoom: 5, now: 3_000 }))
    const shrunk = ctrl.getDiagnostics().effectiveCap
    expect(shrunk).toBeLessThan(100)
    expect(shrunk).toBe(35) // clamped to usedUnits = 20 + 5*3 = 35

    // Must refuse new non-bypass clients while overloaded
    const refused = ctrl.canAdmit('web', { webInRoom: 20, mappInRoom: 5, activeRooms: 3 })
    expect(refused).toEqual({ allowed: false, reason: 'capacity' })

    // Rejoin / room-switch bypass always passes
    expect(ctrl.canAdmit('web', { webInRoom: 20, mappInRoom: 5, activeRooms: 3 }, { bypass: true })).toEqual({
      allowed: true,
    })

    // Feed healthy ticks until EWMA cools below 0.5 and 5 healthy ticks elapse -> additive recovery
    for (let i = 0; i < 12; i++) {
      ctrl.recordSample(makeSample({ memoryRatio: 0.3, webInRoom: 35, mappInRoom: 0, now: 5_000 + i * 2_000 }))
    }
    expect(ctrl.getDiagnostics().effectiveCap).toBeGreaterThan(shrunk)
    expect(ctrl.getDiagnostics().effectiveCap).toBeLessThan(100) // slow additive growth, not instant jump
  })

  it('isolates mini-app stream congestion without blocking web users', () => {
    const ctrl = new CapacityController({
      enabled: true,
      minUnits: 12,
      maxUnits: 300,
      baseUnits: 100,
      mappWeight: 3,
      maxQueue: 100,
      initialMemoryLimitBytes: 512 * 1024 * 1024,
      initialCpuLimitCores: 0.75,
    })

    ctrl.recordSample(
      makeSample({
        memoryRatio: 0.35,
        eventLoopDelayP95Ms: 8,
        streams: {
          activeStreams: 8,
          maxStreams: 8,
          waitingCount: 20,
          maxQueued: 64,
          recentWaitP95Ms: 8_000,
          recentBusyCount: 3,
        },
      }),
    )

    const live = { webInRoom: 5, mappInRoom: 5, activeRooms: 2 }
    expect(ctrl.canAdmit('mapp', live)).toEqual({ allowed: false, reason: 'mapp_stream' })
    expect(ctrl.canAdmit('web', live)).toEqual({ allowed: true })

    const status = ctrl.getPublicStatus({ ...live, queueLength: 1 })
    expect(status.level).toBe('normal')
    expect(status.mappLevel).toBe('full')
    expect(status.estimatedWebRemaining).toBeGreaterThan(0)
    expect(status.estimatedMappRemaining).toBe(0)
  })

  it('enables soft create restriction when general pressure is elevated with many active rooms', () => {
    const ctrl = new CapacityController({
      enabled: true,
      minUnits: 12,
      maxUnits: 300,
      baseUnits: 100,
      mappWeight: 3,
      maxQueue: 100,
      initialMemoryLimitBytes: 512 * 1024 * 1024,
      initialCpuLimitCores: 0.75,
    })

    // ~0.80 general pressure (memoryRatio 0.80 -> (0.80-0.60)/0.25 = 0.80)
    ctrl.recordSample(makeSample({ memoryRatio: 0.8, webInRoom: 10, mappInRoom: 0, activeRooms: 6 }))

    const live = { webInRoom: 10, mappInRoom: 0, activeRooms: 6 }
    expect(ctrl.canAdmit('web', live, { isCreate: true })).toEqual({ allowed: false, reason: 'create_restricted' })
    expect(ctrl.canAdmit('web', live, { isCreate: false })).toEqual({ allowed: true })
    expect(ctrl.getPublicStatus({ ...live, queueLength: 0 }).createRestricted).toBe(true)
  })

  it('does not double-shrink mappRoomCap when stream and general overload fire on the same tick', () => {
    const ctrl = new CapacityController({
      enabled: true,
      minUnits: 12,
      maxUnits: 300,
      baseUnits: 100,
      mappWeight: 3,
      relaySlots: 8,
      mappRoomBase: 30,
      maxQueue: 100,
      initialMemoryLimitBytes: 512 * 1024 * 1024,
      initialCpuLimitCores: 0.75,
    })

    const combinedOverload = makeSample({
      memoryRatio: 0.85,
      webInRoom: 10,
      mappInRoom: 28,
      mappPeakRoom: 28,
      streams: {
        activeStreams: 8,
        maxStreams: 8,
        waitingCount: 16,
        maxQueued: 64,
        recentWaitP95Ms: 8_000,
        recentBusyCount: 2,
      },
    })
    ctrl.recordSample({ ...combinedOverload, now: 1_000 })
    ctrl.recordSample({ ...combinedOverload, now: 3_000 })

    // Single 0.85x shrink: floor(30 * 0.85) = 25 (NOT double-shrunk to floor(25 * 0.85) = 21)
    expect(ctrl.getDiagnostics().mappRoomCap).toBe(25)
    expect(ctrl.getDiagnostics().effectiveCap).toBe(100)
    expect(ctrl.getDiagnostics().relayDeferredShrinks).toBe(1)
  })

  it('unlocks mappRoomCap in edge-relay mode and grows on demand without StreamSlots waits', () => {
    const defaultEdge = makeController({ edgeRelayEnabled: true, mappWeight: 1, baseUnits: 100, maxUnits: 300 })
    expect(defaultEdge.getDiagnostics()).toMatchObject({ mappRoomCap: 100, edgeRelayActive: true })

    const highBase = makeController({
      edgeRelayEnabled: true,
      mappWeight: 1,
      baseUnits: 100,
      maxUnits: 300,
      mappRoomBase: 120,
      relayMaxQueued: 10,
    })
    expect(highBase.getDiagnostics().mappRoomCap).toBe(120)

    const sample = makeSample({
      webInRoom: 0,
      mappInRoom: 85,
      mappPeakRoom: 85,
      streams: { ...IDLE_STREAMS, recentWaitP95Ms: 0, recentEdgeResolveCount: 12, recentFallbackCount: 0 },
    })
    recordTicks(defaultEdge, sample, 4)
    expect(defaultEdge.getDiagnostics().mappRoomCap).toBe(100)
    defaultEdge.recordSample({ ...sample, now: 9_000 })
    expect(defaultEdge.getDiagnostics().mappRoomCap).toBe(105)
  })

  it('drops out of edge-relay active state and protects Web under fallback-v1 congestion', () => {
    const ctrl = makeController({ edgeRelayEnabled: true, mappWeight: 1, mappRoomBase: 64 })
    const fallbackOverload = makeSample({
      webInRoom: 10,
      mappInRoom: 20,
      mappPeakRoom: 12,
      streams: {
        ...IDLE_STREAMS,
        activeStreams: 8,
        waitingCount: 12,
        recentWaitP95Ms: 6_500,
        recentBusyCount: 2,
        recentFallbackCount: 5,
      },
    })
    recordTicks(ctrl, fallbackOverload, 2)
    expect(ctrl.getDiagnostics()).toMatchObject({ edgeRelayActive: false, mappRoomCap: 12 })
    expect(ctrl.canAdmit('mapp', fallbackOverload)).toEqual({ allowed: false, reason: 'mapp_stream' })
    expect(ctrl.canAdmit('web', fallbackOverload)).toEqual({ allowed: true })
  })

  it('self-heals effectiveCap back to baseline when healthy even while idle, without overshooting baseline', () => {
    const ctrl = makeController({ baseUnits: 100, mappWeight: 1 })
    ctrl.recordSample(makeSample({ memoryRatio: 0.4, webInRoom: 10, mappInRoom: 0, now: 1_000 }))
    ctrl.recordSample(makeSample({ memoryRatio: 0.9, webInRoom: 10, mappInRoom: 0, now: 3_000 }))
    expect(ctrl.getDiagnostics().effectiveCap).toBe(12)

    // Traffic drops well below 80% of shrunk cap; sustained healthy ticks should recover back to 100 and stop there.
    const idleHealthy = makeSample({ memoryRatio: 0.25, webInRoom: 2, mappInRoom: 0, now: 5_000 })
    recordTicks(ctrl, idleHealthy, 25)
    expect(ctrl.getDiagnostics().effectiveCap).toBeGreaterThan(12)
    expect(ctrl.getDiagnostics().effectiveCap).toBeLessThanOrEqual(100)

    recordTicks(ctrl, { ...idleHealthy, now: 60_000 }, 200)
    expect(ctrl.getDiagnostics().effectiveCap).toBe(100)
  })

  it('self-heals mappRoomCap back to baseline after transient relay pressure clears, and pauses on fallbacks', () => {
    const ctrl = makeController({ edgeRelayEnabled: true, mappWeight: 1, mappRoomBase: 48 })
    const burst = makeSample({
      mappInRoom: 32,
      mappPeakRoom: 32,
      streams: { ...IDLE_STREAMS, activeStreams: 8, recentBusyCount: 2, recentFallbackCount: 2 },
      now: 1_000,
    })
    recordTicks(ctrl, burst, 2)
    expect(ctrl.getDiagnostics().mappRoomCap).toBe(32)

    // While recentFallbackCount > 0, do not heal back up yet.
    const stillFallingBack = makeSample({
      mappInRoom: 4,
      mappPeakRoom: 4,
      streams: { ...IDLE_STREAMS, recentFallbackCount: 1 },
      now: 5_000,
    })
    recordTicks(ctrl, stillFallingBack, 20)
    expect(ctrl.getDiagnostics().mappRoomCap).toBe(32)

    // Once fallbacks and StreamSlots pressure clear, heal smoothly back toward 48 without requiring recentWaitP95Ms > 0.
    const clean = makeSample({
      mappInRoom: 4,
      mappPeakRoom: 4,
      streams: { ...IDLE_STREAMS, recentEdgeResolveCount: 4, recentFallbackCount: 0 },
      now: 50_000,
    })
    recordTicks(ctrl, clean, 20)
    const healed = ctrl.getDiagnostics().mappRoomCap
    expect(healed).toBeGreaterThan(32)
    expect(healed).toBeLessThanOrEqual(48)
    expect(ctrl.getDiagnostics()).toMatchObject({ edgeRelayActive: false, edgeRelayDegraded: true })

    recordTicks(ctrl, { ...clean, now: 90_000 }, 110)
    expect(ctrl.getDiagnostics()).toMatchObject({ edgeRelayActive: false, edgeRelayDegraded: true, mappRoomCap: 48 })

    ctrl.recordSample({ ...clean, now: 343_000 })
    expect(ctrl.getDiagnostics()).toMatchObject({ edgeRelayActive: true, edgeRelayDegraded: false, mappRoomCap: 48 })
  })

  it('limits room capacity to VPS streaming capacity during Cloudflare Fail Open and recovers after the window', () => {
    const ctrl = makeController({ edgeRelayEnabled: true, mappWeight: 1, baseUnits: 105, maxUnits: 300 })
    expect(ctrl.getDiagnostics()).toMatchObject({ edgeRelayActive: true, edgeRelayDegraded: false, mappRoomCap: 105 })

    const bypass = makeSample({ streams: { ...IDLE_STREAMS, recentBypassCount: 2, recentFallbackCount: 0 } })
    ctrl.recordSample(bypass)
    expect(ctrl.getDiagnostics()).toMatchObject({ edgeRelayActive: false, edgeRelayDegraded: true, mappRoomCap: 89 })
    recordTicks(ctrl, { ...bypass, now: 3_000 }, 2)
    expect(ctrl.getDiagnostics().mappRoomCap).toBe(72)

    recordTicks(ctrl, makeSample({
      now: 7_000,
      mappInRoom: 70,
      streams: { ...IDLE_STREAMS, recentBusyCount: 2 },
    }), 2)
    expect(ctrl.getDiagnostics().mappRoomCap).toBe(61)

    const idle = makeSample({ streams: { ...IDLE_STREAMS, recentBypassCount: 0, recentFallbackCount: 0 } })
    for (let now = 11_000; now < 305_000; now += 2_000) {
      ctrl.recordSample({ ...idle, now })
      expect(ctrl.getDiagnostics().mappRoomCap).toBeLessThanOrEqual(72)
    }
    expect(ctrl.getDiagnostics()).toMatchObject({ edgeRelayActive: false, edgeRelayDegraded: true, mappRoomCap: 72 })

    // Silence alone after the 5-minute window must not exit degradation without positive edge-resolve proof.
    recordTicks(ctrl, { ...idle, now: 305_000 }, 20)
    expect(ctrl.getDiagnostics()).toMatchObject({ edgeRelayActive: false, edgeRelayDegraded: true, mappRoomCap: 72 })

    // Once Worker serves resolve-v1 again after the window, exit degradation and heal back to 105.
    ctrl.recordSample({ ...idle, now: 347_000, streams: { ...IDLE_STREAMS, recentEdgeResolveCount: 1 } })
    expect(ctrl.getDiagnostics()).toMatchObject({ edgeRelayActive: true, edgeRelayDegraded: false })
    recordTicks(ctrl, { ...idle, now: 349_000 }, 210)
    expect(ctrl.getDiagnostics().mappRoomCap).toBe(105)
  })
})

describe('normalizeEventLoopDelayMs', () => {
  it('subtracts the histogram resolution from the p95 reading', () => {
    expect(ELD_RESOLUTION_MS).toBe(20)
    expect(normalizeEventLoopDelayMs(27_500_000)).toBe(7.5)
    expect(normalizeEventLoopDelayMs(15_000_000)).toBe(0)
    expect(normalizeEventLoopDelayMs(15_000_000, 10)).toBe(5)
  })

  it.each([NaN, Infinity, 0, -1])('returns zero for unusable p95 %s', (p95Ns) => {
    expect(normalizeEventLoopDelayMs(p95Ns)).toBe(0)
  })
})
