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
- 平台连接只允许明确列出的事件：房间、队列、播放器、聊天、投票与校时，以及音乐账号事件（`auth:request_qr` / `check_qr` / `set_cookie` / `logout` / `get_status`、`playlist:get_my`）；服务端到客户端的事件和未知事件一律拒绝。账号事件对应的控制器只认服务端验证过的 socket 身份（`mapp_…` 用户 ID）及其所在房间，登录得到的 Cookie 进入该房间账号池、归属该用户，和网页用户完全一致，且每个 socket 单独限流。

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
- 取链与房间播放共用 `streamUrlResolver`：按房间音质取链，取不到时依次降到 320/192/128（与 Web 一致，避免高音质无 URL 时微应用整首失败）。预算为 32MiB、取链 20 秒、整个请求含传输 5 分钟（`AbortSignal.timeout`；传输上限不再与取链共用 30 秒，慢连接也能下完一首）、源连接/头部 8 秒、全局并发流默认 8（`MAPP_MAX_STREAMS`，1–32）、单主体 2 个；超出全局上限的请求最多 64 个按先后排队、最长等 15 秒（排队只占一个挂起连接，不占上游连接和缓冲），超时或队列已满才返回 429，等待中取消则释放排位；客户端在 429/503 时 2 秒后重试一次，整体超时 75 秒；速率复用 `httpRateLimiter.ts` 的 `mediaStreamRateLimit`（每分钟 20 次，按身份分桶，可通过 `rateLimit` 选项注入）。流式转发使用 `stream/promises` 的 `pipeline`，取消与背压向上游传播；上游和字节守卫先写入暂存流，读到第一块数据后才写响应头。首字节之前的失败（上游断开、空正文、房间权限变化）因此仍能返回带 CORS 头的 JSON 错误，而不是销毁套接字——后者经 Cloudflare 变成不带 CORS 头的 502，浏览器只会报成 CORS 错误，什么都看不出来。音频接口的上游类失败（内部 502/504）对外一律发 503：Cloudflare 会把源站的 502/504 换成自己的错误页，那个页面没有 CORS 头，浏览器只会报一个 CORS 错误，固定 code 到不了客户端（封面/搜索等平台端点仍用 502/504，客户端对它们只做回退，不依赖状态码）。QQ 音乐的下载域名（当前为 `aqqmusic.tc.qq.com`）属于 `tc.qq.com`，CDN 白名单按该后缀放行。平台音频失败按固定 code 与状态码记录警告日志（不含 URL、Cookie 或供应商文本），401 与客户端取消除外。未验证请求的洪泛防护交给 Cloudflare 等入口层。前端 SDK 读取采用 45 秒预算和同样的大小上限，超限明确报错，不悄悄降低音质。客户端只要求 `audio/*` 或 `application/octet-stream`，不做文件头嗅探，非音频字节由 `decodeAudioData` 拒绝；取消后才到达的流响应会被 `cancel()` 释放。

路由以需显式注入验证器的 factory 提供，不在现有 `server/index.ts` 自动挂载。正式装配需将此路径置于通用 Cookie 引导及不适用的 CORS 预检处理之前，原 Web API 保持原有处理链。

### 设置存储与房间命令

既有 `storage` API 通过 `StorageAdapter` 访问后端，默认 `storageBackend` 保留浏览器 localStorage 的键、持久化和异常降级行为；模块导入时不访问原生存储。Mapp 对应 backend 以本 realm Map 为主，接受 `mt-` 设置键；其中仅音乐平台登录 Cookie（`mt-auth-cookies`）会写入 SDK 的应用级持久存储以便下次恢复，rejoin ticket 不持久化，也不写入原生存储；应用卸载时提供 clear。昵称、服务器确认 ID 与外观/音量设置可复用原 facade，票据仍只由 RoomSession 管理。

