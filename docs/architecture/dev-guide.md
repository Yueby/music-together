# 开发指南

## 快速启动

```bash
# 安装依赖
pnpm install

# 启动前后端开发服务器（默认同时开放到局域网）
pnpm dev

# 其他设备通过 http://你的局域网IP:5173 访问前端
# 前端会自动连接到 http://你的局域网IP:3001 后端

# 仅启动前端
pnpm dev:client

# 仅启动后端
pnpm dev:server
```

## 端口

| 服务                       | 默认端口 |
| -------------------------- | -------- |
| 前端 (Vite)                | 5173     |
| 后端 (Express + Socket.IO) | 3001     |

## 环境变量

## 服务端 (`packages/server/.env`)

| 变量           | 说明                     | 默认值                  |
| -------------- | ------------------------ | ----------------------- |
| `PORT`         | 服务端口                 | `3001`                  |
| `CLIENT_URL`   | 客户端地址（CORS）       | `http://localhost:5173` |
| `CORS_ORIGINS` | 额外 CORS 源（逗号分隔） | 空                      |

## 客户端 (Vite 环境变量)

| 变量              | 说明     | 默认值                  |
| ----------------- | -------- | ----------------------- |
| `VITE_SERVER_URL` | 后端地址 | `http://localhost:3001` |

## 构建

```bash
# 构建所有包
pnpm build

# 前端产物 → packages/client/dist/
# 后端产物 → packages/server/dist/
# shared 包无构建步骤，直接作为 TS 源码引用
```

## 添加 shadcn/ui 组件

```bash
cd packages/client
npx shadcn@latest add <component-name>
```

组件会安装到 `src/components/ui/`。

## 注意事项

- 服务端数据全部存储在内存中，重启后丢失
- 无数据库、无服务端持久化（客户端 Cookie 通过 localStorage 持久化）
- 用户身份基于持久化 nanoid（localStorage）+ 昵称（无注册/登录账号系统）；`socket.id` 仅用于 Socket 传输层映射
- 平台认证（网易云/酷狗 QR 扫码登录、QQ 手动 Cookie）用于 VIP 歌曲访问，Cookie 作用域为房间级。QR 登录状态码在 `shared/constants.ts` 中定义为 `QR_STATUS`（800-803），前后端共用，`QrLoginDialog` 无需区分平台
- Auth Cookie 持久化策略：**只有用户主动登出（`useAuth.logout()`）才删除 localStorage 中的 cookie**。`useAuthSync` 在收到 `AUTH_SET_COOKIE_RESULT` 失败时（无论 `reason` 是 `expired` 还是 `error`）仅通过 toast 反馈，永远不删除 cookie，确保下次进房间时自动重试。`LoginSection` 在 localStorage 有 cookie 但服务端未确认时显示 "验证登录中…" 乐观状态
- Auth Cookie 自动重发：`useRoomState` 在收到 `ROOM_STATE` 时自动重发 localStorage 中的 cookie。另外，当从 HomePage 导航到 RoomPage 时（`ROOM_STATE` 已被 HomePage 提前消费），`useRoomState` 挂载时检测到 room 已存在会立即补发 cookie，确保任何入口都能恢复认证
- Auth Cookie 服务端验证双路径：`authController` 收到 `AUTH_SET_COOKIE` 时先检查 `hasCookie()`——如果 cookie 已在内存池中（刷新页面场景），走 **fast path** 跳过 API 调用直接返回成功；否则走 **slow path** 调用 `getUserInfo()` → `ncmApi.login_status()`。slow path 对**任何失败原因**（`expired` 或 `error`）都自动重试 1 次（间隔 1.5 秒），因为网易云 `login_status` API 可能对有效 cookie 临时返回空 profile
- `shared` 包修改后前后端会自动热重载（pnpm workspace 链接）
