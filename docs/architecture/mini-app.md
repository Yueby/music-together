# Discourse 微应用

## 定位与结构

`packages/mapp` 只是把现有网页前端适配为论坛微应用并打包的外壳，不是另一个产品。后端与网页端共用同一个服务：同一套 Socket.IO 房间、队列、权限和播放状态，平台入口由主站按环境变量启用，网页端行为保持不变。模块、身份、媒体读取和发布门禁见 [微应用兼容层](mini-app-compatibility.md)，构建与打包命令见 [mapp README](../../packages/mapp/README.md)。

| 位置                                           | 职责                                                                    |
| ---------------------------------------------- | ----------------------------------------------------------------------- |
| `packages/mapp/src/compat/`                    | SDK 传输、房间会话、宿主组合、音频引擎、受控媒体/元数据读取等平台适配  |
| `packages/mapp/src/bootstrapClient.ts` 等      | 微应用启动、挂载与退出清理                                              |
| `packages/mapp/scripts/`                       | 客户端 manifest 生成与官方 SDK 打包校验                                 |
| `packages/client/src/platform/`                | 复用网页界面的微应用外壳（MemoryRouter + 原 AppSurface）                |
| `packages/server`                              | 同一个后端；启用后额外接受平台 JWT 身份与受控媒体/元数据入口           |
| `vendor/discourse-mini-app-sdk`                | 官方 SDK 0.3.0 原始发行文件，本地 `file:` 依赖及固定提交来源记录        |

## 能力验证记录（探针已退役）

早期用独立探针在真实平台 sandbox 验证了能力边界。探针的前端、同步服务及其 `/mapp-sync` 路径分流已移除，同域部署不再需要为微应用单独分流 Cloudflare 路径；下面只保留结论，作为正式实现的依据。

| 构建 | 验证内容 | 观察结果 |
| --- | --- | --- |
| `0.2.1-e54f5854`（SDK 0.2.0） | 同一浏览器两个标签页，同素材、同测试房间，经平台 JWT 鉴权后互相同步控制 | 两端 ready，各收集 5 个时钟样本；同步暂停与跳转两端状态一致；隐藏一端后另一端继续播放，回到前台恢复，软件 drift 抽样 21.1ms |
| `0.3.0-25be5534`（SDK 0.3.0） | `http.request` bytes、`http.stream`、原样 WS 文本 | 约 250KiB 动态音频经 bytes 与 stream 均完成读取、解码（8.00s）并正常播放/暂停；`textMode: "text"` 与 `sendText` 完成真实 JSON 往返，5 个校时样本 |

这些结果是同一浏览器双标签的软件状态验收，不是跨设备或物理扬声器同步精度承诺。流模式仍是完整读取后才 `decodeAudioData`，不宣称边下边播；它证明获准业务端点的字节响应到 Web Audio 的通路可用，不等于任意第三方音频 URL 可直接覆盖审核端点。跨设备、锁屏和真实网页端同房仍需在启用后的 sandbox 中验收。

## SDK 版本与官方能力核查

开发树固定官方 SDK **0.3.0**，原样来源为平台已登录开发者页面所链接的 `linux-do/mapp-developer-guide` 提交 `f22f6e5247be95684a183c41b392ce468bc09785`，来源记录见 `vendor/README.md`。2026-11-10 核对上游最新提交 `7792ce37`：版本号仍为 0.3.0，仅增量新增应用间跳转 `app.call/return`、`app.call` 权限与 manifest `calls`，本项目未使用，因此未升级。类型和版本号不能代替现场能力检查。

| 边界 | 官方 SDK 0.3.0 的公开契约 | 集成要求 |
| --- | --- | --- |
| 业务响应字节 | `http.request` 支持 `responseType: "bytes"`；`http.stream` 返回 `ReadableStream<Uint8Array>`，需 `network.request` | 受控媒体端点读取字节后 Web Audio 解码；读取字节流不等于边下边播 |
| 网络配额与取消 | 平台不设小额字节配额或默认总超时，支持 signal、`timeoutMs`、下载进度 | 应用自己限制读取量和并发，并传播取消 |
| WebSocket | 支持原样 `sendText`、`textMode: "text"` 及二进制消息；握手拒绝重定向；已建立连接没有平台固定时长限制，也不因握手 JWT 到期断开 | Engine.IO／Socket.IO 帧直接经 SDK 传输；JWT 只在握手时验证 |
| 目标与重定向 | 网络目标由 manifest 声明；动态 query 键须预先声明；重定向只在声明 `redirectTo` 时发生 | 房间、音频、搜索、歌词各用固定端点，不依赖重定向 |
| 身份与鉴权 | 平台 JWT 须服务端验证，身份取 `(iss, sub)`；受保护端点不得回退 Cookie；WS 须在 upgrade 前验证 | 主站后端验签并映射为稳定 `mapp_` 身份，不复制网页 Cookie |
| 音频 | `audio.webAudio` 提供原生 `AudioContext`；用户进入时选择声音状态，静音不暂停音频时钟 | 使用 `WebAudioPlayer`（单 context、单活动 source）并在用户手势内解锁 |

官方依据：[SDK 说明](https://github.com/linux-do/mapp-developer-guide/blob/7792ce37b3/sdk/README.md)、[HTTP/WS 契约](https://github.com/linux-do/mapp-developer-guide/blob/7792ce37b3/docs/sdk-network.md)、[服务端鉴权](https://github.com/linux-do/mapp-developer-guide/blob/7792ce37b3/docs/server-auth.md)、[提审说明](https://github.com/linux-do/mapp-developer-guide/blob/7792ce37b3/docs/submission-review.md)。
