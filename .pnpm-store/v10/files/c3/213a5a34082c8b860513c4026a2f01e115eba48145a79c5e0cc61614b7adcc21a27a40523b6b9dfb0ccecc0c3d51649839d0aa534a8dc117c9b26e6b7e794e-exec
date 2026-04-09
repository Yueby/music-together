import { Mat3Like } from './mat3.js';
import { Vec3Like } from './vec3.js';
import { Vec4Like } from './vec4.js';
/**
 * A Quaternion given as a {@link Quat}, a 4-element floating point TypedArray,
 * or an array of 4 numbers.
 */
export type QuatLike = Vec4Like;
/**
 * Quaternion
 */
export declare class Quat extends Float32Array {
    /**
     * The number of bytes in a {@link Quat}.
     */
    static readonly BYTE_LENGTH: number;
    /**
     * Create a {@link Quat}.
     */
    constructor(...values: [Readonly<QuatLike> | ArrayBufferLike, number?] | number[]);
    /**
     * The x component of the quaternion. Equivalent to `this[0];`
     * @category Quaternion components
     */
    get x(): number;
    set x(value: number);
    /**
     * The y component of the quaternion. Equivalent to `this[1];`
     * @category Quaternion components
     */
    get y(): number;
    set y(value: number);
    /**
     * The z component of the quaternion. Equivalent to `this[2];`
     * @category Quaternion components
     */
    get z(): number;
    set z(value: number);
    /**
     * The w component of the quaternion. Equivalent to `this[3];`
     * @category Quaternion components
     */
    get w(): number;
    set w(value: number);
    /**
     * The magnitude (length) of this.
     * Equivalent to `Quat.magnitude(this);`
     *
     * Magnitude is used because the `length` attribute is already defined by
     * TypedArrays to mean the number of elements in the array.
     */
    get magnitude(): number;
    /**
     * Alias for {@link Quat.magnitude}
     */
    get mag(): number;
    /**
     * A string representation of `this`
     * Equivalent to `Quat.str(this);`
     */
    get str(): string;
    /**
     * Copy the values from another {@link Quat} into `this`.
     *
     * @param a the source quaternion
     * @returns `this`
     */
    copy(a: Readonly<QuatLike>): Quat;
    /**
     * Set `this` to the identity quaternion
     * Equivalent to Quat.identity(this)
     *
     * @returns `this`
     */
    identity(): Quat;
    /**
     * Multiplies `this` by a {@link Quat}.
     * Equivalent to `Quat.multiply(this, this, b);`
     *
     * @param b - The vector to multiply `this` by
     * @returns `this`
     */
    multiply(b: Readonly<QuatLike>): Quat;
    /**
     * Alias for {@link Quat.multiply}
     */
    mul(b: Readonly<QuatLike>): Quat;
    /**
     * Rotates `this` by the given angle about the X axis
     * Equivalent to `Quat.rotateX(this, this, rad);`
     *
     * @param rad - angle (in radians) to rotate
     * @returns `this`
     */
    rotateX(rad: number): Quat;
    /**
     * Rotates `this` by the given angle about the Y axis
     * Equivalent to `Quat.rotateY(this, this, rad);`
     *
     * @param rad - angle (in radians) to rotate
     * @returns `this`
     */
    rotateY(rad: number): Quat;
    /**
     * Rotates `this` by the given angle about the Z axis
     * Equivalent to `Quat.rotateZ(this, this, rad);`
     *
     * @param rad - angle (in radians) to rotate
     * @returns `this`
     */
    rotateZ(rad: number): Quat;
    /**
     * Inverts `this`
     * Equivalent to `Quat.invert(this, this);`
     *
     * @returns `this`
     */
    invert(): Quat;
    /**
     * Scales `this` by a scalar number
     * Equivalent to `Quat.scale(this, this, scale);`
     *
     * @param out - the receiving vector
     * @param a - the vector to scale
     * @param scale - amount to scale the vector by
     * @returns `this`
     */
    scale(scale: number): QuatLike;
    /**
     * Calculates the dot product of `this` and another {@link Quat}
     * Equivalent to `Quat.dot(this, b);`
     *
     * @param b - the second operand
     * @returns dot product of `this` and b
     */
    dot(b: Readonly<QuatLike>): number;
    /**
     * Creates a new identity quat
     * @category Static
     *
     * @returns a new quaternion
     */
    static create(): Quat;
    /**
     * Set a quat to the identity quaternion
     * @category Static
     *
     * @param out - the receiving quaternion
     * @returns `out`
     */
    static identity(out: QuatLike): QuatLike;
    /**
     * Sets a quat from the given angle and rotation axis,
     * then returns it.
     * @category Static
     *
     * @param out - the receiving quaternion
     * @param axis - the axis around which to rotate
     * @param rad - the angle in radians
     * @returns `out`
     **/
    static setAxisAngle(out: QuatLike, axis: Readonly<Vec3Like>, rad: number): QuatLike;
    /**
     * Gets the rotation axis and angle for a given
     *  quaternion. If a quaternion is created with
     *  setAxisAngle, this method will return the same
     *  values as providied in the original parameter list
     *  OR functionally equivalent values.
     * Example: The quaternion formed by axis [0, 0, 1] and
     *  angle -90 is the same as the quaternion formed by
     *  [0, 0, 1] and 270. This method favors the latter.
     * @category Static
     *
     * @param out_axis - Vector receiving the axis of rotation
     * @param q - Quaternion to be decomposed
     * @return Angle, in radians, of the rotation
     */
    static getAxisAngle(out_axis: Vec3Like, q: Readonly<QuatLike>): number;
    /**
     * Gets the angular distance between two unit quaternions
     * @category Static
     *
     * @param  {ReadonlyQuat} a     Origin unit quaternion
     * @param  {ReadonlyQuat} b     Destination unit quaternion
     * @return {Number}     Angle, in radians, between the two quaternions
     */
    static getAngle(a: Readonly<QuatLike>, b: Readonly<QuatLike>): number;
    /**
     * Multiplies two quat's
     * @category Static
     *
     * @param out - the receiving quaternion
     * @param a - the first operand
     * @param b - the second operand
     * @returns `out`
     */
    static multiply(out: QuatLike, a: Readonly<QuatLike>, b: Readonly<QuatLike>): QuatLike;
    /**
     * Rotates a quaternion by the given angle about the X axis
     * @category Static
     *
     * @param out - quat receiving operation result
     * @param a - quat to rotate
     * @param rad - angle (in radians) to rotate
     * @returns `out`
     */
    static rotateX(out: QuatLike, a: Readonly<QuatLike>, rad: number): QuatLike;
    /**
     * Rotates a quaternion by the given angle about the Y axis
     * @category Static
     *
     * @param out - quat receiving operation result
     * @param a - quat to rotate
     * @param rad - angle (in radians) to rotate
     * @returns `out`
     */
    static rotateY(out: QuatLike, a: Readonly<QuatLike>, rad: number): QuatLike;
    /**
     * Rotates a quaternion by the given angle about the Z axis
     * @category Static
     *
     * @param out - quat receiving operation result
     * @param a - quat to rotate
     * @param rad - angle (in radians) to rotate
     * @returns `out`
     */
    static rotateZ(out: QuatLike, a: Readonly<QuatLike>, rad: number): QuatLike;
    /**
     * Calculates the W component of a quat from the X, Y, and Z components.
     * Assumes that quaternion is 1 unit in length.
     * Any existing W component will be ignored.
     * @category Static
     *
     * @param out - the receiving quaternion
     * @param a - quat to calculate W component of
     * @returns `out`
     */
    static calculateW(out: QuatLike, a: Readonly<QuatLike>): QuatLike;
    /**
     * Calculate the exponential of a unit quaternion.
     * @category Static
     *
     * @param out - the receiving quaternion
     * @param a - quat to calculate the exponential of
     * @returns `out`
     */
    static exp(out: QuatLike, a: Readonly<QuatLike>): QuatLike;
    /**
     * Calculate the natural logarithm of a unit quaternion.
     * @category Static
     *
     * @param out - the receiving quaternion
     * @param a - quat to calculate the exponential of
     * @returns `out`
     */
    static ln(out: QuatLike, a: Readonly<QuatLike>): QuatLike;
    /**
     * Calculate the scalar power of a unit quaternion.
     * @category Static
     *
     * @param out - the receiving quaternion
     * @param a - quat to calculate the exponential of
     * @param b - amount to scale the quaternion by
     * @returns `out`
     */
    static pow(out: QuatLike, a: Readonly<QuatLike>, b: number): QuatLike;
    /**
     * Performs a spherical linear interpolation between two quat
     * @category Static
     *
     * @param out - the receiving quaternion
     * @param a - the first operand
     * @param b - the second operand
     * @param t - interpolation amount, in the range [0-1], between the two inputs
     * @returns `out`
     */
    static slerp(out: QuatLike, a: Readonly<QuatLike>, b: Readonly<QuatLike>, t: number): QuatLike;
    /**
     * Generates a random unit quaternion
     * @category Static
     *
     * @param out - the receiving quaternion
     * @returns `out`
     */
    /**
     * Calculates the inverse of a quat
     * @category Static
     *
     * @param out - the receiving quaternion
     * @param a - quat to calculate inverse of
     * @returns `out`
     */
    static invert(out: QuatLike, a: Readonly<QuatLike>): QuatLike;
    /**
     * Calculates the conjugate of a quat
     * If the quaternion is normalized, this function is faster than quat.inverse and produces the same result.
     * @category Static
     *
     * @param out - the receiving quaternion
     * @param a - quat to calculate conjugate of
     * @returns `out`
     */
    static conjugate(out: QuatLike, a: Readonly<QuatLike>): QuatLike;
    /**
     * Creates a quaternion from the given 3x3 rotation matrix.
     *
     * NOTE: The resultant quaternion is not normalized, so you should be sure
     * to renormalize the quaternion yourself where necessary.
     * @category Static
     *
     * @param out - the receiving quaternion
     * @param m - rotation matrix
     * @returns `out`
     */
    static fromMat3(out: QuatLike, m: Readonly<Mat3Like>): QuatLike;
    /**
     * Creates a quaternion from the given euler angle x, y, z.
     * @category Static
     *
     * @param out - the receiving quaternion
     * @param x - Angle to rotate around X axis in degrees.
     * @param y - Angle to rotate around Y axis in degrees.
     * @param z - Angle to rotate around Z axis in degrees.
     * @param {'xyz'|'xzy'|'yxz'|'yzx'|'zxy'|'zyx'} order - Intrinsic order for conversion, default is zyx.
     * @returns `out`
     */
    static fromEuler(out: QuatLike, x: number, y: number, z: number, order?: string): QuatLike;
    /**
     * Returns a string representation of a quatenion
     * @category Static
     *
     * @param a - vector to represent as a string
     * @returns string representation of the vector
     */
    static str(a: Readonly<QuatLike>): string;
    /**
     * Creates a new quat initialized with values from an existing quaternion
     * @category Static
     *
     * @param a - quaternion to clone
     * @returns a new quaternion
     */
    static clone(a: Readonly<QuatLike>): Quat;
    /**
     * Creates a new quat initialized with the given values
     * @category Static
     *
     * @param x - X component
     * @param y - Y component
     * @param z - Z component
     * @param w - W component
     * @returns a new quaternion
     */
    static fromValues(x: number, y: number, z: number, w: number): Quat;
    /**
     * Copy the values from one quat to another
     * @category Static
     *
     * @param out - the receiving quaternion
     * @param a - the source quaternion
     * @returns `out`
     */
    static copy(out: QuatLike, a: Readonly<QuatLike>): QuatLike;
    /**
     * Set the components of a {@link Quat} to the given values
     * @category Static
     *
     * @param out - the receiving quaternion
     * @param x - X component
     * @param y - Y component
     * @param z - Z component
     * @param w - W component
     * @returns `out`
     */
    static set(out: QuatLike, x: number, y: number, z: number, w: number): QuatLike;
    /**
     * Adds two {@link Quat}'s
     * @category Static
     *
     * @param out - the receiving quaternion
     * @param a - the first operand
     * @param b - the second operand
     * @returns `out`
     */
    static add(out: QuatLike, a: Readonly<QuatLike>, b: Readonly<QuatLike>): QuatLike;
    /**
     * Alias for {@link Quat.multiply}
     * @category Static
     */
    static mul(out: QuatLike, a: Readonly<QuatLike>, b: Readonly<QuatLike>): QuatLike;
    /**
     * Scales a quat by a scalar number
     * @category Static
     *
     * @param out - the receiving vector
     * @param a - the vector to scale
     * @param b - amount to scale the vector by
     * @returns `out`
     */
    static scale(out: QuatLike, a: Readonly<QuatLike>, scale: number): QuatLike;
    /**
     * Calculates the dot product of two quat's
     * @category Static
     *
     * @param a - the first operand
     * @param b - the second operand
     * @returns dot product of a and b
     */
    static dot(a: Readonly<QuatLike>, b: Readonly<QuatLike>): number;
    /**
     * Performs a linear interpolation between two quat's
     * @category Static
     *
     * @param out - the receiving quaternion
     * @param a - the first operand
     * @param b - the second operand
     * @param t - interpolation amount, in the range [0-1], between the two inputs
     * @returns `out`
     */
    static lerp(out: QuatLike, a: Readonly<QuatLike>, b: Readonly<QuatLike>, t: number): QuatLike;
    /**
     * Calculates the magnitude (length) of a {@link Quat}
     * @category Static
     *
     * @param a - quaternion to calculate length of
     * @returns length of `a`
     */
    static magnitude(a: Readonly<QuatLike>): number;
    /**
     * Alias for {@link Quat.magnitude}
     * @category Static
     */
    static mag(a: Readonly<QuatLike>): number;
    /**
     * Alias for {@link Quat.magnitude}
     * @category Static
     * @deprecated Use {@link Quat.magnitude} to avoid conflicts with builtin `length` methods/attribs
     */
    static length(a: Readonly<QuatLike>): number;
    /**
     * Alias for {@link Quat.magnitude}
     * @category Static
     * @deprecated Use {@link Quat.mag}
     */
    static len(a: Readonly<QuatLike>): number;
    /**
     * Calculates the squared length of a {@link Quat}
     * @category Static
     *
     * @param a - quaternion to calculate squared length of
     * @returns squared length of a
     */
    static squaredLength(a: Readonly<QuatLike>): number;
    /**
     * Alias for {@link Quat.squaredLength}
     * @category Static
     */
    static sqrLen(a: Readonly<QuatLike>): number;
    /**
     * Normalize a {@link Quat}
     * @category Static
     *
     * @param out - the receiving quaternion
     * @param a - quaternion to normalize
     * @returns `out`
     */
    static normalize(out: QuatLike, a: Readonly<QuatLike>): QuatLike;
    /**
     * Returns whether or not the quaternions have exactly the same elements in the same position (when compared with ===)
     * @category Static
     *
     * @param a - The first quaternion.
     * @param b - The second quaternion.
     * @returns True if the vectors are equal, false otherwise.
     */
    static exactEquals(a: Readonly<QuatLike>, b: Readonly<QuatLike>): boolean;
    /**
     * Returns whether or not the quaternions have approximately the same elements in the same position.
     * @category Static
     *
     * @param a - The first vector.
     * @param b - The second vector.
     * @returns True if the vectors are equal, false otherwise.
     */
    static equals(a: Readonly<QuatLike>, b: Readonly<QuatLike>): boolean;
    /**
     * Sets a quaternion to represent the shortest rotation from one
     * vector to another.
     *
     * Both vectors are assumed to be unit length.
     * @category Static
     *
     * @param out - the receiving quaternion.
     * @param a - the initial vector
     * @param b - the destination vector
     * @returns `out`
     */
    static rotationTo(out: QuatLike, a: Readonly<Vec3Like>, b: Readonly<Vec3Like>): QuatLike;
    /**
     * Performs a spherical linear interpolation with two control points
     * @category Static
     *
     * @param out - the receiving quaternion
     * @param a - the first operand
     * @param b - the second operand
     * @param c - the third operand
     * @param d - the fourth operand
     * @param t - interpolation amount, in the range [0-1], between the two inputs
     * @returns `out`
     */
    static sqlerp(out: QuatLike, a: Readonly<QuatLike>, b: Readonly<QuatLike>, c: Readonly<QuatLike>, d: Readonly<QuatLike>, t: number): QuatLike;
    /**
     * Sets the specified quaternion with values corresponding to the given
     * axes. Each axis is a vec3 and is expected to be unit length and
     * perpendicular to all other specified axes.
     * @category Static
     *
     * @param out - The receiving quaternion
     * @param view - the vector representing the viewing direction
     * @param right - the vector representing the local "right" direction
     * @param up - the vector representing the local "up" direction
     * @returns `out`
     */
    static setAxes(out: QuatLike, view: Readonly<Vec3Like>, right: Readonly<Vec3Like>, up: Readonly<Vec3Like>): QuatLike;
}
/**
 * Quat alias for backwards compatibility
 */
export declare const quat: typeof Quat;
