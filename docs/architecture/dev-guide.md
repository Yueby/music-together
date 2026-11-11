# 开发指南

## 环境要求

- Node.js >= 24.15.0（同时满足 React Router 8、Vite 8 与 jsdom 30 的运行时要求）
- pnpm >= 11（仓库锁定 `pnpm@11.21.0`）

## 快速启动

```bash
pnpm install
pnpm dev
```

前端默认运行在 `http://localhost:5173`，后端默认运行在 `http://localhost:3001`。也可单独启动：

```bash
pnpm dev:client
pnpm dev:server
```

## 环境变量

复制根目录 `.env.example` 为 `.env`。服务端支持：

| 变量 | 说明 | 默认值/要求 |
| --- | --- | --- |
| `PORT` | 服务端口 | `3001` |
| `CLIENT_URL` | 严格 CORS 白名单主来源 | 空，自动模式 |
| `CORS_ORIGINS` | 额外来源，逗号分隔 | 空 |
| `IDENTITY_SECRET` | 身份 Cookie HMAC 密钥 | 开发有默认值；生产必须 >=32 字符 |
| `IDENTITY_TTL_DAYS` | 身份有效期（天） | `30` |
| `REJOIN_TTL_MS` | 重连票据有效期 | `60000` |
| `IDENTITY_COOKIE_SECURE` | 强制 Secure Cookie | 自动判断 |
| `AUTO_FALLBACK_ENABLED` | 网易云/QQ 自动换源 | `true` |
| `TRUST_PROXY` | Express `trust proxy`：信任几层反向代理（数字 / `true` / `false` / 子网），决定按 IP 限流看到的客户端 IP | `1` |
| `MAPP_AUDIO_MAX_BITRATE` | 微应用音频接口的最高码率（128/192/320/999） | `128` |
| `MAPP_MAX_STREAMS` | 微应用音频同时转发的路数（1–32），超出的请求排队 15 秒 | `8` |
| `TTML_DB_BASE_URL` | TTML 逐词歌词库 https 地址，服务端代理读取 | `https://amlldb.bikonoo.com` |

客户端可通过 `VITE_SERVER_URL` 覆盖后端地址；默认使用当前访问地址自动推导。

## 验证命令

```bash
# 全部 Vitest 测试
pnpm test

# 监听测试
pnpm test:watch

# 前端类型与代码检查
pnpm --filter @music-together/client typecheck
pnpm --filter @music-together/client lint

# 构建所有 workspace 包
pnpm build

# 生产依赖安全审计
pnpm audit --prod
```

测试与源码就近放置为 `*.test.ts` / `*.test.tsx`。默认测试必须 mock 网易云、QQ 音乐和酷狗接口，不允许 CI 依赖真实第三方服务。

## 构建产物

```text
packages/shared/dist/
packages/server/dist/
packages/client/dist/
```

服务端生产构建会引用 `shared/dist`；Express 在存在 `client/dist/index.html` 时托管前端 SPA。

## 微应用打包

`packages/mapp` 把现有网页前端适配为论坛微应用，后端与网页端共用同一个服务；它不参与根目录 `pnpm build`。

```bash
pnpm --filter @music-together/mapp typecheck
pnpm exec vitest run packages/mapp

# 使用社区应用页分配的真实 ID 与审定的 WSS 地址生成沙箱上传包
MINI_APP_ID=平台应用ID MAPP_ROOM_URL='wss://你的域名/socket.io/?EIO=4&transport=websocket' \
  pnpm --filter @music-together/mapp package
```

上传 ZIP 位于 `packages/mapp/dist/client-package/app.zip`；版本号取 `manifest.json`（`0.2.0`），沙箱测试无需传 `MINI_APP_VERSION`。主站后端需配置 `MAPP_ISSUER`、`MAPP_AUDIENCE`、`MAPP_APP_ID`（可选 `MAPP_JWKS_FILE`）才会接受平台连接，详见 [微应用兼容层](mini-app-compatibility.md)。本地预览不模拟平台 API；权限、出声和资源访问必须在真实 sandbox 检查。详见 [mapp README](../../packages/mapp/README.md)。

## 添加 shadcn/ui 组件

```bash
cd packages/client
pnpm exec shadcn add <component-name>
```

组件安装到 `src/components/ui/`。优先复用现有组件，图标统一使用 `lucide-react`。

## 外部音乐 API 开发注意事项

- 请求必须设置超时，并同时检查 HTTP 状态和平台业务码。
- 不得记录 Cookie、musickey、token 或完整外部响应中的敏感字段。
- QQ 音乐搜索使用带 `zzc` 签名的 `musics.fcg` Desktop 请求。
- 酷狗 KRC 使用内置 `kugouLyricService`，包含 `/search`、`/download`、XOR 解密和压缩解码。
- 客户端直接使用最新版 AMLL `parseLrc` / `parseTTML` / `parseYrc` 返回的 `LyricLine`，不维护旧版类型转换层；合并辅助与翻译歌词时统一在 500ms 窗口内按时间差最小对齐主歌词行（同距离稳定取首个候选），避免相邻短句错配。
- AMLL 设置支持隐藏已播放行、底栏、敏感词遮罩、逐词渐变、Pixi/网格背景、静态模式及 80–120Hz 低频律动，统一由 `settingsStore` 持久化；歌词布局弹簧保持 AMLL 各轴官方默认值，避免覆盖后产生行距漂移。歌词行本身不提供点击跳转，避免绕过多人房间的权限和同步调度。
- 播放过程中由 `lyricPlayerBridge` 每帧直接调用 AMLL 官方 `setCurrentTime()`；Zustand 的 `currentTime` 只以较低频率更新进度条等 React UI，避免通过 React 重渲染驱动歌词动画。进度跳转依次执行 `resetScroll()`、`setCurrentTime(ms, true)`、`calcLayout('seek')`，使用 AMLL 0.6 的布局原因参数。
- 外部协议变化应添加脱敏 fixture 或 mock 回归测试。

## 数据与认证说明

- 房间、聊天、投票、认证 Cookie 池均存储在内存中，服务重启后清空。
- 身份由 HttpOnly 签名 Cookie 维护；生产环境必须配置唯一的 `IDENTITY_SECRET`。
- 音乐平台 Cookie 仅按房间存储于服务端内存，并由客户端 localStorage 恢复；主动登出时才删除客户端 Cookie。
- 平台个人歌单操作使用当前用户自己的 Cookie，VIP 播放可使用房间内最高等级的可用 Cookie。
