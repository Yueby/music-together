// eslint-disable-next-line @typescript-eslint/unbound-method
const toStringFunction = Function.prototype.toString;
// eslint-disable-next-line @typescript-eslint/unbound-method
const toStringObject = Object.prototype.toString;
/**
 * Get an empty version of the object with the same prototype it has.
 */
function getCleanClone(prototype) {
    if (!prototype) {
        return Object.create(null);
    }
    const Constructor = prototype.constructor;
    if (Constructor === Object) {
        return prototype === Object.prototype ? {} : Object.create(prototype);
    }
    if (Constructor && ~toStringFunction.call(Constructor).indexOf('[native code]')) {
        try {
            return new Constructor();
        }
        catch (_a) {
            // Ignore
        }
    }
    return Object.create(prototype);
}
/**
 * Get the tag of the value passed, so that the correct copier can be used.
 */
function getTag(value) {
    const stringTag = value[Symbol.toStringTag];
    if (stringTag) {
        return stringTag;
    }
    const type = toStringObject.call(value);
    return type.substring(8, type.length - 1);
}

// eslint-disable-next-line @typescript-eslint/unbound-method
const { hasOwnProperty, propertyIsEnumerable } = Object.prototype;
function copyOwnDescriptor(original, clone, property, state) {
    const ownDescriptor = Object.getOwnPropertyDescriptor(original, property) || {
        configurable: true,
        enumerable: true,
        value: original[property],
        writable: true,
    };
    const descriptor = ownDescriptor.get || ownDescriptor.set
        ? ownDescriptor
        : {
            configurable: ownDescriptor.configurable,
            enumerable: ownDescriptor.enumerable,
            value: state.copier(ownDescriptor.value, state),
            writable: ownDescriptor.writable,
        };
    try {
        Object.defineProperty(clone, property, descriptor);
    }
    catch (_a) {
        // The above can fail on node in extreme edge cases, so fall back to the loose assignment.
        clone[property] = descriptor.get ? descriptor.get() : descriptor.value;
    }
}
/**
 * Striclty copy all properties contained on the object.
 */
function copyOwnPropertiesStrict(value, clone, state) {
    const names = Object.getOwnPropertyNames(value);
    for (let index = 0; index < names.length; ++index) {
        copyOwnDescriptor(value, clone, names[index], state);
    }
    const symbols = Object.getOwnPropertySymbols(value);
    for (let index = 0; index < symbols.length; ++index) {
        copyOwnDescriptor(value, clone, symbols[index], state);
    }
    return clone;
}
/**
 * Deeply copy the indexed values in the array.
 */
function copyArrayLoose(array, state) {
    const clone = new state.Constructor();
    // set in the cache immediately to be able to reuse the object recursively
    state.cache.set(array, clone);
    for (let index = 0; index < array.length; ++index) {
        clone[index] = state.copier(array[index], state);
    }
    return clone;
}
/**
 * Deeply copy the indexed values in the array, as well as any custom properties.
 */
function copyArrayStrict(array, state) {
    const clone = new state.Constructor();
    // set in the cache immediately to be able to reuse the object recursively
    state.cache.set(array, clone);
    return copyOwnPropertiesStrict(array, clone, state);
}
/**
 * Copy the contents of the ArrayBuffer.
 */
function copyArrayBuffer(arrayBuffer, _state) {
    return arrayBuffer.slice(0);
}
/**
 * Create a new Blob with the contents of the original.
 */
function copyBlob(blob, _state) {
    return blob.slice(0, blob.size, blob.type);
}
/**
 * Create a new DataView with the contents of the original.
 */
function copyDataView(dataView, state) {
    return new state.Constructor(copyArrayBuffer(dataView.buffer));
}
/**
 * Create a new Date based on the time of the original.
 */
function copyDate(date, state) {
    return new state.Constructor(date.getTime());
}
/**
 * Deeply copy the keys and values of the original.
 */
function copyMapLoose(map, state) {
    const clone = new state.Constructor();
    // set in the cache immediately to be able to reuse the object recursively
    state.cache.set(map, clone);
    map.forEach((value, key) => {
        clone.set(key, state.copier(value, state));
    });
    return clone;
}
/**
 * Deeply copy the keys and values of the original, as well as any custom properties.
 */
function copyMapStrict(map, state) {
    return copyOwnPropertiesStrict(map, copyMapLoose(map, state), state);
}
/**
 * Deeply copy the properties (keys and symbols) and values of the original.
 */
function copyObjectLoose(object, state) {
    const clone = getCleanClone(state.prototype);
    // set in the cache immediately to be able to reuse the object recursively
    state.cache.set(object, clone);
    for (const key in object) {
        if (hasOwnProperty.call(object, key)) {
            clone[key] = state.copier(object[key], state);
        }
    }
    const symbols = Object.getOwnPropertySymbols(object);
    for (let index = 0; index < symbols.length; ++index) {
        const symbol = symbols[index];
        if (propertyIsEnumerable.call(object, symbol)) {
            clone[symbol] = state.copier(object[symbol], state);
        }
    }
    return clone;
}
/**
 * Deeply copy the properties (keys and symbols) and values of the original, as well
 * as any hidden or non-enumerable properties.
 */
function copyObjectStrict(object, state) {
    const clone = getCleanClone(state.prototype);
    // set in the cache immediately to be able to reuse the object recursively
    state.cache.set(object, clone);
    return copyOwnPropertiesStrict(object, clone, state);
}
/**
 * Create a new primitive wrapper from the value of the original.
 */
