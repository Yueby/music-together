# Music Together 论坛微应用

把现有网页前端适配进 Discourse 微应用：复用同一套 React 页面、房间与播放逻辑，只替换宿主相关的几处（SDK Socket.IO 传输、受控音频读取、搜索/歌词、内存存储）。后端与网页端是同一个服务，微应用和网页端在同一个房间里互通。详细设计见 [微应用兼容层](../../docs/architecture/mini-app-compatibility.md)。

## 目录

| 位置                                          | 作用                                                            |
| --------------------------------------------- | --------------------------------------------------------------- |
| `src/compat/`                                 | 宿主适配：房间会话、SDK 音频引擎、元数据/房间预检读取、存储后端 |
| `src/bootstrapClient.ts`、`src/clientMain.ts` | 启动流程与入口                                                  |
| `scripts/`                                    | 构建配置校验与 ZIP 打包（官方 SDK `pack`）                      |
| `../client/mapp.vite.ts`                      | 复用网页前端构建插件的 Vite 配置                                |

## 构建与打包

使用 Node >=24.15、pnpm 和现有 Vite 工具链，不需要 Bun。

```bash
MAPP_ROOM_URL='wss://你的主站域名/socket.io/?EIO=4&transport=websocket' \
MINI_APP_ID='平台应用页分配的UUIDv7' \
  pnpm --filter @music-together/mapp package
```

- `MAPP_ROOM_URL`：已审定的房间 WSS 地址，必须是主站域名的 `/socket.io/?EIO=4&transport=websocket`，不带用户名、端口或其他参数。搜索、歌词和受控音频的 HTTPS 端点由它的域名推导。
- `MINI_APP_ID`：必填，使用平台应用页分配的 ID；源码里的占位 ID 不能打包。
- 版本号取 `manifest.json` 的 `version`（当前 `0.2.0`），沙箱测试无需改动：同一版本可上传多个沙箱构建，由 ZIP 的 SHA-256 区分，只有内容完全相同才会被 `BUILD_EXISTS` 拒绝。仅在正式发布前才需要升版本（必须高于已发布的最高版本），此时再显式设置 `MINI_APP_VERSION`。

产物：

- `dist/client-web/app.js`、`app.css`：单个 IIFE 脚本与单个样式表，无运行时外部分包。
- `dist/client-package/app.zip`、`package.json`：上传到平台沙箱的包，大小和 SHA-256 以 `package.json` 为准。

打包时会校验 Tailwind 工具类样式是否完整，缺失则拒绝生成 ZIP。

## 权限与端点

manifest 由代码生成，只声明：

- 权限：`user.read`、`audio.webAudio`、`network.websocket`、`network.request`。
- WebSocket：`roomSocket`（房间 Socket.IO）。
- HTTP：`roomAudio`（`GET /api/mapp/audio`）、`musicSearch`、`musicLyric`、`musicTtml`（逐词歌词）、`musicCover`（封面字节）、`musicArtist` / `musicArtistSongs` / `musicArtistAlbums`（歌手主页）、`musicPlaylist`（公开歌单与专辑分页）。新增只读接口只需在 shared 的 target 表、schema 表和服务端 handler 表各加一项，manifest 端点自动生成。

这些端点都是 `auth: "platform"`，由主站后端验证平台 JWT，验证失败不回退 Cookie。

## 本地检查

```bash
pnpm --filter @music-together/mapp typecheck
pnpm exec vitest run packages/mapp
```
