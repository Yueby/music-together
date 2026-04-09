import { FloatArray } from './common.js';
import { Vec3Like } from './vec3.js';
import { QuatLike } from './quat.js';
import { Quat2Like } from './quat2.js';
/**
 * A 4x4 Matrix given as a {@link Mat4}, a 16-element floating point TypedArray,
 * or an array of 16 numbers.
 */
export type Mat4Like = [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
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
 * A 4x4 Matrix
 */
export declare class Mat4 extends Float32Array {
    /**
     * The number of bytes in a {@link Mat4}.
     */
    static readonly BYTE_LENGTH: number;
    /**
     * Create a {@link Mat4}.
     */
    constructor(...values: [Readonly<Mat4Like> | ArrayBufferLike, number?] | number[]);
    /**
     * A string representation of `this`
     * Equivalent to `Mat4.str(this);`
     */
    get str(): string;
    /**
     * Copy the values from another {@link Mat4} into `this`.
     *
     * @param a the source vector
     * @returns `this`
     */
    copy(a: Readonly<Mat4Like>): Mat4;
    /**
     * Set `this` to the identity matrix
     * Equivalent to Mat4.identity(this)
     *
     * @returns `this`
     */
    identity(): Mat4;
    /**
     * Multiplies this {@link Mat4} against another one
     * Equivalent to `Mat4.multiply(this, this, b);`
     *
     * @param out - The receiving Matrix
     * @param a - The first operand
     * @param b - The second operand
     * @returns `this`
     */
    multiply(b: Readonly<Mat4Like>): Mat4;
    /**
     * Alias for {@link Mat4.multiply}
     */
    mul(b: Readonly<Mat4Like>): Mat4;
    /**
     * Transpose this {@link Mat4}
     * Equivalent to `Mat4.transpose(this, this);`
     *
     * @returns `this`
     */
    transpose(): Mat4;
    /**
     * Inverts this {@link Mat4}
     * Equivalent to `Mat4.invert(this, this);`
     *
     * @returns `this`
     */
    invert(): Mat4;
    /**
     * Translate this {@link Mat4} by the given vector
     * Equivalent to `Mat4.translate(this, this, v);`
     *
     * @param v - The {@link Vec3} to translate by
     * @returns `this`
     */
    translate(v: Readonly<Vec3Like>): Mat4;
    /**
     * Rotates this {@link Mat4} by the given angle around the given axis
     * Equivalent to `Mat4.rotate(this, this, rad, axis);`
     *
     * @param rad - the angle to rotate the matrix by
     * @param axis - the axis to rotate around
     * @returns `out`
     */
    rotate(rad: number, axis: Readonly<Vec3Like>): Mat4;
    /**
     * Scales this {@link Mat4} by the dimensions in the given vec3 not using vectorization
     * Equivalent to `Mat4.scale(this, this, v);`
     *
     * @param v - The {@link Vec3} to scale the matrix by
     * @returns `this`
     */
    scale(v: Readonly<Vec3Like>): Mat4;
    /**
     * Rotates this {@link Mat4} by the given angle around the X axis
     * Equivalent to `Mat4.rotateX(this, this, rad);`
     *
     * @param rad - the angle to rotate the matrix by
     * @returns `this`
     */
    rotateX(rad: number): Mat4;
    /**
     * Rotates this {@link Mat4} by the given angle around the Y axis
     * Equivalent to `Mat4.rotateY(this, this, rad);`
     *
     * @param rad - the angle to rotate the matrix by
     * @returns `this`
     */
    rotateY(rad: number): Mat4;
    /**
     * Rotates this {@link Mat4} by the given angle around the Z axis
     * Equivalent to `Mat4.rotateZ(this, this, rad);`
     *
     * @param rad - the angle to rotate the matrix by
     * @returns `this`
     */
    rotateZ(rad: number): Mat4;
    /**
     * Generates a perspective projection matrix with the given bounds.
     * The near/far clip planes correspond to a normalized device coordinate Z range of [-1, 1],
     * which matches WebGL/OpenGL's clip volume.
     * Passing null/undefined/no value for far will generate infinite projection matrix.
     * Equivalent to `Mat4.perspectiveNO(this, fovy, aspect, near, far);`
     *
     * @param fovy - Vertical field of view in radians
     * @param aspect - Aspect ratio. typically viewport width/height
     * @param near - Near bound of the frustum
     * @param far - Far bound of the frustum, can be null or Infinity
     * @returns `this`
     */
    perspectiveNO(fovy: number, aspect: number, near: number, far: number): Mat4;
    /**
     * Generates a perspective projection matrix suitable for WebGPU with the given bounds.
     * The near/far clip planes correspond to a normalized device coordinate Z range of [0, 1],
     * which matches WebGPU/Vulkan/DirectX/Metal's clip volume.
     * Passing null/undefined/no value for far will generate infinite projection matrix.
     * Equivalent to `Mat4.perspectiveZO(this, fovy, aspect, near, far);`
     *
     * @param fovy - Vertical field of view in radians
     * @param aspect - Aspect ratio. typically viewport width/height
     * @param near - Near bound of the frustum
     * @param far - Far bound of the frustum, can be null or Infinity
     * @returns `this`
     */
    perspectiveZO(fovy: number, aspect: number, near: number, far: number): Mat4;
    /**
     * Generates a orthogonal projection matrix with the given bounds.
     * The near/far clip planes correspond to a normalized device coordinate Z range of [-1, 1],
     * which matches WebGL/OpenGL's clip volume.
     * Equivalent to `Mat4.orthoNO(this, left, right, bottom, top, near, far);`
     *
     * @param left - Left bound of the frustum
     * @param right - Right bound of the frustum
     * @param bottom - Bottom bound of the frustum
     * @param top - Top bound of the frustum
     * @param near - Near bound of the frustum
     * @param far - Far bound of the frustum
     * @returns `this`
     */
    orthoNO(left: number, right: number, bottom: number, top: number, near: number, far: number): Mat4;
    /**
     * Generates a orthogonal projection matrix with the given bounds.
     * The near/far clip planes correspond to a normalized device coordinate Z range of [0, 1],
     * which matches WebGPU/Vulkan/DirectX/Metal's clip volume.
     * Equivalent to `Mat4.orthoZO(this, left, right, bottom, top, near, far);`
     *
     * @param left - Left bound of the frustum
     * @param right - Right bound of the frustum
     * @param bottom - Bottom bound of the frustum
     * @param top - Top bound of the frustum
     * @param near - Near bound of the frustum
     * @param far - Far bound of the frustum
     * @returns `this`
     */
    orthoZO(left: number, right: number, bottom: number, top: number, near: number, far: number): Mat4;
    /**
     * Creates a new, identity {@link Mat4}
     * @category Static
     *
     * @returns A new {@link Mat4}
     */
    static create(): Mat4;
    /**
     * Creates a new {@link Mat4} initialized with values from an existing matrix
     * @category Static
     *
     * @param a - Matrix to clone
     * @returns A new {@link Mat4}
     */
    static clone(a: Readonly<Mat4Like>): Mat4;
    /**
     * Copy the values from one {@link Mat4} to another
     * @category Static
     *
     * @param out - The receiving Matrix
     * @param a - Matrix to copy
     * @returns `out`
     */
    static copy(out: Mat4Like, a: Readonly<Mat4Like>): Mat4Like;
    /**
     * Create a new mat4 with the given values
     * @category Static
     *
     * @param values - Matrix components
     * @returns A new {@link Mat4}
     */
    static fromValues(...values: number[]): Mat4;
    /**
     * Set the components of a mat4 to the given values
     * @category Static
     *
     * @param out - The receiving matrix
     * @param values - Matrix components
     * @returns `out`
     */
    static set(out: Mat4Like, ...values: number[]): Mat4Like;
    /**
     * Set a {@link Mat4} to the identity matrix
     * @category Static
     *
     * @param out - The receiving Matrix
     * @returns `out`
     */
    static identity(out: Mat4Like): Mat4Like;
    /**
     * Transpose the values of a {@link Mat4}
     * @category Static
     *
     * @param out - the receiving matrix
     * @param a - the source matrix
     * @returns `out`
     */
    static transpose(out: Mat4Like, a: Readonly<Mat4Like>): Mat4Like;
    /**
     * Inverts a {@link Mat4}
     * @category Static
     *
     * @param out - the receiving matrix
     * @param a - the source matrix
     * @returns `out` or `null` if the matrix is not invertable
     */
    static invert(out: Mat4Like, a: Mat4Like): Mat4Like | null;
    /**
     * Calculates the adjugate of a {@link Mat4}
     * @category Static
     *
     * @param out - the receiving matrix
     * @param a - the source matrix
     * @returns `out`
     */
    static adjoint(out: Mat4Like, a: Mat4Like): Mat4Like;
    /**
     * Calculates the determinant of a {@link Mat4}
     * @category Static
     *
     * @param a - the source matrix
     * @returns determinant of a
     */
    static determinant(a: Readonly<Mat4Like>): number;
    /**
     * Multiplies two {@link Mat4}s
     * @category Static
     *
     * @param out - The receiving Matrix
     * @param a - The first operand
     * @param b - The second operand
     * @returns `out`
     */
    static multiply(out: Mat4Like, a: Readonly<Mat4Like>, b: Readonly<Mat4Like>): Mat4Like;
    /**
     * Alias for {@link Mat4.multiply}
     * @category Static
     */
    static mul(out: Mat4Like, a: Readonly<Mat4Like>, b: Readonly<Mat4Like>): Mat4Like;
    /**
     * Translate a {@link Mat4} by the given vector
     * @category Static
     *
     * @param out - the receiving matrix
     * @param a - the matrix to translate
     * @param v - vector to translate by
     * @returns `out`
     */
    static translate(out: Mat4Like, a: Readonly<Mat4Like>, v: Readonly<Vec3Like>): Mat4Like;
    /**
     * Scales the {@link Mat4} by the dimensions in the given {@link Vec3} not using vectorization
     * @category Static
     *
     * @param out - the receiving matrix
     * @param a - the matrix to scale
     * @param v - the {@link Vec3} to scale the matrix by
     * @returns `out`
     **/
    static scale(out: Mat4Like, a: Readonly<Mat4Like>, v: Readonly<Vec3Like>): Mat4Like;
    /**
     * Rotates a {@link Mat4} by the given angle around the given axis
     * @category Static
     *
     * @param out - the receiving matrix
     * @param a - the matrix to rotate
     * @param rad - the angle to rotate the matrix by
     * @param axis - the axis to rotate around
     * @returns `out` or `null` if axis has a length of 0
     */
    static rotate(out: Mat4Like, a: Readonly<Mat4Like>, rad: number, axis: Readonly<Vec3Like>): Mat4Like | null;
    /**
     * Rotates a matrix by the given angle around the X axis
     * @category Static
     *
     * @param out - the receiving matrix
     * @param a - the matrix to rotate
     * @param rad - the angle to rotate the matrix by
     * @returns `out`
     */
    static rotateX(out: Mat4Like, a: Readonly<Mat4Like>, rad: number): Mat4Like;
    /**
     * Rotates a matrix by the given angle around the Y axis
     * @category Static
     *
     * @param out - the receiving matrix
     * @param a - the matrix to rotate
     * @param rad - the angle to rotate the matrix by
     * @returns `out`
     */
    static rotateY(out: Mat4Like, a: Readonly<Mat4Like>, rad: number): Mat4Like;
    /**
     * Rotates a matrix by the given angle around the Z axis
     * @category Static
     *
     * @param out - the receiving matrix
     * @param a - the matrix to rotate
     * @param rad - the angle to rotate the matrix by
     * @returns `out`
     */
    static rotateZ(out: Mat4Like, a: Readonly<Mat4Like>, rad: number): Mat4Like;
    /**
     * Creates a {@link Mat4} from a vector translation
     * This is equivalent to (but much faster than):
     *
     *     mat4.identity(dest);
     *     mat4.translate(dest, dest, vec);
     * @category Static
     *
     * @param out - {@link Mat4} receiving operation result
     * @param v - Translation vector
     * @returns `out`
     */
    static fromTranslation(out: Mat4Like, v: Readonly<Vec3Like>): Mat4Like;
    /**
     * Creates a {@link Mat4} from a vector scaling
     * This is equivalent to (but much faster than):
     *
     *     mat4.identity(dest);
     *     mat4.scale(dest, dest, vec);
     * @category Static
     *
     * @param out - {@link Mat4} receiving operation result
     * @param v - Scaling vector
     * @returns `out`
     */
    static fromScaling(out: Mat4Like, v: Readonly<Vec3Like>): Mat4Like;
    /**
     * Creates a {@link Mat4} from a given angle around a given axis
     * This is equivalent to (but much faster than):
     *
     *     mat4.identity(dest);
     *     mat4.rotate(dest, dest, rad, axis);
     * @category Static
     *
     * @param out - {@link Mat4} receiving operation result
     * @param rad - the angle to rotate the matrix by
     * @param axis - the axis to rotate around
     * @returns `out` or `null` if `axis` has a length of 0
     */
    static fromRotation(out: Mat4Like, rad: number, axis: Readonly<Vec3Like>): Mat4Like | null;
    /**
     * Creates a matrix from the given angle around the X axis
     * This is equivalent to (but much faster than):
     *
     *     mat4.identity(dest);
     *     mat4.rotateX(dest, dest, rad);
     * @category Static
     *
     * @param out - mat4 receiving operation result
     * @param rad - the angle to rotate the matrix by
     * @returns `out`
     */
    static fromXRotation(out: Mat4Like, rad: number): Mat4Like;
    /**
     * Creates a matrix from the given angle around the Y axis
     * This is equivalent to (but much faster than):
     *
     *     mat4.identity(dest);
     *     mat4.rotateY(dest, dest, rad);
     * @category Static
     *
     * @param out - mat4 receiving operation result
     * @param rad - the angle to rotate the matrix by
     * @returns `out`
     */
    static fromYRotation(out: Mat4Like, rad: number): Mat4Like;
    /**
     * Creates a matrix from the given angle around the Z axis
     * This is equivalent to (but much faster than):
     *
     *     mat4.identity(dest);
     *     mat4.rotateZ(dest, dest, rad);
     * @category Static
     *
     * @param out - mat4 receiving operation result
     * @param rad - the angle to rotate the matrix by
     * @returns `out`
     */
    static fromZRotation(out: Mat4Like, rad: number): Mat4Like;
    /**
     * Creates a matrix from a quaternion rotation and vector translation
     * This is equivalent to (but much faster than):
     *
     *     mat4.identity(dest);
     *     mat4.translate(dest, vec);
     *     let quatMat = mat4.create();
     *     quat4.toMat4(quat, quatMat);
     *     mat4.multiply(dest, quatMat);
     * @category Static
     *
     * @param out - mat4 receiving operation result
     * @param q - Rotation quaternion
     * @param v - Translation vector
     * @returns `out`
     */
    static fromRotationTranslation(out: Mat4Like, q: Readonly<QuatLike>, v: Readonly<Vec3Like>): Mat4Like;
    /**
     * Sets a {@link Mat4} from a {@link Quat2}.
     * @category Static
     *
     * @param out - Matrix
     * @param a - Dual Quaternion
     * @returns `out`
     */
    static fromQuat2(out: Mat4Like, a: Quat2Like): Mat4Like;
    /**
     * Calculates a {@link Mat4} normal matrix (transpose inverse) from a {@link Mat4}
     * @category Static
     *
     * @param out - Matrix receiving operation result
     * @param a - Mat4 to derive the normal matrix from
     * @returns `out` or `null` if the matrix is not invertable
     */
    static normalFromMat4(out: Mat4Like, a: Readonly<Mat4Like>): Mat4Like | null;
    /**
     * Calculates a {@link Mat4} normal matrix (transpose inverse) from a {@link Mat4}
     * This version omits the calculation of the constant factor (1/determinant), so
     * any normals transformed with it will need to be renormalized.
     * From https://stackoverflow.com/a/27616419/25968
     * @category Static
     *
     * @param out - Matrix receiving operation result
     * @param a - Mat4 to derive the normal matrix from
     * @returns `out`
     */
    static normalFromMat4Fast(out: Mat4Like, a: Readonly<Mat4Like>): Mat4Like;
    /**
     * Returns the translation vector component of a transformation
     * matrix. If a matrix is built with fromRotationTranslation,
     * the returned vector will be the same as the translation vector
     * originally supplied.
     * @category Static
     *
     * @param  {vec3} out Vector to receive translation component
     * @param  {ReadonlyMat4} mat Matrix to be decomposed (input)
     * @return {vec3} out
     */
    static getTranslation(out: Vec3Like, mat: Readonly<Mat4Like>): Vec3Like;
    /**
     * Returns the scaling factor component of a transformation
     * matrix. If a matrix is built with fromRotationTranslationScale
     * with a normalized Quaternion parameter, the returned vector will be
     * the same as the scaling vector
     * originally supplied.
     * @category Static
     *
     * @param  {vec3} out Vector to receive scaling factor component
     * @param  {ReadonlyMat4} mat Matrix to be decomposed (input)
     * @return {vec3} out
     */
    static getScaling(out: Vec3Like, mat: Readonly<Mat4Like>): Vec3Like;
    /**
     * Returns a quaternion representing the rotational component
     * of a transformation matrix. If a matrix is built with
     * fromRotationTranslation, the returned quaternion will be the
     * same as the quaternion originally supplied.
     * @category Static
     *
     * @param out - Quaternion to receive the rotation component
     * @param mat - Matrix to be decomposed (input)
     * @return `out`
     */
    static getRotation(out: QuatLike, mat: Readonly<Mat4Like>): QuatLike;
    /**
     * Decomposes a transformation matrix into its rotation, translation
     * and scale components. Returns only the rotation component
     * @category Static
     *
     * @param out_r - Quaternion to receive the rotation component
     * @param out_t - Vector to receive the translation vector
     * @param out_s - Vector to receive the scaling factor
     * @param mat - Matrix to be decomposed (input)
     * @returns `out_r`
     */
    static decompose(out_r: QuatLike, out_t: Vec3Like, out_s: Vec3Like, mat: Readonly<Mat4Like>): QuatLike;
    /**
     * Creates a matrix from a quaternion rotation, vector translation and vector scale
     * This is equivalent to (but much faster than):
     *
     *     mat4.identity(dest);
     *     mat4.translate(dest, vec);
     *     let quatMat = mat4.create();
     *     quat4.toMat4(quat, quatMat);
     *     mat4.multiply(dest, quatMat);
     *     mat4.scale(dest, scale);
     * @category Static
     *
     * @param out - mat4 receiving operation result
     * @param q - Rotation quaternion
     * @param v - Translation vector
     * @param s - Scaling vector
     * @returns `out`
     */
    static fromRotationTranslationScale(out: Mat4Like, q: Readonly<QuatLike>, v: Readonly<Vec3Like>, s: Readonly<Vec3Like>): Mat4Like;
    /**
     * Creates a matrix from a quaternion rotation, vector translation and vector scale, rotating and scaling around the given origin
     * This is equivalent to (but much faster than):
     *
     *     mat4.identity(dest);
     *     mat4.translate(dest, vec);
     *     mat4.translate(dest, origin);
     *     let quatMat = mat4.create();
     *     quat4.toMat4(quat, quatMat);
     *     mat4.multiply(dest, quatMat);
     *     mat4.scale(dest, scale)
     *     mat4.translate(dest, negativeOrigin);
     * @category Static
     *
     * @param out - mat4 receiving operation result
     * @param q - Rotation quaternion
     * @param v - Translation vector
     * @param s - Scaling vector
     * @param o - The origin vector around which to scale and rotate
     * @returns `out`
     */
    static fromRotationTranslationScaleOrigin(out: Mat4Like, q: Readonly<QuatLike>, v: Readonly<Vec3Like>, s: Readonly<Vec3Like>, o: Readonly<Vec3Like>): Mat4Like;
    /**
     * Calculates a 4x4 matrix from the given quaternion
     * @category Static
     *
     * @param out - mat4 receiving operation result
     * @param q - Quaternion to create matrix from
     * @returns `out`
     */
    static fromQuat(out: Mat4Like, q: Readonly<QuatLike>): Mat4Like;
    /**
     * Generates a frustum matrix with the given bounds
     * The near/far clip planes correspond to a normalized device coordinate Z range of [-1, 1],
     * which matches WebGL/OpenGL's clip volume.
     * Passing null/undefined/no value for far will generate infinite projection matrix.
     * @category Static
     *
     * @param out - mat4 frustum matrix will be written into
     * @param left - Left bound of the frustum
     * @param right - Right bound of the frustum
     * @param bottom - Bottom bound of the frustum
     * @param top - Top bound of the frustum
     * @param near - Near bound of the frustum
     * @param far -  Far bound of the frustum, can be null or Infinity
     * @returns `out`
     */
    static frustumNO(out: Mat4Like, left: number, right: number, bottom: number, top: number, near: number, far?: number): Mat4Like;
    /**
     * Alias for {@link Mat4.frustumNO}
     * @category Static
     * @deprecated Use {@link Mat4.frustumNO} or {@link Mat4.frustumZO} explicitly
     */
    static frustum(out: Mat4Like, left: number, right: number, bottom: number, top: number, near: number, far?: number): Mat4Like;
    /**
     * Generates a frustum matrix with the given bounds
     * The near/far clip planes correspond to a normalized device coordinate Z range of [0, 1],
     * which matches WebGPU/Vulkan/DirectX/Metal's clip volume.
     * Passing null/undefined/no value for far will generate infinite projection matrix.
     * @category Static
     *
     * @param out - mat4 frustum matrix will be written into
     * @param left - Left bound of the frustum
     * @param right - Right bound of the frustum
     * @param bottom - Bottom bound of the frustum
     * @param top - Top bound of the frustum
     * @param near - Near bound of the frustum
     * @param far - Far bound of the frustum, can be null or Infinity
     * @returns `out`
     */
    static frustumZO(out: Mat4Like, left: number, right: number, bottom: number, top: number, near: number, far?: number): Mat4Like;
    /**
     * Generates a perspective projection matrix with the given bounds.
     * The near/far clip planes correspond to a normalized device coordinate Z range of [-1, 1],
     * which matches WebGL/OpenGL's clip volume.
     * Passing null/undefined/no value for far will generate infinite projection matrix.
     * @category Static
     *
     * @param out - mat4 frustum matrix will be written into
     * @param fovy - Vertical field of view in radians
     * @param aspect - Aspect ratio. typically viewport width/height
     * @param near - Near bound of the frustum
     * @param far - Far bound of the frustum, can be null or Infinity
     * @returns `out`
     */
    static perspectiveNO(out: Mat4Like, fovy: number, aspect: number, near: number, far?: number): Mat4Like;
    /**
     * Alias for {@link Mat4.perspectiveNO}
     * @category Static
     * @deprecated Use {@link Mat4.perspectiveNO} or {@link Mat4.perspectiveZO} explicitly
     */
    static perspective(out: Mat4Like, fovy: number, aspect: number, near: number, far?: number): Mat4Like;
    /**
     * Generates a perspective projection matrix suitable for WebGPU with the given bounds.
     * The near/far clip planes correspond to a normalized device coordinate Z range of [0, 1],
     * which matches WebGPU/Vulkan/DirectX/Metal's clip volume.
     * Passing null/undefined/no value for far will generate infinite projection matrix.
     * @category Static
     *
     * @param out - mat4 frustum matrix will be written into
     * @param fovy - Vertical field of view in radians
     * @param aspect - Aspect ratio. typically viewport width/height
     * @param near - Near bound of the frustum
     * @param far - Far bound of the frustum, can be null or Infinity
     * @returns `out`
     */
    static perspectiveZO(out: Mat4Like, fovy: number, aspect: number, near: number, far?: number): Mat4Like;
    /**
     * Generates a perspective projection matrix with the given field of view.
     * This is primarily useful for generating projection matrices to be used
     * with the still experiemental WebVR API.
     * @category Static
     *
     * @param out - mat4 frustum matrix will be written into
     * @param fov - Object containing the following values: upDegrees, downDegrees, leftDegrees, rightDegrees
     * @param near - Near bound of the frustum
     * @param far - Far bound of the frustum
     * @returns `out`
     * @deprecated
     */
    static perspectiveFromFieldOfView(out: Mat4Like, fov: any, near: number, far: number): Mat4Like;
    /**
     * Generates a orthogonal projection matrix with the given bounds.
     * The near/far clip planes correspond to a normalized device coordinate Z range of [-1, 1],
     * which matches WebGL/OpenGL's clip volume.
     * @category Static
     *
     * @param out - mat4 frustum matrix will be written into
     * @param left - Left bound of the frustum
     * @param right - Right bound of the frustum
     * @param bottom - Bottom bound of the frustum
     * @param top - Top bound of the frustum
     * @param near - Near bound of the frustum
     * @param far - Far bound of the frustum
     * @returns `out`
     */
    static orthoNO(out: Mat4Like, left: number, right: number, bottom: number, top: number, near: number, far: number): Mat4Like;
    /**
     * Alias for {@link Mat4.orthoNO}
     * @category Static
     * @deprecated Use {@link Mat4.orthoNO} or {@link Mat4.orthoZO} explicitly
     */
    static ortho(out: Mat4Like, left: number, right: number, bottom: number, top: number, near: number, far: number): Mat4Like;
    /**
     * Generates a orthogonal projection matrix with the given bounds.
     * The near/far clip planes correspond to a normalized device coordinate Z range of [0, 1],
     * which matches WebGPU/Vulkan/DirectX/Metal's clip volume.
     * @category Static
     *
     * @param out - mat4 frustum matrix will be written into
     * @param left - Left bound of the frustum
     * @param right - Right bound of the frustum
     * @param bottom - Bottom bound of the frustum
     * @param top - Top bound of the frustum
     * @param near - Near bound of the frustum
     * @param far - Far bound of the frustum
     * @returns `out`
     */
    static orthoZO(out: Mat4Like, left: number, right: number, bottom: number, top: number, near: number, far: number): Mat4Like;
    /**
     * Generates a look-at matrix with the given eye position, focal point, and up axis.
     * If you want a matrix that actually makes an object look at another object, you should use targetTo instead.
     * @category Static
     *
     * @param out - mat4 frustum matrix will be written into
     * @param eye - Position of the viewer
     * @param center - Point the viewer is looking at
     * @param up - vec3 pointing up
     * @returns `out`
     */
    static lookAt(out: Mat4Like, eye: Readonly<Vec3Like>, center: Readonly<Vec3Like>, up: Readonly<Vec3Like>): Mat4Like;
    /**
     * Generates a matrix that makes something look at something else.
     * @category Static
     *
     * @param out - mat4 frustum matrix will be written into
     * @param eye - Position of the viewer
     * @param target - Point the viewer is looking at
     * @param up - vec3 pointing up
     * @returns `out`
     */
    static targetTo(out: Mat4Like, eye: Readonly<Vec3Like>, target: Readonly<Vec3Like>, up: Readonly<Vec3Like>): Mat4Like;
    /**
     * Returns Frobenius norm of a {@link Mat4}
     * @category Static
     *
     * @param a - the matrix to calculate Frobenius norm of
     * @returns Frobenius norm
     */
    static frob(a: Readonly<Mat4Like>): number;
    /**
     * Adds two {@link Mat4}'s
     * @category Static
     *
     * @param out - the receiving matrix
     * @param a - the first operand
     * @param b - the second operand
     * @returns `out`
     */
    static add(out: Mat4Like, a: Readonly<Mat4Like>, b: Readonly<Mat4Like>): Mat4Like;
    /**
     * Subtracts matrix b from matrix a
     * @category Static
     *
     * @param out - the receiving matrix
     * @param a - the first operand
     * @param b - the second operand
     * @returns `out`
     */
    static subtract(out: Mat4Like, a: Readonly<Mat4Like>, b: Readonly<Mat4Like>): Mat4Like;
    /**
     * Alias for {@link Mat4.subtract}
     * @category Static
     */
    static sub(out: Mat4Like, a: Readonly<Mat4Like>, b: Readonly<Mat4Like>): Mat4Like;
    /**
     * Multiply each element of the matrix by a scalar.
     * @category Static
     *
     * @param out - the receiving matrix
     * @param a - the matrix to scale
     * @param b - amount to scale the matrix's elements by
     * @returns `out`
     */
    static multiplyScalar(out: Mat4Like, a: Readonly<Mat4Like>, b: number): Mat4Like;
    /**
     * Adds two mat4's after multiplying each element of the second operand by a scalar value.
     * @category Static
     *
     * @param out - the receiving vector
     * @param a - the first operand
     * @param b - the second operand
     * @param scale - the amount to scale b's elements by before adding
     * @returns `out`
     */
    static multiplyScalarAndAdd(out: Mat4Like, a: Readonly<Mat4Like>, b: Readonly<Mat4Like>, scale: number): Mat4Like;
    /**
     * Returns whether or not two {@link Mat4}s have exactly the same elements in the same position (when compared with ===)
     * @category Static
     *
     * @param a - The first matrix.
     * @param b - The second matrix.
     * @returns True if the matrices are equal, false otherwise.
     */
    static exactEquals(a: Readonly<Mat4Like>, b: Readonly<Mat4Like>): boolean;
    /**
     * Returns whether or not two {@link Mat4}s have approximately the same elements in the same position.
     * @category Static
     *
     * @param a - The first matrix.
     * @param b - The second matrix.
     * @returns True if the matrices are equal, false otherwise.
     */
    static equals(a: Readonly<Mat4Like>, b: Readonly<Mat4Like>): boolean;
    /**
     * Returns a string representation of a {@link Mat4}
     * @category Static
     *
     * @param a - matrix to represent as a string
     * @returns string representation of the matrix
     */
    static str(a: Readonly<Mat4Like>): string;
}
/**
 * Mat4 alias for backwards compatibility
 */
export declare const mat4: typeof Mat4;
