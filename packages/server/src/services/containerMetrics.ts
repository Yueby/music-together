import fs from 'node:fs'
import os from 'node:os'
import v8 from 'node:v8'

export interface ContainerLimits {
  memoryLimitBytes: number
  cpuLimitCores: number
  source: 'cgroup-v2' | 'cgroup-v1' | 'process'
}

export interface ContainerResourceSample {
  memoryUsedBytes: number
  memoryLimitBytes: number
  memoryRatio: number
  cpuLimitCores: number
  /** Cumulative CPU throttled time in microseconds (cgroup v2/v1), or null when unavailable. */
  cpuThrottledUsec: number | null
  source: ContainerLimits['source']
}

export interface FileReader {
  readText(path: string): string | null
}

const defaultReader: FileReader = {
  readText(filePath: string): string | null {
    try {
      return fs.readFileSync(filePath, 'utf8').trim()
    } catch {
      return null
    }
  },
}

/** cgroup v1 reports ~2^63-4096 when no memory limit is set; ignore anything above 1 PiB. */
const UNLIMITED_MEMORY_SENTINEL = 1024 ** 5

function parsePositiveInt(raw: string | null): number | null {
  if (!raw || raw === 'max') return null
  const value = Number.parseInt(raw, 10)
  return Number.isFinite(value) && value > 0 ? value : null
}

function parseCgroupV2CpuCores(raw: string | null): number | null {
  if (!raw) return null
  const [quotaStr, periodStr] = raw.split(/\s+/)
  if (!quotaStr || quotaStr === 'max') return null
  const quota = Number.parseInt(quotaStr, 10)
  const period = Number.parseInt(periodStr ?? '100000', 10)
  if (!Number.isFinite(quota) || !Number.isFinite(period) || quota <= 0 || period <= 0) return null
  return quota / period
}

function readMemoryStat(raw: string | null, key: string): number | null {
  for (const line of raw?.split('\n') ?? []) {
    const [name, value] = line.trim().split(/\s+/)
    if (name === key && value !== undefined) {
      const bytes = Number(value)
      if (Number.isFinite(bytes) && bytes >= 0) return bytes
    }
  }
  return null
}

function parseCgroupCpuThrottledUsec(raw: string | null, mode: 'v2' | 'v1'): number | null {
  if (!raw) return null
  const key = mode === 'v2' ? 'throttled_usec' : 'throttled_time'
  for (const line of raw.split('\n')) {
    const [k, v] = line.trim().split(/\s+/)
    if (k === key && v) {
      const parsed = Number.parseInt(v, 10)
      if (Number.isFinite(parsed) && parsed >= 0) {
        // cgroup v1 `throttled_time` is in nanoseconds; normalize to microseconds.
        return mode === 'v2' ? parsed : Math.floor(parsed / 1000)
      }
    }
  }
  return null
}

function fallbackMemoryLimitBytes(configuredMemoryLimitMb?: number): number {
  if (configuredMemoryLimitMb) return configuredMemoryLimitMb * 1024 * 1024
  const hostMem = os.totalmem()
  const heapLimit = v8.getHeapStatistics().heap_size_limit
  // On non-container hosts, cap the fallback ceiling to a sensible per-Node-process limit so RSS ratio stays meaningful.
  const processOrientedLimit = Math.max(512 * 1024 * 1024, Math.round(heapLimit * 1.25))
  return Math.min(hostMem, processOrientedLimit)
}

/**
 * Reads real container memory & CPU limits (preferring cgroup v2, then cgroup v1, then Node process fallback).
 * Inside Docker (`cpus: 0.75`, `mem_limit: 512m`), `os.totalmem()` and `os.cpus()` still report the host machine;
 * reading cgroup files ensures capacity control reacts to the container's actual quota before OOM or throttling.
 */
