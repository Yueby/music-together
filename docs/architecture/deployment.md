# 部署方案

## 架构

采用纯 Node.js 单镜像：Express 同时托管前端 SPA、REST API 和 Socket.IO。

```text
Docker 容器 (:3001)
├── /                 client/dist
├── /api/*            REST API
└── /socket.io/*      Socket.IO
```

## CI/CD

GitHub Actions 分为两个阶段：

1. Pull Request 和 main push 都执行依赖安装、Vitest、前端 typecheck/lint、workspace build 和生产依赖 critical 审计。
2. 只有非 PR 且验证通过后，才构建并推送 `latest` 和 commit SHA 两个 GHCR 标签。

Dependabot 每周检查 pnpm 依赖，并按月检查 GitHub Actions 和 Docker 基础镜像。

## 必需的生产配置

生产环境必须设置至少 32 字符的随机 `IDENTITY_SECRET`：

```bash
openssl rand -base64 48
```

然后通过容器环境变量传入。未设置时服务会拒绝启动。

### 房间快照与重启

| 环境变量 | 默认值 | 用途 |
| --- | --- | --- |
| `STATE_DIR` | Docker 为 `/app/data`，本地为空 | 加密房间快照的存储目录 |
| `ROOM_SNAPSHOT_ENABLED` | `true` | 设为 `false` 关闭快照 |
| `ROOM_SNAPSHOT_MAX_AGE_MS` | `600000` | 启动时可接受的最大快照年龄 |
| `ROOM_RESTORE_CONTINUITY_MS` | `120000` | 重启间隔在此范围内时，播放时钟继续推进 |
| `RESTORE_REJOIN_WINDOW_MS` | `120000` | 启动后保留空房及原成员免密码重入的时间 |
| `BUILD_ID` | `dev`，CI 为提交 SHA | 前后端构建标识，见 `GET /api/version` 与 `server:hello` |

快照在房间状态变化时每 15 秒检查并保存一次，收到 SIGTERM 或 SIGINT 时再保存一次。文件为 `room-snapshot.v1.bin`，由稳定的 `IDENTITY_SECRET` 派生密钥并使用 AES-256-GCM 加密。目录未配置、不可写或使用本地默认身份密钥时会停用快照，服务照常运行。轮换 `IDENTITY_SECRET` 将使旧快照失效。过期、无效或解密失败的文件会改名为 `.rejected`。

建议在 Docker Compose 中为 `/app/data` 挂载命名卷，使快照在替换容器后仍可读取，并配置 `stop_grace_period: 15s`。

```yaml
services:
  music-together:
    stop_grace_period: 15s
    volumes:
      - music-together-data:/app/data
volumes:
  music-together-data:
```

其他变量详见根目录 `.env.example`：

```text
PORT
CLIENT_URL
CORS_ORIGINS
IDENTITY_SECRET
IDENTITY_TTL_DAYS
REJOIN_TTL_MS
IDENTITY_COOKIE_SECURE
AUTO_FALLBACK_ENABLED
TRUST_PROXY
TTML_DB_BASE_URL
MAPP_AUDIO_MAX_BITRATE
MAPP_MAX_STREAMS
MAPP_RELAY_SECRET
MAPP_RELAY_SOURCES
```

### 动态容量与准入排队

