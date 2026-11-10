# 微应用与网页端同房兼容层

## 目标与当前阶段

微应用与网页端共用现有房间、队列、权限和播放状态。兼容代码只处理平台连接、可信身份及连接恢复；房间和音乐业务继续由原控制器与服务处理。

平台入口已装配进主站后端（`server/src/index.ts`），**默认关闭**：只有同时配置 `MAPP_ISSUER`、`MAPP_AUDIENCE`、`MAPP_APP_ID`（可选 `MAPP_JWKS_FILE`）才会启用；四项全空时与现状完全一致，只配置一部分或值非法则启动失败并指出变量名。微应用与网页端连接同一个域名和端口，不再需要为微应用单独分流 Cloudflare 路径或另起同步服务。线上主站尚未配置这些变量，真实平台 JWT、跨端同房与声音仍需在启用后的 sandbox 中验收。早期独立能力验证探针已退役，结论见 [微应用概览](mini-app.md)。

网页 `getSocket` 与主站启动入口保持原有路径。`SocketProvider` 仅提取同一 Context 的纯状态出口，原 Cookie bootstrap 和连接监听行为保留。开发分支仍有微应用 WIP；正式发布前需要保留这些成果并合入主站既有热修复，不从旧分支直接覆盖生产镜像。

## 传输链路

```text
微应用页面
  → createMappRoomSocket
  → Socket.IO client
  → 单实例 SDK WebSocket transport
  → 已声明的 Socket.IO WSS endpoint
  → 可选平台身份验证
  → 原 room / queue / player controllers
  → 原 services / roomRepo
  ↔ 网页原 Socket.IO 连接
```

- `packages/client/src/lib/platform/SdkRoomSocket.ts` 使用已安装的 `socket.io-client` 公开 WebSocket transport 扩展点。仅这个实例使用 SDK，不替换全局 WebSocket，不改网页 `getSocket` 单例。
- `packages/mapp/src/compat/roomSocket.ts` 绑定实际平台 SDK，要求 `user.read` 和 `network.websocket`，不调用网页 Cookie bootstrap，也不自动连接。
- SDK 使用 `textMode: "text"`；文本通过 `sendText`，二进制通过正常 SDK `send`。Engine.IO open、Socket.IO connect、事件与 ping/pong 保持原始帧，不再次 JSON 编码。
- 审核目标必须为 WSS；端点名、path 与固定 query 精确验证，拒绝客户端注入 `sid`、时间戳、保留 token query 或未支持协议。平台签发的 token 仍由 SDK 正常加入，不进入应用配置或日志。
- 握手完成前收到的帧先缓存，`ready` 后按序投递；发送经单条 Promise 链保持顺序。帧大小由服务端既有的 Socket.IO 限制约束，传输层不再重复设置帧数／字节上限。SDK 故障、超时或收到非文本/二进制帧均关闭该连接并返回固定错误，取消订阅及晚到连接。
- 断线期间业务 emit 被拒绝，Socket.IO acknowledgement retries 为 0；旧播放、跳转或队列写操作不进入重放队列。

## 身份与业务权限

`socketIdentity.ts` 接受可选的 `resolvePlatformIdentity`。没有显式平台标记时，网页沿用原签名 Cookie 验证；显式平台请求只能通过注入的服务器 resolver，空值、重复、异常编码、验证失败或超时均拒绝，不回退 Cookie，不使用客户端自填 ID。

平台令牌在 **WebSocket 升级之前**由 Engine.IO 中间件（`io.engine.use`，仅在注入 resolver 时注册）验证，符合平台审核清单“受保护 WS 在 upgrade 前验证 JWT”的要求：失败直接返回 HTTP 401、不完成升级，长轮询请求同样返回 401。验证结果以握手请求对象为键暂存，`io.use` 守卫只读取该结果；带令牌但没有预验证结果的握手一律拒绝，不回退 Cookie。无令牌的网页握手不经过该中间件，行为不变。

平台验签位于 `packages/server/src/services/platformAuth.ts`（`PlatformAuth.verifyRoomSocket` 等，官方 SDK 作为 server 依赖），平台 resolver 由它生成：

