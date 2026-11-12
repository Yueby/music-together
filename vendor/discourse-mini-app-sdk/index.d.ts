// Generated from sdk/src by tools/build-sdk.ts.
import type { DeviceClient, DeviceSupported } from "./device-client.js";
import type { MediaProgram, MediaProgramSource, MediaProgramState } from "./media-program.js";
import type { NetworkTools } from "./network-tools.js";
import type { NotificationPermit, NotificationRequest } from "./notification-policy.js";
import type { AppQuery, HttpMethod, JsonValue, Permission } from "./types.js";
export type { NetworkTools } from "./network-tools.js";
export type { NotificationTemplate, NotificationTemplates, NotificationRequest, NotificationPermit, } from "./notification-policy.js";
export type { DeviceClient, DeviceSupported, CaptureKind, CaptureOptions, CaptureSnapshot, CapturedFrame, RecordingChunk, FinishedRecording, LocationSnapshot, UsbDeviceSnapshot, } from "./device-client.js";
export type { DevicePolicy, UsbDeviceDeclaration, BluetoothDeviceDeclaration, } from "./device-policy.js";
export type { CodeDeclarations } from "./code-policy.js";
export type { MediaProgram, MediaByteRange, MediaAppendWindow, MediaTextSegment, MediaProgramTextTrack, MediaProgramSource, MediaProgramState, MediaFragment, MediaProgramTrack, MediaProgramVariant, MediaTimelineSegment, } from "./media-program.js";
export type { AppQuery, HttpMethod, JsonValue, Permission, RemoteAssetDeclaration, RemoteAssetMime, } from "./types.js";
export interface MiniAppUser {
    id: number;
    username: string;
    name: string;
    initials: string;
    /** Discourse trust level (0–4), or null if unavailable. */
    trustLevel: number | null;
    /** A 288px avatar as a session-local Blob URL, or null when unavailable. */
    avatarUrl: string | null;
}
/** Public query parameters and fragment supplied when opening the app. */
export interface MiniAppLaunchParameters {
    query: Record<string, string[]>;
    /** Preserves the encoded fragment without its leading #. */
    hash: string;
}
/** Appearance preferences for the app. */
export interface MiniAppTheme {
    mode: "light" | "dark";
    background: string;
    text: string;
    accent: string;
    border: string;
    /** Discourse locale code, such as zh_TW. */
    locale: string;
    reducedMotion: boolean;
    viewport: {
        width: number;
        height: number;
    };
}
export interface RequestOptions {
    /** Cancel this operation without cancelling other requests. */
    signal?: AbortSignal;
    /** Optional caller-selected deadline in milliseconds; omitted means no total deadline. */
    timeoutMs?: number;
}
export interface PlaybackOptions extends RequestOptions {
    /** Volume from 0 to 1; defaults to 1. */
    volume?: number;
    /** Repeat the approved asset until stopped; defaults to false. */
    loop?: boolean;
}
export interface SegmentedVideoSource {
    /** MSE container and codecs, for example video/mp4; codecs="avc1.42E01E". */
    mime: string;
    /** Initialization fragment declared in remote_assets. */
    init: string;
    /** Media fragments in playback order, each declared in remote_assets. */
    segments: string[];
}
export interface ShareOptions {
    title?: string;
    text?: string;
    /** HTTP(S) destination shown to the user. */
    url?: string;
    files?: File[];
}
export interface StorageSnapshot {
    format: 1;
    entries: [string, string][];
}
export interface MiniAppError extends Error {
    /** For example PERMISSION_DENIED, USER_CANCELLED, TIMEOUT or APP_UNLOADED. */
    code?: string;
}
export type HttpResponseType = "json" | "text" | "bytes";
export type HttpResponseBody<Type extends HttpResponseType> = Type extends "bytes" ? Uint8Array<ArrayBuffer> : Type extends "text" ? string : JsonValue;
export interface HttpDownloadProgress {
    /** Response bytes delivered so far, not upload progress. */
    loaded: number;
    /** Uncompressed response length when it is known; otherwise omitted. */
    total?: number;
}
export interface HttpRequestOptions<Type extends HttpResponseType = "json"> extends RequestOptions {
    /** Must equal the endpoint's approved method when supplied. */
    method?: HttpMethod;
    query?: Record<string, string>;
    /** JSON body; cannot be combined with body. */
    json?: JsonValue;
    /** Browser-owned upload body. FormData uses the browser-generated multipart boundary. */
    body?: string | Blob | ArrayBuffer | ArrayBufferView | FormData | URLSearchParams;
    /** Defaults to JSON; text and bytes allow other response formats. */
    responseType?: Type;
    /** Download progress; callback failures cancel the response and reject the operation. */
    onDownloadProgress?: (progress: HttpDownloadProgress) => void | Promise<void>;
    /** Headers are declared in the reviewed manifest, never supplied by the caller. */
    headers?: never;
}
/** Streaming requests return bytes directly and do not accept a responseType. */
export type HttpStreamOptions = Omit<HttpRequestOptions, "responseType">;
export interface HttpResponse<Body = JsonValue> {
    status: number;
    headers: Record<string, string>;
    body: Body;
}
export interface ServerSentEvent {
    /** Event name, or message when the server omits it. */
    event: string;
    /** Joined data lines for this event. */
    data: string;
    /** Most recent last-event-id value, including an explicitly empty ID. */
    id: string;
    /** Most recent valid reconnection delay hint; the SDK does not reconnect automatically. */
    retry?: number;
}
export interface SocketEvents {
    message: JsonValue | Uint8Array<ArrayBuffer>;
    error: {
        code: string;
    };
    close: {
        code: number;
        reason: string;
    };
}
export interface SocketConnectOptions extends RequestOptions {
    query?: Record<string, string>;
    /** Defaults to auto JSON parsing. Use text to preserve every text frame unchanged. */
    textMode?: "auto" | "text";
}
/** An SDK connection for exchanging JSON text and binary messages. */
export interface MiniAppSocket {
    readonly id: string;
    readonly readyState: "open" | "closing" | "closed";
    readonly ready: Promise<void>;
    /** Resolves when queued to the developer connection, before business processing. */
    send(data: JsonValue | Blob | ArrayBuffer | ArrayBufferView, options?: RequestOptions): Promise<null>;
    /** Send a text frame without JSON encoding. */
    sendText(text: string, options?: RequestOptions): Promise<null>;
    /** Browser-compatible close code: 1000 or 3000–4999; reason is at most 123 UTF-8 bytes. */
    close(code?: number, reason?: string): Promise<null>;
    on<Event extends keyof SocketEvents>(event: Event, listener: (value: SocketEvents[Event]) => void): () => void;
}
/** Installed by the platform before the application's bundled script runs. */
export interface MiniAppSDK {
    readonly notifications: {
        /** Ask during a real user action for one future delivery using a reviewed template. */
        request(templateId: string, request: NotificationRequest, options?: RequestOptions): Promise<NotificationPermit>;
    };
    readonly app: {
        /** Navigate to a manifest.calls destination. Success unloads this instance; continue at the destination's startup. */
        call(appId: string, query?: AppQuery, options?: RequestOptions): Promise<void>;
        /** Return to an ancestor as a fresh launch. Success unloads this instance. */
        return(appId: string, query?: AppQuery, options?: RequestOptions): Promise<void>;
    };
    readonly media: DeviceClient["media"];
    readonly location: DeviceClient["location"];
    readonly usb: DeviceClient["usb"];
    readonly bluetooth: DeviceClient["bluetooth"];
    readonly capabilities: {
        /** Read support/policy hints without opening hardware or prompting the user. */
        get(options?: RequestOptions): Promise<{
            supported: DeviceSupported & Record<string, boolean>;
            granted: Permission[];
        }>;
    };
    readonly modules: {
        /** Import an explicitly declared, integrity-bound ES module graph. */
        import(path: string): Promise<Record<string, unknown>>;
    };
    readonly scripts: {
        /** Execute a declared package classic/IIFE bundle once; requires code.load. */
        load(path: string): Promise<void>;
    };
    readonly workers: {
        /** Start a declared package classic worker; requires workers.create. */
        create(path: string, options?: {
            name?: string;
            signal?: AbortSignal;
        }): Promise<Worker>;
    };
    readonly network: NetworkTools;
    readonly links: {
        /** Open an exact manifest.links URL after user confirmation; undeclared destinations are denied. */
        open(url: string, options?: RequestOptions): Promise<null>;
    };
    readonly files: {
        /** Save app-provided bytes after a trusted user action; requires files.save. */
        save(name: string, data: string | Blob | ArrayBuffer | ArrayBufferView, options?: RequestOptions): Promise<null>;
    };
    readonly sharing: {
        /** Show the system share sheet after a trusted user action; requires sharing.share. */
        share(data: ShareOptions, options?: RequestOptions): Promise<null>;
    };
    readonly screen: {
        /** Keep the visible app awake until disabled or unloaded; requires screen.keepAwake. */
        setKeepAwake(enabled: boolean, options?: RequestOptions): Promise<{
            active: boolean;
        }>;
    };
    readonly gamepad: {
        /** Poll the browser's gamepads; requires gamepad.read and browser user activation. */
        get(): ReadonlyArray<Gamepad | null>;
    };
    /** Resolves when the communication channel connects, before app initialization finishes. */
    readonly ready: Promise<void>;
    /** Low-level, permission-checked RPC. Prefer the named methods below. */
    request(method: string, params?: {
        [key: string]: JsonValue;
    }, options?: RequestOptions): Promise<JsonValue>;
    readonly permissions: {
        list(): Permission[];
        has(permission: Permission): boolean;
    };
    readonly lifecycle: {
        /** Call once after the first render or an initialization error has been displayed. */
        ready(): Promise<void>;
    };
    readonly user: {
        /** Returns null for anonymous public/embed sessions. Requires user.read. */
        getCurrent(options?: RequestOptions): Promise<MiniAppUser | null>;
        /** Requires user.lookup; uses community profile visibility and returns a basic data snapshot. */
        getById(userId: number, options?: RequestOptions): Promise<MiniAppUser>;
    };
    readonly launch: {
        /** Requires launch.read. Repeated query values retain their order; the snapshot never updates. */
        getParameters(): Promise<MiniAppLaunchParameters>;
    };
    readonly theme: {
        get(): Promise<MiniAppTheme>;
        /** Requires theme.read; returns an unsubscribe function. */
        onChange(listener: (theme: MiniAppTheme) => void): () => void;
    };
    /** Persistent browser storage scoped to this app and environment; the original async API is preserved. */
    readonly localStorage: {
        /** Export this app and channel's saved strings; requires storage.read. */
        exportData(options?: RequestOptions): Promise<StorageSnapshot>;
        /** Atomically merge or replace this app's saved strings; requires storage.write. */
        importData(snapshot: StorageSnapshot, options?: RequestOptions & {
            replace?: boolean;
        }): Promise<null>;
        /** Coerces keys to strings, like the browser Storage API. */
        getItem(key: unknown): Promise<string | null>;
        /** Coerces both the key and value to strings before storing. */
        setItem(key: unknown, value: unknown): Promise<null>;
        removeItem(key: unknown): Promise<null>;
        clear(): Promise<null>;
    };
    /** Browser cookies restricted to this app prefix and app route. */
    readonly cookies: {
        get(name: string): Promise<string | null>;
        set(name: string, value: string, options?: {
            maxAge?: number;
        }): Promise<null>;
        remove(name: string): Promise<null>;
    };
    readonly clipboard: {
        readText(): Promise<string>;
        writeText(text: string): Promise<null>;
    };
    readonly fullscreen: {
        request(): Promise<{
            active: boolean;
        }>;
        exit(): Promise<{
            active: boolean;
        }>;
    };
    readonly audio: {
        /**
         * Requires audio.play; returns an independent playback handle without prompting.
         * Muting only silences output; playback, progress and remote downloads continue.
         */
        play(asset: string, options?: PlaybackOptions): Promise<{
            handle: string;
        }>;
        /**
         * Stops one playback handle without prompting, whether or not this run is muted.
         */
        stop(handle: string): Promise<null>;
    };
    readonly audioWorklet: {
        /** Load a declared processor into a managed online context; cancellation during native loading closes that context. */
        addModule(context: AudioContext, path: string, options?: RequestOptions): Promise<void>;
    };
    readonly video: {
        play(asset: string, options?: PlaybackOptions): Promise<{
            handle: string;
        }>;
        /** Play a verified timeline with adaptive renditions, alternate audio and live updates. */
        playProgram(source: MediaProgramSource, options?: RequestOptions & {
            volume?: number;
            bufferAhead?: number;
        }): Promise<{
            handle: string;
        }>;
        state(handle: string, options?: RequestOptions): Promise<MediaProgramState | {
            currentTime: number;
            duration: number | null;
        }>;
        seek(handle: string, time: number, options?: RequestOptions): Promise<MediaProgramState | {
            currentTime: number;
        }>;
        setVariant(handle: string, id: string, options?: RequestOptions): Promise<MediaProgramState>;
        selectAudioTrack(handle: string, id: string, options?: RequestOptions): Promise<MediaProgramState>;
        /** Select a declared WebVTT track, or null to hide subtitles. */
        selectTextTrack(handle: string, id: string | null, options?: RequestOptions): Promise<MediaProgramState>;
        updateProgram(handle: string, program: MediaProgram, options?: RequestOptions): Promise<MediaProgramState>;
        /** Play fixed CDN fragments after each has passed integrity verification. */
        playSegments(source: SegmentedVideoSource, options?: Omit<PlaybackOptions, "loop">): Promise<{
            handle: string;
        }>;
        stop(handle: string): Promise<null>;
        requestPictureInPicture(handle: string, options?: RequestOptions): Promise<{
            active: boolean;
        }>;
        exitPictureInPicture(): Promise<{
            active: boolean;
        }>;
    };
    readonly http: {
        /** Requires network.request. Requests are cancelled only by the caller, browser or application lifetime. */
        request<Type extends HttpResponseType = "json">(endpoint: string, options?: HttpRequestOptions<Type>): Promise<HttpResponse<HttpResponseBody<Type>>>;
        /** Pull response bytes on demand. Cancel the body when it will not be consumed. */
        stream(endpoint: string, options?: HttpStreamOptions): Promise<HttpResponse<ReadableStream<Uint8Array<ArrayBuffer>>>>;
        /** Parse text/event-stream responses without automatic reconnection. */
        events(endpoint: string, options?: HttpStreamOptions): Promise<HttpResponse<ReadableStream<ServerSentEvent>>>;
    };
    readonly webSocket: {
        /** Requires network.websocket; platform-authenticated endpoints also require user.read. */
        connect(endpoint: string, options?: SocketConnectOptions): Promise<MiniAppSocket>;
    };
    /** Reads package files and reviewed remote assets by declared path, never arbitrary URLs. */
    readonly assets: {
        /** Reads binary resources; core text files are returned as UTF-8 bytes. */
        readBytes(path: string, options?: RequestOptions): Promise<Uint8Array<ArrayBuffer>>;
        /** Decodes a file as UTF-8, rejecting invalid text. */
        readText(path: string, options?: RequestOptions): Promise<string>;
        /** Reads and parses a JSON file. */
        readJson(path: string, options?: RequestOptions): Promise<JsonValue>;
    };
    /** Compiles and instantiates reviewed WebAssembly files. */
    readonly wasm: {
        /** Reads a declared .wasm path; reviewed remote WASM also requires assets.remote. Arbitrary URLs are rejected. */
        instantiate(path: string, imports?: WebAssembly.Imports): Promise<WebAssembly.WebAssemblyInstantiatedSource>;
    };
}
/** Returns the app's SDK. */
export declare function getSDK(): MiniAppSDK;