| 环境变量 | 默认值 | 用途 |
| --- | --- | --- |
| `CAPACITY_ENABLED` | `true` | 启用动态容量、准入排队和 Socket.IO 连接上限 |
| `CAPACITY_MIN_UNITS` | `12` | 动态容量下限（加权单位） |
| `CAPACITY_MAX_UNITS` | `300` | 动态容量上限（加权单位，至少为配置的下限） |
| `CAPACITY_BASE_UNITS` | 自动估算 | 初始容量（加权单位），默认根据内存和 CPU 配额估算 |
| `CAPACITY_MAPP_WEIGHT` | `3`（全音源边缘中转时自动 `1`） | 并发中转预算内每位微应用用户的总权重，最多对 `MAPP_MAX_STREAMS` 名听众收取额外权重。所有入房用户的基础权重为 1 |
| `CAPACITY_MAPP_ROOM_BASE` | `2 × MAPP_MAX_STREAMS`（全音源边缘中转时自动对齐通用容量基线） | 微应用单房听众上限的初始值，可设置为 1–2000。两种模式的运行时下限均为中转并发槽位数。直推模式的上限为中转并发槽位数加中转请求队列上限。全音源边缘中转模式的上限为 `max(中转并发槽位 + 中转请求队列上限, CAPACITY_MAX_UNITS)` |
| `MAPP_AUDIO_MAX_BITRATE` | `128` | 微应用经 VPS 直推或 `fallback-v1` 回退时的最高码率（`128` / `192` / `320` / `999`） |
| `MAPP_RELAY_AUDIO_MAX_BITRATE` | `max(320, MAPP_AUDIO_MAX_BITRATE)` | 微应用经 Cloudflare Worker `resolve-v1` 边缘直转时的最高码率（`128` / `192` / `320` / `999`）。32 MiB 在 320 kbps 下约为 14 分钟，在标称 999 kbps 下约为 5 分钟，无损文件的实际码率会波动。 |
| `CAPACITY_MAX_QUEUE` | `100` | 等候队列人数上限，设为 `0` 时满载请求直接被拒绝 |
| `CAPACITY_MAX_SOCKETS` | `500` | Socket.IO 并发连接上限，包含未进入房间的连接 |
| `CAPACITY_MEMORY_LIMIT_MB` | 自动检测 | 可选内存上限（MiB），存在有限 cgroup 配额时取两者较小值 |

Linux 容器从 cgroup 读取内存和 CPU 配额。内存采样在可用时扣除非活跃文件页缓存，并以 Node.js 进程 RSS 为下限。持续健康且已使用至少 80% 有效容量时，容量上限才会逐步回升。

通用容量和微应用单房听众上限各自使用 AIMD 调节。持续中转拥塞会收紧单房上限。中转利用率高时，通用过载的前两次收缩优先收紧单房上限，之后也收紧通用容量。内存占比达到 88% 时立即收紧通用容量。单房上限在健康且房间接近上限时按 30 秒冷却逐步扩容（VPS 直推模式需观测到近期中转等待记录，边缘中转运行健康时无需等待记录即可按需扩容）。若通用容量或单房上限因短暂尖刺收缩至各自基线以下，在系统持续健康、无回退且低压力时会逐步自愈回各自基线，不会在低峰期长期锁死在低位；超过基线的扩容仍严格要求真实高占用触发。

### Discourse 微应用入口（可选，默认关闭）

微应用与网页端共用同一个服务、域名和端口，无需另起同步服务或为 Cloudflare 增加路径分流。设置下面变量后才会接受平台 JWT：

```text
MAPP_ISSUER      论坛 https 地址（可带子目录）
MAPP_AUDIENCE    本服务的公开 https origin（主机名不能与论坛相同）
MAPP_APP_ID      平台应用页分配的 UUIDv7
MAPP_JWKS_FILE   可选，容器内只读公钥文件的绝对路径
MAPP_ALLOW_SANDBOX  可选，true 时同时接受沙箱通道令牌；默认只接受正式通道
```

沙箱构建签发的令牌 `channel` 为 `sandbox`，默认会被拒绝。测试沙箱构建时临时设置 `MAPP_ALLOW_SANDBOX=true`（官方文档要求沙箱需显式允许并与正式数据分开）；沙箱会话会与本服务的真实房间共用数据，测试完成后应移除该变量。

四项全部不设置即关闭；只设置一部分或值非法时服务会拒绝启动。使用 `MAPP_JWKS_FILE` 时把公钥文件只读挂载进容器（如 `-v ./platform-jwks.json:/run/keys/platform-jwks.json:ro`）；不设置则从论坛 `/mini-app-api/jwks` 获取公钥。日志和代理不要记录带 `mini_app_token` 的完整 query。详见 [微应用兼容层](mini-app-compatibility.md)。

### Cloudflare 代理与控制台配置（使用 Cloudflare 时）

若站点挂载在 Cloudflare 橙云代理（Proxied）或 Cloudflare Tunnel（`cloudflared`）之后，无论是否部署下方可选的 Cloudflare Worker 插件，建议在 Cloudflare 控制台核对以下基础配置：

