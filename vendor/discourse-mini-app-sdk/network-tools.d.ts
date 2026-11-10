// Generated from sdk/src by tools/build-sdk.ts.
import type { HttpStreamOptions, MiniAppSDK, MiniAppSocket, RequestOptions, ServerSentEvent, SocketConnectOptions, SocketEvents } from "./index.js";
export interface NetworkRetryOptions {
    /** Initial retry delay; defaults to 500 ms. */
    initialDelayMs?: number;
    /** Backoff ceiling before a server SSE retry hint; defaults to 30 seconds. */
    maxDelayMs?: number;
    /** Multiplier between unsuccessful attempts; defaults to 2. */
    factor?: number;
    /** Proportion of randomized delay, between 0 and 1; defaults to 0.2. */
    jitter?: number;
    /** Override retry decisions for transport errors or remote close/status errors. */
    shouldRetry?: (error: unknown, attempt: number) => boolean;
    onRetry?: (retry: {
        attempt: number;
        delayMs: number;
        error: unknown;
    }) => void;
}
export type NetworkRecoveryState = "connecting" | "open" | "waiting" | "closed";
export interface ReconnectSocketOptions extends SocketConnectOptions {
    retry?: NetworkRetryOptions;
    /** Runs for every connection. Restore subscriptions here; sent writes are never replayed. */
    onOpen?: (socket: MiniAppSocket, context: {
        reconnected: boolean;
        signal: AbortSignal;
    }) => void | Promise<void>;
    /** Called in arrival order. Throwing stops recovery. */
    onMessage?: (message: SocketEvents["message"]) => void | Promise<void>;
}
export interface ReconnectingSocket {
    readonly state: NetworkRecoveryState;
    /** Resolves after the first connection and its onOpen callback complete. */
    readonly ready: Promise<void>;
    /** Resolves on explicit/normal close; rejects on cancellation or a terminal error. */
    readonly done: Promise<void>;
    send: MiniAppSocket["send"];
    sendText: MiniAppSocket["sendText"];
    /** Stops reconnecting and closes the current connection. */
    close(): Promise<void>;
}
export interface ReconnectEventsOptions extends Omit<HttpStreamOptions, "method" | "body" | "json"> {
    retry?: NetworkRetryOptions;
    /** Name of an already reviewed query parameter used by your server for the resume ID. */
    lastEventIdQuery: string;
    /** Optional saved server cursor. An empty string clears the cursor. */
    lastEventId?: string;
}
export interface ReconnectingEvents {
    readonly state: NetworkRecoveryState;
    /** Includes control-only id records. Persist this value when saving app state. */
    readonly lastEventId: string;
    readonly body: ReadableStream<ServerSentEvent>;
    readonly done: Promise<void>;
    close(): Promise<void>;
}
export interface ChunkUploadOptions extends RequestOptions {
    /** Chunk size in bytes; defaults to 1 MiB. */
    chunkSize?: number;
    /** Offset confirmed by your server before this invocation. */
    resumeOffset?: number;
    /** Optional complete size for stream sources. Blob sources use their own size. */
    total?: number;
    /** Your server protocol must acknowledge exactly end; retries are intentionally not automatic. */
    send: (part: {
        chunk: Blob;
        offset: number;
        end: number;
        total?: number;
        signal: AbortSignal;
    }) => Promise<{
        confirmedOffset: number;
    }>;
    /** Server-confirmed progress, not bytes transmitted over the wire. */
    onProgress?: (progress: {
        confirmedOffset: number;
        total?: number;
    }) => void | Promise<void>;
}
export interface NetworkTools {
    reconnectSocket(endpoint: string, options?: ReconnectSocketOptions): ReconnectingSocket;
    reconnectEvents(endpoint: string, options: ReconnectEventsOptions): ReconnectingEvents;
    /** Stream sources must start at resumeOffset; Blob sources are sliced from that offset. */
    uploadChunks(source: Blob | ReadableStream<Uint8Array<ArrayBuffer>>, options: ChunkUploadOptions): Promise<{
        confirmedOffset: number;
    }>;
}
/** Carries the last acknowledged offset; an interrupted request may have reached the server. */
export declare class ChunkUploadError extends Error {
    readonly code?: string;
    readonly confirmedOffset: number;
    constructor(cause: unknown, confirmedOffset: number);
}
declare function sleep(milliseconds: number, signal: AbortSignal): Promise<void>;
/** Optional recovery tools bound to the SDK instance's lifetime. No sent writes are replayed. */
export declare function createNetworkTools(api: Pick<MiniAppSDK, "http" | "webSocket">, lifetime: AbortSignal, environment?: {
    sleep?: typeof sleep;
    random?: () => number;
}): NetworkTools;
export {};
