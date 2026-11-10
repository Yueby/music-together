// Generated from sdk/src by tools/build-sdk.ts.
import type { JsonWebKey, KeyObject } from "node:crypto";
export interface PlatformIdentity {
    readonly iss: string;
    readonly aud: string;
    /** Use the issuer and subject together as the community account identity. */
    readonly sub: string;
    /** Community trust level (0–4) at issuance; absent in tokens from older issuers. */
    readonly trust_level?: number;
    readonly app_id: string;
    readonly version: string;
    readonly channel: "production" | "sandbox";
    readonly scopes: readonly ("network.request" | "network.websocket")[];
    readonly iat: number;
    readonly nbf: number;
    readonly exp: number;
    /** Token identifier; it may be reused for this endpoint until expiry. */
    readonly jti: string;
    /** Reviewed request method; WebSocket handshakes use GET. */
    readonly htm: string;
    /** Reviewed HTTPS base URL, including the fixed query bytes. */
    readonly htu: string;
    /** Reviewed names that may appear after the fixed endpoint query. */
    readonly query_keys: readonly string[];
}
export interface PlatformRequestOptions {
    /** The complete incoming Authorization header. */
    authorization: string;
    /** The community's trusted JWT verification public key, certificate, or JWK. */
    publicKey: string | Buffer | KeyObject | JsonWebKey;
    /** The configured community base URL, including any forum subdirectory. */
    issuer: string;
    /** The configured developer server HTTPS origin. */
    audience: string;
    /** The application allowed to call this handler. */
    appId: string;
    /** Distinguishes HTTP requests from WebSocket handshakes. */
    scope: "network.request" | "network.websocket";
    /** The actual uppercase HTTP request method. */
    method: string;
    /** The externally visible HTTPS request URL, reconstructed with a trusted public origin. */
    url: string | URL;
    /** Production by default; sandbox must be explicitly permitted. */
    channel?: "production" | "sandbox";
    /** Restricts this handler to a particular published application version when supplied. */
    version?: string;
    /** Unix seconds; useful for a controlled server clock or tests. */
    now?: number;
}
export type PlatformWebSocketRequestOptions = Omit<PlatformRequestOptions, "authorization" | "scope" | "method" | "url"> & {
    /** The full external HTTPS/WSS upgrade URL, including its sole mini_app_token query value. */
    url: string | URL;
};
/** A failed identity or endpoint verification. */
export declare class PlatformAuthError extends Error {
    readonly code: "INVALID_PLATFORM_REQUEST";
    constructor();
}
/** Verifies a reusable endpoint token; the developer still authorizes access to business resources. */
export declare function verifyPlatformRequest(options: PlatformRequestOptions): Promise<PlatformIdentity>;
/**
 * Verifies the sole query token against the upgrade URL, without using cookies or headers.
 * JWT expiry limits the handshake; an established connection need not close when it expires.
 */
export declare function verifyPlatformWebSocketRequest(options: PlatformWebSocketRequestOptions): Promise<PlatformIdentity>;