#### 1. 接入拓扑、WebSockets 与 `TRUST_PROXY`

- **Cloudflare Tunnel / 橙云代理**：推荐将 Tunnel 直接指向容器本机端口 `http://127.0.0.1:3001`（减少一层反代开销）。
- **WebSockets**：在 Cloudflare Dashboard → 目标域名 → **Network（网络）** 中确认 **WebSockets** 保持开启（默认开启；Socket.IO 实时同步依赖此项）。
- **源站 `TRUST_PROXY` 对齐**：
  - Cloudflare Tunnel 直连 `127.0.0.1:3001`（1 层代理）：保持默认 `TRUST_PROXY=1`；
  - Cloudflare 橙云（或 Tunnel）→ Nginx / openresty / Caddy → 容器（2 层代理）：设为 `TRUST_PROXY=2`；
  - 核验方法：观察容器启动后 `Identity bootstrap issued` 日志中的 `ip` 字段应为访客真实出口 IP，若显示 `127.0.0.1` 则说明代理层数少算了一层。

#### 2. Caching → Cache Rules（PWA 入口防 4 小时旧缓存）

服务端已为 `/sw.js`、`/registerSW.js`、`/manifest.webmanifest` 设置 `Cache-Control: no-cache`（带 ETag），但 Cloudflare 默认按文件扩展名缓存 `.js` / `.webmanifest` 并覆写 **Browser Cache TTL 为 4 小时（`max-age=14400`）**，会导致发版后 PWA 客户端最长数小时无法拉取最新 Service Worker。

建议在 Cloudflare Dashboard → 目标域名 → **Caching（缓存）→ Cache Rules** 中新增一条规则（将 `music.example.com` 替换为实际站点域名）：

- **规则名称**：`Music Together PWA no-cache`
- **匹配方式**：选择**自定义筛选表达式 → 编辑表达式**，填入：
  ```text
  (http.host eq "music.example.com" and http.request.uri.path in {"/sw.js" "/registerSW.js" "/manifest.webmanifest"})
  ```
- **缓存资格（Cache eligibility）**：选择 **绕过缓存（Bypass cache）**
- **浏览器 TTL（Browser TTL）**：点击添加设置 → 选择 **接受源服务器 TTL（Respect origin）**

部署后在本地执行验证：

```bash
curl -fsSI https://music.example.com/sw.js
curl -fsSI https://music.example.com/registerSW.js
curl -fsSI https://music.example.com/manifest.webmanifest
```

三项路径均应返回 `Cache-Control: no-cache`、`cf-cache-status: DYNAMIC` 且保留 `etag`（不再出现 `max-age=14400`）。同时 `/assets/*` 仍由源站下发 `public, max-age=31536000, immutable`，不受该规则影响，可继续享受 Cloudflare 边缘缓存。

### Cloudflare Worker 边缘加速插件（可选，`deploy/cf-worker/`）

在「域名开启 Cloudflare 橙云 + Cloudflare Tunnel (`cloudflared`) 指向低配单容器 VPS」的部署拓扑下，可按需部署 `deploy/cf-worker/` 将高带宽/高频读请求卸载到 Cloudflare 边缘节点。不部署该插件时，主程序 100% 保持单容器零配置运行，Web 与微应用前端代码零改动。

#### 模块与路由边界

插件包含三个可独立开关的模块（`ENABLE_MAPP_AUDIO` / `ENABLE_COVER_PROXY` / `ENABLE_PUBLIC_METADATA_CACHE`，设为 `"false"` 或 `"0"` 可单模块透传源站），通过精确的 **Workers Routes** 挂载（**严禁挂 `/*` 通配路由，严禁使用 Custom Domain**，以免拦截 WebSocket/SPA 或触发同域 `fetch` 循环）：

