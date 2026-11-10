# 目录结构

## 根目录

```
music-together/
├── .agents/skills/      # 项目 Agent Skills（每个技能目录包含 SKILL.md）
├── .github/             # CI、Dependabot、PR/Issue 模板
├── packages/
│   ├── client/          # React 前端
│   ├── mapp/            # Discourse 微应用适配与打包（独立 ZIP，不参与主站构建）
│   ├── server/          # Node.js 后端
│   └── shared/          # 共享类型、事件、Schema 与权限
├── vendor/              # 官方 Discourse Mini App SDK 原样发行文件（file: 依赖，镜像构建需复制）
├── docs/                # 架构与开发文档
├── AGENTS.md            # 项目级 AI/Agent 工作约束
├── CONTRIBUTING.md      # 贡献指南
├── SECURITY.md          # 安全报告策略
├── vitest.config.ts     # Monorepo 测试配置
├── package.json         # 根 package（工作区编排）
├── pnpm-workspace.yaml  # pnpm 工作区定义
├── pnpm-lock.yaml
└── README.md
```

## packages/client/src/ — 前端源码

```
src/
├── main.tsx                    # 入口：ReactDOM.createRoot
├── App.tsx                     # Web Router/Provider；共享 AppSurface 与原路由/错误边界
├── platform/                   # MappApp MemoryRouter 壳与可等待 React commit 的挂载器
├── index.css                   # 全局样式：Tailwind + 配色变量 + 自定义动画
│
├── pages/                      # 页面级组件
│   ├── HomePage.tsx            #   大厅：创建/加入房间、房间列表
│   ├── RoomPage.tsx            #   房间：播放器 + 聊天（桌面侧栏/移动端 Drawer） + 覆盖层弹窗
│   └── NotFoundPage.tsx        #   404 页面
│
├── components/                 # UI 组件
│   ├── Chat/
│   │   ├── ChatMessage.tsx     #     单条消息（用户/系统）
│   │   └── ChatPanel.tsx       #     聊天面板（消息列表 + 输入框）
│   ├── Lobby/
│   │   ├── CreateRoomDialog.tsx #    创建房间弹窗
│   │   ├── NicknameDialog.tsx  #     设置昵称弹窗
│   │   ├── PasswordDialog.tsx  #     输入房间密码弹窗
│   │   ├── RoomCard.tsx        #     房间列表卡片
│   │   ├── UserPopover.tsx     #     用户信息气泡
│   │   ├── HeroSection.tsx     #     首页 Hero 标题区域
│   │   ├── ActionCards.tsx     #     创建/加入房间卡片
│   │   └── RoomListSection.tsx #     活跃房间列表区域
│   ├── TrackListItem.tsx        #   共享曲目行渲染（序号+封面+标题VIP+歌手可点击+时长+isAdded 添加按钮，memo 优化）
│   ├── VirtualTrackList.tsx     #   共享虚拟滚动曲目列表（@tanstack/react-virtual + 无限加载 + skeleton + 空态，forwardRef 暴露 scrollToTop）
│   ├── Overlays/
│   │   ├── QueueDrawer.tsx     #     播放队列抽屉（vaul Drawer，移动端底部/桌面端右侧）
│   │   ├── SearchDialog.tsx    #     音乐搜索弹窗（单曲/歌手/专辑/歌单四个标签；VirtualTrackList 虚拟滚动 + 自动无限加载 + AbortController 竞态防护；歌手/专辑/歌单点进详情视图，专辑可叠在歌手主页之上并返回）
│   │   ├── ArtistDetail.tsx    #     歌手主页（头像/简介/热门歌曲/专辑两个标签，目前仅网易云有数据；网页端与微应用同一份代码）
│   │   ├── CollectionRow.tsx   #     可点击的结果行（专辑/歌单方形封面，歌手圆形头像）
│   │   ├── SettingsDialog.tsx  #     设置弹窗（壳，Tab 导航：房间/成员/外观/歌词，移动端 nav scrollbar-hide；不再包含账号）
│   │   ├── AccountDialog.tsx   #     音乐账号弹窗（网易云/QQ/酷狗登录、VIP 状态、个人歌单导入，内容是 PlatformHub；入口在房间顶栏的"音乐账号"按钮，桌面为独立图标、移动端在"更多"菜单；`hostRuntime.platformAccounts` 为 false 的宿主不渲染）
│   │   └── Settings/
│   │       ├── SettingRow.tsx              # 设置行共享组件
│   │       ├── RoomSettingsSection.tsx     # 房间设置（名称、密码）
│   │       ├── MembersSection.tsx          # 成员列表（角色管理）
│   │       ├── PlatformAuthSection.tsx     # 平台账号认证（VIP Cookie，旧版，已被 PlatformHub 替代）
│   │       ├── PlatformHub.tsx            # 平台中心（登录 + 歌单浏览 + 导入，替代 PlatformAuthSection；挂在 AccountDialog 中）
│   │       ├── LoginSection.tsx           # 精简版平台登录区域（PlatformHub 子组件）
│   │       ├── PlaylistSection.tsx        # 歌单列表 + 手动输入（PlatformHub 子组件）
│   │       ├── PlaylistDetail.tsx         # 歌单/专辑详情（返回行 + TrackCollection）
│   │       ├── TrackCollection.tsx        # 可分页曲目列表（VirtualTrackList + queueKeys/addedIds 去重 + 动态全部添加过滤重复），歌单、专辑、歌手主页共用
│   │       ├── ProfileSettingsSection.tsx  # 个人设置（昵称）
│   │       ├── AppearanceSection.tsx       # 外观设置（歌词 + 背景 + 布局）
│   │       ├── OtherSettingsSection.tsx    # 其他设置
│   │       ├── ManualCookieDialog.tsx      # 手动输入 Cookie 弹窗
│   │       └── QrLoginDialog.tsx           # 通用 QR 扫码登录弹窗（网易云 + 酷狗 + QQ 音乐）
│   ├── Player/
│   │   ├── constants.ts        #     共享动画常量（SPRING / LAYOUT_TRANSITION），NowPlaying 和 SongInfoBar 统一导入
│   │   ├── AudioPlayer.tsx     #     主播放器布局（桌面：左右分栏；移动：双模式封面/歌词切换）
│   │   ├── LyricDisplay.tsx    #     AMLL 歌词渲染（LRC 正则支持 [mm:ss] / [mm:ss.x] / [mm:ss.xx] / [mm:ss.xxx]）
│   │   ├── NowPlaying.tsx      #     当前曲目展示（支持 compact 小封面横排模式 + layoutId 共享动画）
│   │   ├── SongInfoBar.tsx     #     歌曲信息栏（标题/艺术家 + 音量/聊天按钮，竖屏模式自适应缩放）
│   │   └── PlayerControls.tsx  #     进度条+播放控制+播放模式切换
│   ├── Room/
│   │   └── RoomHeader.tsx      #     房间头部（房间名/人数/连接状态；移动端 DropdownMenu 收纳设置/离开等操作）
│   ├── Vote/
│   │   └── VoteBanner.tsx      #     投票横幅（进行中的投票显示 + 投票按钮）
│   ├── InteractionGate.tsx     #   浏览器交互解锁（点击后才能播放音频）
│   └── ui/                     #   shadcn/ui 基础组件
│       ├── avatar.tsx
│       ├── badge.tsx
│       ├── button.tsx
│       ├── card.tsx
│       ├── dialog.tsx
│       ├── drawer.tsx
│       ├── dropdown-menu.tsx
│       ├── input.tsx
│       ├── label.tsx
│       ├── popover.tsx
│       ├── resize-handle.tsx
│       ├── scroll-area.tsx
│       ├── select.tsx
│       ├── separator.tsx
│       ├── marquee-text.tsx
│       ├── responsive-dialog.tsx
│       ├── sheet.tsx
│       ├── skeleton.tsx
│       ├── slider.tsx
│       ├── switch.tsx
│       ├── tabs.tsx
│       └── tooltip.tsx
│
├── hooks/                      # 自定义 Hooks
│   ├── useSocketEvent.ts       #   通用 Socket 事件订阅工具 Hook（自动 on/off，ref 稳定）
│   ├── usePlayer.ts            #   播放器主 hook（组合 useHowl + useLyric + usePlayerSync）
│   ├── useHowl.ts              #   Howler.js 音频实例管理
│   ├── useLyric.ts             #   歌词加载（服务端 TTML 代理 → 平台逐词 YRC/KRC → LRC）
│   ├── useBackgroundAlbum.ts   #   流体背景的封面来源：需读字节的宿主把 Blob URL 转成已加载的 `<img>`（避免库内 fetch 被 CSP 拦截）
│   ├── usePlayerSync.ts        #   播放同步（Scheduled Execution + conductor 上报 + 周期性漂移校正）
│   ├── useClockSync.ts         #   NTP 时钟同步 hook（校准客户端时钟与服务器对齐）
│   ├── useRoom.ts              #   房间组合 hook（编排 5 个子 hook，对外 API 不变）
│   ├── room/                   #   useRoom 子 hook（按职责拆分）
│   │   ├── useRoomState.ts     #     ROOM_STATE / JOIN / LEFT / SETTINGS / ROLE_CHANGED / ERROR + 挂载时补发 cookie（覆盖 HomePage 提前消费 ROOM_STATE 的场景）
│   │   ├── useChatSync.ts      #     CHAT_HISTORY / CHAT_MESSAGE
│   │   ├── useQueueSync.ts     #     QUEUE_UPDATED
│   │   ├── useAuthSync.ts      #     AUTH_SET_COOKIE_RESULT + localStorage 持久化（验证失败只做 toast 反馈，永不删除 cookie；删除权仅在 useAuth.logout）
│   │   └── useConnectionGuard.ts #   disconnect → resetAllRoomState
│   ├── useAuth.ts              #   平台认证 UI & Socket 事件
│   ├── useVote.ts              #   投票（使用 useSocketEvent）
│   ├── useChat.ts              #   聊天消息收发
│   ├── useLobby.ts             #   大厅房间列表与操作（使用 useSocketEvent）
│   ├── useQueue.ts             #   播放队列操作（含 addBatchTracks 批量添加）
│   ├── useArtist.ts            #   歌手主页状态（资料 + 歌曲/专辑各自分页；按"服务端已发出条数"计偏移并去重；代际计数防止慢请求覆盖新歌手）
│   ├── useSearch.ts            #   搜索/翻页/竞态保护（`SearchType` = song/album/playlist/artist）
│   ├── usePlaylist.ts          #   歌单管理（用户歌单列表、分页曲目获取 + 无限加载、URL 解析、批量导入）
│   ├── useIsMobile.ts          #   布局维度：orientation 检测（portrait=竖屏布局，landscape=横屏布局）
│   ├── useHasHover.ts          #   交互维度：hover 能力检测（(hover: hover) 媒体查询，触控设备=false）
│   ├── useContainerPortrait.ts #   容器宽高比检测（ResizeObserver，用于播放器横竖屏切换）
│   └── useCoverWidth.ts        #   封面容器最小尺寸测量（约束信息栏/控件宽度与封面对齐）
│
├── stores/                     # Zustand 状态仓库
│   ├── playerStore.ts          #   播放状态（currentTrack, isPlaying, volume 等）
│   ├── roomStore.ts            #   房间状态（room, currentUser, users）
│   ├── chatStore.ts            #   聊天（messages, unreadCount, isChatOpen）
│   ├── lobbyStore.ts           #   大厅（rooms 列表, isLoading）
│   └── settingsStore.ts        #   设置（歌词参数、背景参数，持久化到 localStorage）
│
├── providers/                  # React Context Provider
│   ├── SocketProvider.tsx      #   Web 连接/Cookie 引导；SocketStateProvider 为同一 Context 的纯状态出口
│   ├── MappSocketProvider.tsx  #   外部微应用会话订阅与身份就绪连接态投影，不接管其生命周期
│   └── AbilityProvider.tsx     #   CASL 权限上下文（基于 currentUser.role）
│
└── lib/                        # 工具库
    ├── config.ts               #   配置常量（SERVER_URL）
    ├── constants.ts            #   命名常量（定时器、阈值、布局尺寸）
    ├── clockSync.ts            #   NTP 时钟同步引擎（采样、offset 计算、getServerTime）
    ├── resetStores.ts          #   全局 store 重置工具
    ├── hostRuntime.ts          #   Web 默认能力；Mapp 按审核通路选择对应 profile
├── MetadataTransport.ts    #   搜索/歌词读取的最窄响应接口
├── metadataFetch.ts        #   Web 默认 fetch 委托，Mapp 使用 SDK 对应实现
├── StorageAdapter.ts       #   设置存储后端接口
├── storageBackend.ts       #   默认浏览器存储操作，原 storage facade 复用
├── RoomCommands.ts         #   统一房间命令边界及 Web 默认事件透传
├── PlaybackSound.ts        #   共享播放器最窄媒体对象接口
├── playbackSoundFactory.ts #   默认 Web Howler 创建入口，宿主可选择对应媒体实现
├── socket.ts               #   Socket.IO 网页客户端实例
├── platform/SdkRoomSocket.ts #   可注入的微应用 SDK Socket.IO 传输（不替换网页实例）
    ├── storage.ts              #   localStorage 封装（带类型校验）
    ├── platform.ts             #   平台常量（PLATFORM_LABELS / PLATFORM_SHORT_LABELS / PLATFORM_COLORS / VIP_LABELS / 状态查找函数）
    ├── format.ts               #   格式化工具（时间、文本等）
    ├── audioUnlock.ts          #   浏览器音频自动播放解锁
    └── utils.ts                #   cn() + trackKey() 等通用工具
```

