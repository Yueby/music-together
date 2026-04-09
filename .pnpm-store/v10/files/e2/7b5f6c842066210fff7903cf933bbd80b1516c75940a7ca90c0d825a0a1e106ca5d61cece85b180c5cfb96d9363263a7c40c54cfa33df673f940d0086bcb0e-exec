import { FloatArray } from './common.js';
import { Vec2Like } from './vec2.js';
/**
 * A 2x3 Matrix given as a {@link Mat2d}, a 6-element floating point TypedArray,
 * or an array of 6 numbers.
 */
export type Mat2dLike = [
    number,
    number,
    number,
    number,
    number,
    number
] | FloatArray;
/**
 * A 2x3 Matrix
 */
export declare class Mat2d extends Float32Array {
    /**
     * The number of bytes in a {@link Mat2d}.
     */
    static readonly BYTE_LENGTH: number;
    /**
     * Create a {@link Mat2}.
     */
    constructor(...values: [Readonly<Mat2dLike> | ArrayBufferLike, number?] | number[]);
    /**
     * A string representation of `this`
     * Equivalent to `Mat2d.str(this);`
     */
    get str(): string;
    /**
     * Copy the values from another {@link Mat2d} into `this`.
     *
     * @param a the source vector
     * @returns `this`
     */
    copy(a: Readonly<Mat2dLike>): Mat2d;
    /**
     * Set `this` to the identity matrix
     * Equivalent to Mat2d.identity(this)
     *
     * @returns `this`
     */
    identity(): Mat2d;
    /**
     * Multiplies this {@link Mat2d} against another one
     * Equivalent to `Mat2d.multiply(this, this, b);`
     *
     * @param out - The receiving Matrix
     * @param a - The first operand
     * @param b - The second operand
     * @returns `this`
     */
    multiply(b: Readonly<Mat2dLike>): Mat2d;
    /**
     * Alias for {@link Mat2d.multiply}
     */
    mul(b: Readonly<Mat2dLike>): Mat2d;
    /**
     * Translate this {@link Mat2d} by the given vector
     * Equivalent to `Mat2d.translate(this, this, v);`
     *
     * @param v - The {@link Vec2} to translate by
     * @returns `this`
     */
    translate(v: Readonly<Vec2Like>): Mat2d;
    /**
     * Rotates this {@link Mat2d} by the given angle around the given axis
     * Equivalent to `Mat2d.rotate(this, this, rad);`
     *
     * @param rad - the angle to rotate the matrix by
     * @returns `out`
     */
    rotate(rad: number): Mat2d;
    /**
     * Scales this {@link Mat2d} by the dimensions in the given vec3 not using vectorization
     * Equivalent to `Mat2d.scale(this, this, v);`
     *
     * @param v - The {@link Vec2} to scale the matrix by
     * @returns `this`
     */
    scale(v: Readonly<Vec2Like>): Mat2d;
    /**
     * Creates a new, identity {@link Mat2d}
     * @category Static
     *
     * @returns A new {@link Mat2d}
     */
    static create(): Mat2d;
    /**
     * Creates a new {@link Mat2d} initialized with values from an existing matrix
     * @category Static
     *
     * @param a - Matrix to clone
     * @returns A new {@link Mat2d}
     */
    static clone(a: Readonly<Mat2dLike>): Mat2d;
    /**
     * Copy the values from one {@link Mat2d} to another
     * @category Static
     *
     * @param out - The receiving Matrix
     * @param a - Matrix to copy
     * @returns `out`
     */
    static copy(out: Mat2dLike, a: Readonly<Mat2dLike>): Mat2dLike;
    /**
     * Create a new {@link Mat2d} with the given values
     * @category Static
     *
     * @param values - Matrix components
     * @returns A new {@link Mat2d}
     */
    static fromValues(...values: number[]): Mat2d;
    /**
     * Set the components of a {@link Mat2d} to the given values
     * @category Static
     *
     * @param out - The receiving matrix
     * @param values - Matrix components
     * @returns `out`
     */
    static set(out: Mat2dLike, ...values: number[]): Mat2dLike;
    /**
     * Set a {@link Mat2d} to the identity matrix
     * @category Static
     *
     * @param out - The receiving matrix
     * @returns `out`
     */
    static identity(out: Mat2dLike): Mat2dLike;
    /**
     * Inverts a {@link Mat2d}
     * @category Static
     *
     * @param out - the receiving matrix
     * @param a - the source matrix
     * @returns `out` or `null` if the matrix is not invertable
     */
    static invert(out: Mat2dLike, a: Mat2dLike): Mat2dLike | null;
    /**
     * Calculates the determinant of a {@link Mat2d}
     * @category Static
     *
     * @param a - the source matrix
     * @returns determinant of a
     */
    static determinant(a: Readonly<Mat2dLike>): number;
    /**
     * Adds two {@link Mat2d}'s
     * @category Static
     *
     * @param out - the receiving matrix
     * @param a - the first operand
     * @param b - the second operand
     * @returns `out`
     */
    static add(out: Mat2dLike, a: Readonly<Mat2dLike>, b: Readonly<Mat2dLike>): Mat2dLike;
    /**
     * Subtracts matrix b from matrix a
     * @category Static
     *
     * @param out - the receiving matrix
     * @param a - the first operand
     * @param b - the second operand
     * @returns `out`
     */
    static subtract(out: Mat2dLike, a: Readonly<Mat2dLike>, b: Readonly<Mat2dLike>): Mat2dLike;
    /**
     * Alias for {@link Mat2d.subtract}
     * @category Static
     */
    static sub(out: Mat2dLike, a: Readonly<Mat2dLike>, b: Readonly<Mat2dLike>): Mat2dLike;
    /**
     * Multiplies two {@link Mat2d}s
     * @category Static
     *
     * @param out - The receiving Matrix
     * @param a - The first operand
     * @param b - The second operand
     * @returns `out`
     */
    static multiply(out: Mat2dLike, a: Readonly<Mat2dLike>, b: Readonly<Mat2dLike>): Mat2dLike;
    /**
     * Alias for {@link Mat2d.multiply}
     * @category Static
     */
    static mul(out: Mat2dLike, a: Readonly<Mat2dLike>, b: Readonly<Mat2dLike>): Mat2dLike;
    /**
     * Translate a {@link Mat2d} by the given vector
     * @category Static
     *
     * @param out - the receiving matrix
     * @param a - the matrix to translate
     * @param v - vector to translate by
     * @returns `out`
     */
    static translate(out: Mat2dLike, a: Readonly<Mat2dLike>, v: Readonly<Vec2Like>): Mat2dLike;
    /**
     * Rotates a {@link Mat2d} by the given angle
     * @category Static
     *
     * @param out - the receiving matrix
     * @param a - the matrix to rotate
     * @param rad - the angle to rotate the matrix by
     * @returns `out`
     */
    static rotate(out: Mat2dLike, a: Readonly<Mat2dLike>, rad: number): Mat2dLike;
    /**
     * Scales the {@link Mat2d} by the dimensions in the given {@link Vec2}
     * @category Static
     *
     * @param out - the receiving matrix
     * @param a - the matrix to scale
     * @param v - the {@link Vec2} to scale the matrix by
     * @returns `out`
     **/
    static scale(out: Mat2dLike, a: Readonly<Mat2dLike>, v: Readonly<Vec2Like>): Mat2dLike;
    /**
     * Creates a {@link Mat2d} from a vector translation
     * This is equivalent to (but much faster than):
     *
     *     Mat2d.identity(dest);
     *     Mat2d.translate(dest, dest, vec);
     * @category Static
     *
     * @param out - {@link Mat2d} receiving operation result
     * @param v - Translation vector
     * @returns `out`
     */
    static fromTranslation(out: Mat2dLike, v: Readonly<Vec2Like>): Mat2dLike;
    /**
     * Creates a {@link Mat2d} from a given angle around a given axis
     * This is equivalent to (but much faster than):
     *
     *     Mat2d.identity(dest);
     *     Mat2d.rotate(dest, dest, rad);
     * @category Static
     *
     * @param out - {@link Mat2d} receiving operation result
     * @param rad - the angle to rotate the matrix by
     * @returns `out`
     */
    static fromRotation(out: Mat2dLike, rad: number): Mat2dLike;
    /**
     * Creates a {@link Mat2d} from a vector scaling
     * This is equivalent to (but much faster than):
     *
     *     Mat2d.identity(dest);
     *     Mat2d.scale(dest, dest, vec);
     * @category Static
     *
     * @param out - {@link Mat2d} receiving operation result
     * @param v - Scaling vector
     * @returns `out`
     */
    static fromScaling(out: Mat2dLike, v: Readonly<Vec2Like>): Mat2dLike;
    /**
     * Returns Frobenius norm of a {@link Mat2d}
     * @category Static
     *
     * @param a - the matrix to calculate Frobenius norm of
     * @returns Frobenius norm
     */
    static frob(a: Readonly<Mat2dLike>): number;
    /**
     * Multiply each element of a {@link Mat2d} by a scalar.
     * @category Static
     *
     * @param out - the receiving matrix
     * @param a - the matrix to scale
     * @param b - amount to scale the matrix's elements by
     * @returns `out`
     */
    static multiplyScalar(out: Mat2dLike, a: Readonly<Mat2dLike>, b: number): Mat2dLike;
    /**
     * Adds two {@link Mat2d}'s after multiplying each element of the second operand by a scalar value.
     * @category Static
     *
     * @param out - the receiving vector
     * @param a - the first operand
     * @param b - the second operand
     * @param scale - the amount to scale b's elements by before adding
     * @returns `out`
     */
    static multiplyScalarAndAdd(out: Mat2dLike, a: Readonly<Mat2dLike>, b: Readonly<Mat2dLike>, scale: number): Mat2dLike;
    /**
     * Returns whether or not two {@link Mat2d}s have exactly the same elements in the same position (when compared with ===)
     * @category Static
     *
     * @param a - The first matrix.
     * @param b - The second matrix.
     * @returns True if the matrices are equal, false otherwise.
     */
    static exactEquals(a: Readonly<Mat2dLike>, b: Readonly<Mat2dLike>): boolean;
    /**
     * Returns whether or not two {@link Mat2d}s have approximately the same elements in the same position.
     * @category Static
     *
     * @param a - The first matrix.
     * @param b - The second matrix.
     * @returns True if the matrices are equal, false otherwise.
     */
    static equals(a: Readonly<Mat2dLike>, b: Readonly<Mat2dLike>): boolean;
    /**
     * Returns a string representation of a {@link Mat2d}
     * @category Static
     *
     * @param a - matrix to represent as a string
     * @returns string representation of the matrix
     */
    static str(a: Readonly<Mat2dLike>): string;
}
/**
 * {@link Mat2d} alias for backwards compatibility
 */
export declare const mat2d: typeof Mat2d;
