import { useEffect, useRef } from 'react'
import { EVENTS, NTP } from '@music-together/shared'
import { useSocketContext } from '@/providers/SocketProvider'
import { recordPing, processPong, resetClockSync, isCalibrated, getMedianRTT } from '@/lib/clockSync'

/**
 * Runs the NTP clock-sync loop for the lifetime of the socket connection.
 *
 * Phase 1 (calibration): rapid pings every `NTP.INITIAL_INTERVAL_MS` until
 *   `MAX_INITIAL_SAMPLES` are collected.
 * Phase 2 (steady state): pings every `NTP.STEADY_STATE_INTERVAL_MS` to
 *   track drift.
 */
export function useClockSync(): void {
  const { socket } = useSocketContext()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const switchedRef = useRef(false)

  useEffect(() => {
    // Reset on fresh connection
    resetClockSync()
    switchedRef.current = false

    // --- Pong handler ---
    const onPong = (data: { clientPingId: number; serverTime: number }) => {
      processPong(data.clientPingId, data.serverTime)

      // Switch from fast to slow interval once — only on first calibration
      if (!switchedRef.current && isCalibrated() && intervalRef.current !== null) {
        switchedRef.current = true
        clearInterval(intervalRef.current)
        intervalRef.current = setInterval(sendPing, NTP.STEADY_STATE_INTERVAL_MS)
      }
    }

    socket.on(EVENTS.NTP_PONG, onPong)

    // --- Ping sender (includes last measured RTT for server-side scheduling) ---
    const sendPing = () => {
      const id = recordPing()
      const rtt = getMedianRTT()
      socket.emit(EVENTS.NTP_PING, { clientPingId: id, lastRttMs: rtt > 0 ? rtt : undefined })
    }

    // Start with fast interval
    sendPing() // first ping immediately
    intervalRef.current = setInterval(sendPing, NTP.INITIAL_INTERVAL_MS)

    return () => {
      socket.off(EVENTS.NTP_PONG, onPong)
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      resetClockSync()
    }
  }, [socket])
}
