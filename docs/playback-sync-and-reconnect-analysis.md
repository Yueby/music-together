# 播放同步与房间重连 - 深度分析报告

本文档分析 `music-together` 项目中播放同步和房间重连相关代码，涵盖 11 个核心文件，识别潜在问题与改进建议。

---

## 一、文件概览与数据流

### 1. syncEngine.ts

**完整内容：**

```typescript
import type { Server } from 'socket.io'
import { EVENTS } from '@music-together/shared'
import * as roomManager from '../services/roomManager.js'

const BROADCAST_INTERVAL_MS = 10000 // 10 seconds

export function startSyncEngine(io: Server) {
  setInterval(() => {
    for (const roomId of roomManager.getAllRoomIds()) {
      const room = roomManager.getRoom(roomId)
      if (!room || !room.playState.isPlaying || !room.currentTrack) continue

      io.to(roomId).emit(EVENTS.PLAYER_SYNC_RESPONSE, {
        currentTime: estimateCurrentTime(roomId),
        isPlaying: room.playState.isPlaying,
        serverTimestamp: Date.now(),
      })
    }
  }, BROADCAST_INTERVAL_MS)
}

export function estimateCurrentTime(roomId: string): number {
  const room = roomManager.getRoom(roomId)
  if (!room) return 0

  const { playState } = room
  if (!playState.isPlaying) return playState.currentTime

  const elapsed = (Date.now() - playState.serverTimestamp) / 1000
  return playState.currentTime + elapsed
}
```

**分析：**

- 定期向有播放中的房间广播同步位置
- 使用 `playState.serverTimestamp` 和 `currentTime` 推算当前时间
- `estimateCurrentTime` 在不播放时直接返回 `currentTime`

**潜在问题：**

| 问题 | 严重程度 | 说明 |
|------|----------|------|
| 无停止/清理 | 低 | `setInterval` 不清理，进程退出时无谓执行，但通常可接受 |
| 空房间广播 | 低 | 宽限期内房间可能为空，`io.to(roomId)` 不会发给任何人，影响不大 |

---

### 2. playerHandler.ts

**完整内容：** （见项目源码）

**分析：**

- 处理播放、暂停、seek、下一首、同步报点、同步请求
- `PLAYER_SYNC` 仅接受 host 上报，用于修正服务端播放位置
- `PLAYER_SYNC_REQUEST` 返回基于 `estimateCurrentTime` 的当前时间

**潜在问题：**

| 问题 | 严重程度 | 说明 |
|------|----------|------|
| 无 | - | 行为与预期一致 |

---

### 3. roomHandler.ts

**完整内容：** （见项目源码）

**房间加入/重连流程：**

1. `ROOM_JOIN` → `joinRoom()`
2. `socket.join(roomId)`
3. `socket.emit(ROOM_STATE, room)`
4. `socket.emit(CHAT_HISTORY, chatHistory)`
5. 若有 `currentTrack?.streamUrl`：`socket.emit(PLAYER_PLAY, { track, playState })`（含 `estimateCurrentTime`）

**潜在问题：**

| 问题 | 严重程度 | 说明 |
|------|----------|------|
| 重连用户识别 | 中 | 重连后 `socket.id` 变化，`room.users.find(u => u.id === socketId)` 无法匹配旧用户；旧用户已在 disconnect 时被移除，会作为新用户加入，逻辑可接受，但缺少“同一用户”的连续性概念 |

---

### 4. roomManager.ts

**完整内容：** （见项目源码）

**分析：**

- 房间宽限期 30 秒，为空时延迟删除，支持刷新后重连
- `joinRoom` 会取消待删除定时器
- `leaveRoom` 会删除 `socketToRoom` 映射

**潜在问题：**

| 问题 | 严重程度 | 说明 |
|------|----------|------|
| `getNextTrack` 逻辑 | 中 | 当前曲在 queue 中查找，若当前曲不在 queue（如直接播放），可能行为异常 |
| 宽限期竞态 | 低 | 定时器删除前 room 可能被再次使用，一般无问题 |

---

### 5. playTrack.ts

**完整内容：** （见项目源码）

**分析：**

- `setCurrentTrack` 会更新 `room.playState`（含 `serverTimestamp`）
- 随后 emit 时使用更新后的 `room.playState`，顺序正确

**潜在问题：**

| 问题 | 严重程度 | 说明 |
|------|----------|------|
| 无 | - | 无明显缺陷 |

---

### 6. usePlayer.ts

