// Generated from sdk/src by tools/build-sdk.ts.
export interface UsbFilter {
    vendorId: number;
    productId?: number;
    classCode?: number;
    subclassCode?: number;
    protocolCode?: number;
    serialNumber?: string;
}
export interface UsbControlDeclaration {
    direction: "in" | "out";
    requestType: "standard" | "class" | "vendor";
    recipient: "device" | "interface" | "endpoint" | "other";
    request: number;
    value: number;
    index: number;
}
export interface UsbDeviceDeclaration {
    filters: UsbFilter[];
    controlTransfers?: Record<string, UsbControlDeclaration>;
}
export interface BluetoothCharacteristicDeclaration {
    uuid: string;
    read?: true;
    write?: true;
    notify?: true;
}
export interface BluetoothServiceDeclaration {
    uuid: string;
    characteristics: Record<string, BluetoothCharacteristicDeclaration>;
}
export interface BluetoothDeviceDeclaration {
    filters: {
        name?: string;
        namePrefix?: string;
        services?: string[];
    }[];
    services: Record<string, BluetoothServiceDeclaration>;
}
export interface DevicePolicy {
    usb?: Record<string, UsbDeviceDeclaration>;
    bluetooth?: Record<string, BluetoothDeviceDeclaration>;
}
/** Validate only fixed reviewed device choices; callers cannot replace picker filters or UUIDs. */
export declare function validateDevicePolicy(value?: unknown, permissions?: readonly string[]): DevicePolicy;