1. **微应用音频边缘中转（`/api/mapp/audio*`）**。Worker 携带 `Origin`、`Authorization`、`X-MT-Relay: resolve-v1` 和中转密钥回源，完成身份和房间权限校验并获取签名 CDN URL。回源解析超时或网络失败返回 Worker 生成的 `503`。源站非 `200` 响应直接透传。解析结果无效，或 CDN 请求在音频响应开始前发生大小、长度、编码、状态码校验失败或网络异常时，Worker 携带 `X-MT-Relay: fallback-v1` 和 `X-MT-Relay-Reason` 回退 VPS 直推。回退跳过二次限流扣减，仍受 `StreamSlots` 控制。回源解析时限为 15 秒，CDN 响应头时限为 6 秒。无 `Content-Length` 的 CDN 响应按 32 MiB 上限流式转发，超限时终止流。`Server-Timing` 记录已完成阶段的 `vps_resolve` 和 `cdn_ttfb`，以及生成响应前的 `total`，单位为毫秒。
2. **全站封面代理与边缘缓存（`/api/music/cover-proxy*`）**。Web 封面直接走 `caches.default` 与共享白名单图床抓取（含网易云 `600y600` 尺寸限制、最多 3 跳 `https` 白名单重定向、光栅图片校验与 3 MiB 上限）。封面 URL 查询参数在抓取和生成缓存键前归一化，仅保留受支持的网易云尺寸参数。同一 Worker 实例中对同一封面的并发冷请求共用一次图床读取，异常回退 VPS。配置 `ALLOWED_MAPP_ORIGIN` 后，匹配来源且带 `Authorization` 的微应用封面请求可以使用边缘缓存与图床，仍受 2 MiB 上限及 `Cache-Control: private, no-store, no-transform` 约束。未配置时，带 `Authorization` 的封面请求透传源站。
3. **公开只读元数据边缘缓存**。仅缓存同源 Web 无 `Authorization` 的 `GET` 请求，精确路径为 `/api/music/ttml`、`/api/music/lyric`、`/api/music/discover/radar`、`/api/music/artist`、`/api/music/artist/songs`、`/api/music/artist/albums`、`/api/music/playlist` 和 `/api/music/search`。微应用认证 `GET` 和个人元数据路由（如 `/api/music/playlist/mine`）继续回源。缓存 MISS 时 Worker 只转发 `mt_identity` Cookie 供源站验签和限流，公开路由跳过 Cookie 续签。符合缓存策略的 `200` 响应可写入边缘缓存，`private`、`Vary: Cookie` 或 `Set-Cookie` 响应会绕过缓存。共享响应前移除限流和 CORS 响应头。同一 Worker 实例中的同键冷请求共用一次可缓存的回源读取。边缘缓存保留两倍 TTL，第一段 TTL 内返回 `HIT`，下一段返回 `STALE`，客户端最多缓存 30 秒，边缘后台合并同键刷新。刷新失败时保留旧条目直到边缘缓存过期。

配置 `ALLOWED_MAPP_ORIGIN` 后，符合各路由 CORS 校验的微应用 `OPTIONS` 预检由边缘返回 `204`，覆盖音频、封面和上述公开元数据路径。其他预检原样回源。边缘和源站均为通过的微应用预检返回 `Access-Control-Max-Age: 86400`，单容器部署也可使用浏览器的预检缓存。

完整挂载的 8 条精确 Workers Routes（均保留末尾 `*` 以匹配查询参数，具体以 `deploy/cf-worker/wrangler.toml` 为准）：

| 路由模式（将域名替换为站点主机名） | 归属模块 | 备注 |
| --- | --- | --- |
| `music.example.com/api/mapp/audio*` | 微应用音频中转 | 携带 `resolve-v1` 回源验权后直连 CDN |
| `music.example.com/api/music/cover-proxy*` | 全站封面缓存 | Web 3 MiB / 微应用 2 MiB，异常回源 |
| `music.example.com/api/music/ttml*` | 公开元数据缓存 | 有歌词最长 6h，`lines: null` 10m |
| `music.example.com/api/music/lyric*` | 公开元数据缓存 | TTL 30m |
| `music.example.com/api/music/discover/radar*` | 公开元数据缓存 | TTL 10m |
| `music.example.com/api/music/artist*` | 公开元数据缓存 | 覆盖 `/artist`、`/artist/songs`、`/artist/albums`，TTL 5m |
| `music.example.com/api/music/playlist*` | 公开元数据缓存 | 精确路径匹配 `/playlist`（TTL 5m），`/playlist/mine` 自动透传源站 |
| `music.example.com/api/music/search*` | 公开元数据缓存 | TTL 3m |

