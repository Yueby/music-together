import type { InternalCopier } from './copier.d.cts';
import type { Cache } from './utils.d.cts';
export interface CopierMethods {
  array?: InternalCopier<any[]>;
  arrayBuffer?: InternalCopier<ArrayBuffer>;
  asyncGenerator?: InternalCopier<AsyncGenerator>;
  blob?: InternalCopier<Blob>;
  dataView?: InternalCopier<DataView>;
  date?: InternalCopier<Date>;
  error?: InternalCopier<Error>;
  generator?: InternalCopier<Generator>;
  map?: InternalCopier<Map<any, any>>;
  object?: InternalCopier<Record<string, any>>;
  regExp?: InternalCopier<RegExp>;
  set?: InternalCopier<Set<any>>;
}
interface Copiers {
  [key: string]: InternalCopier<any> | undefined;
  Arguments: InternalCopier<Record<string, any>>;
  Array: InternalCopier<any[]>;
  ArrayBuffer: InternalCopier<ArrayBuffer>;
  AsyncGenerator: InternalCopier<AsyncGenerator>;
  Blob: InternalCopier<Blob>;
  Boolean: InternalCopier<Boolean>;
  DataView: InternalCopier<DataView>;
  Date: InternalCopier<Date>;
  Error: InternalCopier<Error>;
  Float32Array: InternalCopier<ArrayBuffer>;
  Float64Array: InternalCopier<ArrayBuffer>;
  Generator: InternalCopier<Generator>;
  Int8Array: InternalCopier<ArrayBuffer>;
  Int16Array: InternalCopier<ArrayBuffer>;
  Int32Array: InternalCopier<ArrayBuffer>;
  Map: InternalCopier<Map<any, any>>;
  Number: InternalCopier<Number>;
  Object: InternalCopier<Record<string, any>>;
  Promise: InternalCopier<Promise<any>>;
  RegExp: InternalCopier<RegExp>;
  Set: InternalCopier<Set<any>>;
  String: InternalCopier<String>;
  WeakMap: InternalCopier<WeakMap<any, any>>;
  WeakSet: InternalCopier<WeakSet<any>>;
  Uint8Array: InternalCopier<ArrayBuffer>;
  Uint8ClampedArray: InternalCopier<ArrayBuffer>;
  Uint16Array: InternalCopier<ArrayBuffer>;
  Uint32Array: InternalCopier<ArrayBuffer>;
  Uint64Array: InternalCopier<ArrayBuffer>;
}
export interface CreateCopierOptions {
  createCache?: () => Cache;
  methods?: CopierMethods;
  strict?: boolean;
}
export interface RequiredCreateCopierOptions extends Omit<Required<CreateCopierOptions>, 'methods'> {
  copiers: Copiers;
  methods: Required<CopierMethods>;
}
export declare function createDefaultCache(): Cache;
export declare function getOptions({
  createCache: createCacheOverride,
  methods: methodsOverride,
  strict,
}: CreateCopierOptions): RequiredCreateCopierOptions;
/**
 * Get the copiers used for each specific object tag.
 */
export declare function getTagSpecificCopiers(methods: Required<CopierMethods>): Copiers;
export {};
