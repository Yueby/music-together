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
```

### 动态容量与准入排队

| 环境变量 | 默认值 | 用途 |
| --- | --- | --- |
| `CAPACITY_ENABLED` | `true` | 启用动态容量、准入排队和 Socket.IO 连接上限 |
| `CAPACITY_MIN_UNITS` | `12` | 动态容量下限（加权单位） |
| `CAPACITY_MAX_UNITS` | `300` | 动态容量上限（加权单位，至少为配置的下限） |
| `CAPACITY_BASE_UNITS` | 自动估算 | 初始容量（加权单位），默认根据内存和 CPU 配额估算 |
| `CAPACITY_MAPP_WEIGHT` | `3` | 并发中转预算内每位微应用用户的总权重，最多对 `MAPP_MAX_STREAMS` 名听众收取额外权重。所有入房用户的基础权重为 1 |
| `CAPACITY_MAPP_ROOM_BASE` | `2 × MAPP_MAX_STREAMS` | 微应用单房听众上限的初始值，可设置为 1–2000。运行时限制在中转并发槽位数与该槽位数加中转请求队列上限之间 |
| `CAPACITY_MAX_QUEUE` | `100` | 等候队列人数上限，设为 `0` 时满载请求直接被拒绝 |
| `CAPACITY_MAX_SOCKETS` | `500` | Socket.IO 并发连接上限，包含未进入房间的连接 |
| `CAPACITY_MEMORY_LIMIT_MB` | 自动检测 | 可选内存上限（MiB），存在有限 cgroup 配额时取两者较小值 |

Linux 容器从 cgroup 读取内存和 CPU 配额。内存采样在可用时扣除非活跃文件页缓存，并以 Node.js 进程 RSS 为下限。持续健康且已使用至少 80% 有效容量时，容量上限才会逐步回升。

通用容量和微应用单房听众上限各自使用 AIMD 调节。持续中转拥塞会收紧单房上限。中转利用率高时，通用过载的前两次收缩优先收紧单房上限，之后也收紧通用容量。内存占比达到 88% 时立即收紧通用容量。单房上限在有近期中转等待记录、房间接近上限且两种压力都较低时增长，每次增长后冷却 30 秒。

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
