export interface WasmInfo {
    imports: {
        from: string;
        names: string[];
    }[];
    exports: string[];
}
export declare function parseWasm(wasmFilePath: string): Promise<WasmInfo>;
export declare function generateGlueCode(wasmFilePath: string, names: {
    initWasm: string;
    wasmUrl: string;
}): Promise<string>;
