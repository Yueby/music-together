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
| `CAPACITY_MAPP_ROOM_BASE` | `2 × MAPP_MAX_STREAMS`（全音源边缘中转时自动对齐通用容量基线） | 微应用单房听众上限的初始值，可设置为 1–2000。直推模式运行时限制在中转并发槽位数与该槽位数加中转请求队列上限之间。全音源边缘中转模式的上限为 `max(中转并发槽位 + 中转请求队列上限, CAPACITY_MAX_UNITS)` |
| `MAPP_AUDIO_MAX_BITRATE` | `128` | 微应用经 VPS 直推或 `fallback-v1` 回退时的最高码率（`128` / `192` / `320` / `999`） |
| `MAPP_RELAY_AUDIO_MAX_BITRATE` | `320`（不低于 `MAPP_AUDIO_MAX_BITRATE`） | 微应用经 Cloudflare Worker `resolve-v1` 边缘直转时的最高码率（`128` / `192` / `320` / `999`） |
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

### Cloudflare Worker 边缘加速插件（可选，`deploy/cf-worker/`）

在「域名开启 Cloudflare 橙云 + Cloudflare Tunnel (`cloudflared`) 指向低配单容器 VPS」的部署拓扑下，可按需部署 `deploy/cf-worker/` 将高带宽/高频读请求卸载到 Cloudflare 边缘节点。不部署该插件时，主程序 100% 保持单容器零配置运行，Web 与微应用前端代码零改动。

#### 模块与路由边界

插件包含三个可独立开关的模块（`ENABLE_MAPP_AUDIO` / `ENABLE_COVER_PROXY` / `ENABLE_PUBLIC_METADATA_CACHE`），通过精确的 **Workers Routes** 挂载（**严禁挂 `/*` 通配路由，严禁使用 Custom Domain**，以免拦截 WebSocket/SPA 或触发同域 `fetch` 循环）：

1. **微应用音频边缘中转（`/api/mapp/audio*`）**：Worker 原样携带 `Origin`/`Authorization` 附加 `X-MT-Relay: resolve-v1` 与 `X-MT-Relay-Secret` 回源完成 Discourse JWT 与房间权限校验并获取签名 CDN URL（不占用 VPS `StreamSlots`），再由 Worker 直连白名单音频 CDN，通过 workerd 原生 `FixedLengthStream` 零拷贝流式转发给微应用（8 秒仅限响应头超时，拿到响应头即释放定时器）。任意校验/拉取失败时取消上游流并携带 `X-MT-Relay: fallback-v1` 回退 VPS 直推（跳过二次 `mediaStreamRateLimit` 扣减，保留 `StreamSlots` 并发控制）。
2. **全站封面代理与边缘缓存（`/api/music/cover-proxy*`）**：Web 封面直接走 `caches.default` 与共享白名单图床抓取（含网易云 `600y600` 尺寸限制、最多 3 跳 `https` 白名单重定向、光栅图片校验与 3 MiB 上限），异常回退 VPS；当 Worker 配置 `ALLOWED_MAPP_ORIGIN` 后，匹配该来源且带 `Authorization` 的微应用封面请求及 `OPTIONS` 预检直接由边缘缓存/白名单图床响应（严格执行 `<= 2 MiB`、`Access-Control-Allow-Origin: <ALLOWED_MAPP_ORIGIN>`、`Vary: Origin`、`Cache-Control: private, no-store, no-transform`），实现 VPS 零封面请求；未配置 `ALLOWED_MAPP_ORIGIN` 时带 `Authorization` 请求安全透传源站。
3. **公开只读元数据边缘缓存**：仅接管精确白名单路径（`/api/music/ttml`、`/api/music/lyric`、`/api/music/discover/radar`、`/api/music/artist`、`/api/music/artist/songs`、`/api/music/artist/albums`、`/api/music/playlist`、`/api/music/search`）且为同源 Web 无 `Authorization` 的 `GET` 请求；严禁覆盖 `/api/music/playlist/mine`、`/api/music/discover/daily`、`/api/music/discover/home`、`/api/music/url`。MISS 回源前剥离 `Cookie` 请求头，入缓存前删除 `Set-Cookie` 与 `Access-Control-*`，且仅缓存 `200` 且不含 `no-store` 的响应。

#### 部署步骤