- 固定论坛 issuer、开发者 audience、应用 ID、Origin、签名和时效。
- 默认只接受 SDK 的 **production** channel，sandbox 令牌不会获得房间入口。测试沙箱构建时可显式设置 `MAPP_ALLOW_SANDBOX=true`：先按 production 验证，失败再按 sandbox 验证，其余校验不变。沙箱会话会与真实房间共用数据，测试完应移除该变量。
- Socket.IO 目标为 `/socket.io/?EIO=4&transport=websocket`，无额外动态 query，令牌唯一。
- 论坛身份由已验证的 `issuer + sub` 映射为稳定 `mapp_` 命名空间 ID；昵称相同不会绑定网页用户或取得网页房主身份。
- 接入成功后，新增的 `identity:ready` 仅向该平台连接发送服务器确认的 userId。网页默认路径不发送此事件，不改变既有启动流程。
- 平台连接只允许房间、队列、播放器、聊天、投票与校时事件。音乐账号 Cookie、二维码登录、退出账号及个人歌单入口不通过此接入通道，避免将网页音乐凭据发送到微应用。

该白名单是平台入口能力边界，不替代房间密码或 CASL 权限判断。真实 Socket.IO socket.id 继续用于连接映射与 conductor 选举，平台身份 ID 用于持久成员和房主识别。

验证只发生在握手阶段；现有房间断线行为保留。平台文档明确：已建立的 WebSocket 没有固定时长限制，也不因握手 JWT 到期而断开，每次重连须取得有效 JWT，业务权限仍由服务端逐条检查——这与握手期验证一致。正式开启前还需确认平台撤权后的处理、可信公钥轮换及生产配置，不暗中放宽现有主站入口。

## 连接恢复

`packages/mapp/src/compat/RoomSession.ts` 提供 `createMappRoomSession`，暴露原 typed socket、只读 snapshot 及显式 connect/createRoom/joinRoom/leaveRoom/dispose。create/join 的布尔返回值只表示请求已发送，不表示服务器已接受。

会话提供 `subscribe(listener)` 给外部 UI 订阅稳定、冻结的 snapshot。取消订阅不关闭 socket，dispose 通知最终状态并释放全部订阅；同一 listener 引用只算一次订阅。

恢复层只管理连接身份、已确认房间及内存中的不透明 rejoin ticket。重新连接后，必须先收到服务端身份确认，再对已确认的房间重新加入。创建房间及播放／队列写操作不自动重放；票据失效或身份改变时返回正常手动流程。

重新入房后，现有控制器发送权威房间及播放事件，适配层不自行恢复旧播放位置，也不复制队列或角色逻辑。票据、密码和令牌不出现在会话快照或日志，不新增持久化存储权限。

## 媒体与界面边界

SDK 0.3 的受控动态字节读取和 Web Audio 已在早期探针中实测（见 [微应用概览](mini-app.md)）。受控服务端音频响应随同一后端提供，需配置平台变量才会启用；带宽容量与主站升级窗口在启用前另行确认。

`MappAudioEngine` 在 `WebAudioPlayer`（单 AudioContext、单活动 source、循环/暂停/跳转、异步取消与用户手势解锁）之上提供音量和播放速率接口。默认音量为 0.12、速率为 1；播放中调速重新锚定 audio-clock 位置，保持现有 source 和未来启动 deadline，供后续复用原同步校正逻辑。

### 受控房间媒体契约

固定 HTTP 目标为 `GET /api/mapp/audio`，唯一动态 query 是 `roomId` 与 `trackId`，SDK 端点名为 `roomAudio`。平台身份由正常 HTTP JWT 验证，仍限定可信 issuer/audience/app、production、请求方法、URL、Origin 与获准 query；不回退网页 Cookie。

