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
│   ├── TrackListItem.tsx        #   共享曲目行渲染（序号+封面+标题VIP+歌手名（ArtistNames，点击开歌手页）+时长+isAdded 添加按钮，memo 优化）
│   ├── ArtistNames.tsx          #   一首歌的歌手名 "A / B"，每个名字都可点击打开歌手页（有歌手 id 直达，否则按名字查找）；没有歌手页的平台为纯文本或由调用方指定点击行为。**凡是显示歌手名的地方都用它**：曲目行、播放队列、正在播放（桌面/移动/紧凑三种布局）
│   ├── VirtualTrackList.tsx     #   共享虚拟滚动曲目列表（@tanstack/react-virtual + 无限加载 + skeleton + 空态，forwardRef 暴露 scrollToTop）
│   ├── EmptyState.tsx           #   空状态（图标 + 一行字，撑满所在区域并上下左右居中）；曲目列表与搜索结果共用
│   ├── ArtworkImage.tsx         #   所有封面/头像的统一外框：图片在路上（已请求或宿主还在读取字节）时显示脉动骨架，到了再淡入；没有封面或读取失败（`useArtwork` 的 `failed`）才显示占位图标，因此占位图只代表"没有图"，不会是"可能还在加载"；`load=false`（列表行未进入视口）与 `pending`（所属对象还在获取）也显示为加载中
│   ├── PlatformSelect.tsx       #   音乐平台下拉（网易云/QQ/酷狗 + 彩色圆点）；搜索弹窗与音乐账号共用，取代占满一行的按钮条/标签条
│   ├── DialogNav.tsx            #   弹窗里"进入下一级"的两个部件：`DialogNavBar`（标题栏：返回按钮在标题左侧，出现/消失时宽度过渡、标题被推开；标题换页时淡入）与 `DialogPageTransition`（换页淡出淡入）。页面本身不带标题和返回，由容器弹窗提供
│   ├── Pages/                   #   可复用的独立页面（由弹窗当容器显示，自己不含返回按钮和标题）
│   │   ├── PlaylistPage.tsx    #     歌单/专辑的曲目页（TrackCollection）
│   │   ├── ArtistPage.tsx      #     歌手主页（头像/简介/热门歌曲/专辑两个标签，目前仅网易云有数据；网页端与微应用同一份代码）
│   │   └── TrackCollection.tsx #     可分页曲目列表（VirtualTrackList + queueKeys/addedIds 去重 + 动态全部添加过滤重复），歌单、专辑、歌手主页共用
│   ├── Overlays/
│   │   ├── QueueDrawer.tsx     #     播放队列抽屉（vaul Drawer，移动端底部/桌面端右侧）
│   │   ├── SearchDialog.tsx    #     音乐搜索弹窗（单曲/歌手/专辑/歌单四个标签；VirtualTrackList 虚拟滚动 + 自动无限加载 + AbortController 竞态防护；专辑/歌单点进详情视图；歌手（搜索结果或歌曲行里的歌手名）打开全局歌手页）
│   │   ├── ArtistDialog.tsx    #     **全局唯一**的歌手页弹窗（挂在 RoomPage，由 `artistPageStore` 驱动）：搜索、队列、正在播放、账号页的歌手推荐都通过 `openArtistPage` 打开它，叠在当前弹窗之上，关闭回到原处；点歌手页里的专辑在原位展开，换歌手则重新开始
│   │   ├── CollectionRow.tsx   #     可点击的结果行（专辑/歌单方形封面，歌手圆形头像）
│   │   ├── CoverCard.tsx       #     封面网格磁贴（方形或圆形封面 + 标题 + 副标题；进入视口才加载封面）与 CoverGrid（手机 3 列，随弹窗变宽到 4、5 列）
│   │   ├── SettingsDialog.tsx  #     设置弹窗（壳，用 ui/tabs 的 Tabs：房间/成员/外观/歌词；宽屏（`useMediaQuery('(min-width: 768px)')`）左侧竖排，窄屏顶部横向可滚动；不再包含账号）
│   │   ├── AccountDialog.tsx   #     音乐账号弹窗（网易云/QQ/酷狗登录、VIP 状态、个人歌单导入，内容是 PlatformHub；入口在房间顶栏的"音乐账号"按钮，桌面为独立图标、移动端在"更多"菜单；`hostRuntime.platformAccounts` 为 false 的宿主不渲染）
│   │   └── Settings/
│   │       ├── SettingRow.tsx              # 设置行共享组件
│   │       ├── RoomSettingsSection.tsx     # 房间设置（名称、密码）
│   │       ├── MembersSection.tsx          # 成员列表（角色管理）
│   │       ├── PlatformHub.tsx            # 账号弹窗正文：主页（AccountHome）与从它打开的歌单/专辑/每日推荐（PlaylistPage），就地换页；页面栈、标题与返回按钮属于弹窗（`useDialogPages` + `DialogNavBar`），这里只管两页共用的数据；切换平台退出已打开的内容
│   │       ├── AccountHome.tsx            # 账号主页，照流媒体首页做成**一页滚动的区块**（不是标签页）：我的歌单 → 推荐歌单 → 私人雷达 → 歌手推荐 → 新碟上架；每日推荐是推荐歌单的第一块普通磁贴；平台不支持的区块合并成一条"暂不提供…"提示；只负责展示与上报选择，不管怎么打开
│   │       ├── DiscoverSections.tsx       # 区块组件：Section、CoverSection（封面网格 + 加载/空/失败状态）、Note（明确提示：需要登录 / 该平台暂不提供 / 加载失败可重试）
│   │       ├── AccountMenu.tsx            # 弹窗右上角：平台下拉 + 头像（点开账号卡：昵称、VIP badge、房间登录情况、登录/登出）
│   │       ├── LoginActions.tsx           # 扫码登录 / Cookie 登录两个按钮（账号卡与各区块的登录提示共用）
│   │       ├── LoginBanner.tsx            # 账号页**唯一**的登录入口（未登录时置顶；各区块只写"需要登录"的文字，不再各放一组按钮）
│   │       ├── PlaylistSection.tsx        # 我的歌单封面网格（未登录时给出提示和登录按钮；封面经 useArtworkUrl，微应用同样可见）
│   │       ├── ProfileSettingsSection.tsx  # 个人设置（昵称）
│   │       ├── AppearanceSection.tsx       # 外观设置（歌词 + 背景 + 布局）
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
│       ├── collapse.tsx        #   按高度展开/收起内容（grid-rows 过渡，内容保持挂载，收起时 inert）；用于弹窗里会出现的字段，避免高度突变
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
│       ├── responsive-dialog.tsx  #   响应式弹窗（桌面 Dialog / 手机 Drawer）；所有弹窗共用同一个标题栏：`DIALOG_BAR_CLASS`（h-14、下分割线、右侧给关闭按钮留位）与正文内边距 `DIALOG_BODY_CLASS`，弹窗内容本身用 `gap-0 p-0`，这样标题在每个弹窗里位置和高度一致
│       ├── sheet.tsx
│       ├── skeleton.tsx
│       ├── slider.tsx
│       ├── switch.tsx
│       ├── tabs.tsx
│       ├── textarea.tsx
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
│   ├── useArtworkUrl.ts        #   封面地址：`useArtwork` 返回 `{ src, failed }`（网页端直接用 URL；需读字节的宿主加载并重试一次，仍失败则 `failed`），`useArtworkUrl` 只取地址
│   ├── useDialogPages.ts       #   弹窗的页面栈（`open`/`back`/`reset`，`current` 为当前页或 null=弹窗自己的首页）；每页带 `title`，标题栏显示它；搜索、账号、歌手页弹窗共用
│   ├── useMediaQuery.ts        #   订阅一条 CSS 媒体查询的匹配结果（需要按屏宽切换组件方向/结构而非仅样式时用）
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
│   ├── useDiscover.ts          #   每日推荐、雷达歌单、首页区块（推荐歌单/歌手/新碟，一次请求）；各自独立的请求代际，慢响应不会覆盖新平台的结果；401/400/其他映射为 login-required/unsupported/failed
│   ├── useAccountSession.ts    #   账号弹窗的共享会话：当前平台、登录状态、扫码/Cookie 登录流程（头部菜单与正文共用，useAuth 只挂一份）
│   ├── useAccountDiscover.ts   #   账号主页要展示的内容：按平台加载、登录变化时重载（等已保存登录确认后再载，未登录不请求每日推荐）、不显示其他平台的旧数据、各区块的 loading/error（服务端标记失败的区块算失败，不算"暂无内容"）、每日推荐磁贴
│   ├── useQueueMembership.ts   #   哪些歌已在房间队列里（给"添加到队列"的列表用）：刚发出的歌立刻算已添加，进队列后以队列为准（移除后可再添加），服务端没收的 5 秒后不再算；`addOnce` 已在队列则提示不重复发送。搜索与歌单/专辑/歌手列表共用
│   ├── useInView.ts            #   元素接近视口时变为 true 并保持（长列表按需加载封面，CoverCard 与 CollectionRow 共用）
│   ├── useDataImageUrl.ts      #   base64 data: 图片 → Blob URL（登录二维码；沙箱 CSP 拦截 data: 图片）
│   ├── useArtist.ts            #   歌手主页状态（资料 + 歌曲/专辑各自分页；按"服务端已发出条数"计偏移并去重；代际计数防止慢请求覆盖新歌手；`loadByName` 只有名字时先按名字找到歌手，没有同名的就报"没有找到这位歌手"，不猜）
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
│   ├── artistPageStore.ts      #   要打开的歌手（平台 + 歌手 id 或名字）；`openArtistPage()` 可在任何事件处理里调用，由 ArtistDialog 展示
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
    ├── artistLink.ts           #   歌手链接：哪些平台有歌手页、把一首歌的歌手名与 id 配成可打开的目标（id 与名字数量对不上就不用 id）
    ├── musicApi.ts             #   `/api/music/*` 的唯一 GET-JSON 入口（走宿主传输、带凭据）：`getMusicJson` 与带状态码的 `ApiError`/`statusOf`；歌手、发现、按名找歌手共用
    ├── artistLookup.ts         #   只有名字时用歌手搜索找歌手（只认同名，忽略大小写/全半角/空格，不取模糊的第一条；查询带齐搜索目标的全部键，微应用同样可用）
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
    ├── platform.ts             #   平台常量（PLATFORM_LABELS / PLATFORM_SHORT_LABELS / PLATFORM_DOT / PLATFORM_GLYPH、会员名称 `vipLabel`（按平台区分等级）、状态查找函数）；平台清单本身（`MUSIC_SOURCES`、`ARTIST_SOURCES`、`DISCOVER_SOURCES`）在 shared/constants
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
│   ├── queueService.ts         #   队列操作（reorder 保留未包含曲目防丢歌，getNextTrack 支持 4 种播放模式（队列模式为 consume 时按 `effectivePlayMode` 不循环），clearQueue 清空，addBatchTracks 批量添加）
│   ├── chatService.ts          #   聊天消息处理 + HTML 转义（含系统消息）
│   ├── syncService.ts          #   播放位置估算工具（estimateCurrentTime）
│   ├── musicProvider.ts        #   音乐数据聚合（3 层引用式 LRU 缓存 + 外部 API 超时保护 + 歌单分页获取）；不依赖缓存状态的部分已陆续拆出：封面地址处理 `coverUrls`、专辑/歌单搜索 `catalogSearch`、歌词读取 `lyricFetch`、各平台原始曲目到 `Track` 的映射 `trackMapping`、整份歌单/专辑的来源 `playlistFetchers`、KRC 转逐词歌词 `kugouLyricService`；留在这里的是缓存与曲目注册表、搜索、播放地址、歌单分页切片与封面补全
│   ├── playlistFetchers.ts    #   整份歌单/专辑从哪里取：网易云用 ncmApi.playlist_track_all 每 1000 首一块（突破 Meting 的 1000 首限制，带调用者 cookie 读私有歌单）和 ncmApi.album；酷狗/QQ 歌单先走原生接口（酷狗 300 首、QQ 100 首一页），没数据回退 Meting 原始模式（保留 VIP/时长字段），专辑只走 Meting；每个函数只取数据，成功返回曲目、无数据/超时/失败（记日志）返回空数组，不碰缓存与注册表，由 `musicProvider` 收录。行为由 `musicProvider.playlist.test.ts` 固定
│   ├── lyricFetch.ts          #   读取一首歌的歌词：网易云走 SDK（含逐词 YRC），QQ/酷狗走 Meting，酷狗再加 KRC 逐词行；超时或无法解析返回 null（调用方不缓存），硬失败抛出
│   ├── trackMapping.ts        #   各平台原始歌曲数据 → `Track` 的纯函数（`rawToTrack`、`kugouSongToTrack`、`navigatePath`），含网易云歌手 id 对齐与"没人署名"占位符
│   ├── coverUrls.ts           #   封面地址的纯函数：网易云去尺寸限制并升级 https、酷狗模板尺寸、各平台缩略图推导（网易云可指定任意尺寸）
│   ├── idLookup.ts            #   按 ID 找一首歌/一张专辑/一个歌单/一位歌手（`lookupById`）：网易云与 QQ 通过 Meting 原始模式拿元数据（歌曲经 `musicProvider.ingest` 注册，之后点歌与搜索结果一致）；酷狗的专辑和歌单答复只有歌曲，所以名称取自其中内容（"专辑 <id>"/"歌单 <id>"）；酷狗对付费歌曲不报时长（0，播放器从音频读取）；不存在返回空列表，平台不应答抛 `SearchError`；歌手走 `artistService`
│   ├── catalogSearch.ts       #   三个平台的专辑/歌单搜索（`searchAlbums`/`searchPlaylists`）：QQ 请求、酷狗请求、网易云 Meting 各一个小函数共用；检查 HTTP 状态与业务码，搜索没有结果返回空列表，请求失败/超时/答复无法解析则抛 `SearchError` 并记日志（让界面提示重试，而不是显示"没有结果"）；QQ 封面升级 https
│   ├── platformMediaService.ts #   可选房间音频读取授权、取链与有界流响应（默认未挂载）
│   ├── mediaSourceRequest.ts   #   音乐 CDN HTTPS/公网 DNS 固定及音频响应校验
│   ├── authService.ts          #   Cookie 池管理（房间级作用域；getAnyCookie 用于 VIP 播放共享，getUserCookie 用于歌单等用户私有操作）
│   ├── authProvider.ts         #   统一认证接口（AuthProvider 接口定义 + GetUserInfoResult/UserInfoData 共享类型 + AUTH_PROVIDERS 策略映射表 + `listUserPlaylists`：自己的歌单，封面已处理好）
│   ├── fallbackCooldown.ts    #   自动换源冷却（按房间分组，房间销毁时清掉，避免无限增长）
│   ├── gridCovers.ts          #   封面网格用的封面处理：https 升级与按网格尺寸（256px）的缩略图，网易云可任意缩放，其他平台保持原图
│   ├── neteaseAuthService.ts   #   网易云 API 认证（QR / Cookie 验证 / 用户信息 / 用户歌单列表；getUserInfo 返回 { ok, data? } | { ok: false, reason: 'expired' | 'error' } 区分过期与临时故障）
│   ├── kugouAuthService.ts    #   酷狗 API 认证（QR 扫码登录 + VIP 检查 + 用户昵称(RSA) + 用户歌单列表 + 歌单歌曲获取；kugouRequest 含 HTTP 状态检查与 JSON 安全解析；自包含签名实现，状态码归一化为 800-803 与网易云统一）
│   ├── tencentAuthService.ts  #   QQ 音乐认证与通用 zzc 签名请求
│   ├── kugouLyricService.ts   #   酷狗 KRC 搜索、下载、XOR/压缩解密与逐词解析，以及转成歌词播放器行格式的 `krcToAmllLines`
│   ├── discoverService.ts     #   网易云每日推荐（按账号缓存 30 分钟，无登录直接 401）、雷达歌单列表（7 个固定歌单，匿名读取，缓存 1 小时，单个失败不影响其余）、首页区块 `getHome`（推荐歌单：登录用 `recommend_resource` 按账号缓存、未登录/登录失效用 `personalized` 共享缓存；热门歌手与新碟共享缓存 1 小时；区块各自失败为空，全部失败才报错）
│   ├── catalogUtils.ts        #   网易云目录服务共用工具：统一的 `CatalogError`（kind/code/status，ArtistError、DiscoverError、`SearchError` 的基类，Web 路由与微应用适配器按 kind 映射）、宽松解析、`neteaseArtist`/`neteaseAlbum`/`neteaseCover` 映射、`withDeadline`、带 TTL 且合并并发请求的 `sharedCache`
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
    └── withTimeout.ts          #   限时包装，两种有意区分：`withTimeout` 超时即 reject（身份验证、元数据、媒体链路）；`withTimeoutOrNull` 超时返回 null、也接受带 AbortSignal 的 fetch 函数（目录搜索、网易云认证）
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
├── musicRef.ts        # 按 ID 查找：各平台歌曲/专辑/歌单/歌手的 ID 形状（`normalizeMusicId`，只放行合法 ID，纯 ID 或同平台同类型分享链接里的 ID）、分享链接解析（`parseMusicLink`，识别平台与类型；网易云/QQ/酷狗常见链接格式，不会信任仿冒域名）、`looksLikeMusicId`（比前者更严：短数字、普通词仍当作关键词）、`supportsIdLookup`（歌手页仅网易云）
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