1. **配置 VPS 环境变量**：生成高熵共享密钥（`openssl rand -base64 32`）写入容器 `MAPP_RELAY_SECRET`；可按需配置 `MAPP_RELAY_SOURCES`（默认 `netease,tencent,kugou`，设 `none` 或移除某音源即可零停机秒退 VPS 直推）。
2. **调整 `deploy/cf-worker/wrangler.toml`**：将 `[[routes]]` 域名替换为实际站点域名，确认 `[observability] enabled = false`（防止签名链接与密钥进入 CF 日志）；启用微应用时建议取消注释并填写 `ALLOWED_MAPP_ORIGIN`（如 `https://linux.do`），以同时启用微应用封面边缘极速模式并在 `resolve-v1` 回源异常时为 Worker 生成的 `503 MEDIA_RELAY_FAILED` 附带 CORS 头。
3. **写入密钥并部署 Worker**：
   ```bash
   cd deploy/cf-worker
   npx wrangler secret put MAPP_RELAY_SECRET
   npx wrangler deploy
   ```
4. **开启全部路由的 Fail open**：在 Cloudflare Dashboard → **Workers Routes** 中，为每一条挂载的路由选择 **Failure mode: Fail open (proceed)**（该项由 Cloudflare 控制台/API 管理，无法直接写在 `wrangler.toml` 中），确保 Worker 触及配额或异常时自动放行回源。

#### 启用后的动态容量与音质行为

当服务端配置了 `MAPP_RELAY_SECRET` 且 `MAPP_RELAY_SOURCES` 覆盖全部音源时，动态容量控制器自动进入**边缘中转感知模式**：

- 未显式配置时，`CAPACITY_MAPP_WEIGHT` 自动默认 `1`，单房听众上限基线自动对齐通用容量基线、上限放开至 `max(中转并发槽位 + 中转请求队列上限, CAPACITY_MAX_UNITS)`（不再被直推槽位上限 `8 + 64 = 72` 截断）；
- `resolve-v1` 边缘直转使用独立的 `MAPP_RELAY_AUDIO_MAX_BITRATE`（默认 `320` kbps），而 `fallback-v1` 回退与直推仍使用 `MAPP_AUDIO_MAX_BITRATE`（默认 `128` kbps）；
- 服务端分别记录 Worker 主动发起的 `fallback-v1` 回退和 Cloudflare Fail Open（请求绕过 Worker 直连 VPS）。任一信号都会触发或延长 5 分钟降级窗口。窗口内退出边缘活跃态，逐步将高于直推容量的单房上限收回至 `MAPP_MAX_STREAMS + 64` 以内，并将自愈目标限制在该上限。发生中转拥塞时，以 `mapp_stream` 限制微应用入房，网页端仍可正常入房。连续 5 分钟无新的回退或绕过事件、观测到新的边缘解析恢复（`resolve-v1`）且中转压力降至低压阈值后，恢复边缘活跃态并逐步自愈至基线。

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
- 按 IP 的限流（如 `POST /api/auth/identity/bootstrap`）需要拿到真实客户端 IP：反向代理必须透传 `X-Forwarded-For`，服务端通过 `TRUST_PROXY` 决定信任几层代理。默认 `1`（前面有一层反向代理，即本文的部署方式）；端口 3001 直接暴露、没有反向代理时设为 `false`，否则客户端可伪造该请求头；多层代理设为实际层数：Cloudflare 橙云 + Nginx/openresty 是两层，设为 `2`；Cloudflare Tunnel（`cloudflared`）直接指到 `127.0.0.1:3001` 只有 `cloudflared` 一层，用默认 `1`，Tunnel 先指到 Nginx/openresty 再转发则是两层，设为 `2`（部署后看 `Identity bootstrap issued` 日志里的 `ip`：应是访客自己的出口 IP，显示 `127.0.0.1` 就是少算了一层）。也可填 `loopback`、`10.0.0.0/8` 等 Express 支持的值。

## 部署示例

```bash
docker run -d \
  --name music-together \
  --restart unless-stopped \
  -p 3001:3001 \
  -e IDENTITY_SECRET='<至少32字符的随机密钥>' \
  ghcr.io/yueby/music-together:latest
```

检查健康状态：

```bash
docker inspect --format '{{json .State.Health}}' music-together
curl http://127.0.0.1:3001/api/health
```

如使用 1Panel、Nginx 或 Caddy，反向代理到 `127.0.0.1:3001`，启用 WebSocket，并正确传递来源协议头。

Watchtower 可用于自动更新镜像，但其 Docker Socket 权限较高；使用前应理解其安全边界，并限制为指定容器。
