# 固定 SDK 来源

`discourse-mini-app-sdk/` 原样取自平台开发者页面链接的官方仓库：

- 仓库：<https://github.com/linux-do/mapp-developer-guide>
- 提交：`ae0b523297a8c25314304f2cd92270badc0ac629`
- 目录：`sdk/`
- 包：`@discourse-mini-app/sdk@0.3.0`
- `package.json` SHA-256：`502c327b9ad8351301ffabf828febcbaa21f37f6448c5413004b3b1fb8d3bfce`

发行文件保持原样，由 `packages/mapp`（客户端打包）与 `packages/server`（平台 JWT 验签）通过 `file:../../vendor/discourse-mini-app-sdk` 使用。平台运行时由宿主注入，类型和版本号不能代替现场能力检查。升级后需同时执行类型检查、协议/打包回归和真实 sandbox 验证。
