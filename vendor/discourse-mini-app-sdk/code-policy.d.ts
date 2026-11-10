// Generated from sdk/src by tools/build-sdk.ts.
/** Explicit executable entries; remote entries retain their fixed asset declarations. */
export interface CodeDeclarations {
    scripts?: string[];
    workers?: string[];
    modules?: string[];
    moduleBundle?: string;
    /** Audio processor sources, bound to their exact original SHA-256. */
    worklets?: Record<string, string>;
}
export type CodeKind = "scripts" | "workers" | "modules";
export declare const MODULE_BUNDLE_REGISTER = "__registerBundle";
export declare const MODULE_BUNDLE_FINISH = "__finishBundle";
export declare const CODE_MIME_TYPES: readonly ["text/javascript", "application/javascript"];
export declare function validCodePath(value: unknown): value is string;
export declare function moduleSpecifier(path: string): string;
/** Validate execution roles independently from the package/remote asset byte budgets. */
export declare function validateCodeDeclarations(value: unknown, assets: readonly string[], remoteAssets: Readonly<Record<string, {
    mime: string;
    sha256?: unknown;
}>>, permissions: readonly string[]): value is CodeDeclarations | undefined;
/** Legacy manifests may use local classic entries; modules always require an explicit list. */
export declare function declaredCodePaths(code: CodeDeclarations | undefined, kind: CodeKind, assets: readonly string[]): string[];
