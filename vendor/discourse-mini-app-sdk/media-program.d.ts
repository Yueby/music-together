// Generated from sdk/src by tools/build-sdk.ts.
/** A byte window within the complete, already verified source file. */
export interface MediaByteRange {
    offset: number;
    length: number;
}
export interface MediaAppendWindow {
    start: number;
    end: number;
}
/** A pinned file, or media bytes served by a separately approved business endpoint. */
export type MediaFragment = ({
    path: string;
} | {
    endpoint: string;
    query?: Record<string, string>;
    sha256: string;
    size: number;
    mime: string;
}) & {
    range?: MediaByteRange;
};
export interface MediaTimelineSegment {
    id: string;
    start: number;
    duration: number;
    source: MediaFragment;
    /** Initialization for this segment; omitted segments use their track's initialization. */
    init?: MediaFragment;
    /** Explicit period boundary; ordinary segment durations do not clip encoded packets. */
    appendWindow?: MediaAppendWindow;
    /** Optional offset for discontinuous or rebased encoded timestamps. */
    timestampOffset?: number;
}
export interface MediaProgramTrack {
    id: string;
    mime: string;
    init: MediaFragment;
    segments: MediaTimelineSegment[];
    label?: string;
    language?: string;
}
export interface MediaProgramVariant {
    id: string;
    /** Bits per second used for automatic rendition selection. */
    bandwidth: number;
    video: MediaProgramTrack;
}
export interface MediaTextSegment {
    id: string;
    start: number;
    duration: number;
    source: MediaFragment;
    /** Maps the WebVTT media clock into the program's presentation timeline. */
    timestampOffset?: number;
}
export type MediaProgramTextTrack = {
    id: string;
    mime: "text/vtt";
    label?: string;
    language?: string;
} & ({
    source: MediaFragment;
    timestampOffset?: number;
} | {
    segments: MediaTextSegment[];
});
/** An explicit media timeline. Live indexes use the same shape with increasing sequence values. */
export interface MediaProgram {
    variants: MediaProgramVariant[];
    audioTracks?: MediaProgramTrack[];
    textTracks?: MediaProgramTextTrack[];
    duration?: number;
    live?: boolean;
    ended?: boolean;
    sequence?: number;
    /** Polling advice for a live index, in milliseconds. */
    updateIntervalMs?: number;
}
export type MediaProgramSource = {
    program: MediaProgram;
} | {
    playlist: {
        endpoint: string;
        query?: Record<string, string>;
    };
};
export interface MediaProgramState {
    currentTime: number;
    duration: number | null;
    live: boolean;
    variant: string;
    selection: "auto" | "manual";
    audioTrack: string | null;
    textTrack: string | null;
    /** A subtitle refresh failure does not stop otherwise valid video playback. */
    textTrackError: string | null;
    available: {
        start: number;
        end: number;
    };
}
export declare function validateMediaFragment(value: unknown): MediaFragment;
/** Validate and detach a timeline before it enters the trusted playback controller. */
export declare function validateMediaProgram(value: unknown): MediaProgram;
export declare function validateMediaProgramSource(value: unknown): MediaProgramSource;
