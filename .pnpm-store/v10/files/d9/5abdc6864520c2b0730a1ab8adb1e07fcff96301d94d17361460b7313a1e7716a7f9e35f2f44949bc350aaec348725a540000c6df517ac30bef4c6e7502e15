import type { CreateCopierOptions } from './options.ts';
export type { State } from './copier.ts';
export type { CreateCopierOptions } from './options.ts';
/**
 * Create a custom copier based on custom options for any of the following:
 *   - `createCache` method to create a cache for copied objects
 *   - custom copier `methods` for specific object types
 *   - `strict` mode to copy all properties with their descriptors
 */
export declare function createCopier(options?: CreateCopierOptions): <Value>(value: Value) => Value;
/**
 * Copy an value deeply as much as possible, where strict recreation of object properties
 * are maintained. All properties (including non-enumerable ones) are copied with their
 * original property descriptors on both objects and arrays.
 */
export declare const copyStrict: <Value>(value: Value) => Value;
/**
 * Copy an value deeply as much as possible.
 */
export declare const copy: <Value>(value: Value) => Value;
