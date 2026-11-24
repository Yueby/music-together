import { describe, expect, it } from 'vitest'
import {
  CapacityController,
  deriveBaselineUnits,
  ELD_RESOLUTION_MS,
  normalizeEventLoopDelayMs,
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

describe('deriveBaselineUnits', () => {
  it('computes ~105 units for a 512 MiB / 0.75 CPU container', () => {
    const cap = deriveBaselineUnits(512 * 1024 * 1024, 0.75, 12, 300)
    expect(cap).toBe(105)
  })
})

describe('CapacityController', () => {
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