`client/lib/RoomCommands.ts` 保留 Web 原事件及 payload；大厅建房/加入、RoomPage 自动或密码加入、离房均通过这个入口。`MappRoomCommands` 只接受对应 session 的 socket，过滤客户端身份与重入票据，委托原 session API；自动加入在权威 joining/creating 或同房已加入时合并，避免与 RoomSession 恢复重复发送。未连接时大厅不缓存 room-list 请求，而由连接事件发起。

身份变化会以固定 `IDENTITY_CHANGED` 状态清除恢复，过期/缺失票据或恢复失败亦要求手动入房。MappSocketProvider 投影 `requiresManualJoin`；共享 RoomPage 返回 InteractionGate、清除旧密码引用，只有新的用户交互才能继续。这一门控对 Web 默认关闭。正式宿主构建的模块选择及启动装配仍未开启。

### 共享播放器媒体对象

`client/src/lib/PlaybackSound.ts` 定义现有播放器 Hook 消费的最小媒体接口；默认 `playbackSoundFactory.ts` 原样将 options 传给 Howler。`useHowl` 只替换媒体创建入口，`usePlayer` 继续复用，`usePlayerSync` 保留既有计划执行、EMA 漂移校正和 conductor 上报逻辑。

**首播耗时与码率上限**：网页端用 `<audio>` 流式播放（Howler `html5: true`，收到第一段就能播），微应用做不到——沙箱只有 Web Audio，`decodeAudioData` 需要完整文件，SDK 的 `audio.play` / `video.playProgram` 只播 manifest 声明并校验过的资源（固定文件，或每段带 `sha256`/`size` 的分段），不适用动态歌曲。沙箱 CSP 还有 `media-src 'none'`（沙箱实测：`<audio>` 加载 `blob:` URL 会被拦截），所以 `<audio>` / MediaSource 的边下边播也走不通。所以微应用的首播耗时就是整个文件的下载时间，而瓶颈是服务器（海外）到音乐 CDN 的链路：实测 2MB 封面约 0.6–0.7MB/s（偶发降到 50KB/s），音频约 1–1.5MB/s，320kbps 的 4 分钟歌（约 10MB）要 6–9 秒。服务端因此给微应用音频接口加了码率上限 `MAPP_AUDIO_MAX_BITRATE`（默认 128kbps，约 4MB，耗时约为 320kbps 的 40%，上游带宽也最省），取房间音质与上限中较小者，网页端不受影响；需要更高音质可设为 192/320/999。服务器配置有限，所以微应用只做转发，不转码、不落盘、不做服务端缓存，缓存、解码、预载都留在用户浏览器里。

**切歌预取**：微应用必须经 SDK 下载整个文件才能解码（约 10MB 实测 7 秒），不预取时每次切歌都会比房主晚数秒、从曲目中途开始。服务端在每首歌开始后广播 `player:preload`（见 data-flow），`MappPlaybackSoundFactory.preload` 交给 `MappAudioEngine.preloadRoomTrack` 提前下载下一首的压缩字节（仅一份，不含解码后的音频，避免占用数倍内存）；切歌时 `loadRoomTrack` 接手同一首的预取（含仍在传输中的），只剩解码。鉴权沿用 `roomAudio`：下一首已在房间队列里，服务端的“曲目属于该房间”检查照常通过。

`MappPlaybackSoundFactory` 使用一个共享 MappAudioEngine/context；只以 roomId/trackId 加载，忽略 Track.streamUrl/options.src，关闭音频源自动重试与 HTML5 频谱分支。每个媒体对象有稳定 sound ID、owner/operation 守卫、异步 load/play/pause/end 回调和 once 监听；卸载曲目释放 buffer，但保留已解锁 context，退出应用才 dispose。加载期间 seek 排队、pause 不终止合法字节读取；加载回调不被同一对象的控制操作丢弃。

共享 Hook 在延迟加载后采用最新的权威暂停/定位目标，避免初始化 seekTo 覆盖下载期间收到的状态。集成测试用真实 useHowl、Mapp factory/engine 及模拟 SDK/AudioContext，验证位置、调速、暂停、源拒绝不重试和跨曲目 context 复用。正式 Mapp 构建选择与页面入口仍待装配。

