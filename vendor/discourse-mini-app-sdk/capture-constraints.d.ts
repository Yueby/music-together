// Generated from sdk/src by tools/build-sdk.ts.
export type CaptureNumberConstraint = number | {
    ideal?: number;
    exact?: number;
    min?: number;
    max?: number;
};
export type CaptureBooleanConstraint = boolean | {
    ideal?: boolean;
    exact?: boolean;
};
export type CaptureFacingMode = "user" | "environment" | "left" | "right";
export interface VideoCaptureConstraints {
    width?: CaptureNumberConstraint;
    height?: CaptureNumberConstraint;
    frameRate?: CaptureNumberConstraint;
    facingMode?: CaptureFacingMode | {
        ideal?: CaptureFacingMode;
        exact?: CaptureFacingMode;
    };
}
export interface AudioCaptureConstraints {
    sampleRate?: CaptureNumberConstraint;
    channelCount?: CaptureNumberConstraint;
    echoCancellation?: CaptureBooleanConstraint;
    noiseSuppression?: CaptureBooleanConstraint;
    autoGainControl?: CaptureBooleanConstraint;
}
/** Copy the supported JSON constraints; device IDs, advanced objects and unknown fields are rejected. */
export declare function validateVideoCaptureConstraints(value: unknown): VideoCaptureConstraints;
export declare function validateAudioCaptureConstraints(value: unknown): AudioCaptureConstraints;
