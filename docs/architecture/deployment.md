# 部署方案

## 架构

采用**纯 Node.js 单镜像**方案：Express 同时托管前端 SPA 静态文件和后端 API/WebSocket，无需 Nginx。

```
Docker 容器 (:3001)
├── / 静态文件        → client/dist（Vite 产物）
├── /api/*           → REST API
└── /socket.io/*     → WebSocket
```

## CI/CD 流程

1. **push 到 main** → GitHub Actions 构建 Docker 镜像 → 推送到 GHCR（`ghcr.io`）
2. **服务器上** Watchtower 每 5 分钟检查镜像更新 → 自动拉取并重启容器

零人工干预，GitHub 零额外 Secrets（使用自带的 `GITHUB_TOKEN`）。

## Docker 多阶段构建

- **阶段 1（deps）**：`pnpm install --frozen-lockfile` 安装全部依赖
- **阶段 2（build）**：分别构建 shared、server（tsc）、client（vite build）
- **阶段 3（production）**：仅安装 server 生产依赖（`--filter @music-together/server...`），复制构建产物

## CORS 策略

- `CLIENT_URL` 未设置 → 自动模式，允许所有来源访问（适用于单镜像同域部署、局域网、公网反代）
- `CLIENT_URL` 显式设置 → 严格白名单模式（适用于前后端分离跨域部署）

## Identity Cookie 策略

- 未显式设置 `IDENTITY_COOKIE_SECURE` 时，服务端会根据当前请求协议自动决定是否添加 `Secure`
- 局域网 HTTP 访问会下发非 Secure cookie
- 公网 HTTPS / 反代 HTTPS 访问会下发 Secure cookie
- 自动判断 HTTPS 依赖代理正确透传 `X-Forwarded-Proto`
- 仅在需要强制行为时才手动设置 `IDENTITY_COOKIE_SECURE`

## 前端同域适配

`SERVER_URL` 默认使用 `window.location.origin`，同域部署时自动指向当前页面的 origin，无需配置。

## 静态文件托管

`packages/server/src/index.ts` 在启动时检测 `client/dist/index.html` 是否存在：

- **存在**（生产环境）：挂载 `express.static` + SPA fallback
- **不存在**（本地开发）：跳过，零影响

## 服务器部署命令

```bash
# 启动应用容器
docker run -d --name music-together --restart unless-stopped -p 3001:3001 ghcr.io/<owner>/music-together:latest

# 启动 Watchtower 自动更新
docker run -d --name watchtower --restart unless-stopped \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -e WATCHTOWER_CLEANUP=true \
  containrrr/watchtower --interval 300 music-together
```

如使用 1Panel，创建反向代理网站指向 `127.0.0.1:3001`，启用 WebSocket 和 HTTPS。
