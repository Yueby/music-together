# 固定 SDK 来源

`discourse-mini-app-sdk/` 原样取自平台开发者页面链接的官方仓库：

- 仓库：<https://github.com/linux-do/mapp-developer-guide>
- 提交：`44141fbee68fd5f783f5c2bd0e662fad28cf3556`
- 目录：`sdk/`
- 包：`@discourse-mini-app/sdk@0.4.0`
- `package.json` SHA-256：`dc334b38ceff479d1aa6b44ec263b8222731864c3fb9f2f5e6011432a13d3d1d`

发行文件保持原样，由 `packages/mapp`（客户端打包）与 `packages/server`（平台 JWT 验签）通过 `file:../../vendor/discourse-mini-app-sdk` 使用。平台运行时由宿主注入，类型和版本号不能代替现场能力检查。升级后需同时执行类型检查、协议/打包回归和真实 sandbox 验证。
