# 设计模式

## 前端模式

## Zustand Store 模式

5 个独立 store，各自管理一个领域的状态：

| Store           | 职责                                                | 持久化                    |
| --------------- | --------------------------------------------------- | ------------------------- |
| `playerStore`   | 播放状态（曲目、进度、音量、歌词）                  | 音量持久化到 localStorage |
| `roomStore`     | 房间状态（room、currentUser 自动推导自 room.users） | 无                        |
| `chatStore`     | 聊天（消息列表、未读数、开关状态）                  | 无                        |
| `lobbyStore`    | 大厅（房间列表、加载状态）                          | 无                        |
| `settingsStore` | 设置（歌词对齐/动画/字体/翻译字体大小、背景参数）   | 全部持久化到 localStorage |

使用方式：通过选择器订阅特定字段，避免不必要的渲染：

```typescript
const volume = usePlayerStore((s) => s.volume)
```

在 Socket 回调中使用 `getState()` 避免闭包问题：

```typescript
const room = useRoomStore.getState().room
```

## 自定义 Hooks 组合模式

两个核心组合 hook 各自编排多个子 hook：

```
usePlayer                             useRoom
├── useHowl (Howler.js 实例)          ├── useRoomState (核心房间事件)
├── useLyric (歌词解析)                ├── useChatSync (聊天事件)
└── usePlayerSync                     ├── useQueueSync (队列事件)
    ├── Scheduled Execution           ├── useAuthSync (Cookie 持久化 + toast 反馈，永不删除 cookie)
    └── Host Progress Reporting       └── useConnectionGuard (断线重置)

SocketProvider (连接管理，无 NTP)

RoomPage
└── ClockSyncRunner → useClockSync (NTP 时钟同步，仅房间内运行)
```

通用工具 Hook：`useSocketEvent(event, handler)` 封装 `socket.on/off` 样板代码，已在 `useLobby` 和 `useVote` 中使用。

其他独立 hook：`useChat`、`useLobby`、`useQueue`、`useVote`、`useAuth`、`usePlaylist`，每个 hook 负责将 Socket 事件绑定到对应 Store。

`usePlaylist` 管理歌单功能：通过 Socket 获取用户歌单列表（`playlist:get_my` → `playlist:my_list`），通过 REST 分页获取歌单曲目（`GET /api/music/playlist?limit=100&offset=0`，返回 `{ tracks, total, offset, hasMore }`），提供 `loadMoreTracks()` 无限加载下一页、URL/ID 解析工具函数（`parsePlaylistInput`），以及单曲/批量添加到队列。切换歌单时立即重置状态防止闪旧数据，内部 `loadingMoreRef`（ref）做同步防重，避免 React 批量更新前的闭包竞态。URL 拼接通过 `buildPlaylistUrl()` 辅助函数集中管理。

## 受控 Dialog 模式

所有弹窗组件遵循统一的 prop 接口：

```typescript
interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  // 业务回调...
}
```

父组件（页面）管理 `open` 状态，弹窗组件只负责渲染和用户交互。

## ResponsiveDialog 模式

`responsive-dialog.tsx` 通用组件根据视口宽度自动切换呈现方式：

- **桌面端**（≥640px）：居中 Dialog（基于 Radix UI）
- **移动端**（<640px）：底部 Drawer（基于 vaul，支持拖拽关闭）

通过 React Context 向子组件传递 `isMobile` 状态，提供一一映射的子组件：`ResponsiveDialog`、`ResponsiveDialogContent`、`ResponsiveDialogHeader`、`ResponsiveDialogTitle`、`ResponsiveDialogDescription`、`ResponsiveDialogFooter`、`ResponsiveDialogClose`、`ResponsiveDialogBody`。使用方只需替换 import 路径即可获得响应式行为。项目中所有业务弹窗（CreateRoomDialog、PasswordDialog、NicknameDialog、SearchDialog、SettingsDialog）均已迁移至此组件。

## Context Provider 模式

`SocketProvider` 通过 React Context 提供 Socket.IO 实例和连接状态，并内置断线/重连 Toast 提示：