- 后端只允许当前房间成员读取该房间的 current/pending/queue 曲目；客户端不提供 URL。
- 取源调用既有 `musicProvider` 和服务器房间账号池，不信任队列数据中可能由客户端携带的 `streamUrl`，不向微应用或 CDN 发送 Cookie。
- 取源完成及流读取过程中重新核对成员与曲目权限。源站拒绝直接返回固定错误，不改变身份请求头、切换 IP、解锁、转码或落盘。
- 仅接受受控 HTTPS 音乐 CDN，检查并固定公网 DNS 解析，保持默认 TLS 校验；重定向、私网、压缩歧义或非 200 的上游响应不进入播放通路。响应只校验 Content-Type 白名单与 `nosniff`，不再做文件头签名嗅探；客户端仅用 `decodeAudioData` 读取。
- 预算为 32MiB、总请求/写出 30 秒（`AbortSignal.timeout`）、源连接/头部 8 秒、全局 8／单主体 2 个并发流；速率复用 `httpRateLimiter.ts` 的 `mediaStreamRateLimit`（每分钟 20 次，按身份分桶，可通过 `rateLimit` 选项注入）。流式转发使用 `stream/promises` 的 `pipeline`，取消与背压向上游传播。未验证请求的洪泛防护交给 Cloudflare 等入口层。前端 SDK 读取采用 45 秒预算和同样的大小上限，超限明确报错，不悄悄降低音质。客户端只要求 `audio/*` 或 `application/octet-stream`，不做文件头嗅探，非音频字节由 `decodeAudioData` 拒绝；取消后才到达的流响应会被 `cancel()` 释放。

路由以需显式注入验证器的 factory 提供，不在现有 `server/index.ts` 自动挂载。正式装配需将此路径置于通用 Cookie 引导及不适用的 CORS 预检处理之前，原 Web API 保持原有处理链。

### 设置存储与房间命令

既有 `storage` API 通过 `StorageAdapter` 访问后端，默认 `storageBackend` 保留浏览器 localStorage 的键、持久化和异常降级行为；模块导入时不访问原生存储。Mapp 对应 backend 仅使用本 realm Map，接受 `mt-` 设置键，显式不保存音乐平台 Cookie 或 rejoin ticket，并在应用卸载时提供 clear。昵称、服务器确认 ID 与外观/音量设置可复用原 facade，票据仍只由 RoomSession 管理。

`client/lib/RoomCommands.ts` 保留 Web 原事件及 payload；大厅建房/加入、RoomPage 自动或密码加入、离房均通过这个入口。`MappRoomCommands` 只接受对应 session 的 socket，过滤客户端身份与重入票据，委托原 session API；自动加入在权威 joining/creating 或同房已加入时合并，避免与 RoomSession 恢复重复发送。未连接时大厅不缓存 room-list 请求，而由连接事件发起。

身份变化会以固定 `IDENTITY_CHANGED` 状态清除恢复，过期/缺失票据或恢复失败亦要求手动入房。MappSocketProvider 投影 `requiresManualJoin`；共享 RoomPage 返回 InteractionGate、清除旧密码引用，只有新的用户交互才能继续。这一门控对 Web 默认关闭。正式宿主构建的模块选择及启动装配仍未开启。

### 共享播放器媒体对象

`client/src/lib/PlaybackSound.ts` 定义现有播放器 Hook 消费的最小媒体接口；默认 `playbackSoundFactory.ts` 原样将 options 传给 Howler。`useHowl` 只替换媒体创建入口，`usePlayer` 继续复用，`usePlayerSync` 保留既有计划执行、EMA 漂移校正和 conductor 上报逻辑。

`MappPlaybackSoundFactory` 使用一个共享 MappAudioEngine/context；只以 roomId/trackId 加载，忽略 Track.streamUrl/options.src，关闭音频源自动重试与 HTML5 频谱分支。每个媒体对象有稳定 sound ID、owner/operation 守卫、异步 load/play/pause/end 回调和 once 监听；卸载曲目释放 buffer，但保留已解锁 context，退出应用才 dispose。加载期间 seek 排队、pause 不终止合法字节读取；加载回调不被同一对象的控制操作丢弃。

共享 Hook 在延迟加载后采用最新的权威暂停/定位目标，避免初始化 seekTo 覆盖下载期间收到的状态。集成测试用真实 useHowl、Mapp factory/engine 及模拟 SDK/AudioContext，验证位置、调速、暂停、源拒绝不重试和跨曲目 context 复用。正式 Mapp 构建选择与页面入口仍待装配。