### React 会话桥接

`client/src/providers/SocketProvider.tsx` 导出纯 `SocketStateProvider`，现有 `useSocketContext` 消费者无需更换 Context。`MappSocketProvider.tsx` 使用 `useSyncExternalStore` 订阅外部会话，仅在连接与服务器身份均就绪后投影 connected 状态；不会调用原生 getSocket、Cookie bootstrap、浏览器存储，或接管 session 的 connect/dispose。StrictMode 重挂及切换 session 只清理自己的订阅。

微应用入口 `client/src/platform/MappApp.tsx` 在 `MemoryRouter` 内以 `MappSocketProvider` 挂载该桥接；该入口仅在平台配置启用时可达，真实平台 sandbox 验收见上文。

### 只读搜索、歌词与封面

`shared/mappMetadata.ts` 集中固定 target、query allowlist、严格 schema 与 1MiB 预算。SDK 名称为 `musicSearch`、`musicLyric`、`musicTtml`、`musicCover`、`musicArtist`、`musicArtistSongs`、`musicArtistAlbums`、`musicPlaylist`，分别对应 `GET /api/music/search`、`/lyric`、`/ttml`、`/cover-proxy`、`/artist`、`/artist/songs`、`/artist/albums`、`/playlist`。查询拒绝未知和重复键（畸形转义同样报 `METADATA_QUERY_REJECTED`）；schema 解析显式采用 jitless，并沿用 Mapp 的 CSP 初始化策略。

**新增一个只读接口只改三处，网页端与微应用同时生效**：① `mappMetadataTargets.ts` 加一条 target（路径、SDK 端点名、query 键）；② `mappMetadata.ts` 的 `MAPP_METADATA_SCHEMAS` 加对应严格 schema（`satisfies` 保证每个 target 都有 schema，并让解析结果类型随 target 变化）；③ `platformMetadata.ts` 的 `handlers` 表加处理函数（类型保证每个 JSON target 都有 handler）。manifest 的 endpoints 由 target 表自动生成，平台 JWT 的 `query_keys` 校验读同一张表，`mappMetadata.test.ts` 校验 `queryKeys` 与 schema 的键集合一致，所以不会各写一份而漂移。因为平台签名的是实际发出的键集合，每个 schema 都用默认值保证所有键总是出现（例如 `limit/offset/total`）。

歌手搜索、歌手主页（`/api/music/artist*`，见 [数据流](data-flow.md)）与专辑/歌单详情在微应用里与网页端是同一套界面代码：客户端不再用宿主开关隐藏它们，请求经上面的 target 走 SDK。歌手主页首屏（50 首歌曲 + 30 张专辑）和歌单分页（`MAPP_PLAYLIST_PAGE_MAX = 200` 首/页，网页端同样按 200 分页，保证行为一致）都在 1MiB 预算内。

Web 的 `metadataFetch` 默认原样委托 fetch；搜索、歌词 Hook 改用这一窄入口。`createMappMetadataFetch` 只调用 SDK bytes API，校验审核 origin、GET、JSON MIME、UTF-8、响应大小及 20 秒时限，传播取消并隔离晚结果。不会转发 credentials，也不会把任何外部 URL 当作网络目标。

TTML 逐词歌词走第四个只读端点 `musicTtml`（`GET /api/music/ttml?source=netease|tencent&id=<歌曲 ID>`，id 限 `[A-Za-z0-9_-]{1,64}`）：服务端 `ttmlService` 只拼接 `TTML_DB_BASE_URL/<ncm-lyrics|qq-lyrics>/<id>.ttml`，6 秒总超时。公共库会把 `amlldb.…` 302 到 API 子域，所以手动跟随重定向，但只允许 https、无端口/凭据、主机名属于基础域名同一站点（以基础域名为后缀，基础地址不要指向 `github.io` 这类共享后缀）、最多 3 跳，且每一跳的解析结果都必须是公网地址（尽力防护，fetch 自身会再解析一次）。

