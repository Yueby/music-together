import { FloatArray } from './common.js';
import { Mat2Like } from './mat2.js';
import { Mat2dLike } from './mat2d.js';
import { Mat3Like } from './mat3.js';
import { Mat4Like } from './mat4.js';
/**
 * A 2 dimensional vector given as a {@link Vec2}, a 2-element floating point
 * TypedArray, or an array of 2 numbers.
 */
export type Vec2Like = [number, number] | FloatArray;
/**
 * 2 Dimensional Vector
 */
export declare class Vec2 extends Float32Array {
    /**
     * The number of bytes in a {@link Vec2}.
     */
    static readonly BYTE_LENGTH: number;
    /**
     * Create a {@link Vec2}.
     */
    constructor(...values: [Readonly<Vec2Like> | ArrayBufferLike, number?] | number[]);
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
     * The magnitude (length) of this.
     * Equivalent to `Vec2.magnitude(this);`
     *
     * Magnitude is used because the `length` attribute is already defined by
     * TypedArrays to mean the number of elements in the array.
     */
    get magnitude(): number;
    /**
     * Alias for {@link Vec2.magnitude}
     */
    get mag(): number;
    /**
     * The squared magnitude (length) of `this`.
     * Equivalent to `Vec2.squaredMagnitude(this);`
     */
    get squaredMagnitude(): number;
    /**
     * Alias for {@link Vec2.squaredMagnitude}
     */
    get sqrMag(): number;
    /**
     * A string representation of `this`
     * Equivalent to `Vec2.str(this);`
     */
    get str(): string;
    /**
     * Copy the values from another {@link Vec2} into `this`.
     *
     * @param a the source vector
     * @returns `this`
     */
    copy(a: Readonly<Vec2Like>): Vec2;
    /**
     * Adds a {@link Vec2} to `this`.
     * Equivalent to `Vec2.add(this, this, b);`
     *
     * @param b - The vector to add to `this`
     * @returns `this`
     */
    add(b: Readonly<Vec2Like>): Vec2;
    /**
     * Subtracts a {@link Vec2} from `this`.
     * Equivalent to `Vec2.subtract(this, this, b);`
     *
     * @param b - The vector to subtract from `this`
     * @returns `this`
     */
    subtract(b: Readonly<Vec2Like>): Vec2;
    /**
     * Alias for {@link Vec2.subtract}
     */
    sub(b: Readonly<Vec2Like>): Vec2;
    /**
     * Multiplies `this` by a {@link Vec2}.
     * Equivalent to `Vec2.multiply(this, this, b);`
     *
     * @param b - The vector to multiply `this` by
     * @returns `this`
     */
    multiply(b: Readonly<Vec2Like>): Vec2;
    /**
     * Alias for {@link Vec2.multiply}
     */
    mul(b: Readonly<Vec2Like>): Vec2;
    /**
     * Divides `this` by a {@link Vec2}.
     * Equivalent to `Vec2.divide(this, this, b);`
     *
     * @param b - The vector to divide `this` by
     * @returns {Vec2} `this`
     */
    divide(b: Readonly<Vec2Like>): Vec2;
    /**
     * Alias for {@link Vec2.divide}
     */
    div(b: Readonly<Vec2Like>): Vec2;
    /**
     * Scales `this` by a scalar number.
     * Equivalent to `Vec2.scale(this, this, b);`
     *
     * @param b - Amount to scale `this` by
     * @returns `this`
     */
    scale(b: number): Vec2;
    /**
     * Calculates `this` scaled by a scalar value then adds the result to `this`.
     * Equivalent to `Vec2.scaleAndAdd(this, this, b, scale);`
     *
     * @param b - The vector to add to `this`
     * @param scale - The amount to scale `b` by before adding
     * @returns `this`
     */
    scaleAndAdd(b: Readonly<Vec2Like>, scale: number): Vec2;
    /**
     * Calculates the euclidian distance between another {@link Vec2} and `this`.
     * Equivalent to `Vec2.distance(this, b);`
     *
     * @param b - The vector to calculate the distance to
     * @returns Distance between `this` and `b`
     */
    distance(b: Readonly<Vec2Like>): number;
    /**
     * Alias for {@link Vec2.distance}
     */
    dist(b: Readonly<Vec2Like>): number;
    /**
     * Calculates the squared euclidian distance between another {@link Vec2} and `this`.
     * Equivalent to `Vec2.squaredDistance(this, b);`
     *
     * @param b The vector to calculate the squared distance to
     * @returns Squared distance between `this` and `b`
     */
    squaredDistance(b: Readonly<Vec2Like>): number;
    /**
     * Alias for {@link Vec2.squaredDistance}
     */
    sqrDist(b: Readonly<Vec2Like>): number;
    /**
     * Negates the components of `this`.
     * Equivalent to `Vec2.negate(this, this);`
     *
     * @returns `this`
     */
    negate(): Vec2;
    /**
     * Inverts the components of `this`.
     * Equivalent to `Vec2.inverse(this, this);`
     *
     * @returns `this`
     */
    invert(): Vec2;
    /**
     * Sets each component of `this` to it's absolute value.
     * Equivalent to `Vec2.abs(this, this);`
     *
     * @returns `this`
     */
    abs(): Vec2;
    /**
     * Calculates the dot product of this and another {@link Vec2}.
     * Equivalent to `Vec2.dot(this, b);`
     *
     * @param b - The second operand
     * @returns Dot product of `this` and `b`
     */
    dot(b: Readonly<Vec2Like>): number;
    /**
     * Normalize `this`.
     * Equivalent to `Vec2.normalize(this, this);`
     *
     * @returns `this`
     */
    normalize(): Vec2;
    /**
     * Creates a new, empty {@link Vec2}
     * @category Static
     *
     * @returns A new 2D vector
     */
    static create(): Vec2;
    /**
     * Creates a new {@link Vec2} initialized with values from an existing vector
     * @category Static
     *
     * @param a - Vector to clone
     * @returns A new 2D vector
     */
    static clone(a: Readonly<Vec2Like>): Vec2;
    /**
     * Creates a new {@link Vec2} initialized with the given values
     * @category Static
     *
     * @param x - X component
     * @param y - Y component
     * @returns A new 2D vector
     */
    static fromValues(x: number, y: number): Vec2;
    /**
     * Copy the values from one {@link Vec2} to another
     * @category Static
     *
     * @param out - the receiving vector
     * @param a - The source vector
     * @returns `out`
     */
    static copy(out: Vec2Like, a: Readonly<Vec2Like>): Vec2Like;
    /**
     * Set the components of a {@link Vec2} to the given values
     * @category Static
     *
     * @param out - The receiving vector
     * @param x - X component
     * @param y - Y component
     * @returns `out`
     */
    static set(out: Vec2Like, x: number, y: number): Vec2Like;
    /**
     * Adds two {@link Vec2}s
     * @category Static
     *
     * @param out - The receiving vector
     * @param a - The first operand
     * @param b - The second operand
     * @returns `out`
     */
    static add(out: Vec2Like, a: Readonly<Vec2Like>, b: Readonly<Vec2Like>): Vec2Like;
    /**
     * Subtracts vector b from vector a
     * @category Static
     *
     * @param out - The receiving vector
     * @param a - The first operand
     * @param b - The second operand
     * @returns `out`
     */
    static subtract(out: Vec2Like, a: Readonly<Vec2Like>, b: Readonly<Vec2Like>): Vec2Like;
    /**
     * Alias for {@link Vec2.subtract}
     * @category Static
     */
    static sub(out: Vec2Like, a: Readonly<Vec2Like>, b: Readonly<Vec2Like>): Vec2Like;
    /**
     * Multiplies two {@link Vec2}s
     * @category Static
     *
     * @param out - The receiving vector
     * @param a - The first operand
     * @param b - The second operand
     * @returns `out`
     */
    static multiply(out: Vec2Like, a: Readonly<Vec2Like>, b: Readonly<Vec2Like>): Vec2Like;
    /**
     * Alias for {@link Vec2.multiply}
     * @category Static
     */
    static mul(out: Vec2Like, a: Readonly<Vec2Like>, b: Readonly<Vec2Like>): Vec2Like;
    /**
     * Divides two {@link Vec2}s
     * @category Static
     *
     * @param out - The receiving vector
     * @param a - The first operand
     * @param b - The second operand
     * @returns `out`
     */
    static divide(out: Vec2Like, a: Readonly<Vec2Like>, b: Readonly<Vec2Like>): Vec2Like;
    /**
     * Alias for {@link Vec2.divide}
     * @category Static
     */
    static div(out: Vec2Like, a: Readonly<Vec2Like>, b: Readonly<Vec2Like>): Vec2Like;
    /**
     * Math.ceil the components of a {@link Vec2}
     * @category Static
     *
     * @param out - The receiving vector
     * @param a - Vector to ceil
     * @returns `out`
     */
    static ceil(out: Vec2Like, a: Readonly<Vec2Like>): Vec2Like;
    /**
     * Math.floor the components of a {@link Vec2}
     * @category Static
     *
     * @param out - The receiving vector
     * @param a - Vector to floor
     * @returns `out`
     */
    static floor(out: Vec2Like, a: Readonly<Vec2Like>): Vec2Like;
    /**
     * Returns the minimum of two {@link Vec2}s
     * @category Static
     *
     * @param out - The receiving vector
     * @param a - The first operand
     * @param b - The second operand
     * @returns `out`
     */
    static min(out: Vec2Like, a: Readonly<Vec2Like>, b: Readonly<Vec2Like>): Vec2Like;
    /**
     * Returns the maximum of two {@link Vec2}s
     * @category Static
     *
     * @param out - The receiving vector
     * @param a - The first operand
     * @param b - The second operand
     * @returns `out`
     */
    static max(out: Vec2Like, a: Readonly<Vec2Like>, b: Readonly<Vec2Like>): Vec2Like;
    /**
     * Math.round the components of a {@link Vec2}
     * @category Static
     *
     * @param out - The receiving vector
     * @param a - Vector to round
     * @returns `out`
     */
    static round(out: Vec2Like, a: Readonly<Vec2Like>): Vec2Like;
    /**
     * Scales a {@link Vec2} by a scalar number
     * @category Static
     *
     * @param out - The receiving vector
     * @param a - The vector to scale
     * @param b - Amount to scale the vector by
     * @returns `out`
     */
    static scale(out: Vec2Like, a: Readonly<Vec2Like>, b: number): Vec2Like;
    /**
     * Adds two Vec2's after scaling the second operand by a scalar value
     * @category Static
     *
     * @param out - The receiving vector
     * @param a - The first operand
     * @param b - The second operand
     * @param scale - The amount to scale b by before adding
     * @returns `out`
     */
    static scaleAndAdd(out: Vec2Like, a: Readonly<Vec2Like>, b: Readonly<Vec2Like>, scale: number): Vec2Like;
    /**
     * Calculates the euclidian distance between two {@link Vec2}s
     * @category Static
     *
     * @param a - The first operand
     * @param b - The second operand
     * @returns distance between `a` and `b`
     */
    static distance(a: Readonly<Vec2Like>, b: Readonly<Vec2Like>): number;
    /**
     * Alias for {@link Vec2.distance}
     * @category Static
     */
    static dist(a: Readonly<Vec2Like>, b: Readonly<Vec2Like>): number;
    /**
     * Calculates the squared euclidian distance between two {@link Vec2}s
     * @category Static
     *
     * @param a - The first operand
     * @param b - The second operand
     * @returns Squared distance between `a` and `b`
     */
    static squaredDistance(a: Readonly<Vec2Like>, b: Readonly<Vec2Like>): number;
    /**
     * Alias for {@link Vec2.distance}
     * @category Static
     */
    static sqrDist(a: Readonly<Vec2Like>, b: Readonly<Vec2Like>): number;
    /**
     * Calculates the magnitude (length) of a {@link Vec2}
     * @category Static
     *
     * @param a - Vector to calculate magnitude of
     * @returns Magnitude of a
     */
    static magnitude(a: Readonly<Vec2Like>): number;
    /**
     * Alias for {@link Vec2.magnitude}
     * @category Static
     */
    static mag(a: Readonly<Vec2Like>): number;
    /**
     * Alias for {@link Vec2.magnitude}
     * @category Static
     * @deprecated Use {@link Vec2.magnitude} to avoid conflicts with builtin `length` methods/attribs
     *
     * @param a - vector to calculate length of
     * @returns length of a
     */
    static length(a: Readonly<Vec2Like>): number;
    /**
     * Alias for {@link Vec2.magnitude}
     * @category Static
     * @deprecated Use {@link Vec2.mag}
     */
    static len(a: Readonly<Vec2Like>): number;
    /**
     * Calculates the squared length of a {@link Vec2}
     * @category Static
     *
     * @param a - Vector to calculate squared length of
     * @returns Squared length of a
     */
    static squaredLength(a: Readonly<Vec2Like>): number;
    /**
     * Alias for {@link Vec2.squaredLength}
     */
    static sqrLen(a: Readonly<Vec2Like>, b: Readonly<Vec2Like>): number;
    /**
     * Negates the components of a {@link Vec2}
     * @category Static
     *
     * @param out - The receiving vector
     * @param a - Vector to negate
     * @returns `out`
     */
    static negate(out: Vec2Like, a: Readonly<Vec2Like>): Vec2Like;
    /**
     * Returns the inverse of the components of a {@link Vec2}
     * @category Static
     *
     * @param out - The receiving vector
     * @param a - Vector to invert
     * @returns `out`
     */
    static inverse(out: Vec2Like, a: Readonly<Vec2Like>): Vec2Like;
    /**
     * Returns the absolute value of the components of a {@link Vec2}
     * @category Static
     *
     * @param out - The receiving vector
     * @param a - Vector to compute the absolute values of
     * @returns `out`
     */
    static abs(out: Vec2Like, a: Readonly<Vec2Like>): Vec2Like;
    /**
     * Normalize a {@link Vec2}
     * @category Static
     *
     * @param out - The receiving vector
     * @param a - Vector to normalize
     * @returns `out`
     */
    static normalize(out: Vec2Like, a: Readonly<Vec2Like>): Vec2Like;
    /**
     * Calculates the dot product of two {@link Vec2}s
     * @category Static
     *
     * @param a - The first operand
     * @param b - The second operand
     * @returns Dot product of `a` and `b`
     */
    static dot(a: Readonly<Vec2Like>, b: Readonly<Vec2Like>): number;
    /**
     * Computes the cross product of two {@link Vec2}s
     * Note that the cross product must by definition produce a 3D vector.
     * For this reason there is also not instance equivalent for this function.
     * @category Static
     *
     * @param out - The receiving vector
     * @param a - The first operand
     * @param b - The second operand
     * @returns `out`
     */
    static cross(out: Vec2Like, a: Readonly<Vec2Like>, b: Readonly<Vec2Like>): Vec2Like;
    /**
     * Performs a linear interpolation between two {@link Vec2}s
     * @category Static
     *
     * @param out - The receiving vector
     * @param a - The first operand
     * @param b - The second operand
     * @param t - Interpolation amount, in the range [0-1], between the two inputs
     * @returns `out`
     */
    static lerp(out: Vec2Like, a: Readonly<Vec2Like>, b: Readonly<Vec2Like>, t: number): Vec2Like;
    /**
     * Transforms the {@link Vec2} with a {@link Mat2}
     *
     * @param out - The receiving vector
     * @param a - The vector to transform
     * @param m - Matrix to transform with
     * @returns `out`
     */
    static transformMat2(out: Vec2Like, a: Readonly<Vec2Like>, m: Readonly<Mat2Like>): Vec2Like;
    /**
     * Transforms the {@link Vec2} with a {@link Mat2d}
     *
     * @param out - The receiving vector
     * @param a - The vector to transform
     * @param m - Matrix to transform with
     * @returns `out`
     */
    static transformMat2d(out: Vec2Like, a: Readonly<Vec2Like>, m: Readonly<Mat2dLike>): Vec2Like;
    /**
     * Transforms the {@link Vec2} with a {@link Mat3}
     * 3rd vector component is implicitly '1'
     *
     * @param out - The receiving vector
     * @param a - The vector to transform
     * @param m - Matrix to transform with
     * @returns `out`
     */
    static transformMat3(out: Vec2Like, a: Readonly<Vec2Like>, m: Readonly<Mat3Like>): Vec2Like;
    /**
     * Transforms the {@link Vec2} with a {@link Mat4}
     * 3rd vector component is implicitly '0'
     * 4th vector component is implicitly '1'
     *
     * @param out - The receiving vector
     * @param a - The vector to transform
     * @param m - Matrix to transform with
     * @returns `out`
     */
    static transformMat4(out: Vec2Like, a: Readonly<Vec2Like>, m: Readonly<Mat4Like>): Vec2Like;
    /**
     * Rotate a 2D vector
     * @category Static
     *
     * @param out - The receiving {@link Vec2}
     * @param a - The {@link Vec2} point to rotate
     * @param b - The origin of the rotation
     * @param rad - The angle of rotation in radians
     * @returns `out`
     */
    static rotate(out: Vec2Like, a: Readonly<Vec2Like>, b: Readonly<Vec2Like>, rad: number): Vec2Like;
    /**
     * Get the angle between two 2D vectors
     * @category Static
     *
     * @param a - The first operand
     * @param b - The second operand
     * @returns The angle in radians
     */
    static angle(a: Readonly<Vec2Like>, b: Readonly<Vec2Like>): number;
    /**
     * Set the components of a {@link Vec2} to zero
     * @category Static
     *
     * @param out - The receiving vector
     * @returns `out`
     */
    static zero(out: Vec2Like): Vec2Like;
    /**
     * Returns whether or not the vectors have exactly the same elements in the same position (when compared with ===)
     * @category Static
     *
     * @param a - The first vector.
     * @param b - The second vector.
     * @returns `true` if the vectors components are ===, `false` otherwise.
     */
    static exactEquals(a: Readonly<Vec2Like>, b: Readonly<Vec2Like>): boolean;
    /**
     * Returns whether or not the vectors have approximately the same elements in the same position.
     * @category Static
     *
     * @param a - The first vector.
     * @param b - The second vector.
     * @returns `true` if the vectors are approximately equal, `false` otherwise.
     */
    static equals(a: Readonly<Vec2Like>, b: Readonly<Vec2Like>): boolean;
    /**
     * Returns a string representation of a vector
     * @category Static
     *
     * @param a - Vector to represent as a string
     * @returns String representation of the vector
     */
    static str(a: Readonly<Vec2Like>): string;
}
/**
 * Vec2 alias for backwards compatibility
 */
export declare const vec2: typeof Vec2;