#### 部署步骤

1. **配置 VPS 环境变量**：生成高熵共享密钥（`openssl rand -base64 32`）写入容器 `MAPP_RELAY_SECRET`；可按需配置 `MAPP_RELAY_SOURCES`（默认 `netease,tencent,kugou`，设 `none` 或移除某音源即可零停机秒退 VPS 直推）。
2. **调整 `deploy/cf-worker/wrangler.toml`**：
   - 将全部 8 条 `[[routes]]` 的 `pattern` 与 `zone_name` 替换为实际站点域名与 Zone；
   - 保持安全基线不变：`workers_dev = false`、`preview_urls = false`、`[observability] enabled = false`（防止 `.workers.dev` 绕过路由以及签名链接/密钥进入 Cloudflare 日志）；
   - 启用微应用时，在 `[vars]` 中设置与源站 `MAPP_ISSUER` 一致的 `ALLOWED_MAPP_ORIGIN`（如 `"https://linux.do"`），以启用边缘 `OPTIONS` 预检、微应用封面边缘缓存，以及 `resolve-v1` 回源失败时合成 `503 MEDIA_RELAY_FAILED` 的 CORS 响应头。
3. **写入密钥并部署 Worker**：
   ```bash
   cd deploy/cf-worker
   npx wrangler secret put MAPP_RELAY_SECRET
   npx wrangler deploy
   ```
4. **开启全部路由的 Fail open（Dashboard 必做项）**：在 Cloudflare Dashboard → 目标域名 → **Workers Routes** 中，为上述全部 8 条路由逐一将 **Failure mode** 设为 **Fail open (proceed)**（对应 API 字段 `request_limit_fail_open: true`；该项由 Cloudflare 控制台/API 管理，无法写入 `wrangler.toml`，**每次增删或重建路由后都需重新核对**），确保 Worker 触及免费额度或异常时自动放行回源。

#### 上线验收与应急回退

- **公开元数据边缘缓存核验**：连续请求两次 `curl -fsSI "https://music.example.com/api/music/discover/radar"`，预期第二次响应带 `X-MT-Edge-Cache: HIT`（或后台刷新窗口内 `STALE`），且不包含 `Set-Cookie`。
- **私有路由隔离核验**：请求 `/api/music/playlist/mine` 不应出现 `X-MT-Edge-Cache: HIT`。
- **容器边缘感知态核验**：查看容器启动日志应包含 `edgeRelayEnabled: true`、`edgeRelayActive: true`、`mappWeight: 1`；`GET https://music.example.com/api/health` 中 `load.mappRoomLimit` 与 `load.effectiveCap` 对齐。
- **应急回退**：
  - 关闭单个模块：修改 `wrangler.toml` 中对应 `ENABLE_*` 为 `"false"` 后重新 `npx wrangler deploy`；
  - 关闭指定音源中转：修改 VPS `MAPP_RELAY_SOURCES`（或设为 `none`）并重启容器即可回退 VPS 直推；
  - 彻底下线插件：在 Cloudflare Dashboard → **Workers Routes** 移除全部路由即可恢复单容器直连。

#### 启用后的动态容量与音质行为

当服务端配置了 `MAPP_RELAY_SECRET` 且 `MAPP_RELAY_SOURCES` 覆盖全部音源时，动态容量控制器自动进入**边缘中转感知模式**：

- 未显式配置时，`CAPACITY_MAPP_WEIGHT` 自动默认 `1`，单房听众上限基线自动对齐通用容量基线、上限放开至 `max(中转并发槽位 + 中转请求队列上限, CAPACITY_MAX_UNITS)`（不再被直推槽位上限 `8 + 64 = 72` 截断）；
- `resolve-v1` 使用 `MAPP_RELAY_AUDIO_MAX_BITRATE`。`size` 和 `length` 回退以及普通直推使用 `MAPP_AUDIO_MAX_BITRATE`（默认 `128` kbps），并受 32 MiB 上限约束。`network`、`origin` 和 `encoding` 回退优先复用有效的边缘解析 URL，缓存未命中时使用直推码率。
- 服务端将 `X-MT-Relay-Reason` 的白名单值写入 `relay_fallback` 日志。只有 `network`（含缺失或未知的原因）、`origin` 和 Cloudflare Fail Open（绕过 Worker 直连 VPS）会触发或延长 5 分钟降级窗口。`size`、`length` 和 `encoding` 仅记录原因。窗口内退出边缘活跃态，逐步将高于直推容量的单房上限收回至 `MAPP_MAX_STREAMS + 64` 以内，并将自愈目标限制在该上限。发生中转拥塞时，以 `mapp_stream` 限制微应用入房，网页端仍可正常入房。降级信号停止至少 5 分钟、观测到新的边缘解析（`resolve-v1`）且中转压力降至低压阈值后，恢复边缘活跃态并逐步自愈至基线。

