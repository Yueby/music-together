// Generated from sdk/src by tools/build-sdk.ts.
export interface ModuleBundleOptions {
    /** Every declared module path and its JavaScript source, including dependencies. */
    files: Readonly<Record<string, string>>;
    /** Cancels compilation and removes temporary files. */
    signal?: AbortSignal;
}
/** Build one eager ESM graph for code.moduleBundle; business modules are never executed while building. */
export declare function bundleModules({ files, signal, }: ModuleBundleOptions): Promise<string>;
