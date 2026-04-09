export { getRegistries, getRegistriesIndex, getRegistry, getRegistryItems, resolveRegistryItems } from '../index.js';
import { C as Config } from '../get-config-D6gTsP_D.js';
import '../schema/index.js';
import 'zod';

declare function searchRegistries(registries: string[], options?: {
    query?: string;
    limit?: number;
    offset?: number;
    config?: Partial<Config>;
    useCache?: boolean;
}): Promise<{
    items: {
        registry: string;
        name: string;
        addCommandArgument: string;
        type?: string | undefined;
        description?: string | undefined;
    }[];
    pagination: {
        total: number;
        offset: number;
        limit: number;
        hasMore: boolean;
    };
}>;

declare const RegistryErrorCode: {
    readonly NETWORK_ERROR: "NETWORK_ERROR";
    readonly NOT_FOUND: "NOT_FOUND";
    readonly UNAUTHORIZED: "UNAUTHORIZED";
    readonly FORBIDDEN: "FORBIDDEN";
    readonly FETCH_ERROR: "FETCH_ERROR";
    readonly NOT_CONFIGURED: "NOT_CONFIGURED";
    readonly INVALID_CONFIG: "INVALID_CONFIG";
    readonly MISSING_ENV_VARS: "MISSING_ENV_VARS";
    readonly LOCAL_FILE_ERROR: "LOCAL_FILE_ERROR";
    readonly PARSE_ERROR: "PARSE_ERROR";
    readonly VALIDATION_ERROR: "VALIDATION_ERROR";
    readonly UNKNOWN_ERROR: "UNKNOWN_ERROR";
};
type RegistryErrorCode = (typeof RegistryErrorCode)[keyof typeof RegistryErrorCode];
declare class RegistryError extends Error {
    readonly code: RegistryErrorCode;
    readonly statusCode?: number;
    readonly context?: Record<string, unknown>;
    readonly suggestion?: string;
    readonly timestamp: Date;
    readonly cause?: unknown;
    constructor(message: string, options?: {
        code?: RegistryErrorCode;
        statusCode?: number;
        cause?: unknown;
        context?: Record<string, unknown>;
        suggestion?: string;
    });
    toJSON(): {
        name: string;
        message: string;
        code: RegistryErrorCode;
        statusCode: number | undefined;
        context: Record<string, unknown> | undefined;
        suggestion: string | undefined;
        timestamp: Date;
        stack: string | undefined;
    };
}
declare class RegistryNotFoundError extends RegistryError {
    readonly url: string;
    constructor(url: string, cause?: unknown);
}
declare class RegistryUnauthorizedError extends RegistryError {
    readonly url: string;
    constructor(url: string, cause?: unknown);
}
declare class RegistryForbiddenError extends RegistryError {
    readonly url: string;
    constructor(url: string, cause?: unknown);
}
declare class RegistryFetchError extends RegistryError {
    readonly url: string;
    readonly responseBody?: string | undefined;
    constructor(url: string, statusCode?: number, responseBody?: string | undefined, cause?: unknown);
}
declare class RegistryNotConfiguredError extends RegistryError {
    readonly registryName: string | null;
    constructor(registryName: string | null);
}
declare class RegistryLocalFileError extends RegistryError {
    readonly filePath: string;
    constructor(filePath: string, cause?: unknown);
}
declare class RegistryParseError extends RegistryError {
    readonly item: string;
    readonly parseError: unknown;
    constructor(item: string, parseError: unknown);
}
declare class RegistryMissingEnvironmentVariablesError extends RegistryError {
    readonly registryName: string;
    readonly missingVars: string[];
    constructor(registryName: string, missingVars: string[]);
}
declare class RegistryInvalidNamespaceError extends RegistryError {
    readonly name: string;
    constructor(name: string);
}
declare class RegistriesIndexParseError extends RegistryError {
    readonly parseError: unknown;
    constructor(parseError: unknown);
}

export { RegistriesIndexParseError, RegistryError, RegistryFetchError, RegistryForbiddenError, RegistryInvalidNamespaceError, RegistryLocalFileError, RegistryMissingEnvironmentVariablesError, RegistryNotConfiguredError, RegistryNotFoundError, RegistryParseError, RegistryUnauthorizedError, searchRegistries };