```typescript
const { socket, isConnected } = useSocketContext()
```

`AbilityProvider` 通过 React Context 提供 CASL ability 实例，组件可通过 `useContext(AbilityContext)` 查询权限。

## 组件组合模式

`AudioPlayer` 组合 `NowPlaying` + `SongInfoBar` + `PlayerControls` + `LyricDisplay`，各组件独立负责自己的渲染逻辑。`RoomPage` 组合所有功能区域和覆盖层弹窗。

## 移动端双模式播放页面

移动端（竖屏）播放页面通过 `lyricExpanded` 状态实现两种模式切换，模仿 Apple Music 移动端交互：

- **默认模式**（`lyricExpanded=false`）：大封面 + 歌曲信息 + 控制器，封面自适应剩余空间（`flex-1 min-h-0` + `aspect-square max-h-full max-w-full`），控制器固定底部，不显示歌词
- **歌词模式**（`lyricExpanded=true`）：点击封面后，封面缩小到顶部变为 compact 横排（48px 小封面 `rounded-md` + 标题 `text-base` / 艺术家 `text-sm`），歌词区域 fade+slide-up 入场占满中间空间，控制器固定底部

布局策略：

- 移动端外层 padding `px-5 py-7`（水平 20px，垂直 28px），所有子元素 `w-full`，不使用 `max-w` 约束，边距由外层 padding 统一控制
- `NowPlaying` wrapper 使用 `flex-1 min-h-0`，默认模式下封面在剩余空间内居中缩放（`aspect-square max-h-full max-w-full`），避免封面过大挤压控件

关键技术：

- `NowPlaying` 组件支持 `compact` prop 切换大图/小图布局，`onCoverClick` 触发模式切换
- `framer-motion` 的 `layoutId`（"cover-art" / "song-info"）实现封面和文字在两种布局间的共享布局动画（0.45s Apple 风格贝塞尔缓动）
- `LayoutGroup` 包裹移动端内容区，确保跨组件 `layoutId` 动画生效
- `AnimatePresence` + `motion.div` 实现歌词区域的 fade+slide-up 入场/退场
- 歌词模式状态在切歌时保持不变，用户手动点击封面切换
- 桌面端保持左右分栏布局不受影响

## 后端模式

## 分层架构

```
Controller → Service → Repository / Utils
```

- **Controller**：注册 Socket 事件监听器，薄编排层（校验输入 → 调用 Service → 编排通知）。不包含业务逻辑。
- **Service**：业务逻辑、跨领域编排、Socket 广播。关键服务职责拆分：
  - `roomService`：房间 CRUD + 角色管理 + 临时管理员协调（`reconcileRoomRoles`）+ conductor 选举（`electConductor`）+ 加入校验（`validateJoinRequest`）。Re-export `toPublicRoomState` 和 `broadcastRoomList` 以保持控制器调用方式不变。
  - `roomLifecycleService`：房间空置删除定时器 + 防抖广播。不依赖 `roomService`，消除循环依赖。API：`scheduleDeletion`、`cancelDeletionTimer`、`broadcastRoomList`、`clearAllTimers`。角色宽限期已移除（conductor 自动选举，无需 grace period）。
  - `playerService`：播放状态管理 + 流 URL 解析 + 切歌防抖 + 加入播放同步（`syncPlaybackToSocket`）+ 房间清理（`cleanupRoom`）。`playTrackInRoom` 通过 per-room Promise 链互斥锁防止并发竞态。`playNextTrackInRoom` / `playPrevTrackInRoom` 将 debounce + 队列导航 + 播放统一封装在 mutex 内部。`autoPlayIfEmpty` 在 mutex 内重新检查 `room.currentTrack`，防止并发 QUEUE_ADD 双重自动播放。
- **Repository**：数据存取（当前为内存 Map，接口抽象，可替换为数据库）
- **Utils**：纯函数工具（`toPublicRoomState` 等），无状态，可被任意层引用

## Repository 模式