**完整内容：** （见项目源码）

**分析：**

- 两阶段加载：静音加载 → seek → unmute，规避 HTML5 流式 seek 问题
- `loadingRef` 2 秒去重，避免重复加载
- `syncReadyRef` 控制 `SYNC_RESPONSE` 在 seek 完成后再生效
- 依赖 `socket` 的 useEffect 包含 cleanup

**潜在问题：**

| 问题 | 严重程度 | 说明 |
|------|----------|------|
| 依赖数组变化 | 中 | `loadTrack` 依赖 `volume` 等，变化时 effect 会重新注册监听器，短暂存在无监听器窗口 |
| 非房间内持续请求 | 低 | `PLAYER_SYNC_REQUEST` 每 12 秒发送，未在房间时服务端会直接 return，无副作用 |

---

### 7. useRoom.ts

**完整内容：** （见项目源码）

**分析：**

- `ROOM_STATE` 更新 room、queue、currentUser
- 播放状态统一由 `PLAYER_PLAY` 管理，避免重复写入

**潜在问题：**

| 问题 | 严重程度 | 说明 |
|------|----------|------|
| 离开房间不清空状态 | 严重 | `leaveRoom` 仅 emit，不调用 `setRoom(null)` |
| 未监听 disconnect | 严重 | 断线时客户端不清理 room，导致重连后仍认为在房间内 |

---

### 8. useSocket.ts

**完整内容：** （见项目源码）

**分析：**

- 管理 `connect` / `disconnect`，更新 `isConnected`
- cleanup 只移除监听器，不销毁 socket 单例

**潜在问题：**

| 问题 | 严重程度 | 说明 |
|------|----------|------|
| 无 | - | 实现合理 |

---

### 9. socket.ts

**完整内容：** （见项目源码）

**分析：**

- 单例模式，`autoConnect: false`
- `disconnectSocket` 存在但未被调用，socket 一般不会被销毁

**潜在问题：**

| 问题 | 严重程度 | 说明 |
|------|----------|------|
| 无 | - | 符合当前设计 |

---

### 10. playerStore.ts

**完整内容：** （见项目源码）

**分析：** 简单 Zustand 状态，无逻辑问题。

---

### 11. roomStore.ts

**完整内容：** （见项目源码）

**分析：** 简单 Zustand 状态，无逻辑问题。`removeUser` 使用 `user.id`，正确。

---

## 二、核心问题汇总

### 1. 严重：Socket 断线重连后房间状态未恢复

**场景：**

1. 用户在 RoomPage，已加入房间
2. 网络中断，socket 断开
3. 服务端 `handleDisconnect` → `leaveRoom`，用户被移出房间
4. 客户端 `setConnected(false)`，但 **room 仍保留**
5. 网络恢复，socket 重连
6. `setConnected(true)`，`room` 仍存在
7. RoomPage 的 `useEffect` 条件为 `!room && isConnected`，不满足，**不会重新发起 ROOM_JOIN**

**结果：** 客户端认为还在房间，服务端已移除，处于“僵尸”状态。

**修复建议：**

在 `useSocket` 或 `useRoom` 中监听 `disconnect`，断线时清理房间状态：

```typescript
// useRoom.ts 或新建 useRoomReconnect 逻辑
socket.on('disconnect', () => {
  setRoom(null)
  setCurrentUser(null)
})
```

或在 RoomPage 中，在 `connect` 时若 `roomId` 存在且当前不在房间，则主动 `ROOM_JOIN`。

---

### 2. 严重：主动离开房间后未清空 room 状态

**场景：**

1. 用户在 RoomPage，已加入房间
2. 用户离开（如返回首页），RoomPage unmount
3. cleanup 调用 `leaveRoom()`，emit `ROOM_LEAVE`
4. 服务端执行 `leaveRoom`，用户已离开
5. **客户端未调用 `setRoom(null)`，room 仍保留**
6. 用户再次进入同一房间 URL（如 /room/ABC123）
7. `room` 仍为旧房间，`!room` 为 false，**不会发起 ROOM_JOIN**

**结果：** 客户端认为自己仍在房间，但服务端已移除。

**修复建议：**

在 `leaveRoom` 中同时清理本地状态：

```typescript
// useRoom.ts
const leaveRoom = useCallback(() => {
  socket.emit(EVENTS.ROOM_LEAVE)
  setRoom(null)
  setCurrentUser(null)
}, [socket])
```

---

### 3. 中：重连后重新加入的完整流程存在竞态