## packages/server/src/ — 后端源码

```
src/
├── index.ts                    # 入口：Express + HTTP + Socket.IO 服务启动与优雅关闭
├── config.ts                   # 环境变量配置（PORT, CLIENT_URL, CORS）
│
├── controllers/                # 控制器：注册 Socket 事件处理器（薄编排层，不含业务逻辑）
│   ├── index.ts                #   统一注册入口
│   ├── roomController.ts       #   房间生命周期（创建/加入/离开/发现/设置/角色）
│   ├── playerController.ts     #   播放控制（play/pause/seek/next/prev/sync/set_mode）+ NTP ping/pong
│   ├── queueController.ts      #   队列管理（add/remove/reorder/clear）
│   ├── chatController.ts       #   聊天消息（含限流反馈）
│   ├── voteController.ts       #   投票系统（发起/投票/超时/执行，支持 set-mode / play-track / remove-track 投票）
│   ├── musicMetadataController.ts # 匿名目录搜索/歌词编排，由 Web 与可选平台入口复用
│   ├── authController.ts       #   平台认证（QR 登录/Cookie 管理/状态查询；支持网易云/酷狗/QQ 音乐三平台；策略模式——通过 AUTH_PROVIDERS 映射表统一处理；fast path: 内存池命中跳过 API；slow path: getUserInfo + 任意失败重试 1 次）
│   └── playlistController.ts   #   歌单管理（获取用户歌单列表 via Socket，使用 getUserCookie 取请求者自己的 cookie，歌单私有）
│
├── services/                   # 服务层：业务逻辑
│   ├── roomService.ts          #   房间 CRUD + 角色管理 + 加入校验（validateJoinRequest）
│   ├── roomLifecycleService.ts #   房间生命周期定时器（空置删除）+ 防抖广播
│   ├── playerService.ts        #   已提交/待执行播放状态 + revision 边界 + 流 URL 解析/过期刷新 + 切歌防抖 + 加入播放同步
│   ├── streamUrlLifetime.ts    #   网易云 CDN 签名有效期解析、调度余量与按链接 TTL
│   ├── neteasePlayback.ts      #   登录态正常 v1 取链、官方公钥缓存与有界媒体可用性验证
│   ├── queueService.ts         #   队列操作（reorder 保留未包含曲目防丢歌，getNextTrack 支持 4 种播放模式，clearQueue 清空，addBatchTracks 批量添加）
│   ├── chatService.ts          #   聊天消息处理 + HTML 转义（含系统消息）
│   ├── syncService.ts          #   播放位置估算工具（estimateCurrentTime）
│   ├── musicProvider.ts        #   音乐数据聚合（3 层引用式 LRU 缓存 + 外部 API 超时保护 + 歌单分页获取；Netease 歌单使用 ncmApi.playlist_track_all 分块请求突破 1000 首限制，Kugou 用户歌单使用原生 API (get_other_list_file_nofilt) + Meting fallback，Tencent 使用 Meting 原始模式保留 VIP/时长字段）
│   ├── platformMediaService.ts #   可选房间音频读取授权、取链与有界流响应（默认未挂载）
│   ├── mediaSourceRequest.ts   #   音乐 CDN HTTPS/公网 DNS 固定及音频响应校验
│   ├── authService.ts          #   Cookie 池管理（房间级作用域；getAnyCookie 用于 VIP 播放共享，getUserCookie 用于歌单等用户私有操作）
│   ├── authProvider.ts         #   统一认证接口（AuthProvider 接口定义 + GetUserInfoResult/UserInfoData 共享类型 + AUTH_PROVIDERS 策略映射表）
│   ├── neteaseAuthService.ts   #   网易云 API 认证（QR / Cookie 验证 / 用户信息 / 用户歌单列表；getUserInfo 返回 { ok, data? } | { ok: false, reason: 'expired' | 'error' } 区分过期与临时故障）
│   ├── kugouAuthService.ts    #   酷狗 API 认证（QR 扫码登录 + VIP 检查 + 用户昵称(RSA) + 用户歌单列表 + 歌单歌曲获取；kugouRequest 含 HTTP 状态检查与 JSON 安全解析；自包含签名实现，状态码归一化为 800-803 与网易云统一）
│   ├── tencentAuthService.ts  #   QQ 音乐认证与通用 zzc 签名请求
│   ├── kugouLyricService.ts   #   酷狗 KRC 搜索、下载、XOR/压缩解密与逐词解析
│   ├── artistService.ts       #   网易云歌手搜索与主页（资料 + 最热歌曲 + 专辑并行取数，业务码校验、10 秒超时、带 TTL 的合并缓存；歌曲经 `musicProvider.ingestNeteaseSongs` 登记，之后加入队列与搜索结果一致）
│   ├── ttmlService.ts         #   TTML 逐词歌词库读取并解析为 AMLL 歌词行（固定上游路径、超时、仅同站点公网重定向、大小上限、命中/缺失/故障分级缓存、并发合并）
│   ├── voteActionService.ts    #   已通过投票的播放器/队列动作统一执行
│   └── voteService.ts          #   投票状态、在线成员阈值与当前房主否决权管理
│
├── repositories/               # 数据仓库：内存存储
│   ├── types.ts                #   接口定义（RoomRepository, ChatRepository）
│   ├── roomRepository.ts       #   房间数据 + Socket 映射 + per-socket RTT + roomToSockets 反向索引（Map<string, RoomData>）
│   └── chatRepository.ts       #   聊天记录（Map<string, ChatMessage[]>）
│
├── middleware/                  # Socket.IO 中间件
│   ├── types.ts                #   TypedServer, TypedSocket, HandlerContext
│   ├── withRoom.ts             #   房间成员身份校验
│   ├── withControl.ts          #   操作权限校验（包装 withRoom）
│   ├── socketIdentity.ts       #   网页 Cookie 身份；可选平台 JWT resolver 默认关闭
│   ├── socketRateLimiter.ts    #   Socket 事件按 identity 限流 + 多连接安全清理
│   └── httpRateLimiter.ts      #   音乐 REST / 封面代理 / 平台媒体流的 identity/IP 限流
│
├── routes/                     # Express REST 路由
│   ├── music.ts                #   GET /api/music/search|url|lyric|cover|playlist|ttml|artist|artist/songs|artist/albums（统一 validated() 路由包装器消除重复 try/catch + Zod 模式）
│   ├── platformMedia.ts        #   可选 GET /api/mapp/audio（显式身份验证器，默认未挂载）
│   ├── platformMetadata.ts     #   可选搜索/歌词平台认证（限流复用 musicApiRateLimit），普通 Web Cookie 请求继续原链
│   └── rooms.ts                #   GET /api/rooms/:roomId/check（房间预检）
│
├── types/
│   └── meting.d.ts             #   @meting/core 类型声明
│
└── utils/
    ├── logger.ts               #   结构化日志（基于 pino，info/warn/error + JSON context）
    ├── roomUtils.ts            #   房间数据转换纯函数（toPublicRoomState / toPublicRoomStateForOwner，密码仅 owner 可见）
    └── withTimeout.ts          #   Promise 限时包装（平台身份验证、元数据、媒体链路共用）
```

