// Generated from sdk/src by tools/build-sdk.ts.
import { type CodeDeclarations } from "./code-policy.js";
import { type DevicePolicy } from "./device-policy.js";
import { type NotificationTemplates } from "./notification-policy.js";
import type { HttpMethod, Permission, RemoteAssetDeclaration } from "./types.js";
export { bundleModules, type ModuleBundleOptions } from "./module-bundle.js";
export interface EndpointDeclaration {
    url: string;
    query?: string[];
    /** Reviewed constant headers; sensitive and transport headers are prohibited. */
    headers?: Record<string, string>;
    auth?: "none" | "platform" | "auto";
    /** Follow an actual redirect only to this reviewed GET/HEAD endpoint, using fresh authorization. */
    redirectTo?: string;
}
export interface MiniAppManifest {
    format: 1;
    id: string;
    version: string;
    entry: "index.html";
    script: "app.js";
    style: "app.css";
    permissions: readonly Permission[];
    name?: string;
    /** Tags reviewed with this version. */
    tags?: string[];
    assets?: string[];
    code?: CodeDeclarations;
    devices?: DevicePolicy;
    /** Exact external URLs allowed by links.open, including fixed query and fragment. */
    links?: string[];
    /** Application UUIDv7 destinations reviewed for app.call. */
    calls?: string[];
    /** Reviewed notification text and optional permission-preview examples. */
    notifications?: NotificationTemplates;
    /** Pinned CDN files; their bytes are omitted from the application ZIP. */
    remote_assets?: Record<string, RemoteAssetDeclaration>;
    media?: Record<string, {
        path: string;
        kind: "audio" | "video";
        mime: "audio/wav" | "audio/mpeg" | "audio/ogg" | "audio/aac" | "audio/flac" | "audio/mp4" | "audio/webm" | "video/mp4" | "video/webm" | "video/ogg";
    }>;
    endpoints?: Record<string, EndpointDeclaration & {
        method: HttpMethod;
    }>;
    websockets?: Record<string, EndpointDeclaration & {
        protocols?: string[];
    }>;
}
type FileContents = string | Uint8Array | ArrayBuffer;
/** Creates the restricted ZIP format accepted by the runtime. */
export declare function createZip(entries: Array<[string, FileContents]>): Buffer;
/** Writes app.zip and non-secret package.json build metadata after manifest validation. */
export declare function pack({ manifest, files, outputDirectory, }: {
    manifest: unknown;
    files: Record<string, FileContents>;
    outputDirectory: string;
}): Promise<{
    file: string;
    zipSha256: string;
    size: number;
}>;