**场景：**

1. 断线后清空 room，重连后触发 `ROOM_JOIN`
2. 服务端依次发送 `ROOM_STATE` 和 `PLAYER_PLAY`
3. 若客户端在 `connect` 后立即发出 `ROOM_JOIN`，而 socket 尚未完全就绪，可能出现：
   - `ROOM_STATE` 在 `ROOM_JOIN` 之前到达
   - 或 `PLAYER_PLAY` 在 `ROOM_STATE` 之前到达

**影响：** 播放状态与 UI 可能短暂不一致。

**修复建议：**

- 在重连时确保 `connect` 事件后再发 `ROOM_JOIN`
- 服务端保证 `ROOM_STATE` 先于 `PLAYER_PLAY` 下发（当前实现已满足）

---

### 4. 中：roomManager.getNextTrack 在 queue 外播放时可能异常

**当前逻辑：**

```typescript
const currentIndex = room.currentTrack
  ? room.queue.findIndex((t) => t.id === room.currentTrack!.id)
  : -1
const nextIndex = currentIndex + 1
return nextIndex < room.queue.length ? room.queue[nextIndex] : null
```

若 `currentTrack` 不在 `queue` 中（如直接播放某首），`currentIndex === -1`，`nextIndex === 0`，会返回 queue 的第一首，可能不符合预期。

**修复建议：**

明确业务规则：当前曲不在 queue 时是返回 null 还是 queue 第一首，并据此调整逻辑。

---

### 5. 低：usePlayer 中 syncReadyRef 与 loadTrack 的时序

暂停房间加入时：

```typescript
} else {
  if (seekTo && seekTo > 0) {
    howl.seek(seekTo)
  }
  howl.volume(volume)
  setCurrentTime(seekTo ?? 0)
  syncReadyRef.current = true  // 立即设为 true
}
```

seek 为异步，`syncReadyRef` 可能在 seek 尚未完成时就被设为 true。若紧接着收到 `SYNC_RESPONSE`，可能触发一次不必要的 seek。

**修复建议：** 暂停时也加短延迟再设置 `syncReadyRef.current = true`，或监听 Howl 的 seek 完成事件。

---

### 6. 低：事件监听器重复注册

`usePlayer` 的 effect 依赖 `[socket, loadTrack, setCurrentTime, setQueue, fetchLyric]`。`loadTrack` 变化时会先 cleanup 再重新注册，中间存在短暂无监听期。考虑用 `useRef` 保存 `loadTrack` 等，减少 effect 重建。

---

## 三、事件流与边界情况

### 正常加入房间

```
Client: ROOM_JOIN
Server: ROOM_STATE → CHAT_HISTORY → [PLAYER_PLAY if track]
Client: useRoom 处理 ROOM_STATE
Client: usePlayer 处理 PLAYER_PLAY
```

### 重连后（若实现断线清空 room）

```
Client: disconnect → setRoom(null)
Client: connect → isConnected=true, room=null
RoomPage: !room && isConnected → ROOM_JOIN
Server: ROOM_STATE → CHAT_HISTORY → [PLAYER_PLAY if track]
Client: 恢复房间与播放状态
```

### 主动离开

```
Client: leaveRoom() → emit ROOM_LEAVE
Server: leaveRoom, socket.leave
Client: 应同时 setRoom(null)（当前缺失）
```

---

## 四、修复优先级建议

| 优先级 | 问题 | 涉及文件 |
|--------|------|----------|
| P0 | 断线时清空 room + 重连时重新加入 | useRoom.ts, RoomPage.tsx |
| P0 | 主动离开时清空 room | useRoom.ts |
| P1 | 断线时显式清空 room 状态 | useRoom.ts（监听 disconnect） |
| P2 | getNextTrack 边界逻辑 | roomManager.ts |
| P2 | usePlayer 暂停场景下 syncReady 时序 | usePlayer.ts |
| P3 | usePlayer effect 依赖优化 | usePlayer.ts |

---

## 五、总结

- 播放同步链路（host 上报、sync request/response、syncEngine 广播）整体设计合理。
- 主要问题集中在**断线重连**和**主动离开**时的客户端 room 状态清理，导致重连或再次进入时不会重新加入房间。
- 建议优先实现：断线时 `setRoom(null)`，离开时在 `leaveRoom` 中 `setRoom(null)`，并在 RoomPage 中保证 `connect` 后按 `roomId` 重新发起 `ROOM_JOIN`。
