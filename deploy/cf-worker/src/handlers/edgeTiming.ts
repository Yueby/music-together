export function setEdgeTiming(headers: Headers, state: 'HIT' | 'MISS' | 'BYPASS', originMs?: number): void {
  const edge = `edge;desc="${state}"`
  headers.append('Server-Timing', originMs === undefined ? edge : `${edge}, origin;dur=${originMs}`)
}

export function timedBypass(response: Response): Response {
  if (response.status === 101) return response
  const timed = new Response(response.body, response)
  setEdgeTiming(timed.headers, 'BYPASS')
  return timed
}
