# @discourse-mini-app/sdk

通过 `getSDK()` 获取 SDK，等待 `sdk.ready` 后调用 API。完成首次渲染或显示错误后，调用 `lifecycle.ready()`。

```ts
import { getSDK } from "@discourse-mini-app/sdk";

const sdk = getSDK();
await sdk.ready;
try {
  const user = sdk.permissions.has("user.read")
    ? await sdk.user.getCurrent()
    : null;
  const player = document.getElementById("player");
  if (player) player.textContent = user?.name ?? "访客";
} finally {
  await sdk.lifecycle.ready();
}
```

## 权限与 API

| 权限                                       | 方法                                                                     |
| ------------------------------------------ | ------------------------------------------------------------------------ |
| `user.read`                                | `user.getCurrent()`                                                      |
| `user.lookup`                              | `user.getById(userId)`                                                   |
| `launch.read`                              | `launch.getParameters()`                                                 |
| `theme.read`                               | `theme.get()`、`theme.onChange(callback)`                                |
| `storage.read` / `storage.write`           | `localStorage.getItem/setItem/removeItem/clear/exportData/importData`    |
| `cookies.read` / `cookies.write`           | `cookies.get/set/remove`                                                 |
| `clipboard.read` / `clipboard.write`       | `clipboard.readText/writeText`                                           |
| `fullscreen`                               | `fullscreen.request/exit`                                                |
| `pointer.lock`                             | 原生 `Element.requestPointerLock()`、`document.exitPointerLock()`        |
| `audio.play` / `video.play`                | `audio.play(assetId)`、`video.play(assetId)`、对应 `stop(handle)`        |
| `audio.webAudio`                           | 原生在线 `AudioContext`，调用方式仍为浏览器 API                          |
| `audio.worklet`                            | `audioWorklet.addModule(context, path, options?)`，另需 `audio.webAudio` |
| `network.request`                          | `http.request/stream/events(endpointName, options)`                      |
| `network.websocket`                        | `webSocket.connect(endpointName, options)`                               |
| `assets.remote`                            | `assets.readBytes/readText/readJson(path)` 读取声明的 CDN 素材           |
| `links.open`                               | `links.open(url)`                                                        |
| `app.call`                                 | `app.call(appId, query?, options?)`                                      |
| `notifications`                            | `notifications.request(templateId, request, options?)`                  |
| `files.save`                               | `files.save(name, data)`                                                 |
| `sharing.share`                            | `sharing.share(data)`                                                    |
| `screen.keepAwake`                         | `screen.setKeepAwake(enabled)`                                           |
| `gamepad.read`                             | `gamepad.get()` 或原生手柄 API                                           |
| `code.load`                                | `scripts.load(path)`                                                     |
| `workers.create`                           | `workers.create(path, options?)`                                         |
| `code.modules`                             | `modules.import(path)`                                                   |
| `code.eval`                                | 隔离环境内的 `eval` / `new Function`                                     |
| `video.stream`                             | 已审核业务端点提供的媒体时间线与片段，另需网络、播放权限                 |
| `camera` / `microphone` / `screen.capture` | `media.capture`、截图、分块录制                                          |
| `location.read`                            | `location.get()`                                                         |
| `device.usb` / `device.bluetooth`          | 已审核设备的选择、连接与协议操作                                         |

先检查 `sdk.permissions.has()`，并处理 Promise 拒绝。`sdk.capabilities.get()` 返回当前浏览器的能力快照及批准权限，不触发设备许可。匿名模式的用户为 `null`，不能查询其他用户、使用剪贴板或取得平台身份 JWT；可调用获批且声明 `auth: "none"` 的公开 HTTP/WS，也可读取获批的固定 CDN 素材。