如需显式锁定更低单房上限，仍可手动配置 `CAPACITY_MAPP_WEIGHT` / `CAPACITY_MAPP_ROOM_BASE` 覆盖默认值。

## Docker 多阶段构建

- `deps`：锁定 pnpm 11.21.0 并执行 frozen install；需先复制仓库根 `vendor/`（官方 SDK 的 `file:` 依赖）。
- `build`：构建 shared、server 和 client。
- `production`：只安装服务端生产依赖链，复制构建产物。
- 运行时使用非 root `node` 用户。
- 容器通过 `/api/health` 执行 Docker `HEALTHCHECK`。
- `GET /api/health` 返回 `status`、`timestamp` 和 `load` 摘要。摘要包含网页和微应用负载档位（`level`、`mappLevel`）与百分比（`pressurePercent`、`mappPressurePercent`）、微应用单房听众上限（`mappRoomLimit`）、房间内在线人数（`onlineUsers`）、活跃房间数（`activeRooms`）、已用加权单位（`usedUnits`）、有效容量（`effectiveCap`）和排队人数（`queueLength`）。满载时健康检查仍返回 `status: 'ok'`。

## CORS 与 Cookie

- `CLIENT_URL` / `CORS_ORIGINS` 未设置：自动来源模式，适合同域镜像和局域网部署。
- 显式设置来源：严格白名单模式，适合前后端分离。
- `IDENTITY_COOKIE_SECURE` 未设置时，根据生产环境和当前请求协议自动判断。
- HTTPS 反向代理必须透传 `X-Forwarded-Proto`。
- 服务端 HTTP 访问日志的顶层 `responseTime` 字段记录请求耗时，单位为毫秒。
- 按 IP 的限流（如 `POST /api/auth/identity/bootstrap`）需要拿到真实客户端 IP：反向代理必须透传 `X-Forwarded-For`，服务端通过 `TRUST_PROXY` 决定信任几层代理。默认 `1`（前面有一层反向代理，即本文的部署方式）；端口 3001 直接暴露、没有反向代理时设为 `false`，否则客户端可伪造该请求头；多层代理设为实际层数：Cloudflare 橙云 + Nginx/openresty 是两层，设为 `2`；Cloudflare Tunnel（`cloudflared`）直接指到 `127.0.0.1:3001` 只有 `cloudflared` 一层，用默认 `1`，Tunnel 先指到 Nginx/openresty 再转发则是两层，设为 `2`（部署后看 `Identity bootstrap issued` 日志里的 `ip`：应是访客自己的出口 IP，显示 `127.0.0.1` 就是少算了一层）。也可填 `loopback`、`10.0.0.0/8` 等 Express 支持的值。

## 部署示例

```bash
docker run -d \
  --name music-together \
  --restart unless-stopped \
  -p 3001:3001 \
  -e IDENTITY_SECRET='<至少32字符的随机密钥>' \
  -v music-together-data:/app/data \
  --stop-timeout 15 \
  ghcr.io/yueby/music-together:latest
```

检查健康状态：

```bash
docker inspect --format '{{json .State.Health}}' music-together
curl http://127.0.0.1:3001/api/health
```

如使用 1Panel、Nginx 或 Caddy，反向代理到 `127.0.0.1:3001`，启用 WebSocket，并正确传递来源协议头。

Watchtower 可用于自动更新镜像，但其 Docker Socket 权限较高；使用前应理解其安全边界，并限制为指定容器。