**解析在服务端完成**：微应用的 Trusted Types 不允许 `DOMParser.parseFromString`，所以服务端用 AMLL 官方 `TTMLParser` 注入 `@xmldom/xmldom` 解析（拒绝含 DTD/ENTITY 的文件，解析错误一律视为“没有条目”），客户端只收到歌词行，两端结果一致，客户端也不再打包解析步骤。原文 ≤ 512KiB，解析后的 JSON ≤ 900KiB（低于平台 1MiB 预算，网页端与微应用不会因此出现差异）。命中缓存 6 小时、没有条目缓存 10 分钟、瞬时故障只缓存 30 秒（避免故障库拖慢每次切歌），缓存同时受 500 条和 16MiB 约束，同一首歌的并发请求合并。

响应为 `{ lines }` JSON，平台端复用现有“JSON + 1MiB”传输。库里没有这首歌时是 `lines: null`（200，浏览器不会在控制台报错），上游故障是 502（平台端固定 code `METADATA_FAILED`）。共享歌词 Hook 在两端与服务端歌词请求同时发出，TTML 失败或没有歌词行时回退到 LRC/YRC/KRC 数据，库慢不会拖慢基础歌词。网页端过去直连第三方库会被 CORS 拦截（库对所有请求先 302），“库地址”设置项也无法在服务端安全沿用，该设置项已移除，改由运维用 `TTML_DB_BASE_URL` 指定。酷狗在库里没有目录，继续使用原生 KRC 逐词歌词。

封面走同一类受控读取：`GET /api/music/cover-proxy?url=<封面 https 地址>`，平台鉴权通过后复用 Web 封面代理的主机白名单（`y.gtimg.cn`、`p1`~`p4.music.126.net`、`imgessl.kugou.com`）抓取并返回图片字节（上游重定向手动跟随，目标必须仍在白名单且为 https，最多 3 跳，Web 与平台共用），上限 2MiB，限流沿用封面代理额度（每分钟 60 次）。网易云封面默认是数 MB 的原图（实测约 5MB，服务器上拉取需 8 秒以上，既超上限也易超时），所以平台端点对 `p1`~`p4.music.126.net` 且未带 `param` 的地址自动请求 `?param=600y600`（约 0.5MB、不到 1 秒）；列表缩略图已带的 `param=120y120` 保持不变，Web 封面代理不改。微应用侧 `coverLoader` 通过 SDK 读取字节后生成 Blob URL（官方要求图片以 Blob 加载，不直连 CDN）：白名单主机的 `http://` 先升级为 `https://`，要求 200、`image/*`（排除 SVG）、非空且不超过 2MiB；同一地址只请求一次、失败不缓存、并发 4；已完成的封面按最近使用排序、总计超过 48MiB 就回收（revoke）最久未用的，翻长列表不会让沙箱内存无限增长（白名单来自 shared 的 `COVER_HOST_ALLOWLIST`，与服务端是同一份）；排队等位的请求后来先服务，刚开始播放的这首的封面不会排在一长串列表缩略图后面；`useArtworkUrl` 失败后 2.5 秒自动重试一次，一次瞬时的代理/CDN 故障不会让占位图留到整首歌结束；宿主 dispose 时撤销全部 Blob URL 并取消在途请求。网页端 `artworkLoader` 默认直接返回原 URL，`useArtworkUrl` 同步返回，网页渲染不变。

服务端 `createPlatformMetadataRouter` 仅在平台配置启用时挂载（`server/src/index.ts`，与媒体路由一并置于 Web CORS / Cookie 引导之前），复用 `musicMetadataController` 的匿名目录搜索和歌词编排，不复制服务逻辑。显式 Authorization（含空/错误）、`mini_app_token` 查询参数或 Authorization 预检进入平台验证；正常 Web Cookie 请求与 Web 预检通过 `next('router')` 交还原链，不写头、不改变身份。平台验签检查 production/network.request、issuer/audience/app/time/Origin/GET/htu 与完整 query_keys，失败不降级 Cookie。认证限时 6 秒，处理限时 20 秒，JSON 响应不超过 1MiB，错误只返回固定 code。