### React 会话桥接

`client/src/providers/SocketProvider.tsx` 导出纯 `SocketStateProvider`，现有 `useSocketContext` 消费者无需更换 Context。`MappSocketProvider.tsx` 使用 `useSyncExternalStore` 订阅外部会话，仅在连接与服务器身份均就绪后投影 connected 状态；不会调用原生 getSocket、Cookie bootstrap、浏览器存储，或接管 session 的 connect/dispose。StrictMode 重挂及切换 session 只清理自己的订阅。

正式页面尚未挂载该桥接。

### 只读搜索、歌词与封面

`shared/mappMetadata.ts` 集中固定 target、query allowlist、严格 schema 与 1MiB 预算。SDK 名称为 `musicSearch`、`musicLyric`、`musicCover`，分别对应 `GET /api/music/search`、`GET /api/music/lyric`、`GET /api/music/cover-proxy`。查询拒绝未知和重复键；schema 解析显式采用 jitless，并沿用 Mapp 的 CSP 初始化策略。

Web 的 `metadataFetch` 默认原样委托 fetch；搜索、歌词 Hook 改用这一窄入口。`createMappMetadataFetch` 只调用 SDK bytes API，校验审核 origin、GET、JSON MIME、UTF-8、响应大小及 20 秒时限，传播取消并隔离晚结果。不会转发 credentials，也不会把未审核外部 TTML URL 当作网络目标；共享歌词 Hook 正常回退到服务端 LRC/YRC/KRC 数据。

封面走同一类受控读取：`GET /api/music/cover-proxy?url=<封面 https 地址>`，平台鉴权通过后复用 Web 封面代理的主机白名单（`y.gtimg.cn`、`p1`~`p4.music.126.net`、`imgessl.kugou.com`）抓取并返回图片字节，上限 2MiB，限流沿用封面代理额度（每分钟 60 次）。网易云封面默认是数 MB 的原图（实测约 5MB，服务器上拉取需 8 秒以上，既超上限也易超时），所以平台端点对 `p1`~`p4.music.126.net` 且未带 `param` 的地址自动请求 `?param=600y600`（约 0.5MB、不到 1 秒）；列表缩略图已带的 `param=120y120` 保持不变，Web 封面代理不改。微应用侧 `coverLoader` 通过 SDK 读取字节后生成 Blob URL（官方要求图片以 Blob 加载，不直连 CDN）：白名单主机的 `http://` 先升级为 `https://`，要求 200、`image/*`（排除 SVG）、非空且不超过 2MiB；同一地址只请求一次、失败不缓存、并发 4，宿主 dispose 时撤销全部 Blob URL 并取消在途请求。网页端 `artworkLoader` 默认直接返回原 URL，`useArtworkUrl` 同步返回，网页渲染不变。

服务端 `createPlatformMetadataRouter` 默认未挂载，复用 `musicMetadataController` 的匿名目录搜索和歌词编排，不复制服务逻辑。显式 Authorization（含空/错误）、`mini_app_token` 查询参数或 Authorization 预检进入平台验证；正常 Web Cookie 请求与 Web 预检通过 `next('router')` 交还原链，不写头、不改变身份。平台验签检查 production/network.request、issuer/audience/app/time/Origin/GET/htu 与完整 query_keys，失败不降级 Cookie。认证限时 6 秒，处理限时 20 秒，JSON 响应不超过 1MiB，错误只返回固定 code。

限流不再手写：验签通过后设置 `req.identityUserId`，复用 `httpRateLimiter.ts` 的 `musicApiRateLimit`（每分钟 120 次，按身份分桶），可通过 `rateLimit` 选项替换。因路由自带该限流器，正式装配时须挂在通用 `/api/music` 限流器之前，避免重复计数。未验证请求的洪泛防护交给 Cloudflare 等入口层。

公共歌单详情仍需先核实并隔离授权缓存与 album/playlist 作用域；个人歌单和账号不进入此通道。图片与外部 TTML 也需独立受控读取，不从网页任意 URL 路径推导平台权限。

### 宿主组合