- 用户资料包含 `id/username/name/initials/trustLevel/avatarUrl`。使用 `id` 关联用户数据和判断身份，用户名只用于展示。`trustLevel` 是 0–4 的论坛信任等级，未提供时为 `null`；它是展示信息，不是开发者服务器的授权凭据。`getCurrent(options?)` 和 `getById(userId, options?)` 支持可选 `signal`、`timeoutMs`，默认不设总超时。
- `avatarUrl` 是请求 288 像素头像后得到的本次运行内 Blob URL，可直接设置为图片的 `src`。读取失败或头像缺失时为 `null`，可回退显示 `initials`。不要持久化或手动回收这个地址；离开微应用后会失效。不另设头像数量或字节配额。
- 头像支持 PNG、JPEG、GIF、WebP 和 AVIF。不支持的图片格式返回 `null`。
- 主题包含颜色、明暗、语言、容器尺寸和减少动效偏好；`onChange` 返回取消订阅函数。
- 启动参数返回 `{ query: Record<string, string[]>, hash }` 快照；重复 query 保留，hash 不含 `#`。不另设总量、键数或单值额度，平台保留的身份与运行参数仍会过滤；不能作为身份凭据。
- `audio.play/video.play` 只播放 manifest 声明的包内资源或固定 CDN 素材。远程媒体同时需要 `assets.remote` 和对应播放权限。剪贴板保留用户确认；每次进入全屏前都显示“进入全屏”确认；视频直接显示播放器。音频输出由本次运行的声音开关控制。
- SDK 不再设置通用每分钟调用配额、音效每秒次数或网络数据大小配额。网络、素材读取和媒体播放支持可选 `signal`、`timeoutMs`，默认不设总超时。处理权限、浏览器失败、取消、`TIMEOUT` 和离开后的 `APP_UNLOADED`；论坛授权等服务端接口仍有自身限流。

获取当前论坛界面语言需 `theme.read`，语言代码沿用 Discourse，例如 `zh_CN`、`zh_TW`、`en`：

```ts
const { locale } = await sdk.theme.get();
const unsubscribe = sdk.theme.onChange(({ locale }) => updateLanguage(locale));
```

