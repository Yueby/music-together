# Backend Code Review Report

**Date:** 2025-02-14  
**Scope:** Node.js + Express + Socket.IO music sync server  
**Focus:** Error handling, race conditions, input validation, resource cleanup, security, logic bugs

---

## 1. Error Handling Gaps

### 1.1 [CRITICAL] Auth controller async handlers — unhandled promise rejections

**File:** `packages/server/src/controllers/authController.ts`  
**Lines:** 19–31, 33–64, 70–131

**Issue:** `AUTH_REQUEST_QR`, `AUTH_CHECK_QR`, and `AUTH_SET_COOKIE` are async handlers with no try/catch. Unlike `withRoom`-wrapped handlers, these do not use `Promise.resolve(handler(...)).catch(...)`. Any rejection from `neteaseAuth.generateQrCode()`, `neteaseAuth.checkQrStatus()`, `neteaseAuth.getUserInfo()`, or `authService.addCookie()` will cause an unhandled promise rejection and may crash the process.

**Fix:** Wrap each async handler in try/catch and emit an error response on failure:

```ts
socket.on(EVENTS.AUTH_REQUEST_QR, async (data) => {
  try {
    if (data?.platform !== 'netease') { ... }
    const result = await neteaseAuth.generateQrCode()
    // ...
  } catch (err) {
    logger.error('AUTH_REQUEST_QR error', err, { socketId: socket.id })
    socket.emit(EVENTS.AUTH_QR_STATUS, { status: 800, message: '服务器内部错误' })
  }
})
```

Apply the same pattern to `AUTH_CHECK_QR` and `AUTH_SET_COOKIE`.

---

### 1.2 [MEDIUM] ROOM_LEAVE handler — no error response to client

**File:** `packages/server/src/controllers/roomController.ts`  
**Lines:** 156–164

**Issue:** When `handleLeave` throws, the catch block logs the error but does not emit `ROOM_ERROR` to the socket. The user receives no feedback that the leave failed.

**Fix:** Emit an error before returning (if the socket is still connected):

```ts
} catch (err) {
  logger.error('ROOM_LEAVE handler error', err, { socketId: socket.id })
  socket.emit(EVENTS.ROOM_ERROR, { code: ERROR_CODE.INTERNAL, message: '离开房间失败' })
}
```

---

## 2. Input Validation Gaps

### 2.1 [MEDIUM] roomJoinSchema — password has no max length

**File:** `packages/shared/src/schemas.ts`  
**Lines:** 14–18

**Issue:** `roomJoinSchema` defines `password: z.string().optional()` with no `.max()`. A client can send a very large password (e.g. 1MB), causing `Buffer.from(password)` in `safeCompare` to allocate excessive memory (DoS).

**Fix:** Add max length to match room creation:

```ts
password: z.string().max(LIMITS.ROOM_PASSWORD_MAX_LENGTH).optional(),
```

---

### 2.2 [MEDIUM] NTP_PING — no validation of lastRttMs

**File:** `packages/server/src/controllers/playerController.ts`  
**Lines:** 123–133

**Issue:** `data?.lastRttMs` is used directly. A client can send `lastRttMs: 999999999`, which is stored via `roomRepo.setSocketRTT()` and used in `getScheduleTime()` to compute scheduling delay. Extremely large values could skew playback scheduling.

**Fix:** Validate and clamp RTT before storing:

```ts
if (data?.lastRttMs != null && typeof data.lastRttMs === 'number' && data.lastRttMs > 0 && data.lastRttMs <= 30_000) {
  roomRepo.setSocketRTT(socket.id, data.lastRttMs)
}
```

---

### 2.3 [LOW] Auth controller — platform not validated against MusicSource

**File:** `packages/server/src/controllers/authController.ts`  
**Lines:** 70–76, 136–138

**Issue:** `data?.platform` and `data.platform` are used without validating they are one of `['netease', 'tencent', 'kugou']`. Invalid platforms could create unbounded keys in the auth pool and bypass intended behavior.

**Fix:** Add a Zod schema or inline check:

```ts
const validPlatforms = ['netease', 'tencent', 'kugou'] as const
if (!validPlatforms.includes(data.platform as any)) {
  socket.emit(EVENTS.AUTH_SET_COOKIE_RESULT, { success: false, message: '不支持的平台' })
  return
}
```

---

## 3. Security

### 3.1 [MEDIUM] Auth controller — no rate limiting

**File:** `packages/server/src/controllers/authController.ts`  
**Lines:** 19–131