使用 TypeScript 接口抽象数据访问：

```typescript
interface RoomRepository {
  get(roomId: string): RoomData | undefined
  set(roomId: string, room: RoomData): void
  delete(roomId: string): void
  getAll(): Map<string, RoomData>
  // ...
}
```

当前实现为 `InMemoryRoomRepository`（`Map<string, RoomData>`），未来可替换为 Redis/数据库实现。

## Socket.IO 中间件链

```
withPermission(action, subject)  →  withRoom(io)  →  Handler
withOwnerOnly(io)                →  withRoom(io)  →  Handler
```

- `withRoom`：校验 Socket 是否在房间中，构建 `HandlerContext`（io, socket, roomId, room, user）
- `withPermission`：在 `withRoom` 基础上用 CASL `defineAbilityFor(role)` 检查 `(action, subject)` 权限
- `withOwnerOnly`：在 `withRoom` 基础上仅允许房主（`user.role === 'owner'`），用于设置和角色管理

错误统一通过 `ROOM_ERROR` 事件回传给客户端，错误码使用 `ERROR_CODE` 枚举（`shared/types.ts`），包括：`NOT_IN_ROOM`、`ROOM_NOT_FOUND`、`NO_PERMISSION`、`INVALID_DATA`、`QUEUE_FULL`、`RATE_LIMITED`、`ROOM_ENTRY_LIMITED`（建房/入房被限流或达到建房上限）、`INTERNAL` 等。

## 结构化日志（pino）

基于 [pino](https://github.com/pinojs/pino) 的薄封装，开发环境使用 `pino-pretty` 美化输出：

```typescript
logger.info('Room created', { roomId, socketId: socket.id })
logger.error('Failed to resolve stream URL', err, { roomId, trackId })
```

输出格式：`[ISO_TIMESTAMP] LEVEL message {JSON_CONTEXT}`

## 共享模式

## 类型驱动的事件系统

`EVENTS` 常量对象定义所有事件名，`ClientToServerEvents` / `ServerToClientEvents` 接口为每个事件定义精确的负载类型，确保前后端通信的类型安全。

## 构建优化

- **路由级懒加载**：`RoomPage` 和 `NotFoundPage` 使用 `React.lazy` + `Suspense`（`HomePage` 保持同步加载以保证首屏速度）
- **Vite manualChunks 分包**：react、socket.io、motion、radix-ui、pixi.js 分别打包为独立 chunk，利用浏览器长期缓存
- **React.memo**：列表项组件（`RoomCard`、`ChatMessage`、`TrackListItem`）和高频更新组件（`PlayerControls`）均使用 `React.memo` 避免不必要的 re-render
- **Zustand 细粒度 selector**：避免 `useRoomStore((s) => s.room)` 的粗粒度订阅，改用 `s.room?.name` 等精确字段

## 常量集中管理

`LIMITS` 和 `TIMING` 在 shared 包中统一定义，前后端共用：

```typescript
LIMITS.QUEUE_MAX_SIZE // 100
LIMITS.QUEUE_BATCH_MAX_SIZE // 100
LIMITS.CHAT_HISTORY_MAX // 200
TIMING.ROOM_GRACE_PERIOD_MS // 60_000
TIMING.PLAYER_NEXT_DEBOUNCE_MS // 500
TIMING.VOTE_TIMEOUT_MS // 30_000
NTP.INITIAL_INTERVAL_MS // 50
NTP.STEADY_STATE_INTERVAL_MS // 5_000
NTP.MAX_INITIAL_SAMPLES // 20
NTP.MIN_SCHEDULE_DELAY_MS // 300
NTP.MAX_SCHEDULE_DELAY_MS // 3_000
QR_STATUS.EXPIRED // 800
QR_STATUS.WAITING_SCAN // 801
QR_STATUS.SCANNED // 802
QR_STATUS.SUCCESS // 803
QR_TIMING.POLL_INTERVAL_MS // 2_000
QR_TIMING.SUCCESS_CLOSE_DELAY_MS // 1_000
```

---
