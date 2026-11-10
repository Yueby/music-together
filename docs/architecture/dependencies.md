# 第三方库依赖

> 版本以当前各包 `package.json` 为准；本页记录核心依赖和职责。

## Client 核心依赖

| 分类 | 库 | 版本 | 用途 |
| --- | --- | --- | --- |
| UI | react / react-dom | ^19.3.1 | UI 基础 |
| UI | radix-ui / shadcn/ui | ^1.8.1 / — | 无障碍 UI 原语与项目组件 |
| 样式 | tailwindcss / @tailwindcss/vite | ^4.3.3 | 原子化 CSS 与 Vite 集成 |
| 状态 | zustand | ^5.0.16 | 客户端状态管理 |
| 路由 | react-router | ^8.5.1 | 客户端路由（v8 ESM；仓库统一使用 Node >=24.15.0） |
| 实时通信 | socket.io-client | ^4.8.4 | Socket.IO 客户端 |
| 音频 | howler | ^2.2.4 | 音频播放引擎 |
| 歌词 | @applemusic-like-lyrics/core / react / lyric | ^0.6.0 / ^0.6.0 / ^1.1.0 | AMLL 歌词解析、逐词动画与动态背景 |
| 动画 | motion | ^14.9.0 | React 动画 |
| 虚拟列表 | @tanstack/react-virtual | ^3.14.24 | 搜索和歌单大列表 |
| 图形 | @pixi/* | 7.x | 歌词背景渲染与滤镜 |
| 工具 | dayjs / nanoid / sonner / lucide-react | 当前锁定版本 | 日期、ID、通知、图标 |

## Server 核心依赖

| 库 | 版本 | 用途 |
| --- | --- | --- |
| express | ^5.3.0 | HTTP API 和静态文件托管 |
| socket.io | ^4.8.4 | 实时房间通信 |
| @meting/core | ^1.6.2 | 多音源基础数据聚合 |
| @neteasecloudmusicapienhanced/api | ^4.41.1 | 网易云登录、用户、歌单及登录态播放 URL API |
| dotenv | ^18.0.9 | 环境变量加载 |
| zod | ^4.6.7 | 运行时输入验证 |
| pino | ^10.4.0 | 结构化日志 |
| rate-limiter-flexible | ^11.2.3 | Socket/聊天限流 |
| express-rate-limit | ^8.7.2 | 音乐 REST 与封面代理 HTTP 限流 |
| lru-cache | ^11.5.3 | 搜索、曲目和资源缓存 |
| p-limit | ^7.3.3 | 外部请求并发控制 |
| qrcode | ^1.5.4 | 酷狗登录二维码编码 |
| escape-html | ^1.0.3 | 聊天内容转义 |

服务端的 TTML 逐词歌词解析使用 `@applemusic-like-lyrics/ttml`（与客户端歌词包内置版本一致，固定 1.0.1）并注入 `@xmldom/xmldom` 作为 DOMParser（Node 没有内置的，微应用的 Trusted Types 也不允许在客户端解析）。

酷狗 KRC 获取、解密和逐词解析由 `packages/server/src/services/kugouLyricService.ts` 内置实现，不再依赖已停止维护的 `request` 生态。

QQ 音乐搜索使用腾讯 `zzc` 签名访问 `musics.fcg`，避免未签名 `musicu.fcg` 返回业务码 `2001` 和空列表。

## Shared 核心依赖

| 库 | 版本 | 用途 |
| --- | --- | --- |
| @casl/ability | ^7.1.0 | 前后端共享 RBAC 能力定义 |
| zod | ^4.6.7 | 前后端共享 Schema |

## 微应用依赖

`packages/mapp` 使用原生 TypeScript、现有 Vite 8 工具链及固定在仓库根 `vendor/` 的 `@discourse-mini-app/sdk@0.3.0`。SDK 通过 `file:` 依赖解析：`packages/mapp` 用它的平台客户端与 ZIP 打包入口，`packages/server` 用它的 `/server` 验签入口（平台 JWT 验证）；运行时音频内核使用原生 Web Audio。浏览器显式复用 `zod@^4.6.7` 并在 Schema 初始化前关闭 JIT，以适配沙箱 CSP。该包通过 `tsc6` 执行独立类型检查；因 `file:` 依赖，Dockerfile 在安装依赖前需复制 `vendor/`。构建及 SDK 来源见 [mini-app.md](mini-app.md)。

## 开发与测试工具

| 库 | 位置 | 用途 |
| --- | --- | --- |
| TypeScript ~6.0.2 | all | `typescript` 使用 `@typescript/typescript6` 别名，提供类型检查和构建 |
| TypeScript ~7.0.2 | all | `@typescript/native` 使用 `typescript` 别名，供原生编译器使用 |
| Vite ^8.3.5 | client | 前端构建 |
| ESLint ^10.14.0 | client | 代码检查 |
| Vitest ^5.0.5 | root | Node/jsdom 单元与组件测试 |
| Testing Library | client | React 组件行为测试 |
| jsdom ^30.1.3 | client | 浏览器 DOM 测试环境 |
| tsx ^4.23.15 | server | 服务端开发热重载 |
| shadcn ^4.23.0 | client | shadcn/ui 组件生成 CLI |
| Prettier ^3.9.10 | root | 代码格式化 |
| concurrently ^10.0.6 | root | 并行启动前后端 |

核心依赖升级需核对 API 变化，并执行测试、类型检查、lint 和生产依赖安全审计；构建验证按需执行。

`patches/@neteasecloudmusicapienhanced__api@4.41.1.patch` 通过 `pnpm-workspace.yaml` 的 `patchedDependencies` 锁定：接受官方验签后返回的有效 X25519 公钥及可选 `sk` 字段，保留响应验签和业务码检查；握手请求设 8s 超时；正常 XEAPI 请求重新读取原子更新的密钥缓存，失败日志仅保留状态和业务码。Docker 的依赖阶段和运行阶段均先复制 `patches/` 再执行 frozen install。升级该 SDK 时需重新运行补丁契约与播放适配回归测试。

根 `pnpm-workspace.yaml` 对 shadcn CLI 的传递依赖锁定安全版本：`@modelcontextprotocol/sdk@1.30.0` 和 `@hono/node-server@2.0.12`。

网易云 API 的代理依赖链使用 `get-uri@6>basic-ftp` 定向锁定 `basic-ftp@6.2.1`，修复目录列表解析的 CPU 拒绝服务漏洞（GHSA-c475-qrg2-pj4r）。该版本保留 `get-uri` 使用的 FTP Client 接口，并默认限制被动传输连接到同一主机；此 override 需在上游依赖采用修复版本后重新评估。
