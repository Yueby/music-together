import { useEffect, useRef } from 'react'
import { EVENTS, NTP } from '@music-together/shared'
import { useSocketContext } from '@/providers/SocketProvider'
import { recordPing, processPong, resetClockSync, isCalibrated, getMedianRTT } from '@/lib/clockSync'

const VISIBILITY_SYNC_COOLDOWN_MS = 2_000

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
    const clearPingInterval = () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    const startCalibration = () => {
      resetClockSync()
      switchedRef.current = false
      clearPingInterval()
      sendPing()
      intervalRef.current = setInterval(sendPing, NTP.INITIAL_INTERVAL_MS)
    }

    // --- Pong handler ---
    const onPong = (data: { clientPingId: number; serverTime: number }) => {
      const rtt = processPong(data.clientPingId, data.serverTime)
      if (rtt === null) return

      // Switch from fast to slow interval once — only on first calibration
      if (!switchedRef.current && isCalibrated() && intervalRef.current !== null) {
        switchedRef.current = true
        clearInterval(intervalRef.current)
        intervalRef.current = setInterval(sendPing, NTP.STEADY_STATE_INTERVAL_MS)
      }
    }

    // --- Ping sender (includes last measured RTT for server-side scheduling) ---
    function sendPing() {
      if (!socket.connected) return
      const id = recordPing()
      const rtt = getMedianRTT()
      socket.emit(EVENTS.NTP_PING, { clientPingId: id, lastRttMs: rtt > 0 ? rtt : undefined })
    }

    const onConnect = () => startCalibration()
    const onDisconnect = clearPingInterval
    let lastWakeAt = -Infinity
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || !socket.connected) return
      const now = performance.now()
      if (now - lastWakeAt < VISIBILITY_SYNC_COOLDOWN_MS) return
      lastWakeAt = now
      sendPing()
    }

    socket.on(EVENTS.NTP_PONG, onPong)
    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    document.addEventListener('visibilitychange', onVisible)

    startCalibration()

    return () => {
      socket.off(EVENTS.NTP_PONG, onPong)
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      document.removeEventListener('visibilitychange', onVisible)
      clearPingInterval()
      resetClockSync()
    }
  }, [socket])
}