限流不再手写：验签通过后设置 `req.identityUserId`，复用 `httpRateLimiter.ts` 的 `musicApiRateLimit`（每分钟 120 次，按身份分桶），可通过 `rateLimit` 选项替换。因路由自带该限流器，正式装配时须挂在通用 `/api/music` 限流器之前，避免重复计数。未验证请求的洪泛防护交给 Cloudflare 等入口层。

歌单缓存已按"类型 + 凭据"隔离（`playlistCacheKey`：专辑与歌单同号不再串，带账号 Cookie 取到的私有歌单只属于该 Cookie，Cookie 本身不进缓存键）；公共 `musicPlaylist` 端点始终匿名读取（不带 `roomId`，服务端传 `null` Cookie），私有歌单不可能经它泄漏。个人歌单和账号登录仍不进入此通道，见下节"账号"计划。平台权限不从网页任意 URL 路径推导：图片只经封面端点、TTML 只经 `musicTtml`，二者都由服务端固定上游。服务端对这些端点的失败一律以 503（不用 502/504）加固定 `code` 返回，避免 Cloudflare 把响应换成没有 CORS 头的页面。

### 宿主组合

`MappHost.ts` 将同一 SDK 的 RoomSession、媒体 factory、房间命令、metadata fetch 和内存身份组合为单个宿主。构造不自动连接或创建 AudioContext；调用方先等待 SDK ready，显式 connect 和用户手势 unlock。一个 realm 仅保留一个活动宿主；失去连接、身份或房间、或切换房间时卸载当前媒体。宿主 dispose 取消 metadata 请求、关闭会话与音频、清内存，收尾后释放单宿主 guard。React Provider 仍仅订阅该外部所有者。`MappApp` 使用 MemoryRouter 和原 AppSurface（同一大厅、房间页面、弹窗与样式）；未选择 Mapp host modules 时以固定错误拒绝挂载，错误重置只离房、清状态并在内存导航，不刷新论坛页面。

`bootstrapClient` 在 SDK ready 后创建并绑定宿主，等待 React commit 再 connect，最后 best-effort lifecycle.ready。20 秒启动期限、退出/pagehide 取消、晚到 mount 立即卸载、解绑和 Host dispose 均有离线回归；隐藏/失焦不当作退出。`hostBinding` 与 hostModules 只委托同一个外部所有者，不创建原生网络回退。

房间预检通过 RoomCheckReader 入口：Web 保留原 HTTP；Mapp 等待可信会话与连接后单次 ROOM_LIST，从同一公开列表取 name/hasPassword/userCount。5 秒期限、调用方及 Host lifetime abort、断线与独立监听清理覆盖了并行和同步响应，不增加动态 path HTTP 权限；信任服务端列表载荷，不再重复校验房间 ID 格式与载荷形状。

界面后续以可兼容组件复用为目标，但不假定整个网页 bundle 可直接运行。需隔离 Cookie 引导、存储与生命周期、音频引擎等平台差异。原 Web 实现保持默认行为。

## 宿主能力与独立产物

Web hostRuntime 保留全部原能力。`hostRuntime` 只记录**宿主确实做不到的事**，不是功能开关："一次制作，到处打包"，功能不得因宿主而被隐藏。Mapp 现在关闭的只有：系统 MediaSession、版本轮询、剪贴板（无法复制房间号，只能显示）、外链、PixiJS 背景（禁止 eval）。搜索、歌手、专辑/歌单详情和音乐账号登录（`platformAccounts` 为 true）已与网页端一致。封面不直连 CDN，而是经 `musicCover` 读字节转 Blob URL（所有列表、歌手头像都走同一个 `useArtworkUrl`）；封面读取失败时回退本地图标占位。