export function readContainerResourceSample(options?: {
  reader?: FileReader
  configuredMemoryLimitMb?: number
  rssBytes?: number
  hostCpus?: number
}): ContainerResourceSample {
  const reader = options?.reader ?? defaultReader
  const rssBytes = options?.rssBytes ?? process.memoryUsage().rss
  const hostCpus = Math.max(1, options?.hostCpus ?? (os.cpus().length || 1))

  // --- cgroup v2 ---
  const v2MemMax = parsePositiveInt(reader.readText('/sys/fs/cgroup/memory.max'))
  const v2MemCurrent = parsePositiveInt(reader.readText('/sys/fs/cgroup/memory.current'))
  const v2CpuCores = parseCgroupV2CpuCores(reader.readText('/sys/fs/cgroup/cpu.max'))
  const v2Throttled = parseCgroupCpuThrottledUsec(reader.readText('/sys/fs/cgroup/cpu.stat'), 'v2')

  if (v2MemMax !== null && v2MemMax < UNLIMITED_MEMORY_SENTINEL && v2MemCurrent !== null) {
    const memoryLimitBytes = options?.configuredMemoryLimitMb
      ? Math.min(v2MemMax, options.configuredMemoryLimitMb * 1024 * 1024)
      : v2MemMax
    const inactiveFile = readMemoryStat(reader.readText('/sys/fs/cgroup/memory.stat'), 'inactive_file') ?? 0
    const memoryUsedBytes = Math.max(rssBytes, Math.max(0, v2MemCurrent - inactiveFile))
    return {
      memoryUsedBytes,
      memoryLimitBytes,
      memoryRatio: Math.min(1, memoryUsedBytes / memoryLimitBytes),
      cpuLimitCores: v2CpuCores ? Math.min(v2CpuCores, hostCpus) : hostCpus,
      cpuThrottledUsec: v2Throttled,
      source: 'cgroup-v2',
    }
  }

  // --- cgroup v1 ---
  const v1MemMax = parsePositiveInt(reader.readText('/sys/fs/cgroup/memory/memory.limit_in_bytes'))
  const v1MemCurrent = parsePositiveInt(reader.readText('/sys/fs/cgroup/memory/memory.usage_in_bytes'))
  const v1Quota = parsePositiveInt(reader.readText('/sys/fs/cgroup/cpu/cpu.cfs_quota_us'))
  const v1Period = parsePositiveInt(reader.readText('/sys/fs/cgroup/cpu/cpu.cfs_period_us'))
  const v1CpuCores = v1Quota && v1Period ? v1Quota / v1Period : null
  const v1Throttled = parseCgroupCpuThrottledUsec(reader.readText('/sys/fs/cgroup/cpu/cpu.stat'), 'v1')

  if (v1MemMax !== null && v1MemMax < UNLIMITED_MEMORY_SENTINEL && v1MemCurrent !== null) {
    const memoryLimitBytes = options?.configuredMemoryLimitMb
      ? Math.min(v1MemMax, options.configuredMemoryLimitMb * 1024 * 1024)
      : v1MemMax
    const memoryStat = reader.readText('/sys/fs/cgroup/memory/memory.stat')
    const inactiveFile = readMemoryStat(memoryStat, 'total_inactive_file') ?? readMemoryStat(memoryStat, 'inactive_file') ?? 0
    const memoryUsedBytes = Math.max(rssBytes, Math.max(0, v1MemCurrent - inactiveFile))
    return {
      memoryUsedBytes,
      memoryLimitBytes,
      memoryRatio: Math.min(1, memoryUsedBytes / memoryLimitBytes),
      cpuLimitCores: v1CpuCores ? Math.min(v1CpuCores, hostCpus) : hostCpus,
      cpuThrottledUsec: v1Throttled,
      source: 'cgroup-v1',
    }
  }

  // --- Non-container / Windows / macOS fallback ---
  const memoryLimitBytes = fallbackMemoryLimitBytes(options?.configuredMemoryLimitMb)
  return {
    memoryUsedBytes: rssBytes,
    memoryLimitBytes,
    memoryRatio: Math.min(1, rssBytes / memoryLimitBytes),
    cpuLimitCores: v2CpuCores ?? v1CpuCores ?? hostCpus,
    cpuThrottledUsec: v2Throttled ?? v1Throttled,
    source: 'process',
  }
}