`links.open(url)` 仅接受 manifest `links` 数组中的完整 URL；query、fragment 也须一致。无声明的旧版本同样不可打开外链。完整示例见[外链声明](../docs/browser-capabilities.md#外链文件与分享)。

更多能力：[外链、文件、分享、常亮、手柄与存档备份](../docs/browser-capabilities.md) · [分包、ESM 与 Worker](../docs/execution.md) · [网络恢复与分片上传](../docs/network-recovery.md) · [分片视频与画中画](../docs/segmented-media.md) · [直播、清晰度、音轨与跳转](../docs/media-timelines.md) · [设备访问](../docs/device-access.md) · [AudioWorklet](../docs/audio-worklet.md)。

应用间同页跳转使用 [`app.call/return`](../docs/app-navigation.md)：manifest `calls` 只声明目标应用 ID，query 可动态传入；返回只允许当前调用栈中的祖先，无需额外声明。每次跳转都重新启动目标应用，返回数据从启动参数读取，不跨页面等待原 Promise。

[`notifications.request()`](../docs/notifications.md) 在用户操作时申请下一次模板通知。前端提醒限 24 小时，后台许可限 30 天、仅用一次；每次都需用户同意。通知以论坛私信送达，用户可在应用信息中关闭。

分片播放 `video.playSegments` 同时需要 `video.play` 与 `assets.remote`；画中画沿用 `video.play`。`network.reconnectSocket/reconnectEvents/uploadChunks` 复用底层网络权限，不新增业务权限。

## 鼠标锁定

需要鼠标锁定时，在 manifest 的 `permissions` 中加入 `pointer.lock` 并提审。批准后直接使用原生 `Element.requestPointerLock()`，没有 `sdk.pointerLock` 包装或平台额外确认框。`mousemove` 的 `movementX/movementY` 是应用内原生事件，不经过 RPC。

在应用自己的用户点击处理函数中、首个 `await` 之前发起请求。浏览器可能返回 Promise 或 `void`；处理同步异常与 Promise 拒绝，并以 `pointerlockchange`、`pointerlockerror` 和 `document.pointerLockElement` 确认结果，不能把方法返回视为成功。

使用 `document.exitPointerLock()` 或 Esc 退出；应用失焦、隐藏或关闭时会自动释放，不自动重锁。优先使用不带选项的标准锁；`unadjustedMovement` 是可选能力，不支持时提供标准锁入口，让用户点击重试。

全屏仍使用 `sdk.fullscreen.request/exit`。若同时需要全屏和锁定，先通过 SDK 进入全屏，再让用户在应用内点击锁定；不要在 `await sdk.fullscreen.request()` 后直接请求原生锁定，此时最初的用户激活已不可依赖。

`fullscreen.exit()` 同时撤销尚未确认或正在进入的请求，原 `request()` 以 `USER_CANCELLED` 拒绝。等待退出完成后再重新请求。

已有原生锁定代码只需新增权限、重新打包提审，调用方式不变；未使用锁定的应用无需申请。`setPointerCapture()` 用于拖动和长按，不需要 `pointer.lock`，见 [开发说明](../docs/developer-guide.md#鼠标锁定)。

## 音频播放

获批 `audio.webAudio`，或同时获批 `audio.play` 并声明了音频素材的应用，在代码执行前让用户选择初始声音状态。运行中可通过声音开关（窄屏在“更多”菜单中）随时开启声音或静音；开关只影响本次运行，关闭或刷新后重选。`audio.play/stop` 不弹框，音频由应用控制，平台只提供总声音开关，不显示音频列表或暂停、停止按钮；视频保留原有播放器界面。

静音只关闭输出，既有和新音频仍正常播放、保留进度及独立的 `{ handle }`，也可下载声明的远程音频。`stop(handle)` 照常停止对应音频；取消静音会恢复当前背景音乐或循环音频的声音，不补播已结束的短音效。

仅使用 `sdk.audio.play/stop` 的现有应用保持兼容，无需增加 `audio.webAudio` 或为声音开关重新打包。使用原生在线 `AudioContext` 的应用需申请 `audio.webAudio` 并重新提审；API 调用仍使用浏览器原生接口。

不另设音视频播放路数配额；平台复用空闲音频播放器，不抢停正在播放的音效。音效不应阻塞输入状态；长按开始时先更新状态，松手早于 `play` 返回时应在取得句柄后立即停止。浏览器可能拒绝播放，应用应处理失败，见 [长按操作示例](../docs/developer-guide.md#音频与长按操作)。

## 原生 Web Audio

获批 `audio.webAudio` 后可使用 `new AudioContext()`。声音开关同步控制其总输出；静音不暂停音频时钟、节点调度或播放进度。不另设 context 数量配额，用完后调用 `close()` 释放资源；退出应用会统一关闭。

浏览器的用户手势要求仍然存在：在应用自己的点击处理函数中调用 `context.resume()`，并处理拒绝。先完成首次渲染并调用 `sdk.lifecycle.ready()`，不要等待音频启动或 `resume()` 完成后才显示界面。

`OfflineAudioContext` 可用于离线处理，无需 `audio.webAudio`，也不直接发声。不支持 `createMediaStreamDestination()`。受控在线 context 可通过 [`sdk.audioWorklet.addModule()`](../docs/audio-worklet.md) 加载已声明处理器，需同时批准 `audio.webAudio` 与 `audio.worklet`；OfflineAudioContext 不使用该入口。

## 包内文件

读取只限当前包的基础文件和声明资源，不需要额外权限。三个方法均为异步：

| 方法                               | 返回内容                                                    |
| ---------------------------------- | ----------------------------------------------------------- |
| `await sdk.assets.readText(path)`  | UTF-8 文字                                                  |
| `await sdk.assets.readJson(path)`  | JSON 数据，例如 `await sdk.assets.readJson("strings.json")` |
| `await sdk.assets.readBytes(path)` | 文件字节；基础文本按 UTF-8 返回                             |

普通资源在 manifest 的 `assets` 路径数组中声明；`media` 已声明的文件不要重复列入。包内图片使用 Blob，例如：

```ts
const bytes = await sdk.assets.readBytes("images/logo.png");
const url = URL.createObjectURL(new Blob([bytes], { type: "image/png" }));
const logo = new Image();
logo.src = url;
document.body.append(logo);
// 图片不再使用时：URL.revokeObjectURL(url)
```

图片使用读取到的字节创建 Blob，或使用用户资料接口提供的 Blob 地址；音视频在 `media` 声明后使用 `sdk.audio/video.play()`。包内单文件最多 32 MiB，整个 ZIP 的文件数和大小限制见 [开发说明](../docs/developer-guide.md#项目和运行-zip)。

## 自定义字体

将字体文件加入包内 `assets`，再把读取到的字节交给原生 `FontFace`：

```ts
const bytes = await sdk.assets.readBytes("fonts/game.woff2");
const font = await new FontFace("GameFont", bytes).load();
document.fonts.add(font);
// 在 app.css 中使用 font-family: "GameFont", sans-serif。
```

也可读取已声明的 CDN 二进制素材，需 `assets.remote` 并使用允许的 `application/octet-stream` MIME。字体格式支持取决于浏览器；不支持 `@font-face` 或 `FontFace` 的 URL 加载，包括 Blob URL。

## WebAssembly

单线程 WASM 文件可放入运行 ZIP 并在 `assets` 声明，也可加入固定 CDN 清单。无需新增 WASM 权限；CDN 读取仍需 `assets.remote`。例如读取 `wasm/answer.wasm`：

```ts
const { module, instance } = await sdk.wasm.instantiate("wasm/answer.wasm");
const answer = instance.exports.answer;
if (typeof answer === "function") console.log(answer());
```

`instantiate(path, imports?)` 接收原生 WebAssembly imports，返回原生 `module` 和 `instance`。只接受已声明的 `.wasm` 虚拟路径，不接受任意 URL 或未声明文件。远程模块先完整验证大小、MIME 和 SHA-256。此方法不限制浏览器原生 WebAssembly 的其他字节来源。

读取前后及编译完成后会检查应用生命周期，退出后以 `APP_UNLOADED` 拒绝，避免随后执行模块 start。不可用的浏览器 API 返回 `API_UNSUPPORTED`，非法路径返回 `ASSET_NOT_FOUND`；文件读取错误与原生 `CompileError`、`LinkError`、`RuntimeError` 原样传播。`CompileError` 也可能来自浏览器策略，不能一概视为文件语法错误。

JS `eval`/`new Function` 需单独批准 `code.eval`；分包、ESM 与 Worker 见[执行能力](../docs/execution.md)。SharedArrayBuffer 和多线程 WASM 仍受当前浏览器隔离条件限制。JSPI、WASM GC 依赖浏览器原生特性检测，SDK 不提供兼容层或统一支持保证。

## CDN 素材

通过 manifest 的 `remote_assets` 固定素材 URL、SHA-256、字节数与 MIME，并申请 `assets.remote`。虚拟路径不能与包内文件重名，不放入 `assets` 或 ZIP；`media.path` 可以指向远程素材，但 MIME 必须匹配。完整声明和构建步骤见 [开发者 CDN 素材](../docs/developer-guide.md#开发者-cdn-素材)。

```ts
if (sdk.permissions.has("assets.remote")) {
  const bytes = await sdk.assets.readBytes("images/atlas.webp");
  const atlasUrl = URL.createObjectURL(
    new Blob([bytes], { type: "image/webp" })
  );
  // 将 atlasUrl 设置为图片 src；不用时调用 URL.revokeObjectURL(atlasUrl)。
  if (sdk.permissions.has("audio.play")) {
    await sdk.audio.play("music", { volume: 0.5, loop: true });
  }
}
```

`readText` 使用 UTF-8，`readJson` 继续解析 JSON，`readBytes` 返回文件原始字节。只传已声明的虚拟路径，不能传任意 URL。清单不另设文件数或字节配额，受 manifest 1 MiB 边界约束；不同文件交给浏览器调度，相同文件的并发读取合并。完整校验后才交付，当前实例的已验证内存缓存最多 64 MiB，较大的文件可读取但不留在该缓存中。

文件读取和音视频播放可在 options 中传 `signal`、`timeoutMs`，不再设固定总期限。大素材建议按关卡读取；单文件视频须完整校验后播放。固定分片可用 `video.playSegments()` 逐片校验播放，并支持静态 HLS/DASH 子集转换，见[分片视频](../docs/segmented-media.md)。

CDN 需允许论坛 origin 的 CORS GET，且不依赖 Cookie、认证头或重定向。改动内容或 URL 后应更新描述符并重新提审；校验失败没有忽略 SHA-256 的回退。常见失败包括 `ASSET_NOT_FOUND`、`PERMISSION_DENIED`、`REMOTE_ASSET_FAILED`、`REMOTE_ASSET_INVALID`、`RATE_LIMIT` 和 `APP_UNLOADED`。远程 JavaScript 需按[执行角色](../docs/execution.md)声明并获批；不加载执行远程 HTML 或 CSS。

## 浏览器存储

存储仅保存在当前浏览器，按应用及正式/沙盒隔离；`clear()` 只清当前应用范围。用户级 key 由应用组织，数据不跨设备同步。

```ts
await sdk.localStorage.setItem("progress", JSON.stringify({ level: 2 }));
const raw = await sdk.localStorage.getItem("progress");
const progress = raw === null ? null : JSON.parse(raw);
```

`localStorage` 保留原有异步 API，数据由容器代管的 IndexedDB 保存，旧存档会自动迁移。不再设置单值大小、键数或应用总容量配额，以浏览器存储配额为准。

`cookies` 同样按应用及正式/沙盒隔离。key 限字母、数字、点、下划线或连字符；`maxAge` 为非负安全整数秒，默认一天，0 表示删除。不再另设 30 天有效期或 32 项数量限制；单次 Cookie 赋值串（含编码后的名称、值与属性）最多 4096 字节，超出返回 `MESSAGE_LIMIT`，大数据使用 `localStorage`。浏览器自身的 Cookie 容量、有效期和存储策略仍适用。

浏览器拒绝存储时返回 `STORAGE_UNAVAILABLE`，应用应处理保存失败。切换账号不会自动切换此应用的数据。

Cookie 隔离升级后，SDK 不读取或删除旧命名空间的 Cookie，也不自动迁移路径和剩余有效期。应用可重新保存所需偏好，旧 Cookie 按原有期限由浏览器管理；存档导入导出不包含 Cookie。

## 网络与打包

HTTP 返回 `{ status, headers, body }`；`request()` 返回完整数据，`stream()` 返回字节流，`events()` 返回解析后的 SSE 事件流。三者可通过 `onDownloadProgress` 观察响应读取进度；流的取消方式与示例见 [HTTP/WS](../docs/sdk-network.md)。响应头按 CORS 暴露，凭据头除外。

WS 返回可 `send/sendText/close/on` 的连接；默认自动解析收到的 JSON 文本，`connect(endpoint, { textMode: "text" })` 可保留文本原样。网络目标由 manifest 固定，开发者服务认证见 [服务端鉴权](../docs/server-auth.md)。

使用 `@discourse-mini-app/sdk/pack` 构建原始 ZIP。下例只包含基础文件；声明的包内 `assets/media` 文件也应按相同路径加入 `files`，`remote_assets` 中的文件不要加入：

```ts
import { readFile } from "node:fs/promises";
import { pack } from "@discourse-mini-app/sdk/pack";

await pack({
  outputDirectory: "dist/package",
  manifest: JSON.parse(await readFile("manifest.json", "utf8")),
  files: {
    "index.html": await readFile("dist/web/index.html"),
    "app.js": await readFile("dist/web/app.js"),
    "app.css": await readFile("dist/web/app.css"),
    "strings.json": await readFile("dist/web/strings.json"),
  },
});
```

Vite 的单 IIFE/CSS 构建配置和媒体打包见 [完整示例](../demos/README.md)。运行 ZIP 只含编译产物，格式与调试步骤见 [开发说明](../docs/developer-guide.md)。