`MappHost.ts` 将同一 SDK 的 RoomSession、媒体 factory、房间命令、metadata fetch 和内存身份组合为单个宿主。构造不自动连接或创建 AudioContext；调用方先等待 SDK ready，显式 connect 和用户手势 unlock。一个 realm 仅保留一个活动宿主；失去连接、身份或房间、或切换房间时卸载当前媒体。宿主 dispose 取消 metadata 请求、关闭会话与音频、清内存，收尾后释放单宿主 guard。React Provider 仍仅订阅该外部所有者。`MappApp` 使用 MemoryRouter 和原 AppSurface（同一大厅、房间页面、弹窗与样式）；未选择 Mapp host modules 时以固定错误拒绝挂载，错误重置只离房、清状态并在内存导航，不刷新论坛页面。

`bootstrapClient` 在 SDK ready 后创建并绑定宿主，等待 React commit 再 connect，最后 best-effort lifecycle.ready。20 秒启动期限、退出/pagehide 取消、晚到 mount 立即卸载、解绑和 Host dispose 均有离线回归；隐藏/失焦不当作退出。`hostBinding` 与 hostModules 只委托同一个外部所有者，不创建原生网络回退。

房间预检通过 RoomCheckReader 入口：Web 保留原 HTTP；Mapp 等待可信会话与连接后单次 ROOM_LIST，从同一公开列表取 name/hasPassword/userCount。5 秒期限、调用方及 Host lifetime abort、断线与独立监听清理覆盖了并行和同步响应，不增加动态 path HTTP 权限；信任服务端列表载荷，不再重复校验房间 ID 格式与载荷形状。

界面后续以可兼容组件复用为目标，但不假定整个网页 bundle 可直接运行。需隔离 Cookie 引导、存储与生命周期、音频引擎等平台差异。原 Web 实现保持默认行为。

## 宿主能力与独立产物

Web hostRuntime 保留全部原能力。初始 Mapp profile 仅启用已接入的房间、SDK 音频和公开搜索/歌词：账号与集合详情、系统 MediaSession、版本轮询、剪贴板及外链按宿主策略关闭。封面不直连 CDN，而是经 `musicCover` 读字节转 Blob URL；封面读取失败时回退本地图标占位。现有 Web 导航、图片、账号与分享行为保留。

### 平台运行环境限制与兜底

微应用运行在 `sandbox="allow-scripts"` 的 iframe 中，并受平台 CSP 与 Trusted Types 约束（`autoplay` 权限策略为 `none`，需用户手势后才能发声）。这对共享的网页前端造成两类实际问题，由 `bootstrapClient` 在微应用里安装两个兜底，网页端不受影响：

- **没有 `allow-forms`**：浏览器在派发 `submit` 事件之前就拒绝原生表单提交，建房、昵称、密码等对话框的 `onSubmit` 永远不会执行。`formSubmitFallback` 把提交按钮点击与（无提交按钮表单中的）回车转换成同一表单上的普通 `submit` 事件，输入法组合期间不触发，不产生导航。
- **Trusted Types**：任何 `innerHTML` 赋值都会抛错，而歌词库清理歌词行（`innerHTML = ''`，切歌/重建歌词时）和 Radix 滚动区/下拉选择（`<style dangerouslySetInnerHTML>`，成员列表、设置等面板）都会触发，错误边界会接管整个界面。`trustedTypesFallback` 只处理两种安全等价情形：空字符串改用 `replaceChildren()`，`<style>` 元素改写 `textContent`；其余非空值委托给平台原有的 setter（仍被拒绝）。兜底定义在 `HTMLElement.prototype` 上而不是 `Element.prototype`：平台可能把后者锁成不可配置，覆盖它会被静默跳过，而下一层原型链上的同名属性始终可以定义，并排在所有 HTML 元素的原型链最前。不创建 Trusted Types policy，不引入任何 HTML 解析，卸载时只移除自己的属性。`DOMParser.parseFromString`（PixiJS 适配器与 TTML 解析）同样受限，微应用不走 TTML，暂不处理。集合缓存隔离与额外权限能力可在之后单独验证。

