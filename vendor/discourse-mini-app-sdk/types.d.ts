// Generated from sdk/src by tools/build-sdk.ts.
export type Permission = "user.read" | "user.lookup" | "launch.read" | "theme.read" | "storage.read" | "storage.write" | "cookies.read" | "cookies.write" | "clipboard.read" | "clipboard.write" | "fullscreen" | "pointer.lock" | "audio.play" | "audio.webAudio" | "audio.worklet" | "video.play" | "assets.remote" | "network.request" | "network.websocket" | "links.open" | "files.save" | "sharing.share" | "screen.keepAwake" | "gamepad.read" | "code.load" | "workers.create" | "code.modules" | "code.eval" | "video.stream" | "camera" | "microphone" | "screen.capture" | "location.read" | "device.usb" | "device.bluetooth";
export type JsonValue = null | boolean | number | string | JsonValue[] | {
    [key: string]: JsonValue;
};
/** Static CDN resource formats accepted by the platform. */
export type RemoteAssetMime = "image/png" | "image/jpeg" | "image/gif" | "image/webp" | "image/avif" | "audio/wav" | "audio/mpeg" | "audio/ogg" | "audio/aac" | "audio/flac" | "audio/mp4" | "audio/webm" | "video/mp4" | "video/webm" | "video/ogg" | "application/json" | "application/octet-stream" | "application/wasm" | "text/vtt" | "text/javascript" | "application/javascript";
/** Immutable remote file approved together with the application manifest. */
export interface RemoteAssetDeclaration {
    /** Fixed HTTPS resource URL; callers cannot add query parameters or credentials. */
    url: string;
    /** Lowercase SHA-256 of the response bytes after HTTP content decoding. */
    sha256: string;
    /** Exact file byte length as a positive safe integer. */
    size: number;
    /** Expected response media type, excluding parameters. */
    mime: RemoteAssetMime;
}
export type HttpMethod = "GET" | "HEAD" | "OPTIONS" | "POST" | "PUT" | "PATCH" | "DELETE";