function copyPrimitiveWrapper(primitiveObject, state) {
    return new state.Constructor(primitiveObject.valueOf());
}
/**
 * Create a new RegExp based on the value and flags of the original.
 */
function copyRegExp(regExp, state) {
    const clone = new state.Constructor(regExp.source, regExp.flags);
    clone.lastIndex = regExp.lastIndex;
    return clone;
}
/**
 * Return the original value (an identity function).
 *
 * @note
 * THis is used for objects that cannot be copied, such as WeakMap.
 */
function copySelf(value, _state) {
    return value;
}
/**
 * Deeply copy the values of the original.
 */
function copySetLoose(set, state) {
    const clone = new state.Constructor();
    // set in the cache immediately to be able to reuse the object recursively
    state.cache.set(set, clone);
    set.forEach((value) => {
        clone.add(state.copier(value, state));
    });
    return clone;
}
/**
 * Deeply copy the values of the original, as well as any custom properties.
 */
function copySetStrict(set, state) {
    return copyOwnPropertiesStrict(set, copySetLoose(set, state), state);
}

function createDefaultCache() {
    return new WeakMap();
}
function getOptions({ createCache: createCacheOverride, methods: methodsOverride, strict, }) {
    const defaultMethods = {
        array: strict ? copyArrayStrict : copyArrayLoose,
        arrayBuffer: copyArrayBuffer,
        asyncGenerator: copySelf,
        blob: copyBlob,
        dataView: copyDataView,
        date: copyDate,
        error: copySelf,
        generator: copySelf,
        map: strict ? copyMapStrict : copyMapLoose,
        object: strict ? copyObjectStrict : copyObjectLoose,
        regExp: copyRegExp,
        set: strict ? copySetStrict : copySetLoose,
    };
    const methods = methodsOverride ? Object.assign(defaultMethods, methodsOverride) : defaultMethods;
    const copiers = getTagSpecificCopiers(methods);
    const createCache = createCacheOverride || createDefaultCache;
    // Extra safety check to ensure that object and array copiers are always provided,
    // avoiding runtime errors.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!copiers.Object || !copiers.Array) {
        throw new Error('An object and array copier must be provided.');
    }
    return { createCache, copiers, methods, strict: Boolean(strict) };
}
/**
 * Get the copiers used for each specific object tag.
 */
function getTagSpecificCopiers(methods) {
    return {
        Arguments: methods.object,
        Array: methods.array,
        ArrayBuffer: methods.arrayBuffer,
        AsyncGenerator: methods.asyncGenerator,
        Blob: methods.blob,
        Boolean: copyPrimitiveWrapper,
        DataView: methods.dataView,
        Date: methods.date,
        Error: methods.error,
        Float32Array: methods.arrayBuffer,
        Float64Array: methods.arrayBuffer,
        Generator: methods.generator,
        Int8Array: methods.arrayBuffer,
        Int16Array: methods.arrayBuffer,
        Int32Array: methods.arrayBuffer,
        Map: methods.map,
        Number: copyPrimitiveWrapper,
        Object: methods.object,
        Promise: copySelf,
        RegExp: methods.regExp,
        Set: methods.set,
        String: copyPrimitiveWrapper,
        WeakMap: copySelf,
        WeakSet: copySelf,
        Uint8Array: methods.arrayBuffer,
        Uint8ClampedArray: methods.arrayBuffer,
        Uint16Array: methods.arrayBuffer,
        Uint32Array: methods.arrayBuffer,
        Uint64Array: methods.arrayBuffer,
    };
}

/**
 * Create a custom copier based on custom options for any of the following:
 *   - `createCache` method to create a cache for copied objects
 *   - custom copier `methods` for specific object types
 *   - `strict` mode to copy all properties with their descriptors
 */
function createCopier(options = {}) {
    const { createCache, copiers } = getOptions(options);
    const { Array: copyArray, Object: copyObject } = copiers;
    function copier(value, state) {
        state.prototype = state.Constructor = undefined;
        if (!value || typeof value !== 'object') {
            return value;
        }
        if (state.cache.has(value)) {
            return state.cache.get(value);
        }
        state.prototype = Object.getPrototypeOf(value);
        // Using logical AND for speed, since optional chaining transforms to
        // a local variable usage.
        // eslint-disable-next-line @typescript-eslint/prefer-optional-chain
        state.Constructor = state.prototype && state.prototype.constructor;
        // plain objects
        if (!state.Constructor || state.Constructor === Object) {
            return copyObject(value, state);
        }
        // arrays
        if (Array.isArray(value)) {
            return copyArray(value, state);
        }
        const tagSpecificCopier = copiers[getTag(value)];
        if (tagSpecificCopier) {
            return tagSpecificCopier(value, state);
        }
        return typeof value.then === 'function' ? value : copyObject(value, state);
    }
    return function copy(value) {
        return copier(value, {
            Constructor: undefined,
            cache: createCache(),
            copier,
            prototype: undefined,
        });
    };
}
/**
 * Copy an value deeply as much as possible, where strict recreation of object properties
 * are maintained. All properties (including non-enumerable ones) are copied with their
 * original property descriptors on both objects and arrays.
 */
const copyStrict = createCopier({ strict: true });
/**
 * Copy an value deeply as much as possible.
 */
const copy = createCopier();

export { copy, copyStrict, createCopier };
//# sourceMappingURL=index.mjs.map
