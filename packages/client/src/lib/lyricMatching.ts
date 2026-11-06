export function findClosestLyricLine<T extends { startTime: number }>(
  candidates: readonly T[],
  targetStartTime: number,
  maxWindowMs = 500,
): T | undefined {
  let closest: T | undefined
  let minDiff = Infinity

  for (const candidate of candidates) {
    const diff = Math.abs(candidate.startTime - targetStartTime)
    if (diff <= maxWindowMs && diff < minDiff) {
      minDiff = diff
      closest = candidate
      if (diff === 0) {
        break
      }
    }
  }

  return closest
}