**音乐平台账号**（二维码/Cookie 登录、VIP 状态、个人歌单）在微应用里与网页端是同一套界面（房间顶栏的"音乐账号"，`AccountDialog`）。登录本来就在服务端完成（服务端调用网易云/QQ/酷狗，前端只显示二维码），因此走已有的 Socket.IO `auth:*` 事件，不新增 REST；个人歌单曲目走 `musicMyPlaylist`（`GET /api/music/playlist/mine`，必须带 `roomId`，服务端从验证过的身份查该用户在该房间账号池里的登录，没有登录则匿名读取；响应 `private, no-store`，缓存键按凭据隔离），公开歌单和专辑走匿名的 `musicPlaylist`。

- **登录态保存**：网页端把 `mt-auth-cookies` 存在 localStorage 并在重开后自动恢复。微应用的存储适配器是同步接口，所以 `bootstrapClient` 在宿主创建前用 SDK 的异步 `localStorage`（IndexedDB，按应用与沙箱/正式隔离）把这一个键预读进内存，之后写入同步落盘；其余设置和重连票据仍只在内存。manifest 因此新增 `storage.read` / `storage.write` 两项权限（需要平台审核），没有授予权限时退化为只在本次会话内有效。
- **二维码图片**：服务端返回 base64 `data:` 图片，沙箱 CSP 拦截 `data:` 图片，所以界面统一把它转成 Blob URL（`dataUrlToBlob` 只接受 png/jpeg/gif/webp 的 base64，不接受 SVG）显示，网页端同样使用。

### `storage.read` / `storage.write` 权限审查（公开发布前）

结论：用途收敛、没有需要收紧的地方，不改代码；公开发布时在应用说明里写明即可。

- **写入范围**：`storageBackend` 只把 `mt-auth-cookies` 一个键写穿到 SDK 的持久存储；其余 `mt-` 设置只在内存，重连票据（`mt-rejoin-token`）明确不接受，也不写任何原生存储
- **隔离**：`sdk.localStorage` 按应用与沙箱/正式环境隔离；内容与网页端放在 localStorage 里的一致（音乐平台登录 Cookie 明文），没有比网页端更宽
- **读出时校验**：`getAuthCookies` 校验数组形状与每项字段（平台在 `MUSIC_SOURCES` 内、Cookie 是字符串），畸形数据返回 `[]`，不会让账号弹窗崩溃
- **清除**：用户在"音乐账号"里登出某个平台会走 `removeAuthCookie`，同步写穿删除持久副本；卸载应用只清内存、不删持久副本（登录态是为下次打开保留的）
- **降级**：平台没批准权限时 `bootstrapClient` 不预读，退化为只在本次会话内有效
- **仍要知道的**：Cookie 是明文放在应用私有的 IndexedDB 里，设备上能读到该存储的人能拿到登录态，与网页端 localStorage 同级。应用说明里应写明"登录态保存在本地"

### 平台运行环境限制与兜底

微应用运行在 `sandbox="allow-scripts"` 的 iframe 中，并受平台 CSP 与 Trusted Types 约束（`autoplay` 权限策略为 `none`，需用户手势后才能发声）。这对共享的网页前端造成两类实际问题，由 `bootstrapClient` 在微应用里安装两个兜底，网页端不受影响：

