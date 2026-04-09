import { FloatArray } from './common.js';
import { Mat4Like } from './mat4.js';
import { QuatLike } from './quat.js';
/**
 * A 4 dimensional vector given as a {@link Vec4}, a 4-element floating point
 * TypedArray, or an array of 4 numbers.
 */
export type Vec4Like = [number, number, number, number] | FloatArray;
/**
 * 4 Dimensional Vector
 */
export declare class Vec4 extends Float32Array {
    /**
     * The number of bytes in a {@link Vec4}.
     */
    static readonly BYTE_LENGTH: number;
    /**
     * Create a {@link Vec4}.
     */
    constructor(...values: [Readonly<Vec4Like> | ArrayBufferLike, number?] | number[]);
    /**
     * The x component of the vector. Equivalent to `this[0];`
     * @category Vector components
     */
    get x(): number;
    set x(value: number);
    /**
     * The y component of the vector. Equivalent to `this[1];`
     * @category Vector components
     */
    get y(): number;
    set y(value: number);
    /**
     * The z component of the vector. Equivalent to `this[2];`
     * @category Vector components
     */
    get z(): number;
    set z(value: number);
    /**
     * The w component of the vector. Equivalent to `this[3];`
     * @category Vector components
     */
    get w(): number;
    set w(value: number);
    /**
     * The r component of the vector. Equivalent to `this[0];`
     * @category Color components
     */
    get r(): number;
    set r(value: number);
    /**
     * The g component of the vector. Equivalent to `this[1];`
     * @category Color components
     */
    get g(): number;
    set g(value: number);
    /**
     * The b component of the vector. Equivalent to `this[2];`
     * @category Color components
     */
    get b(): number;
    set b(value: number);
    /**
     * The a component of the vector. Equivalent to `this[3];`
     * @category Color components
     */
    get a(): number;
    set a(value: number);
    /**
     * The magnitude (length) of this.
     * Equivalent to `Vec4.magnitude(this);`
     *
     * Magnitude is used because the `length` attribute is already defined by
     * TypedArrays to mean the number of elements in the array.
     */
    get magnitude(): number;
    /**
     * Alias for {@link Vec4.magnitude}
     */
    get mag(): number;
    /**
     * A string representation of `this`
     * Equivalent to `Vec4.str(this);`
     */
    get str(): string;
    /**
     * Copy the values from another {@link Vec4} into `this`.
     *
     * @param a the source vector
     * @returns `this`
     */
    copy(a: Readonly<Vec4Like>): Vec4;
    /**
     * Adds a {@link Vec4} to `this`.
     * Equivalent to `Vec4.add(this, this, b);`
     *
     * @param b - The vector to add to `this`
     * @returns `this`
     */
    add(b: Readonly<Vec4Like>): Vec4;
    /**
     * Subtracts a {@link Vec4} from `this`.
     * Equivalent to `Vec4.subtract(this, this, b);`
     *
     * @param b - The vector to subtract from `this`
     * @returns `this`
     */
    subtract(b: Readonly<Vec4Like>): Vec4;
    /**
     * Alias for {@link Vec4.subtract}
     */
    sub(b: Readonly<Vec4Like>): Vec4;
    /**
     * Multiplies `this` by a {@link Vec4}.
     * Equivalent to `Vec4.multiply(this, this, b);`
     *
     * @param b - The vector to multiply `this` by
     * @returns `this`
     */
    multiply(b: Readonly<Vec4Like>): Vec4;
    /**
     * Alias for {@link Vec4.multiply}
     */
    mul(b: Readonly<Vec4Like>): Vec4;
    /**
     * Divides `this` by a {@link Vec4}.
     * Equivalent to `Vec4.divide(this, this, b);`
     *
     * @param b - The vector to divide `this` by
     * @returns `this`
     */
    divide(b: Readonly<Vec4Like>): Vec4;
    /**
     * Alias for {@link Vec4.divide}
     */
    div(b: Readonly<Vec4Like>): Vec4;
    /**
     * Scales `this` by a scalar number.
     * Equivalent to `Vec4.scale(this, this, b);`
     *
     * @param b - Amount to scale `this` by
     * @returns `this`
     */
    scale(b: number): Vec4;
    /**
     * Calculates `this` scaled by a scalar value then adds the result to `this`.
     * Equivalent to `Vec4.scaleAndAdd(this, this, b, scale);`
     *
     * @param b - The vector to add to `this`
     * @param scale - The amount to scale `b` by before adding
     * @returns `this`
     */
    scaleAndAdd(b: Readonly<Vec4Like>, scale: number): Vec4;
    /**
     * Calculates the euclidian distance between another {@link Vec4} and `this`.
     * Equivalent to `Vec4.distance(this, b);`
     *
     * @param b - The vector to calculate the distance to
     * @returns Distance between `this` and `b`
     */
    distance(b: Readonly<Vec4Like>): number;
    /**
     * Alias for {@link Vec4.distance}
     */
    dist(b: Readonly<Vec4Like>): number;
    /**
     * Calculates the squared euclidian distance between another {@link Vec4} and `this`.
     * Equivalent to `Vec4.squaredDistance(this, b);`
     *
     * @param b The vector to calculate the squared distance to
     * @returns Squared distance between `this` and `b`
     */
    squaredDistance(b: Readonly<Vec4Like>): number;
    /**
     * Alias for {@link Vec4.squaredDistance}
     */
    sqrDist(b: Readonly<Vec4Like>): number;
    /**
     * Negates the components of `this`.
     * Equivalent to `Vec4.negate(this, this);`
     *
     * @returns `this`
     */
    negate(): Vec4;
    /**
     * Inverts the components of `this`.
     * Equivalent to `Vec4.inverse(this, this);`
     *
     * @returns `this`
     */
    invert(): Vec4;
    /**
     * Sets each component of `this` to it's absolute value.
     * Equivalent to `Vec4.abs(this, this);`
     *
     * @returns `this`
     */
    abs(): Vec4;
    /**
     * Calculates the dot product of this and another {@link Vec4}.
     * Equivalent to `Vec4.dot(this, b);`
     *
     * @param b - The second operand
     * @returns Dot product of `this` and `b`
     */
    dot(b: Readonly<Vec4Like>): number;
    /**
     * Normalize `this`.
     * Equivalent to `Vec4.normalize(this, this);`
     *
     * @returns `this`
     */
    normalize(): Vec4;
    /**
     * Creates a new, empty {@link Vec4}
     * @category Static
     *
     * @returns a new 4D vector
     */
    static create(): Vec4;
    /**
     * Creates a new {@link Vec4} initialized with values from an existing vector
     * @category Static
     *
     * @param a - vector to clone
     * @returns a new 4D vector
     */
    static clone(a: Vec4Like): Vec4;
    /**
     * Creates a new {@link Vec4} initialized with the given values
     * @category Static
     *
     * @param x - X component
     * @param y - Y component
     * @param z - Z component
     * @param w - W component
     * @returns a new 4D vector
     */
    static fromValues(x: number, y: number, z: number, w: number): Vec4;
    /**
     * Copy the values from one {@link Vec4} to another
     * @category Static
     *
     * @param out - the receiving vector
     * @param a - the source vector
     * @returns `out`
     */
    static copy(out: Vec4Like, a: Readonly<Vec4Like>): Vec4Like;
    /**
     * Set the components of a {@link Vec4} to the given values
     * @category Static
     *
     * @param out - the receiving vector
     * @param x - X component
     * @param y - Y component
     * @param z - Z component
     * @param w - W component
     * @returns `out`
     */
    static set(out: Vec4Like, x: number, y: number, z: number, w: number): Vec4Like;
    /**
     * Adds two {@link Vec4}s
     * @category Static
     *
     * @param out - The receiving vector
     * @param a - The first operand
     * @param b - The second operand
     * @returns `out`
     */
    static add(out: Vec4Like, a: Readonly<Vec4Like>, b: Readonly<Vec4Like>): Vec4Like;
    /**
     * Subtracts vector b from vector a
     * @category Static
     *
     * @param out - the receiving vector
     * @param a - the first operand
     * @param b - the second operand
     * @returns `out`
     */
    static subtract(out: Vec4Like, a: Readonly<Vec4Like>, b: Readonly<Vec4Like>): Vec4Like;
    /**
     * Alias for {@link Vec4.subtract}
     * @category Static
     */
    static sub(out: Vec4Like, a: Readonly<Vec4Like>, b: Readonly<Vec4Like>): Vec4Like;
    /**
     * Multiplies two {@link Vec4}'s
     * @category Static
     *
     * @param out - the receiving vector
     * @param a - the first operand
     * @param b - the second operand
     * @returns `out`
     */
    static multiply(out: Vec4Like, a: Readonly<Vec4Like>, b: Readonly<Vec4Like>): Vec4Like;
    /**
     * Alias for {@link Vec4.multiply}
     * @category Static
     */
    static mul(out: Vec4Like, a: Readonly<Vec4Like>, b: Readonly<Vec4Like>): Vec4Like;
    /**
     * Divides two {@link Vec4}'s
     * @category Static
     *
     * @param out - the receiving vector
     * @param a - the first operand
     * @param b - the second operand
     * @returns `out`
     */
    static divide(out: Vec4Like, a: Readonly<Vec4Like>, b: Readonly<Vec4Like>): Vec4Like;
    /**
     * Alias for {@link Vec4.divide}
     * @category Static
     */
    static div(out: Vec4Like, a: Readonly<Vec4Like>, b: Readonly<Vec4Like>): Vec4Like;
    /**
     * Math.ceil the components of a {@link Vec4}
     * @category Static
     *
     * @param out - the receiving vector
     * @param a - vector to ceil
     * @returns `out`
     */
    static ceil(out: Vec4Like, a: Readonly<Vec4Like>): Vec4Like;
    /**
     * Math.floor the components of a {@link Vec4}
     * @category Static
     *
     * @param out - the receiving vector
     * @param a - vector to floor
     * @returns `out`
     */
    static floor(out: Vec4Like, a: Readonly<Vec4Like>): Vec4Like;
    /**
     * Returns the minimum of two {@link Vec4}'s
     * @category Static
     *
     * @param out - the receiving vector
     * @param a - the first operand
     * @param b - the second operand
     * @returns `out`
     */
    static min(out: Vec4Like, a: Readonly<Vec4Like>, b: Readonly<Vec4Like>): Vec4Like;
    /**
     * Returns the maximum of two {@link Vec4}'s
     * @category Static
     *
     * @param out - the receiving vector
     * @param a - the first operand
     * @param b - the second operand
     * @returns `out`
     */
    static max(out: Vec4Like, a: Readonly<Vec4Like>, b: Readonly<Vec4Like>): Vec4Like;
    /**
     * Math.round the components of a {@link Vec4}
     * @category Static
     *
     * @param out - the receiving vector
     * @param a - vector to round
     * @returns `out`
     */
    static round(out: Vec4Like, a: Readonly<Vec4Like>): Vec4Like;
    /**
     * Scales a {@link Vec4} by a scalar number
     * @category Static
     *
     * @param out - the receiving vector
     * @param a - the vector to scale
     * @param scale - amount to scale the vector by
     * @returns `out`
     */
    static scale(out: Vec4Like, a: Readonly<Vec4Like>, scale: number): Vec4Like;
    /**
     * Adds two {@link Vec4}'s after scaling the second operand by a scalar value
     * @category Static
     *
     * @param out - the receiving vector
     * @param a - the first operand
     * @param b - the second operand
     * @param scale - the amount to scale b by before adding
     * @returns `out`
     */
    static scaleAndAdd(out: Vec4Like, a: Readonly<Vec4Like>, b: Readonly<Vec4Like>, scale: number): Vec4Like;
    /**
     * Calculates the euclidian distance between two {@link Vec4}'s
     * @category Static
     *
     * @param a - the first operand
     * @param b - the second operand
     * @returns distance between a and b
     */
    static distance(a: Readonly<Vec4Like>, b: Readonly<Vec4Like>): number;
    /**
     * Alias for {@link Vec4.distance}
     * @category Static
     */
    static dist(a: Readonly<Vec4Like>, b: Readonly<Vec4Like>): number;
    /**
     * Calculates the squared euclidian distance between two {@link Vec4}'s
     * @category Static
     *
     * @param a - the first operand
     * @param b - the second operand
     * @returns squared distance between a and b
     */
    static squaredDistance(a: Readonly<Vec4Like>, b: Readonly<Vec4Like>): number;
    /**
     * Alias for {@link Vec4.squaredDistance}
     * @category Static
     */
    static sqrDist(a: Readonly<Vec4Like>, b: Readonly<Vec4Like>): number;
    /**
     * Calculates the magnitude (length) of a {@link Vec4}
     * @category Static
     *
     * @param a - vector to calculate length of
     * @returns length of `a`
     */
    static magnitude(a: Readonly<Vec4Like>): number;
    /**
     * Alias for {@link Vec4.magnitude}
     * @category Static
     */
    static mag(a: Readonly<Vec4Like>): number;
    /**
     * Alias for {@link Vec4.magnitude}
     * @category Static
     * @deprecated Use {@link Vec4.magnitude} to avoid conflicts with builtin `length` methods/attribs
     */
    static length(a: Readonly<Vec4Like>): number;
    /**
     * Alias for {@link Vec4.magnitude}
     * @category Static
     * @deprecated Use {@link Vec4.mag}
     */
    static len(a: Readonly<Vec4Like>): number;
    /**
     * Calculates the squared length of a {@link Vec4}
     * @category Static
     *
     * @param a - vector to calculate squared length of
     * @returns squared length of a
     */
    static squaredLength(a: Readonly<Vec4Like>): number;
    /**
     * Alias for {@link Vec4.squaredLength}
     * @category Static
     */
    static sqrLen(a: Readonly<Vec4Like>): number;
    /**
     * Negates the components of a {@link Vec4}
     * @category Static
     *
     * @param out - the receiving vector
     * @param a - vector to negate
     * @returns `out`
     */
    static negate(out: Vec4Like, a: Readonly<Vec4Like>): Vec4Like;
    /**
     * Returns the inverse of the components of a {@link Vec4}
     * @category Static
     *
     * @param out - the receiving vector
     * @param a - vector to invert
     * @returns `out`
     */
    static inverse(out: Vec4Like, a: Readonly<Vec4Like>): Vec4Like;
    /**
     * Returns the absolute value of the components of a {@link Vec4}
     * @category Static
     *
     * @param out - The receiving vector
     * @param a - Vector to compute the absolute values of
     * @returns `out`
     */
    static abs(out: Vec4Like, a: Readonly<Vec4Like>): Vec4Like;
    /**
     * Normalize a {@link Vec4}
     * @category Static
     *
     * @param out - the receiving vector
     * @param a - vector to normalize
     * @returns `out`
     */
    static normalize(out: Vec4Like, a: Readonly<Vec4Like>): Vec4Like;
    /**
     * Calculates the dot product of two {@link Vec4}'s
     * @category Static
     *
     * @param a - the first operand
     * @param b - the second operand
     * @returns dot product of a and b
     */
    static dot(a: Readonly<Vec4Like>, b: Readonly<Vec4Like>): number;
    /**
     * Returns the cross-product of three vectors in a 4-dimensional space
     * @category Static
     *
     * @param out the receiving vector
     * @param u - the first vector
     * @param v - the second vector
     * @param w - the third vector
     * @returns result
     */
    static cross(out: Vec4Like, u: Readonly<Vec4Like>, v: Readonly<Vec4Like>, w: Readonly<Vec4Like>): Vec4Like;
    /**
     * Performs a linear interpolation between two {@link Vec4}'s
     * @category Static
     *
     * @param out - the receiving vector
     * @param a - the first operand
     * @param b - the second operand
     * @param t - interpolation amount, in the range [0-1], between the two inputs
     * @returns `out`
     */
    static lerp(out: Vec4Like, a: Readonly<Vec4Like>, b: Readonly<Vec4Like>, t: number): Vec4Like;
    /**
     * Generates a random vector with the given scale
     * @category Static
     *
     * @param out - the receiving vector
     * @param [scale] - Length of the resulting vector. If ommitted, a unit vector will be returned
     * @returns `out`
     */
    /**
     * Transforms the {@link Vec4} with a {@link Mat4}.
     * @category Static
     *
     * @param out - the receiving vector
     * @param a - the vector to transform
     * @param m - matrix to transform with
     * @returns `out`
     */
    static transformMat4(out: Vec4Like, a: Readonly<Vec4Like>, m: Readonly<Mat4Like>): Vec4Like;
    /**
     * Transforms the {@link Vec4} with a {@link Quat}
     * @category Static
     *
     * @param out - the receiving vector
     * @param a - the vector to transform
     * @param q - quaternion to transform with
     * @returns `out`
     */
    static transformQuat(out: Vec4Like, a: Readonly<Vec4Like>, q: Readonly<QuatLike>): Vec4Like;
    /**
     * Set the components of a {@link Vec4} to zero
     * @category Static
     *
     * @param out - the receiving vector
     * @returns `out`
     */
    static zero(out: Vec4Like): Vec4Like;
    /**
     * Returns a string representation of a {@link Vec4}
     * @category Static
     *
     * @param a - vector to represent as a string
     * @returns string representation of the vector
     */
    static str(a: Readonly<Vec4Like>): string;
    /**
     * Returns whether or not the vectors have exactly the same elements in the same position (when compared with ===)
     * @category Static
     *
     * @param a - The first vector.
     * @param b - The second vector.
     * @returns True if the vectors are equal, false otherwise.
     */
    static exactEquals(a: Readonly<Vec4Like>, b: Readonly<Vec4Like>): boolean;
    /**
     * Returns whether or not the vectors have approximately the same elements in the same position.
     * @category Static
     *
     * @param a - The first vector.
     * @param b - The second vector.
     * @returns True if the vectors are equal, false otherwise.
     */
    static equals(a: Readonly<Vec4Like>, b: Readonly<Vec4Like>): boolean;
}
/**
 * Vec4 alias for backwards compatibility
 */
export declare const vec4: typeof Vec4;