**Issue:** `AUTH_REQUEST_QR`, `AUTH_CHECK_QR`, and `AUTH_SET_COOKIE` have no rate limiting. A malicious client can:
- Spam `AUTH_REQUEST_QR` to generate many QR codes and hit external APIs
- Spam `AUTH_CHECK_QR` with arbitrary keys
- Spam `AUTH_SET_COOKIE` with invalid cookies to trigger Netease validation calls

**Fix:** Add a rate limiter (e.g. `rate-limiter-flexible` like chat) per socket or per IP for auth events. Limit to a few requests per minute.

---

### 3.2 [LOW] AUTH_SET_COOKIE — cookie length not bounded

**File:** `packages/server/src/controllers/authController.ts`  
**Lines:** 70–76

**Issue:** `data.cookie` is accepted without length validation. Very long strings could cause memory pressure when stored in the room pool.

**Fix:** Add a reasonable max length (e.g. 2000 chars) before validation/storage.

---

## 4. Logic Bugs / Edge Cases

### 4.1 [MEDIUM] queueController QUEUE_REMOVE — getNextTrack missing playMode

**File:** `packages/server/src/controllers/queueController.ts`  
**Line:** 61

**Issue:** `queueService.getNextTrack(ctx.roomId)` is called without `playMode`. `getNextTrack` falls back to `room.playMode`, so behavior is correct. However, `playerController.PLAYER_NEXT` explicitly passes `ctx.room.playMode` for consistency. Passing it here improves clarity and guards against future changes.

**Fix:** Pass playMode for consistency:

```ts
const nextTrack = queueService.getNextTrack(ctx.roomId, ctx.room.playMode)
```

---

### 4.2 [LOW] voteController executeAction — getNextTrack missing playMode

**File:** `packages/server/src/controllers/voteController.ts`  
**Line:** 25

**Issue:** Same as above — `getNextTrack(roomId)` relies on default. Passing `room.playMode` explicitly is clearer.

**Fix:**

```ts
const room = roomRepo.get(roomId)
const nextTrack = room ? queueService.getNextTrack(roomId, room.playMode) : null
```

---

### 4.3 [LOW] roomController ROOM_JOIN — possible stale room reference after playTrackInRoom

**File:** `packages/server/src/controllers/roomController.ts`  
**Lines:** 126–131

**Issue:** When `isAloneInRoom && updatedRoom.queue.length > 0` and there is no current track, `playerService.playTrackInRoom(io, roomId, firstTrack)` is called. On stream failure, `playTrackInRoom` removes the track from the queue and emits `QUEUE_UPDATED`. The joining client has already received `ROOM_STATE` with the old queue. The subsequent `QUEUE_UPDATED` will correct this, so behavior is correct. No fix required; noted for awareness.

---

## 5. Resource Cleanup

### 5.1 [LOW] roomService — broadcastRoomList timer on shutdown

**File:** `packages/server/src/services/roomService.ts`  
**Lines:** 176–188

**Issue:** The `broadcastTimer` is not cleared on server shutdown. If a broadcast is pending when `SIGTERM`/`SIGINT` fires, the timer may still run and call `io.to('lobby').emit()` after the server has started closing. Low risk but can cause warnings.

**Fix:** Export a `clearBroadcastTimer()` and call it from the shutdown handler in `index.ts` before closing the server.

---

## 6. Summary Table

| #   | Severity  | File                          | Issue                                      |
|-----|-----------|-------------------------------|--------------------------------------------|
| 1.1 | Critical  | authController.ts             | Unhandled promise rejections in auth handlers |
| 1.2 | Medium    | roomController.ts             | ROOM_LEAVE catch doesn't emit error to client |
| 2.1 | Medium    | schemas.ts                    | roomJoinSchema password no max length      |
| 2.2 | Medium    | playerController.ts           | NTP_PING lastRttMs not validated           |
| 2.3 | Low       | authController.ts             | Platform not validated against MusicSource |
| 3.1 | Medium    | authController.ts             | No rate limiting on auth events            |
| 3.2 | Low       | authController.ts             | Cookie length not bounded                  |
| 4.1 | Medium    | queueController.ts            | getNextTrack missing playMode (consistency) |
| 4.2 | Low       | voteController.ts             | getNextTrack missing playMode (consistency) |
| 5.1 | Low       | roomService.ts                | broadcastTimer not cleared on shutdown    |

---

## Items Verified as OK (Skipped per request)

- LRU cache
- broadcastRoomList debounce
- roomToSockets index
- scheduleDeletion broadcast
- withRoom / withPermission error propagation
- chatService HTML escaping
- safeCompare for password timing attacks
- vote timeout cleanup when room is deleted
- room deletion cleanup chain (player, vote, auth)