`pnpm --filter @music-together/mapp package` 构建并打包正式 UI，要求 `MAPP_ROOM_URL` 为审定的 WSS Socket.IO URL；mapp 不参与根目录 `pnpm build`，避免缺少该变量时拖垮主站构建。客户端复用 client workspace 已有 React/Tailwind/WASM 构建插件；Vite 8 的 IIFE 输出显式 `codeSplitting: false`，不生成运行时外部分包，CSS 单文件。客户端库模式显式构建 `process.env.NODE_ENV = "production"`，浏览器无需 Node 全局。定向构建和官方 SDK guard 已通过：ZIP 根目录仅五个必需文件，无外部分包。产物大小与 SHA-256 随代码变化，以 `dist/client-package/package.json` 为准；版本号取 manifest 的 `version`，沙箱构建由 ZIP 哈希区分，无需为每次测试升版本。

真实 JS 产物另经离线 DOM／模拟 SDK 冒烟：大厅成功挂载，原样 Engine.IO/Socket.IO 握手后请求房间列表，lifecycle.ready 只在 UI commit 后通知，pagehide 关闭 SDK 连接。在该测试中禁止原生网络发送、音频创建、Cookie/原生存储、eval/Function 与 innerHTML 写入，未触发这些调用；Socket.IO 的空 XHR 特性探测与请求发送分开处理。此测试不替代官方平台 VM、真实 JWT、设备音频或跨端同房现场验收。

产物为 `dist/client-web`、`dist/client-package`。client manifest 仅 `user.read`、`audio.webAudio`、`network.websocket`、`network.request`，声明 roomSocket、roomAudio、musicSearch、musicLyric、musicCover；不含 remote_assets 或额外权限。打包继续由官方 SDK 校验（ZIP/单文件 32MiB、展开 128MiB）。共享纯 target 数据与 manifest 解析均独立于 CLI，避免打包入口循环加载。

## 验证与发布门禁

本地测试分层覆盖：

1. 实际 Socket.IO client 配合 fixture SDK 验证原始帧、连接 ID、事件、ping/pong、二进制、取消、背压及重连，不监听端口。
2. 官方 SDK 和内存 ES256 密钥验证平台握手约束、稳定身份映射、超时及默认关闭行为。
3. 复用真实 room/queue controllers 的内存双端回归，验证网页和平台成员互相加入同房、共享队列，密码与房主权限保留，以及新 socket 恢复既有 creator/conductor。

当前全量回归通过，Client、Server、Shared、Mapp 类型检查与 Client lint 通过；平台升级前验证已用真实 Engine.IO 做过一次性复核（坏令牌升级前 401，好令牌升级后收到 `identity:ready`，无令牌的网页握手不变）。这些不替代下述真实启用验收。

### 启用与部署

- **环境变量**：`MAPP_ISSUER`（论坛 https 地址，可带子目录）、`MAPP_AUDIENCE`（本服务公开 https origin，主机名不能与 issuer 相同）、`MAPP_APP_ID`（平台分配的 UUIDv7）、可选 `MAPP_JWKS_FILE`（绝对路径，只读公钥文件）、可选 `MAPP_ALLOW_SANDBOX`（`true` 时同时接受沙箱令牌，仅限测试）。全空即关闭；使用公钥文件时需把该文件挂载进主站容器并指向其容器内路径。
- **公钥**：默认从 issuer 的 `/mini-app-api/jwks` 获取（禁止重定向、5 秒超时、缓存 10 分钟，同一时刻只下载一次并带 10 秒冷却）。启动时只做尽力预热，失败不影响主站启动，首个令牌到来时再按需加载。
- **镜像**：Dockerfile 额外复制仓库根 `vendor/`（官方 SDK 原样发行文件），不复制 mapp 源码。
- **挂载顺序**：平台搜索/歌词与媒体路由挂在通用 `cors`、`express.json`、Cookie 身份引导和 `/api/music` 限流之前；它们自带 CORS、预检与鉴权，普通 Web 请求原样交还原链。

启用前仍需确认：应用 endpoint 权限、媒体带宽与域名交付条件、主站升级窗口和房间清空影响；Git 提交、推送与正式发布不由本地实现自动触发。