- **没有 `allow-forms`**：浏览器在派发 `submit` 事件之前就拒绝原生表单提交，建房、昵称、密码等对话框的 `onSubmit` 永远不会执行。`formSubmitFallback` 把提交按钮点击与（无提交按钮表单中的）回车转换成同一表单上的普通 `submit` 事件，输入法组合期间不触发，不产生导航。
- **禁止 eval**：歌词库的动画背景默认用 PixiJS 渲染器，它初始化时会 `new Function(...)`，被 CSP / Trusted Types 拒绝并抛错（`does not allow unsafe-eval` / `TrustedScript`）。微应用的 `hostRuntime.pixiBackground` 为 `false`，`usesMeshRenderer` 因此固定选用纯 WebGL 的 `MeshGradientRenderer`；背景外还包了局部错误边界，装饰性背景失败时静默降级为无背景，不影响播放器。网页端行为不变（仍按用户设置选择渲染器）。
- **背景封面不能用 `blob:` 字符串**：歌词库 `setAlbum` 对字符串来源会先 `fetch()` 再解码，被 `connect-src 'none'` 拒绝（连 Blob URL 也不行），背景会保持纯色。`useBackgroundAlbum` 在需要读字节的宿主里把 Blob URL 先装进 `<img>`，加载完成后把元素交给 `BackgroundRender`（元素来源不经 `fetch`）；切歌时保留上一张直到新图加载完成（渲染器不随每首歌销毁重建 WebGL 上下文），新图加载失败则清除背景，歌曲没有封面则不渲染背景；网页端仍直接传 URL 字符串。
- **Trusted Types**：任何 `innerHTML` 赋值都会抛错，而歌词库清理歌词行（`innerHTML = ''`，切歌/重建歌词时）和 Radix 滚动区/下拉选择（`<style dangerouslySetInnerHTML>`，成员列表、设置等面板）都会触发，错误边界会接管整个界面。`trustedTypesFallback` 只处理两种安全等价情形：空字符串改用 `replaceChildren()`，`<style>` 元素改写 `textContent`；其余非空值委托给平台原有的 setter（仍被拒绝）。兜底定义在 `HTMLElement.prototype` 上而不是 `Element.prototype`：平台可能把后者锁成不可配置，覆盖它会被静默跳过，而下一层原型链上的同名属性始终可以定义，并排在所有 HTML 元素的原型链最前。不创建 Trusted Types policy，不引入任何 HTML 解析，卸载时只移除自己的属性。`DOMParser.parseFromString`（PixiJS 适配器）同样受限；TTML 因此改在服务端解析，微应用不需要它。集合缓存隔离与额外权限能力可在之后单独验证。

`pnpm --filter @music-together/mapp package` 构建并打包正式 UI，要求 `MAPP_ROOM_URL` 为审定的 WSS Socket.IO URL；mapp 不参与根目录 `pnpm build`，避免缺少该变量时拖垮主站构建。客户端复用 client workspace 已有 React/Tailwind/WASM 构建插件；Vite 8 的 IIFE 输出显式 `codeSplitting: false`，不生成运行时外部分包，CSS 单文件。客户端库模式显式构建 `process.env.NODE_ENV = "production"`，浏览器无需 Node 全局。定向构建和官方 SDK guard 已通过：ZIP 根目录仅五个必需文件，无外部分包。产物大小与 SHA-256 随代码变化，以 `dist/client-package/package.json` 为准；版本号取 manifest 的 `version`，沙箱构建由 ZIP 哈希区分，无需为每次测试升版本。

真实 JS 产物另经离线 DOM／模拟 SDK 冒烟：大厅成功挂载，原样 Engine.IO/Socket.IO 握手后请求房间列表，lifecycle.ready 只在 UI commit 后通知，pagehide 关闭 SDK 连接。在该测试中禁止原生网络发送、音频创建、Cookie/原生存储、eval/Function 与 innerHTML 写入，未触发这些调用；Socket.IO 的空 XHR 特性探测与请求发送分开处理。此测试不替代官方平台 VM、真实 JWT、设备音频或跨端同房现场验收。

产物为 `dist/client-web`、`dist/client-package`。client manifest 仅 `user.read`、`audio.webAudio`、`network.websocket`、`network.request`、`storage.read`、`storage.write`，声明 roomSocket、roomAudio、musicSearch、musicLyric、musicTtml、musicCover、musicArtist、musicArtistSongs、musicArtistAlbums、musicPlaylist、musicMyPlaylist、musicRadar、musicDaily、musicHome；不含 remote_assets 或额外权限。打包继续由官方 SDK 校验（ZIP/单文件 32MiB、展开 128MiB）。共享纯 target 数据与 manifest 解析均独立于 CLI，避免打包入口循环加载。

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
