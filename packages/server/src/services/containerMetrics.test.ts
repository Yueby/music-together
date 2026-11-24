import { describe, expect, it } from 'vitest'
import { readContainerResourceSample, type FileReader } from './containerMetrics.js'

function mockFs(files: Record<string, string>): FileReader {
  return {
    readText(path: string) {
      return path in files ? files[path]! : null
    },
  }
}

describe('readContainerResourceSample', () => {
  it('reads cgroup v2 memory, CPU quota, and throttled_usec', () => {
    const reader = mockFs({
      '/sys/fs/cgroup/memory.max': String(512 * 1024 * 1024),
      '/sys/fs/cgroup/memory.current': String(256 * 1024 * 1024),
      '/sys/fs/cgroup/cpu.max': '75000 100000',
      '/sys/fs/cgroup/cpu.stat': 'usage_usec 123456\nnr_throttled 12\nthrottled_usec 450000\n',
    })

    const sample = readContainerResourceSample({
      reader,
      rssBytes: 120 * 1024 * 1024,
      hostCpus: 4,
    })

    expect(sample.source).toBe('cgroup-v2')
    expect(sample.memoryLimitBytes).toBe(512 * 1024 * 1024)
    expect(sample.memoryUsedBytes).toBe(256 * 1024 * 1024)
    expect(sample.memoryRatio).toBeCloseTo(0.5, 4)
    expect(sample.cpuLimitCores).toBeCloseTo(0.75, 4)
    expect(sample.cpuThrottledUsec).toBe(450000)
  })

  it('falls back to cgroup v1 and normalizes throttled_time from ns to us', () => {
    const reader = mockFs({
      '/sys/fs/cgroup/memory/memory.limit_in_bytes': String(1024 * 1024 * 1024),
      '/sys/fs/cgroup/memory/memory.usage_in_bytes': String(512 * 1024 * 1024),
      '/sys/fs/cgroup/cpu/cpu.cfs_quota_us': '150000',
      '/sys/fs/cgroup/cpu/cpu.cfs_period_us': '100000',
      '/sys/fs/cgroup/cpu/cpu.stat': 'nr_periods 100\nnr_throttled 5\nthrottled_time 25000000\n',
    })

    const sample = readContainerResourceSample({
      reader,
      rssBytes: 100 * 1024 * 1024,
      hostCpus: 8,
    })

    expect(sample.source).toBe('cgroup-v1')
    expect(sample.memoryRatio).toBeCloseTo(0.5, 4)
    expect(sample.cpuLimitCores).toBeCloseTo(1.5, 4)
    expect(sample.cpuThrottledUsec).toBe(25000)
  })

  it('ignores unlimited cgroup v1 sentinel and falls back to process memory limit', () => {
    const reader = mockFs({
      '/sys/fs/cgroup/memory/memory.limit_in_bytes': '9223372036854771712',
      '/sys/fs/cgroup/memory/memory.usage_in_bytes': '104857600',
    })

    const sample = readContainerResourceSample({
      reader,
      configuredMemoryLimitMb: 512,
      rssBytes: 128 * 1024 * 1024,
      hostCpus: 4,
    })

    expect(sample.source).toBe('process')
    expect(sample.memoryLimitBytes).toBe(512 * 1024 * 1024)
    expect(sample.memoryRatio).toBeCloseTo(0.25, 4)
  })

  it('subtracts cgroup v2 inactive file cache', () => {
    const mib = 1024 * 1024
    const sample = readContainerResourceSample({
      reader: mockFs({
        '/sys/fs/cgroup/memory.max': String(512 * mib),
        '/sys/fs/cgroup/memory.current': String(384 * mib),
        '/sys/fs/cgroup/memory.stat': `file ${256 * mib}\ninactive_file ${128 * mib}\n`,
      }),
      rssBytes: 120 * mib,
    })

    expect(sample.memoryUsedBytes).toBe(256 * mib)
    expect(sample.memoryRatio).toBe(0.5)
  })

  it.each(['total_inactive_file', 'inactive_file'])('subtracts cgroup v1 %s without falling below RSS', (key) => {
    const mib = 1024 * 1024
    const reader = mockFs({
      '/sys/fs/cgroup/memory/memory.limit_in_bytes': String(512 * mib),
      '/sys/fs/cgroup/memory/memory.usage_in_bytes': String(384 * mib),
      '/sys/fs/cgroup/memory/memory.stat': `${key} ${192 * mib}\n`,
    })

    expect(readContainerResourceSample({ reader, rssBytes: 100 * mib }).memoryUsedBytes).toBe(192 * mib)
    expect(readContainerResourceSample({ reader, rssBytes: 224 * mib }).memoryUsedBytes).toBe(224 * mib)
  })
})
