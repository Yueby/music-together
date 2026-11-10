// Generated from sdk/src by tools/build-sdk.ts.
import { type AudioCaptureConstraints, type VideoCaptureConstraints } from "./capture-constraints.js";
import type { RequestOptions } from "./index.js";
export type CaptureKind = "camera" | "microphone" | "screen";
export interface DeviceSupported {
    camera: boolean;
    microphone: boolean;
    screenCapture: boolean;
    mediaRecorder: boolean;
    location: boolean;
    usb: boolean;
    bluetooth: boolean;
}
export interface CaptureOptions extends RequestOptions {
    record?: boolean;
    audio?: boolean;
    mime?: string;
    chunkMs?: number;
    videoConstraints?: VideoCaptureConstraints;
    audioConstraints?: AudioCaptureConstraints;
}
export interface CaptureSnapshot {
    handle: string;
    kind: CaptureKind;
    mime: string | null;
    tracks: {
        kind: "audio" | "video";
        label: string;
        enabled: boolean;
    }[];
}
export interface CapturedFrame {
    bytes: Uint8Array<ArrayBuffer>;
    mime: string;
    width: number;
    height: number;
}
export interface RecordingChunk {
    bytes: Uint8Array<ArrayBuffer>;
    mime: string;
    seq: number;
}
export interface FinishedRecording {
    mime: string;
    chunks: RecordingChunk[];
}
export interface LocationSnapshot {
    latitude: number;
    longitude: number;
    accuracy: number;
    altitude: number | null;
    altitudeAccuracy: number | null;
    heading: number | null;
    speed: number | null;
    timestamp: number;
}
export interface UsbDeviceSnapshot {
    handle: string;
    vendorId: number;
    productId: number;
    productName: string | null;
    manufacturerName: string | null;
    configurations: {
        value: number;
        interfaces: {
            number: number;
            alternates: {
                setting: number;
                classCode: number;
                subclassCode: number;
                protocolCode: number;
                endpoints: {
                    number: number;
                    direction: "in" | "out";
                    type: string;
                    packetSize: number;
                }[];
            }[];
        }[];
    }[];
}
export type DeviceBinary = Blob | ArrayBuffer | ArrayBufferView;
export type DeviceRequest = <T>(method: string, params: Record<string, unknown>, options?: RequestOptions) => Promise<T>;
export interface DeviceClient {
    readonly media: {
        capture(kind: CaptureKind, options?: CaptureOptions): Promise<CaptureSnapshot>;
        nextFrame(handle: string, options?: RequestOptions & {
            mime?: "image/png" | "image/jpeg" | "image/webp";
            quality?: number;
        }): Promise<CapturedFrame>;
        readRecording(handle: string, options?: RequestOptions): Promise<RecordingChunk>;
        finishRecording(handle: string, options?: RequestOptions): Promise<FinishedRecording>;
        readAudio(handle: string, options?: RequestOptions): Promise<RecordingChunk>;
        finishAudio(handle: string, options?: RequestOptions): Promise<FinishedRecording>;
        /** Discard buffered recording data. Use finishRecording to retain the final block. */
        stop(handle: string, options?: RequestOptions): Promise<null>;
    };
    readonly location: {
        get(options?: RequestOptions & {
            highAccuracy?: boolean;
            maximumAge?: number;
        }): Promise<LocationSnapshot>;
    };
    readonly usb: {
        request(device: string, options?: RequestOptions): Promise<UsbDeviceSnapshot>;
        selectConfiguration(handle: string, configuration: number, options?: RequestOptions): Promise<null>;
        claimInterface(handle: string, interfaceNumber: number, options?: RequestOptions & {
            alternate?: number;
        }): Promise<null>;
        releaseInterface(handle: string, interfaceNumber: number, options?: RequestOptions): Promise<null>;
        selectAlternateInterface(handle: string, interfaceNumber: number, alternate: number, options?: RequestOptions): Promise<null>;
        clearHalt(handle: string, direction: "in" | "out", endpoint: number, options?: RequestOptions): Promise<null>;
        read(handle: string, endpoint: number, length: number, options?: RequestOptions): Promise<{
            status: string;
            bytes: Uint8Array<ArrayBuffer>;
        }>;
        write(handle: string, endpoint: number, data: DeviceBinary, options?: RequestOptions): Promise<{
            status: string;
            bytesWritten: number;
        }>;
        isochronousRead(handle: string, endpoint: number, packetLengths: readonly number[], options?: RequestOptions): Promise<{
            packets: {
                status: string;
                bytes: Uint8Array<ArrayBuffer>;
            }[];
        }>;
        isochronousWrite(handle: string, endpoint: number, data: DeviceBinary, packetLengths: readonly number[], options?: RequestOptions): Promise<{
            packets: {
                status: string;
                bytesWritten: number;
            }[];
        }>;
        controlTransferIn(handle: string, transfer: string, length: number, options?: RequestOptions): Promise<{
            status: string;
            bytes: Uint8Array<ArrayBuffer>;
        }>;
        controlTransferOut(handle: string, transfer: string, data: DeviceBinary, options?: RequestOptions): Promise<{
            status: string;
            bytesWritten: number;
        }>;
        close(handle: string, options?: RequestOptions): Promise<null>;
    };
    readonly bluetooth: {
        request(device: string, options?: RequestOptions): Promise<{
            handle: string;
            name: string | null;
            connected: boolean;
        }>;
        connect(handle: string, options?: RequestOptions): Promise<{
            connected: boolean;
        }>;
        read(handle: string, service: string, characteristic: string, options?: RequestOptions): Promise<{
            bytes: Uint8Array<ArrayBuffer>;
        }>;
        write(handle: string, service: string, characteristic: string, data: DeviceBinary, options?: RequestOptions & {
            withoutResponse?: boolean;
        }): Promise<null>;
        startNotifications(handle: string, service: string, characteristic: string, options?: RequestOptions): Promise<{
            subscription: string;
        }>;
        nextNotification(subscription: string, options?: RequestOptions): Promise<{
            bytes: Uint8Array<ArrayBuffer>;
            seq: number;
        }>;
        stopNotifications(subscription: string, options?: RequestOptions): Promise<null>;
        close(handle: string, options?: RequestOptions): Promise<null>;
    };
}
/** Typed convenience methods over the same permission-checked device RPCs. */
export declare function createDeviceClient(request: DeviceRequest): DeviceClient;
