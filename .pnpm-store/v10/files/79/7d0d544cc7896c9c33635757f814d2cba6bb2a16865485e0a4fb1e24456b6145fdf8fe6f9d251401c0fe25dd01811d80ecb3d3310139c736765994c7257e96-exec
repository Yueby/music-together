import { FloatArray } from './common.js';
import { Mat4Like } from './mat4.js';
import { Mat3Like } from './mat3.js';
import { QuatLike } from './quat.js';
/**
 * A 3 dimensional vector given as a {@link Vec3}, a 3-element floating point
 * TypedArray, or an array of 3 numbers.
 */
export type Vec3Like = [number, number, number] | FloatArray;
/**
 * 3 Dimensional Vector
 */
export declare class Vec3 extends Float32Array {
    /**
    * The number of bytes in a {@link Vec3}.
    */
    static readonly BYTE_LENGTH: number;
    /**
    * Create a {@link Vec3}.
    */
    constructor(...values: [Readonly<Vec3Like> | ArrayBufferLike, number?] | number[]);
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
     * The magnitude (length) of this.
     * Equivalent to `Vec3.magnitude(this);`
     *
     * Magnitude is used because the `length` attribute is already defined by
     * TypedArrays to mean the number of elements in the array.
     */
    get magnitude(): number;
    /**
     * Alias for {@link Vec3.magnitude}
     */
    get mag(): number;
    /**
     * The squared magnitude (length) of `this`.
     * Equivalent to `Vec3.squaredMagnitude(this);`
     */
    get squaredMagnitude(): number;
    /**
     * Alias for {@link Vec3.squaredMagnitude}
     */
    get sqrMag(): number;
    /**
     * A string representation of `this`
     * Equivalent to `Vec3.str(this);`
     */
    get str(): string;
    /**
     * Copy the values from another {@link Vec3} into `this`.
     *
     * @param a the source vector
     * @returns `this`
     */
    copy(a: Readonly<Vec3Like>): Vec3;
    /**
     * Adds a {@link Vec3} to `this`.
     * Equivalent to `Vec3.add(this, this, b);`
     *
     * @param b - The vector to add to `this`
     * @returns `this`
     */
    add(b: Readonly<Vec3Like>): Vec3;
    /**
     * Subtracts a {@link Vec3} from `this`.
     * Equivalent to `Vec3.subtract(this, this, b);`
     *
     * @param b - The vector to subtract from `this`
     * @returns `this`
     */
    subtract(b: Readonly<Vec3Like>): Vec3;
    /**
     * Alias for {@link Vec3.subtract}
     */
    sub(b: Readonly<Vec3Like>): Vec3;
    /**
     * Multiplies `this` by a {@link Vec3}.
     * Equivalent to `Vec3.multiply(this, this, b);`
     *
     * @param b - The vector to multiply `this` by
     * @returns `this`
     */
    multiply(b: Readonly<Vec3Like>): Vec3;
    /**
     * Alias for {@link Vec3.multiply}
     */
    mul(b: Readonly<Vec3Like>): Vec3;
    /**
     * Divides `this` by a {@link Vec3}.
     * Equivalent to `Vec3.divide(this, this, b);`
     *
     * @param b - The vector to divide `this` by
     * @returns `this`
     */
    divide(b: Readonly<Vec3Like>): Vec3;
    /**
     * Alias for {@link Vec3.divide}
     */
    div(b: Readonly<Vec3Like>): Vec3;
    /**
     * Scales `this` by a scalar number.
     * Equivalent to `Vec3.scale(this, this, b);`
     *
     * @param b - Amount to scale `this` by
     * @returns `this`
     */
    scale(b: number): Vec3;
    /**
     * Calculates `this` scaled by a scalar value then adds the result to `this`.
     * Equivalent to `Vec3.scaleAndAdd(this, this, b, scale);`
     *
     * @param b - The vector to add to `this`
     * @param scale - The amount to scale `b` by before adding
     * @returns `this`
     */
    scaleAndAdd(b: Readonly<Vec3Like>, scale: number): Vec3;
    /**
     * Calculates the euclidian distance between another {@link Vec3} and `this`.
     * Equivalent to `Vec3.distance(this, b);`
     *
     * @param b - The vector to calculate the distance to
     * @returns Distance between `this` and `b`
     */
    distance(b: Readonly<Vec3Like>): number;
    /**
     * Alias for {@link Vec3.distance}
     */
    dist(b: Readonly<Vec3Like>): number;
    /**
     * Calculates the squared euclidian distance between another {@link Vec3} and `this`.
     * Equivalent to `Vec3.squaredDistance(this, b);`
     *
     * @param b The vector to calculate the squared distance to
     * @returns Squared distance between `this` and `b`
     */
    squaredDistance(b: Readonly<Vec3Like>): number;
    /**
     * Alias for {@link Vec3.squaredDistance}
     */
    sqrDist(b: Readonly<Vec3Like>): number;
    /**
     * Negates the components of `this`.
     * Equivalent to `Vec3.negate(this, this);`
     *
     * @returns `this`
     */
    negate(): Vec3;
    /**
     * Inverts the components of `this`.
     * Equivalent to `Vec3.inverse(this, this);`
     *
     * @returns `this`
     */
    invert(): Vec3;
    /**
     * Sets each component of `this` to it's absolute value.
     * Equivalent to `Vec3.abs(this, this);`
     *
     * @returns `this`
     */
    abs(): Vec3;
    /**
     * Calculates the dot product of this and another {@link Vec3}.
     * Equivalent to `Vec3.dot(this, b);`
     *
     * @param b - The second operand
     * @returns Dot product of `this` and `b`
     */
    dot(b: Readonly<Vec3Like>): number;
    /**
     * Normalize `this`.
     * Equivalent to `Vec3.normalize(this, this);`
     *
     * @returns `this`
     */
    normalize(): Vec3;
    /**
     * Creates a new, empty vec3
     * @category Static
     *
     * @returns a new 3D vector
     */
    static create(): Vec3;
    /**
     * Creates a new vec3 initialized with values from an existing vector
     * @category Static
     *
     * @param a - vector to clone
     * @returns a new 3D vector
     */
    static clone(a: Readonly<Vec3Like>): Vec3;
    /**
     * Calculates the magnitude (length) of a {@link Vec3}
     * @category Static
     *
     * @param a - Vector to calculate magnitude of
     * @returns Magnitude of a
     */
    static magnitude(a: Readonly<Vec3Like>): number;
    /**
     * Alias for {@link Vec3.magnitude}
     * @category Static
     */
    static mag(a: Readonly<Vec3Like>): number;
    /**
     * Alias for {@link Vec3.magnitude}
     * @category Static
     * @deprecated Use {@link Vec3.magnitude} to avoid conflicts with builtin `length` methods/attribs
     *
     * @param a - vector to calculate length of
     * @returns length of a
     */
    static length(a: Readonly<Vec3Like>): number;
    /**
     * Alias for {@link Vec3.magnitude}
     * @category Static
     * @deprecated Use {@link Vec3.mag}
     */
    static len(a: Readonly<Vec3Like>): number;
    /**
     * Creates a new vec3 initialized with the given values
     * @category Static
     *
     * @param x - X component
     * @param y - Y component
     * @param z - Z component
     * @returns a new 3D vector
     */
    static fromValues(x: number, y: number, z: number): Vec3;
    /**
     * Copy the values from one vec3 to another
     * @category Static
     *
     * @param out - the receiving vector
     * @param a - the source vector
     * @returns `out`
     */
    static copy(out: Vec3Like, a: Readonly<Vec3Like>): Vec3Like;
    /**
     * Set the components of a vec3 to the given values
     * @category Static
     *
     * @param out - the receiving vector
     * @param x - X component
     * @param y - Y component
     * @param z - Z component
     * @returns `out`
     */
    static set(out: Vec3Like, x: number, y: number, z: number): Vec3Like;
    /**
     * Adds two {@link Vec3}s
     * @category Static
     *
     * @param out - The receiving vector
     * @param a - The first operand
     * @param b - The second operand
     * @returns `out`
     */
    static add(out: Vec3Like, a: Readonly<Vec3Like>, b: Readonly<Vec3Like>): Vec3Like;
    /**
     * Subtracts vector b from vector a
     * @category Static
     *
     * @param out - the receiving vector
     * @param a - the first operand
     * @param b - the second operand
     * @returns `out`
     */
    static subtract(out: Vec3Like, a: Readonly<Vec3Like>, b: Readonly<Vec3Like>): Vec3Like;
    /**
     * Alias for {@link Vec3.subtract}
     * @category Static
     */
    static sub(out: Vec3Like, a: Readonly<Vec3Like>, b: Readonly<Vec3Like>): Vec3Like;
    /**
     * Multiplies two vec3's
     * @category Static
     *
     * @param out - the receiving vector
     * @param a - the first operand
     * @param b - the second operand
     * @returns `out`
     */
    static multiply(out: Vec3Like, a: Readonly<Vec3Like>, b: Readonly<Vec3Like>): Vec3Like;
    /**
     * Alias for {@link Vec3.multiply}
     * @category Static
     */
    static mul(out: Vec3Like, a: Readonly<Vec3Like>, b: Readonly<Vec3Like>): Vec3Like;
    /**
     * Divides two vec3's
     * @category Static
     *
     * @param out - the receiving vector
     * @param a - the first operand
     * @param b - the second operand
     * @returns `out`
     */
    static divide(out: Vec3Like, a: Readonly<Vec3Like>, b: Readonly<Vec3Like>): Vec3Like;
    /**
     * Alias for {@link Vec3.divide}
     * @category Static
     */
    static div(out: Vec3Like, a: Readonly<Vec3Like>, b: Readonly<Vec3Like>): Vec3Like;
    /**
     * Math.ceil the components of a vec3
     * @category Static
     *
     * @param out - the receiving vector
     * @param a - vector to ceil
     * @returns `out`
     */
    static ceil(out: Vec3Like, a: Readonly<Vec3Like>): Vec3Like;
    /**
     * Math.floor the components of a vec3
     * @category Static
     *
     * @param out - the receiving vector
     * @param a - vector to floor
     * @returns `out`
     */
    static floor(out: Vec3Like, a: Readonly<Vec3Like>): Vec3Like;
    /**
     * Returns the minimum of two vec3's
     * @category Static
     *
     * @param out - the receiving vector
     * @param a - the first operand
     * @param b - the second operand
     * @returns `out`
     */
    static min(out: Vec3Like, a: Readonly<Vec3Like>, b: Readonly<Vec3Like>): Vec3Like;
    /**
     * Returns the maximum of two vec3's
     * @category Static
     *
     * @param out - the receiving vector
     * @param a - the first operand
     * @param b - the second operand
     * @returns `out`
     */
    static max(out: Vec3Like, a: Readonly<Vec3Like>, b: Readonly<Vec3Like>): Vec3Like;
    /**
     * symmetric round the components of a vec3
     * @category Static
     *
     * @param out - the receiving vector
     * @param a - vector to round
     * @returns `out`
     */
    /**
     * Scales a vec3 by a scalar number
     * @category Static
     *
     * @param out - the receiving vector
     * @param a - the vector to scale
     * @param scale - amount to scale the vector by
     * @returns `out`
     */
    static scale(out: Vec3Like, a: Readonly<Vec3Like>, scale: number): Vec3Like;
    /**
     * Adds two vec3's after scaling the second operand by a scalar value
     * @category Static
     *
     * @param out - the receiving vector
     * @param a - the first operand
     * @param b - the second operand
     * @param scale - the amount to scale b by before adding
     * @returns `out`
     */
    static scaleAndAdd(out: Vec3Like, a: Readonly<Vec3Like>, b: Readonly<Vec3Like>, scale: number): Vec3Like;
    /**
     * Calculates the euclidian distance between two vec3's
     * @category Static
     *
     * @param a - the first operand
     * @param b - the second operand
     * @returns distance between a and b
     */
    static distance(a: Readonly<Vec3Like>, b: Readonly<Vec3Like>): number;
    /**
     * Alias for {@link Vec3.distance}
     */
    static dist(a: Readonly<Vec3Like>, b: Readonly<Vec3Like>): number;
    /**
     * Calculates the squared euclidian distance between two vec3's
     * @category Static
     *
     * @param a - the first operand
     * @param b - the second operand
     * @returns squared distance between a and b
     */
    static squaredDistance(a: Readonly<Vec3Like>, b: Readonly<Vec3Like>): number;
    /**
     * Alias for {@link Vec3.squaredDistance}
     */
    static sqrDist(a: Readonly<Vec3Like>, b: Readonly<Vec3Like>): number;
    /**
     * Calculates the squared length of a vec3
     * @category Static
     *
     * @param a - vector to calculate squared length of
     * @returns squared length of a
     */
    static squaredLength(a: Readonly<Vec3Like>): number;
    /**
     * Alias for {@link Vec3.squaredLength}
     */
    static sqrLen(a: Readonly<Vec3Like>, b: Readonly<Vec3Like>): number;
    /**
     * Negates the components of a vec3
     * @category Static
     *
     * @param out - the receiving vector
     * @param a - vector to negate
     * @returns `out`
     */
    static negate(out: Vec3Like, a: Readonly<Vec3Like>): Vec3Like;
    /**
     * Returns the inverse of the components of a vec3
     * @category Static
     *
     * @param out - the receiving vector
     * @param a - vector to invert
     * @returns `out`
     */
    static inverse(out: Vec3Like, a: Readonly<Vec3Like>): Vec3Like;
    /**
     * Returns the absolute value of the components of a {@link Vec3}
     * @category Static
     *
     * @param out - The receiving vector
     * @param a - Vector to compute the absolute values of
     * @returns `out`
     */
    static abs(out: Vec3Like, a: Readonly<Vec3Like>): Vec3Like;
    /**
     * Normalize a vec3
     * @category Static
     *
     * @param out - the receiving vector
     * @param a - vector to normalize
     * @returns `out`
     */
    static normalize(out: Vec3Like, a: Readonly<Vec3Like>): Vec3Like;
    /**
     * Calculates the dot product of two vec3's
     * @category Static
     *
     * @param a - the first operand
     * @param b - the second operand
     * @returns dot product of a and b
     */
    static dot(a: Readonly<Vec3Like>, b: Readonly<Vec3Like>): number;
    /**
     * Computes the cross product of two vec3's
     * @category Static
     *
     * @param out - the receiving vector
     * @param a - the first operand
     * @param b - the second operand
     * @returns `out`
     */
    static cross(out: Vec3Like, a: Readonly<Vec3Like>, b: Readonly<Vec3Like>): Vec3Like;
    /**
     * Performs a linear interpolation between two vec3's
     * @category Static
     *
     * @param out - the receiving vector
     * @param a - the first operand
     * @param b - the second operand
     * @param t - interpolation amount, in the range [0-1], between the two inputs
     * @returns `out`
     */
    static lerp(out: Vec3Like, a: Readonly<Vec3Like>, b: Readonly<Vec3Like>, t: number): Vec3Like;
    /**
     * Performs a spherical linear interpolation between two vec3's
     * @category Static
     *
     * @param out - the receiving vector
     * @param a - the first operand
     * @param b - the second operand
     * @param t - interpolation amount, in the range [0-1], between the two inputs
     * @returns `out`
     */
    static slerp(out: Vec3Like, a: Readonly<Vec3Like>, b: Readonly<Vec3Like>, t: number): Vec3Like;
    /**
     * Performs a hermite interpolation with two control points
     * @category Static
     *
     * @param out - the receiving vector
     * @param a - the first operand
     * @param b - the second operand
     * @param c - the third operand
     * @param d - the fourth operand
     * @param t - interpolation amount, in the range [0-1], between the two inputs
     * @returns `out`
     */
    static hermite(out: Vec3Like, a: Readonly<Vec3Like>, b: Readonly<Vec3Like>, c: Readonly<Vec3Like>, d: Readonly<Vec3Like>, t: number): Vec3Like;
    /**
     * Performs a bezier interpolation with two control points
     * @category Static
     *
     * @param out - the receiving vector
     * @param a - the first operand
     * @param b - the second operand
     * @param c - the third operand
     * @param d - the fourth operand
     * @param t - interpolation amount, in the range [0-1], between the two inputs
     * @returns `out`
     */
    static bezier(out: Vec3Like, a: Readonly<Vec3Like>, b: Readonly<Vec3Like>, c: Readonly<Vec3Like>, d: Readonly<Vec3Like>, t: number): Vec3Like;
    /**
     * Generates a random vector with the given scale
     * @category Static
     *
     * @param out - the receiving vector
     * @param {Number} [scale] Length of the resulting vector. If omitted, a unit vector will be returned
     * @returns `out`
     */
    /**
     * Transforms the vec3 with a mat4.
     * 4th vector component is implicitly '1'
     * @category Static
     *
     * @param out - the receiving vector
     * @param a - the vector to transform
     * @param m - matrix to transform with
     * @returns `out`
     */
    static transformMat4(out: Vec3Like, a: Readonly<Vec3Like>, m: Readonly<Mat4Like>): Vec3Like;
    /**
     * Transforms the vec3 with a mat3.
     * @category Static
     *
     * @param out - the receiving vector
     * @param a - the vector to transform
     * @param m - the 3x3 matrix to transform with
     * @returns `out`
     */
    static transformMat3(out: Vec3Like, a: Vec3Like, m: Mat3Like): Vec3Like;
    /**
     * Transforms the vec3 with a quat
     * Can also be used for dual quaternions. (Multiply it with the real part)
     * @category Static
     *
     * @param out - the receiving vector
     * @param a - the vector to transform
     * @param q - quaternion to transform with
     * @returns `out`
     */
    static transformQuat(out: Vec3Like, a: Readonly<Vec3Like>, q: Readonly<QuatLike>): Vec3Like;
    /**
     * Rotate a 3D vector around the x-axis
     * @param out - The receiving vec3
     * @param a - The vec3 point to rotate
     * @param b - The origin of the rotation
     * @param rad - The angle of rotation in radians
     * @returns `out`
     */
    static rotateX(out: Vec3Like, a: Readonly<Vec3Like>, b: Readonly<Vec3Like>, rad: number): Vec3Like;
    /**
     * Rotate a 3D vector around the y-axis
     * @param out - The receiving vec3
     * @param a - The vec3 point to rotate
     * @param b - The origin of the rotation
     * @param rad - The angle of rotation in radians
     * @returns `out`
     */
    static rotateY(out: Vec3Like, a: Readonly<Vec3Like>, b: Readonly<Vec3Like>, rad: number): Vec3Like;
    /**
     * Rotate a 3D vector around the z-axis
     * @param out - The receiving vec3
     * @param a - The vec3 point to rotate
     * @param b - The origin of the rotation
     * @param rad - The angle of rotation in radians
     * @returns `out`
     */
    static rotateZ(out: Vec3Like, a: Readonly<Vec3Like>, b: Readonly<Vec3Like>, rad: number): Vec3Like;
    /**
     * Get the angle between two 3D vectors
     * @param a - The first operand
     * @param b - The second operand
     * @returns The angle in radians
     */
    static angle(a: Readonly<Vec3Like>, b: Readonly<Vec3Like>): number;
    /**
     * Set the components of a vec3 to zero
     * @category Static
     *
     * @param out - the receiving vector
     * @returns `out`
     */
    static zero(out: Vec3Like): Vec3Like;
    /**
     * Returns a string representation of a vector
     * @category Static
     *
     * @param a - vector to represent as a string
     * @returns string representation of the vector
     */
    static str(a: Readonly<Vec3Like>): string;
    /**
     * Returns whether or not the vectors have exactly the same elements in the same position (when compared with ===)
     * @category Static
     *
     * @param a - The first vector.
     * @param b - The second vector.
     * @returns True if the vectors are equal, false otherwise.
     */
    static exactEquals(a: Readonly<Vec3Like>, b: Readonly<Vec3Like>): boolean;
    /**
     * Returns whether or not the vectors have approximately the same elements in the same position.
     * @category Static
     *
     * @param a - The first vector.
     * @param b - The second vector.
     * @returns True if the vectors are equal, false otherwise.
     */
    static equals(a: Readonly<Vec3Like>, b: Readonly<Vec3Like>): boolean;
}
/**
 * Vec3 alias for backwards compatibility
 */
export declare const vec3: typeof Vec3;
