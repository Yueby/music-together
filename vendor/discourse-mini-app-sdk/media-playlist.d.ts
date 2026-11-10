// Generated from sdk/src by tools/build-sdk.ts.
import type { SegmentedVideoSource } from "./index.js";
export interface MediaPlaylistOptions {
    /** Map each playlist URI to its already declared remote_assets virtual path; no fetching is performed. */
    resolvePath: (uri: string) => string;
}
/** Convert an unencrypted fixed HLS media playlist with one initialization map and ENDLIST. */
export declare function parseHlsVod(text: string, options: MediaPlaylistOptions & {
    mime: string;
}): SegmentedVideoSource;
/** Convert one static DASH SegmentList; string input requires a browser DOMParser. */
export declare function parseDashVod(input: Document | string, options: MediaPlaylistOptions & {
    mime?: string;
}): SegmentedVideoSource;
