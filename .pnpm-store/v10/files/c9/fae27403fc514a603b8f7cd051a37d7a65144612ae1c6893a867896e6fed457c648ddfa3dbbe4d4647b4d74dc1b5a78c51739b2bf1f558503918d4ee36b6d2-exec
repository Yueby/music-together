import { FloatArray } from './common.js';
import { Mat2dLike } from './mat2d.js';
import { Mat4Like } from './mat4.js';
import { Vec2Like } from './vec2.js';
import { QuatLike } from './quat.js';
/**
 * A 3x3 Matrix given as a {@link Mat3}, a 9-element floating point TypedArray,
 * or an array of 9 numbers.
 */
export type Mat3Like = [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number
] | FloatArray;
/**
 * A 3x3 Matrix
 */
export declare class Mat3 extends Float32Array {
    /**
     * The number of bytes in a {@link Mat3}.
     */
    static readonly BYTE_LENGTH: number;
    /**
     * Create a {@link Mat3}.
     */
    constructor(...values: [Readonly<Mat3Like> | ArrayBufferLike, number?] | number[]);
    /**
     * A string representation of `this`
     * Equivalent to `Mat3.str(this);`
     */
    get str(): string;
    /**
     * Copy the values from another {@link Mat3} into `this`.
     *
     * @param a the source vector
     * @returns `this`
     */
    copy(a: Readonly<Mat3Like>): Mat3;
    /**
     * Set `this` to the identity matrix
     * Equivalent to Mat3.identity(this)
     *
     * @returns `this`
     */
    identity(): Mat3;
    /**
     * Multiplies this {@link Mat3} against another one
     * Equivalent to `Mat3.multiply(this, this, b);`
     *
     * @param out - The receiving Matrix
     * @param a - The first operand
     * @param b - The second operand
     * @returns `this`
     */
    multiply(b: Readonly<Mat3Like>): Mat3;
    /**
     * Alias for {@link Mat3.multiply}
     */
    mul(b: Readonly<Mat3Like>): Mat3;
    /**
     * Transpose this {@link Mat3}
     * Equivalent to `Mat3.transpose(this, this);`
     *
     * @returns `this`
     */
    transpose(): Mat3;
    /**
     * Inverts this {@link Mat3}
     * Equivalent to `Mat4.invert(this, this);`
     *
     * @returns `this`
     */
    invert(): Mat3;
    /**
     * Translate this {@link Mat3} by the given vector
     * Equivalent to `Mat3.translate(this, this, v);`
     *
     * @param v - The {@link Vec2} to translate by
     * @returns `this`
     */
    translate(v: Readonly<Vec2Like>): Mat3;
    /**
     * Rotates this {@link Mat3} by the given angle around the given axis
     * Equivalent to `Mat3.rotate(this, this, rad);`
     *
     * @param rad - the angle to rotate the matrix by
     * @returns `out`
     */
    rotate(rad: number): Mat3;
    /**
     * Scales this {@link Mat3} by the dimensions in the given vec3 not using vectorization
     * Equivalent to `Mat3.scale(this, this, v);`
     *
     * @param v - The {@link Vec2} to scale the matrix by
     * @returns `this`
     */
    scale(v: Readonly<Vec2Like>): Mat3;
    /**
     * Creates a new, identity {@link Mat3}
     * @category Static
     *
     * @returns A new {@link Mat3}
     */
    static create(): Mat3;
    /**
     * Creates a new {@link Mat3} initialized with values from an existing matrix
     * @category Static
     *
     * @param a - Matrix to clone
     * @returns A new {@link Mat3}
     */
    static clone(a: Readonly<Mat3Like>): Mat3;
    /**
     * Copy the values from one {@link Mat3} to another
     * @category Static
     *
     * @param out - The receiving Matrix
     * @param a - Matrix to copy
     * @returns `out`
     */
    static copy(out: Mat3Like, a: Readonly<Mat3Like>): Mat3Like;
    /**
     * Create a new {@link Mat3} with the given values
     * @category Static
     *
     * @param values - Matrix components
     * @returns A new {@link Mat3}
     */
    static fromValues(...values: number[]): Mat3;
    /**
     * Set the components of a {@link Mat3} to the given values
     * @category Static
     *
     * @param out - The receiving matrix
     * @param values - Matrix components
     * @returns `out`
     */
    static set(out: Mat3Like, ...values: number[]): Mat3Like;
    /**
     * Set a {@link Mat3} to the identity matrix
     * @category Static
     *
     * @param out - The receiving matrix
     * @returns `out`
     */
    static identity(out: Mat3Like): Mat3Like;
    /**
     * Transpose the values of a {@link Mat3}
     * @category Static
     *
     * @param out - the receiving matrix
     * @param a - the source matrix
     * @returns `out`
     */
    static transpose(out: Mat3Like, a: Readonly<Mat3Like>): Mat3Like;
    /**
     * Inverts a {@link Mat3}
     * @category Static
     *
     * @param out - the receiving matrix
     * @param a - the source matrix
     * @returns `out` or `null` if the matrix is not invertable
     */
    static invert(out: Mat3Like, a: Mat3Like): Mat3Like | null;
    /**
     * Calculates the adjugate of a {@link Mat3}
     * @category Static
     *
     * @param out - the receiving matrix
     * @param a - the source matrix
     * @returns `out`
     */
    static adjoint(out: Mat3Like, a: Mat3Like): Mat3Like;
    /**
     * Calculates the determinant of a {@link Mat3}
     * @category Static
     *
     * @param a - the source matrix
     * @returns determinant of a
     */
    static determinant(a: Readonly<Mat3Like>): number;
    /**
     * Adds two {@link Mat3}'s
     * @category Static
     *
     * @param out - the receiving matrix
     * @param a - the first operand
     * @param b - the second operand
     * @returns `out`
     */
    static add(out: Mat3Like, a: Readonly<Mat3Like>, b: Readonly<Mat3Like>): Mat3Like;
    /**
     * Subtracts matrix b from matrix a
     * @category Static
     *
     * @param out - the receiving matrix
     * @param a - the first operand
     * @param b - the second operand
     * @returns `out`
     */
    static subtract(out: Mat3Like, a: Readonly<Mat3Like>, b: Readonly<Mat3Like>): Mat3Like;
    /**
     * Alias for {@link Mat3.subtract}
     * @category Static
     */
    static sub(out: Mat3Like, a: Readonly<Mat3Like>, b: Readonly<Mat3Like>): Mat3Like;
    /**
     * Multiplies two {@link Mat3}s
     * @category Static
     *
     * @param out - The receiving Matrix
     * @param a - The first operand
     * @param b - The second operand
     * @returns `out`
     */
    static multiply(out: Mat3Like, a: Readonly<Mat3Like>, b: Readonly<Mat3Like>): Mat3Like;
    /**
     * Alias for {@link Mat3.multiply}
     * @category Static
     */
    static mul(out: Mat3Like, a: Readonly<Mat3Like>, b: Readonly<Mat3Like>): Mat3Like;
    /**
     * Translate a {@link Mat3} by the given vector
     * @category Static
     *
     * @param out - the receiving matrix
     * @param a - the matrix to translate
     * @param v - vector to translate by
     * @returns `out`
     */
    static translate(out: Mat3Like, a: Readonly<Mat3Like>, v: Readonly<Vec2Like>): Mat3Like;
    /**
     * Rotates a {@link Mat3} by the given angle
     * @category Static
     *
     * @param out - the receiving matrix
     * @param a - the matrix to rotate
     * @param rad - the angle to rotate the matrix by
     * @returns `out`
     */
    static rotate(out: Mat3Like, a: Readonly<Mat3Like>, rad: number): Mat3Like;
    /**
     * Scales the {@link Mat3} by the dimensions in the given {@link Vec2}
     * @category Static
     *
     * @param out - the receiving matrix
     * @param a - the matrix to scale
     * @param v - the {@link Vec2} to scale the matrix by
     * @returns `out`
     **/
    static scale(out: Mat3Like, a: Readonly<Mat3Like>, v: Readonly<Vec2Like>): Mat3Like;
    /**
     * Creates a {@link Mat3} from a vector translation
     * This is equivalent to (but much faster than):
     *
     *     mat3.identity(dest);
     *     mat3.translate(dest, dest, vec);
     * @category Static
     *
     * @param out - {@link Mat3} receiving operation result
     * @param v - Translation vector
     * @returns `out`
     */
    static fromTranslation(out: Mat3Like, v: Readonly<Vec2Like>): Mat3Like;
    /**
     * Creates a {@link Mat3} from a given angle around a given axis
     * This is equivalent to (but much faster than):
     *
     *     mat3.identity(dest);
     *     mat3.rotate(dest, dest, rad);
     * @category Static
     *
     * @param out - {@link Mat3} receiving operation result
     * @param rad - the angle to rotate the matrix by
     * @returns `out`
     */
    static fromRotation(out: Mat3Like, rad: number): Mat3Like;
    /**
     * Creates a {@link Mat3} from a vector scaling
     * This is equivalent to (but much faster than):
     *
     *     mat3.identity(dest);
     *     mat3.scale(dest, dest, vec);
     * @category Static
     *
     * @param out - {@link Mat3} receiving operation result
     * @param v - Scaling vector
     * @returns `out`
     */
    static fromScaling(out: Mat3Like, v: Readonly<Vec2Like>): Mat3Like;
    /**
     * Copies the upper-left 3x3 values of a {@link Mat2d} into the given
     * {@link Mat3}.
     * @category Static
     *
     * @param out - the receiving 3x3 matrix
     * @param a - the source 2x3 matrix
     * @returns `out`
     */
    static fromMat2d(out: Mat3Like, a: Readonly<Mat2dLike>): Mat3Like;
    /**
     * Calculates a {@link Mat3} from the given quaternion
     *
     * @param out - {@link Mat3} receiving operation result
     * @param q - {@link Quat} to create matrix from
     * @returns `out`
     */
    static fromQuat(out: Mat3Like, q: Readonly<QuatLike>): Mat3Like;
    /**
     * Copies the upper-left 3x3 values of a {@link Mat4} into the given
     * {@link Mat3}.
     * @category Static
     *
     * @param out - the receiving 3x3 matrix
     * @param a - the source 4x4 matrix
     * @returns `out`
     */
    static fromMat4(out: Mat3Like, a: Readonly<Mat4Like>): Mat3Like;
    /**
     * Calculates a 3x3 normal matrix (transpose inverse) from the 4x4 matrix
     * @category Static
     *
     * @param {mat3} out mat3 receiving operation result
     * @param {ReadonlyMat4} a Mat4 to derive the normal matrix from
     * @returns `out` or `null` if the matrix is not invertable
     */
    static normalFromMat4(out: Mat3Like, a: Readonly<Mat4Like>): Mat3Like | null;
    /**
     * Calculates a {@link Mat3} normal matrix (transpose inverse) from a {@link Mat4}
     * This version omits the calculation of the constant factor (1/determinant), so
     * any normals transformed with it will need to be renormalized.
     * From https://stackoverflow.com/a/27616419/25968
     * @category Static
     *
     * @param out - Matrix receiving operation result
     * @param a - Mat4 to derive the normal matrix from
     * @returns `out`
     */
    static normalFromMat4Fast(out: Mat3Like, a: Readonly<Mat4Like>): Mat3Like;
    /**
     * Generates a 2D projection matrix with the given bounds
     * @category Static
     *
     * @param out mat3 frustum matrix will be written into
     * @param width Width of your gl context
     * @param height Height of gl context
     * @returns `out`
     */
    static projection(out: Mat3Like, width: number, height: number): Mat3Like;
    /**
     * Returns Frobenius norm of a {@link Mat3}
     * @category Static
     *
     * @param a - the matrix to calculate Frobenius norm of
     * @returns Frobenius norm
     */
    static frob(a: Readonly<Mat3Like>): number;
    /**
     * Multiply each element of a {@link Mat3} by a scalar.
     * @category Static
     *
     * @param out - the receiving matrix
     * @param a - the matrix to scale
     * @param b - amount to scale the matrix's elements by
     * @returns `out`
     */
    static multiplyScalar(out: Mat3Like, a: Readonly<Mat3Like>, b: number): Mat3Like;
    /**
     * Adds two {@link Mat3}'s after multiplying each element of the second operand by a scalar value.
     * @category Static
     *
     * @param out - the receiving vector
     * @param a - the first operand
     * @param b - the second operand
     * @param scale - the amount to scale b's elements by before adding
     * @returns `out`
     */
    static multiplyScalarAndAdd(out: Mat3Like, a: Readonly<Mat3Like>, b: Readonly<Mat3Like>, scale: number): Mat3Like;
    /**
     * Returns whether or not two {@link Mat3}s have exactly the same elements in the same position (when compared with ===)
     * @category Static
     *
     * @param a - The first matrix.
     * @param b - The second matrix.
     * @returns True if the matrices are equal, false otherwise.
     */
    static exactEquals(a: Readonly<Mat3Like>, b: Readonly<Mat3Like>): boolean;
    /**
     * Returns whether or not two {@link Mat3}s have approximately the same elements in the same position.
     * @category Static
     *
     * @param a - The first matrix.
     * @param b - The second matrix.
     * @returns True if the matrices are equal, false otherwise.
     */
    static equals(a: Readonly<Mat3Like>, b: Readonly<Mat3Like>): boolean;
    /**
     * Returns a string representation of a {@link Mat3}
     * @category Static
     *
     * @param a - matrix to represent as a string
     * @returns string representation of the matrix
     */
    static str(a: Readonly<Mat3Like>): string;
}
/**
 * {@link Mat3} alias for backwards compatibility
 */
export declare const mat3: typeof Mat3;