## packages/shared/src/ — 共享代码

```
src/
├── index.ts           # 统一导出（re-export 所有模块）
├── types.ts           # 核心类型：ERROR_CODE, Track, RoomState, PlayState, ScheduledPlayState, PlayMode, AudioQuality, User, ChatMessage, VoteAction (incl. play-track, remove-track), VoteState, RoomListItem, Playlist
├── events.ts          # 事件常量：EVENTS 对象（room:*, player:*, queue:*, chat:*, auth:*, ntp:*, playlist:*）
├── socket-types.ts    # Socket.IO 类型：ServerToClientEvents, ClientToServerEvents
├── constants.ts       # 业务常量：LIMITS（长度/数量限制）, TIMING（同步间隔/宽限期）, NTP（时钟同步参数）, QR_STATUS（扫码状态码）, QR_TIMING（轮询间隔）
├── schemas.ts         # Zod 验证 schema
├── mappMetadata.ts    # 平台只读元数据 target/query 合同与大小预算
└── abilities.ts       # CASL 权限定义（Actions incl. set-mode, Subjects, defineAbilityFor）
```

## packages/mapp/ — 微应用适配与打包

mapp 只是把现有网页前端适配为论坛微应用并打包的外壳，后端与网页端共用同一个服务。`src/` 放启动入口（`bootstrapClient`、`clientMain`）、CSP 初始化与微应用样式，`scripts/` 放客户端 manifest 生成与 SDK 打包入口。单 IIFE 与 CSS 输出到 `dist/client-web/`，运行 ZIP 输出到 `dist/client-package/`。概览见 [mini-app.md](mini-app.md)。

`src/compat/` 放置 SDK 房间连接绑定、RoomSession、RoomAudioSource、WebAudioPlayer（Web Audio 内核）、MappAudioEngine、MappPlaybackSoundFactory、MappRoomCommands、metadataFetch、coverLoader（封面经 SDK 读字节转 Blob URL）、roomCheck、MappHost、hostBinding/hostModules、内存 storageBackend，以及适配平台沙箱的 formSubmitFallback 与 trustedTypesFallback。网页端对应的封面入口是 `lib/artwork.ts` 与 `hooks/useArtworkUrl.ts`。平台 JWT 验签位于 `packages/server/src/services/platformAuth.ts`，由主站后端按环境变量启用。契约和发布门禁见 [mini-app-compatibility.md](mini-app-compatibility.md)。

## 测试文件

Vitest 测试与源码就近放置：

```text
packages/shared/src/*.test.ts
packages/server/src/**/*.test.ts
packages/client/src/**/*.test.tsx
packages/mapp/{src,scripts}/**/*.test.ts
```

默认测试使用 Node 或 jsdom 环境，并 mock 外部音乐服务。

---
