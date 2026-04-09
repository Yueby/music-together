import { Application as ue } from "@pixi/app";
import { Texture as ge } from "@pixi/core";
import { Container as ye } from "@pixi/display";
import { BlurFilter as X } from "@pixi/filter-blur";
import { BulgePinchFilter as dt } from "@pixi/filter-bulge-pinch";
import { ColorMatrixFilter as Et } from "@pixi/filter-color-matrix";
import { Sprite as mt } from "@pixi/sprite";
class Le {
}
class te extends Le {
  constructor(t) {
    super(), this.canvas = t, this.observer = new ResizeObserver(() => {
      const e = Math.max(
        1,
        t.clientWidth * window.devicePixelRatio * this.currerntRenderScale
      ), s = Math.max(
        1,
        t.clientHeight * window.devicePixelRatio * this.currerntRenderScale
      );
      this.onResize(e, s);
    }), this.observer.observe(t);
  }
  observer;
  flowSpeed = 4;
  currerntRenderScale = 0.75;
  setRenderScale(t) {
    this.currerntRenderScale = t, this.onResize(
      this.canvas.clientWidth * window.devicePixelRatio * this.currerntRenderScale,
      this.canvas.clientHeight * window.devicePixelRatio * this.currerntRenderScale
    );
  }
  /**
   * 当画板元素大小发生变化时此函数会被调用
   * 可以在此处重设和渲染器相关的尺寸设置
   * 考虑到初始化的时候元素不一定在文档中或出于某些特殊样式状态，尺寸长宽有可能会为 0，请注意进行特判处理
   * @param width 画板元素实际的物理像素宽度，有可能为 0
   * @param height 画板元素实际的物理像素高度，有可能为 0
   */
  onResize(t, e) {
    this.canvas.width = t, this.canvas.height = e;
  }
  /**
   * 修改背景的流动速度，数字越大越快，默认为 4
   * @param speed 背景的流动速度，默认为 4
   */
  setFlowSpeed(t) {
    this.flowSpeed = t;
  }
  dispose() {
    this.observer.disconnect(), this.canvas.remove();
  }
  getElement() {
    return this.canvas;
  }
}
const O = 1e-6, Bt = new Float32Array([
  1,
  0,
  0,
  0,
  0,
  1,
  0,
  0,
  0,
  0,
  1,
  0,
  0,
  0,
  0,
  1
]);
class I extends Float32Array {
  /**
   * The number of bytes in a {@link Mat4}.
   */
  static BYTE_LENGTH = 16 * Float32Array.BYTES_PER_ELEMENT;
  /**
   * Create a {@link Mat4}.
   */
  constructor(...t) {
    switch (t.length) {
      case 16:
        super(t);
        break;
      case 2:
        super(t[0], t[1], 16);
        break;
      case 1:
        const e = t[0];
        typeof e == "number" ? super([
          e,
          e,
          e,
          e,
          e,
          e,
          e,
          e,
          e,
          e,
          e,
          e,
          e,
          e,
          e,
          e
        ]) : super(e, 0, 16);
        break;
      default:
        super(Bt);
        break;
    }
  }
  //============
  // Attributes
  //============
  /**
   * A string representation of `this`
   * Equivalent to `Mat4.str(this);`
   */
  get str() {
    return I.str(this);
  }
  //===================
  // Instance methods
  //===================
  /**
   * Copy the values from another {@link Mat4} into `this`.
   *
   * @param a the source vector
   * @returns `this`
   */
  copy(t) {
    return this.set(t), this;
  }
  /**
   * Set `this` to the identity matrix
   * Equivalent to Mat4.identity(this)
   *
   * @returns `this`
   */
  identity() {
    return this.set(Bt), this;
  }
  /**
   * Multiplies this {@link Mat4} against another one
   * Equivalent to `Mat4.multiply(this, this, b);`
   *
   * @param out - The receiving Matrix
   * @param a - The first operand
   * @param b - The second operand
   * @returns `this`
   */
  multiply(t) {
    return I.multiply(this, this, t);
  }
  /**
   * Alias for {@link Mat4.multiply}
   */
  mul(t) {
    return this;
  }
  /**
   * Transpose this {@link Mat4}
   * Equivalent to `Mat4.transpose(this, this);`
   *
   * @returns `this`
   */
  transpose() {
    return I.transpose(this, this);
  }
  /**
   * Inverts this {@link Mat4}
   * Equivalent to `Mat4.invert(this, this);`
   *
   * @returns `this`
   */
  invert() {
    return I.invert(this, this);
  }
  /**
   * Translate this {@link Mat4} by the given vector
   * Equivalent to `Mat4.translate(this, this, v);`
   *
   * @param v - The {@link Vec3} to translate by
   * @returns `this`
   */
  translate(t) {
    return I.translate(this, this, t);
  }
  /**
   * Rotates this {@link Mat4} by the given angle around the given axis
   * Equivalent to `Mat4.rotate(this, this, rad, axis);`
   *
   * @param rad - the angle to rotate the matrix by
   * @param axis - the axis to rotate around
   * @returns `out`
   */
  rotate(t, e) {
    return I.rotate(this, this, t, e);
  }
  /**
   * Scales this {@link Mat4} by the dimensions in the given vec3 not using vectorization
   * Equivalent to `Mat4.scale(this, this, v);`
   *
   * @param v - The {@link Vec3} to scale the matrix by
   * @returns `this`
   */
  scale(t) {
    return I.scale(this, this, t);
  }
  /**
   * Rotates this {@link Mat4} by the given angle around the X axis
   * Equivalent to `Mat4.rotateX(this, this, rad);`
   *
   * @param rad - the angle to rotate the matrix by
   * @returns `this`
   */
  rotateX(t) {
    return I.rotateX(this, this, t);
  }
  /**
   * Rotates this {@link Mat4} by the given angle around the Y axis
   * Equivalent to `Mat4.rotateY(this, this, rad);`
   *
   * @param rad - the angle to rotate the matrix by
   * @returns `this`
   */
  rotateY(t) {
    return I.rotateY(this, this, t);
  }
  /**
   * Rotates this {@link Mat4} by the given angle around the Z axis
   * Equivalent to `Mat4.rotateZ(this, this, rad);`
   *
   * @param rad - the angle to rotate the matrix by
   * @returns `this`
   */
  rotateZ(t) {
    return I.rotateZ(this, this, t);
  }
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
  perspectiveNO(t, e, s, i) {
    return I.perspectiveNO(this, t, e, s, i);
  }
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
  perspectiveZO(t, e, s, i) {
    return I.perspectiveZO(this, t, e, s, i);
  }
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
  orthoNO(t, e, s, i, n, r) {
    return I.orthoNO(this, t, e, s, i, n, r);
  }
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
  orthoZO(t, e, s, i, n, r) {
    return I.orthoZO(this, t, e, s, i, n, r);
  }
  //================
  // Static methods
  //================
  /**
   * Creates a new, identity {@link Mat4}
   * @category Static
   *
   * @returns A new {@link Mat4}
   */
  static create() {
    return new I();
  }
  /**
   * Creates a new {@link Mat4} initialized with values from an existing matrix
   * @category Static
   *
   * @param a - Matrix to clone
   * @returns A new {@link Mat4}
   */
  static clone(t) {
    return new I(t);
  }
  /**
   * Copy the values from one {@link Mat4} to another
   * @category Static
   *
   * @param out - The receiving Matrix
   * @param a - Matrix to copy
   * @returns `out`
   */
  static copy(t, e) {
    return t[0] = e[0], t[1] = e[1], t[2] = e[2], t[3] = e[3], t[4] = e[4], t[5] = e[5], t[6] = e[6], t[7] = e[7], t[8] = e[8], t[9] = e[9], t[10] = e[10], t[11] = e[11], t[12] = e[12], t[13] = e[13], t[14] = e[14], t[15] = e[15], t;
  }
  /**
   * Create a new mat4 with the given values
   * @category Static
   *
   * @param values - Matrix components
   * @returns A new {@link Mat4}
   */
  static fromValues(...t) {
    return new I(...t);
  }
  /**
   * Set the components of a mat4 to the given values
   * @category Static
   *
   * @param out - The receiving matrix
   * @param values - Matrix components
   * @returns `out`
   */
  static set(t, ...e) {
    return t[0] = e[0], t[1] = e[1], t[2] = e[2], t[3] = e[3], t[4] = e[4], t[5] = e[5], t[6] = e[6], t[7] = e[7], t[8] = e[8], t[9] = e[9], t[10] = e[10], t[11] = e[11], t[12] = e[12], t[13] = e[13], t[14] = e[14], t[15] = e[15], t;
  }
  /**
   * Set a {@link Mat4} to the identity matrix
   * @category Static
   *
   * @param out - The receiving Matrix
   * @returns `out`
   */
  static identity(t) {
    return t[0] = 1, t[1] = 0, t[2] = 0, t[3] = 0, t[4] = 0, t[5] = 1, t[6] = 0, t[7] = 0, t[8] = 0, t[9] = 0, t[10] = 1, t[11] = 0, t[12] = 0, t[13] = 0, t[14] = 0, t[15] = 1, t;
  }
  /**
   * Transpose the values of a {@link Mat4}
   * @category Static
   *
   * @param out - the receiving matrix
   * @param a - the source matrix
   * @returns `out`
   */
  static transpose(t, e) {
    if (t === e) {
      const s = e[1], i = e[2], n = e[3], r = e[6], a = e[7], o = e[11];
      t[1] = e[4], t[2] = e[8], t[3] = e[12], t[4] = s, t[6] = e[9], t[7] = e[13], t[8] = i, t[9] = r, t[11] = e[14], t[12] = n, t[13] = a, t[14] = o;
    } else
      t[0] = e[0], t[1] = e[4], t[2] = e[8], t[3] = e[12], t[4] = e[1], t[5] = e[5], t[6] = e[9], t[7] = e[13], t[8] = e[2], t[9] = e[6], t[10] = e[10], t[11] = e[14], t[12] = e[3], t[13] = e[7], t[14] = e[11], t[15] = e[15];
    return t;
  }
  /**
   * Inverts a {@link Mat4}
   * @category Static
   *
   * @param out - the receiving matrix
   * @param a - the source matrix
   * @returns `out` or `null` if the matrix is not invertable
   */
  static invert(t, e) {
    const s = e[0], i = e[1], n = e[2], r = e[3], a = e[4], o = e[5], l = e[6], c = e[7], h = e[8], m = e[9], u = e[10], f = e[11], g = e[12], p = e[13], y = e[14], L = e[15], x = s * o - i * a, M = s * l - n * a, b = s * c - r * a, w = i * l - n * o, T = i * c - r * o, v = n * c - r * l, P = h * p - m * g, z = h * y - u * g, E = h * L - f * g, F = m * y - u * p, _ = m * L - f * p, R = u * L - f * y;
    let k = x * R - M * _ + b * F + w * E - T * z + v * P;
    return k ? (k = 1 / k, t[0] = (o * R - l * _ + c * F) * k, t[1] = (n * _ - i * R - r * F) * k, t[2] = (p * v - y * T + L * w) * k, t[3] = (u * T - m * v - f * w) * k, t[4] = (l * E - a * R - c * z) * k, t[5] = (s * R - n * E + r * z) * k, t[6] = (y * b - g * v - L * M) * k, t[7] = (h * v - u * b + f * M) * k, t[8] = (a * _ - o * E + c * P) * k, t[9] = (i * E - s * _ - r * P) * k, t[10] = (g * T - p * b + L * x) * k, t[11] = (m * b - h * T - f * x) * k, t[12] = (o * z - a * F - l * P) * k, t[13] = (s * F - i * z + n * P) * k, t[14] = (p * M - g * w - y * x) * k, t[15] = (h * w - m * M + u * x) * k, t) : null;
  }
  /**
   * Calculates the adjugate of a {@link Mat4}
   * @category Static
   *
   * @param out - the receiving matrix
   * @param a - the source matrix
   * @returns `out`
   */
  static adjoint(t, e) {
    const s = e[0], i = e[1], n = e[2], r = e[3], a = e[4], o = e[5], l = e[6], c = e[7], h = e[8], m = e[9], u = e[10], f = e[11], g = e[12], p = e[13], y = e[14], L = e[15], x = s * o - i * a, M = s * l - n * a, b = s * c - r * a, w = i * l - n * o, T = i * c - r * o, v = n * c - r * l, P = h * p - m * g, z = h * y - u * g, E = h * L - f * g, F = m * y - u * p, _ = m * L - f * p, R = u * L - f * y;
    return t[0] = o * R - l * _ + c * F, t[1] = n * _ - i * R - r * F, t[2] = p * v - y * T + L * w, t[3] = u * T - m * v - f * w, t[4] = l * E - a * R - c * z, t[5] = s * R - n * E + r * z, t[6] = y * b - g * v - L * M, t[7] = h * v - u * b + f * M, t[8] = a * _ - o * E + c * P, t[9] = i * E - s * _ - r * P, t[10] = g * T - p * b + L * x, t[11] = m * b - h * T - f * x, t[12] = o * z - a * F - l * P, t[13] = s * F - i * z + n * P, t[14] = p * M - g * w - y * x, t[15] = h * w - m * M + u * x, t;
  }
  /**
   * Calculates the determinant of a {@link Mat4}
   * @category Static
   *
   * @param a - the source matrix
   * @returns determinant of a
   */
  static determinant(t) {
    const e = t[0], s = t[1], i = t[2], n = t[3], r = t[4], a = t[5], o = t[6], l = t[7], c = t[8], h = t[9], m = t[10], u = t[11], f = t[12], g = t[13], p = t[14], y = t[15], L = e * a - s * r, x = e * o - i * r, M = s * o - i * a, b = c * g - h * f, w = c * p - m * f, T = h * p - m * g, v = e * T - s * w + i * b, P = r * T - a * w + o * b, z = c * M - h * x + m * L, E = f * M - g * x + p * L;
    return l * v - n * P + y * z - u * E;
  }
  /**
   * Multiplies two {@link Mat4}s
   * @category Static
   *
   * @param out - The receiving Matrix
   * @param a - The first operand
   * @param b - The second operand
   * @returns `out`
   */
  static multiply(t, e, s) {
    const i = e[0], n = e[1], r = e[2], a = e[3], o = e[4], l = e[5], c = e[6], h = e[7], m = e[8], u = e[9], f = e[10], g = e[11], p = e[12], y = e[13], L = e[14], x = e[15];
    let M = s[0], b = s[1], w = s[2], T = s[3];
    return t[0] = M * i + b * o + w * m + T * p, t[1] = M * n + b * l + w * u + T * y, t[2] = M * r + b * c + w * f + T * L, t[3] = M * a + b * h + w * g + T * x, M = s[4], b = s[5], w = s[6], T = s[7], t[4] = M * i + b * o + w * m + T * p, t[5] = M * n + b * l + w * u + T * y, t[6] = M * r + b * c + w * f + T * L, t[7] = M * a + b * h + w * g + T * x, M = s[8], b = s[9], w = s[10], T = s[11], t[8] = M * i + b * o + w * m + T * p, t[9] = M * n + b * l + w * u + T * y, t[10] = M * r + b * c + w * f + T * L, t[11] = M * a + b * h + w * g + T * x, M = s[12], b = s[13], w = s[14], T = s[15], t[12] = M * i + b * o + w * m + T * p, t[13] = M * n + b * l + w * u + T * y, t[14] = M * r + b * c + w * f + T * L, t[15] = M * a + b * h + w * g + T * x, t;
  }
  /**
   * Alias for {@link Mat4.multiply}
   * @category Static
   */
  static mul(t, e, s) {
    return t;
  }
  /**
   * Translate a {@link Mat4} by the given vector
   * @category Static
   *
   * @param out - the receiving matrix
   * @param a - the matrix to translate
   * @param v - vector to translate by
   * @returns `out`
   */
  static translate(t, e, s) {
    const i = s[0], n = s[1], r = s[2];
    if (e === t)
      t[12] = e[0] * i + e[4] * n + e[8] * r + e[12], t[13] = e[1] * i + e[5] * n + e[9] * r + e[13], t[14] = e[2] * i + e[6] * n + e[10] * r + e[14], t[15] = e[3] * i + e[7] * n + e[11] * r + e[15];
    else {
      const a = e[0], o = e[1], l = e[2], c = e[3], h = e[4], m = e[5], u = e[6], f = e[7], g = e[8], p = e[9], y = e[10], L = e[11];
      t[0] = a, t[1] = o, t[2] = l, t[3] = c, t[4] = h, t[5] = m, t[6] = u, t[7] = f, t[8] = g, t[9] = p, t[10] = y, t[11] = L, t[12] = a * i + h * n + g * r + e[12], t[13] = o * i + m * n + p * r + e[13], t[14] = l * i + u * n + y * r + e[14], t[15] = c * i + f * n + L * r + e[15];
    }
    return t;
  }
  /**
   * Scales the {@link Mat4} by the dimensions in the given {@link Vec3} not using vectorization
   * @category Static
   *
   * @param out - the receiving matrix
   * @param a - the matrix to scale
   * @param v - the {@link Vec3} to scale the matrix by
   * @returns `out`
   **/
  static scale(t, e, s) {
    const i = s[0], n = s[1], r = s[2];
    return t[0] = e[0] * i, t[1] = e[1] * i, t[2] = e[2] * i, t[3] = e[3] * i, t[4] = e[4] * n, t[5] = e[5] * n, t[6] = e[6] * n, t[7] = e[7] * n, t[8] = e[8] * r, t[9] = e[9] * r, t[10] = e[10] * r, t[11] = e[11] * r, t[12] = e[12], t[13] = e[13], t[14] = e[14], t[15] = e[15], t;
  }
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
  static rotate(t, e, s, i) {
    let n = i[0], r = i[1], a = i[2], o = Math.sqrt(n * n + r * r + a * a);
    if (o < O)
      return null;
    o = 1 / o, n *= o, r *= o, a *= o;
    const l = Math.sin(s), c = Math.cos(s), h = 1 - c, m = e[0], u = e[1], f = e[2], g = e[3], p = e[4], y = e[5], L = e[6], x = e[7], M = e[8], b = e[9], w = e[10], T = e[11], v = n * n * h + c, P = r * n * h + a * l, z = a * n * h - r * l, E = n * r * h - a * l, F = r * r * h + c, _ = a * r * h + n * l, R = n * a * h + r * l, k = r * a * h - n * l, B = a * a * h + c;
    return t[0] = m * v + p * P + M * z, t[1] = u * v + y * P + b * z, t[2] = f * v + L * P + w * z, t[3] = g * v + x * P + T * z, t[4] = m * E + p * F + M * _, t[5] = u * E + y * F + b * _, t[6] = f * E + L * F + w * _, t[7] = g * E + x * F + T * _, t[8] = m * R + p * k + M * B, t[9] = u * R + y * k + b * B, t[10] = f * R + L * k + w * B, t[11] = g * R + x * k + T * B, e !== t && (t[12] = e[12], t[13] = e[13], t[14] = e[14], t[15] = e[15]), t;
  }
  /**
   * Rotates a matrix by the given angle around the X axis
   * @category Static
   *
   * @param out - the receiving matrix
   * @param a - the matrix to rotate
   * @param rad - the angle to rotate the matrix by
   * @returns `out`
   */
  static rotateX(t, e, s) {
    let i = Math.sin(s), n = Math.cos(s), r = e[4], a = e[5], o = e[6], l = e[7], c = e[8], h = e[9], m = e[10], u = e[11];
    return e !== t && (t[0] = e[0], t[1] = e[1], t[2] = e[2], t[3] = e[3], t[12] = e[12], t[13] = e[13], t[14] = e[14], t[15] = e[15]), t[4] = r * n + c * i, t[5] = a * n + h * i, t[6] = o * n + m * i, t[7] = l * n + u * i, t[8] = c * n - r * i, t[9] = h * n - a * i, t[10] = m * n - o * i, t[11] = u * n - l * i, t;
  }
  /**
   * Rotates a matrix by the given angle around the Y axis
   * @category Static
   *
   * @param out - the receiving matrix
   * @param a - the matrix to rotate
   * @param rad - the angle to rotate the matrix by
   * @returns `out`
   */
  static rotateY(t, e, s) {
    let i = Math.sin(s), n = Math.cos(s), r = e[0], a = e[1], o = e[2], l = e[3], c = e[8], h = e[9], m = e[10], u = e[11];
    return e !== t && (t[4] = e[4], t[5] = e[5], t[6] = e[6], t[7] = e[7], t[12] = e[12], t[13] = e[13], t[14] = e[14], t[15] = e[15]), t[0] = r * n - c * i, t[1] = a * n - h * i, t[2] = o * n - m * i, t[3] = l * n - u * i, t[8] = r * i + c * n, t[9] = a * i + h * n, t[10] = o * i + m * n, t[11] = l * i + u * n, t;
  }
  /**
   * Rotates a matrix by the given angle around the Z axis
   * @category Static
   *
   * @param out - the receiving matrix
   * @param a - the matrix to rotate
   * @param rad - the angle to rotate the matrix by
   * @returns `out`
   */
  static rotateZ(t, e, s) {
    let i = Math.sin(s), n = Math.cos(s), r = e[0], a = e[1], o = e[2], l = e[3], c = e[4], h = e[5], m = e[6], u = e[7];
    return e !== t && (t[8] = e[8], t[9] = e[9], t[10] = e[10], t[11] = e[11], t[12] = e[12], t[13] = e[13], t[14] = e[14], t[15] = e[15]), t[0] = r * n + c * i, t[1] = a * n + h * i, t[2] = o * n + m * i, t[3] = l * n + u * i, t[4] = c * n - r * i, t[5] = h * n - a * i, t[6] = m * n - o * i, t[7] = u * n - l * i, t;
  }
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
  static fromTranslation(t, e) {
    return t[0] = 1, t[1] = 0, t[2] = 0, t[3] = 0, t[4] = 0, t[5] = 1, t[6] = 0, t[7] = 0, t[8] = 0, t[9] = 0, t[10] = 1, t[11] = 0, t[12] = e[0], t[13] = e[1], t[14] = e[2], t[15] = 1, t;
  }
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
  static fromScaling(t, e) {
    return t[0] = e[0], t[1] = 0, t[2] = 0, t[3] = 0, t[4] = 0, t[5] = e[1], t[6] = 0, t[7] = 0, t[8] = 0, t[9] = 0, t[10] = e[2], t[11] = 0, t[12] = 0, t[13] = 0, t[14] = 0, t[15] = 1, t;
  }
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
  static fromRotation(t, e, s) {
    let i = s[0], n = s[1], r = s[2], a = Math.sqrt(i * i + n * n + r * r);
    if (a < O)
      return null;
    a = 1 / a, i *= a, n *= a, r *= a;
    const o = Math.sin(e), l = Math.cos(e), c = 1 - l;
    return t[0] = i * i * c + l, t[1] = n * i * c + r * o, t[2] = r * i * c - n * o, t[3] = 0, t[4] = i * n * c - r * o, t[5] = n * n * c + l, t[6] = r * n * c + i * o, t[7] = 0, t[8] = i * r * c + n * o, t[9] = n * r * c - i * o, t[10] = r * r * c + l, t[11] = 0, t[12] = 0, t[13] = 0, t[14] = 0, t[15] = 1, t;
  }
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
  static fromXRotation(t, e) {
    let s = Math.sin(e), i = Math.cos(e);
    return t[0] = 1, t[1] = 0, t[2] = 0, t[3] = 0, t[4] = 0, t[5] = i, t[6] = s, t[7] = 0, t[8] = 0, t[9] = -s, t[10] = i, t[11] = 0, t[12] = 0, t[13] = 0, t[14] = 0, t[15] = 1, t;
  }
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
  static fromYRotation(t, e) {
    let s = Math.sin(e), i = Math.cos(e);
    return t[0] = i, t[1] = 0, t[2] = -s, t[3] = 0, t[4] = 0, t[5] = 1, t[6] = 0, t[7] = 0, t[8] = s, t[9] = 0, t[10] = i, t[11] = 0, t[12] = 0, t[13] = 0, t[14] = 0, t[15] = 1, t;
  }
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
  static fromZRotation(t, e) {
    const s = Math.sin(e), i = Math.cos(e);
    return t[0] = i, t[1] = s, t[2] = 0, t[3] = 0, t[4] = -s, t[5] = i, t[6] = 0, t[7] = 0, t[8] = 0, t[9] = 0, t[10] = 1, t[11] = 0, t[12] = 0, t[13] = 0, t[14] = 0, t[15] = 1, t;
  }
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
  static fromRotationTranslation(t, e, s) {
    const i = e[0], n = e[1], r = e[2], a = e[3], o = i + i, l = n + n, c = r + r, h = i * o, m = i * l, u = i * c, f = n * l, g = n * c, p = r * c, y = a * o, L = a * l, x = a * c;
    return t[0] = 1 - (f + p), t[1] = m + x, t[2] = u - L, t[3] = 0, t[4] = m - x, t[5] = 1 - (h + p), t[6] = g + y, t[7] = 0, t[8] = u + L, t[9] = g - y, t[10] = 1 - (h + f), t[11] = 0, t[12] = s[0], t[13] = s[1], t[14] = s[2], t[15] = 1, t;
  }
  /**
   * Sets a {@link Mat4} from a {@link Quat2}.
   * @category Static
   *
   * @param out - Matrix
   * @param a - Dual Quaternion
   * @returns `out`
   */
  static fromQuat2(t, e) {
    const s = -e[0], i = -e[1], n = -e[2], r = e[3], a = e[4], o = e[5], l = e[6], c = e[7];
    let h = s * s + i * i + n * n + r * r;
    return h > 0 ? (V[0] = (a * r + c * s + o * n - l * i) * 2 / h, V[1] = (o * r + c * i + l * s - a * n) * 2 / h, V[2] = (l * r + c * n + a * i - o * s) * 2 / h) : (V[0] = (a * r + c * s + o * n - l * i) * 2, V[1] = (o * r + c * i + l * s - a * n) * 2, V[2] = (l * r + c * n + a * i - o * s) * 2), I.fromRotationTranslation(t, e, V), t;
  }
  /**
   * Calculates a {@link Mat4} normal matrix (transpose inverse) from a {@link Mat4}
   * @category Static
   *
   * @param out - Matrix receiving operation result
   * @param a - Mat4 to derive the normal matrix from
   * @returns `out` or `null` if the matrix is not invertable
   */
  static normalFromMat4(t, e) {
    const s = e[0], i = e[1], n = e[2], r = e[3], a = e[4], o = e[5], l = e[6], c = e[7], h = e[8], m = e[9], u = e[10], f = e[11], g = e[12], p = e[13], y = e[14], L = e[15], x = s * o - i * a, M = s * l - n * a, b = s * c - r * a, w = i * l - n * o, T = i * c - r * o, v = n * c - r * l, P = h * p - m * g, z = h * y - u * g, E = h * L - f * g, F = m * y - u * p, _ = m * L - f * p, R = u * L - f * y;
    let k = x * R - M * _ + b * F + w * E - T * z + v * P;
    return k ? (k = 1 / k, t[0] = (o * R - l * _ + c * F) * k, t[1] = (l * E - a * R - c * z) * k, t[2] = (a * _ - o * E + c * P) * k, t[3] = 0, t[4] = (n * _ - i * R - r * F) * k, t[5] = (s * R - n * E + r * z) * k, t[6] = (i * E - s * _ - r * P) * k, t[7] = 0, t[8] = (p * v - y * T + L * w) * k, t[9] = (y * b - g * v - L * M) * k, t[10] = (g * T - p * b + L * x) * k, t[11] = 0, t[12] = 0, t[13] = 0, t[14] = 0, t[15] = 1, t) : null;
  }
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
  static normalFromMat4Fast(t, e) {
    const s = e[0], i = e[1], n = e[2], r = e[4], a = e[5], o = e[6], l = e[8], c = e[9], h = e[10];
    return t[0] = a * h - h * c, t[1] = o * l - l * h, t[2] = r * c - c * l, t[3] = 0, t[4] = c * n - h * i, t[5] = h * s - l * n, t[6] = l * i - c * s, t[7] = 0, t[8] = i * o - n * a, t[9] = n * r - s * o, t[10] = s * a - i * r, t[11] = 0, t[12] = 0, t[13] = 0, t[14] = 0, t[15] = 1, t;
  }
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
  static getTranslation(t, e) {
    return t[0] = e[12], t[1] = e[13], t[2] = e[14], t;
  }
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
  static getScaling(t, e) {
    const s = e[0], i = e[1], n = e[2], r = e[4], a = e[5], o = e[6], l = e[8], c = e[9], h = e[10];
    return t[0] = Math.sqrt(s * s + i * i + n * n), t[1] = Math.sqrt(r * r + a * a + o * o), t[2] = Math.sqrt(l * l + c * c + h * h), t;
  }
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
  static getRotation(t, e) {
    I.getScaling(V, e);
    const s = 1 / V[0], i = 1 / V[1], n = 1 / V[2], r = e[0] * s, a = e[1] * i, o = e[2] * n, l = e[4] * s, c = e[5] * i, h = e[6] * n, m = e[8] * s, u = e[9] * i, f = e[10] * n, g = r + c + f;
    let p = 0;
    return g > 0 ? (p = Math.sqrt(g + 1) * 2, t[3] = 0.25 * p, t[0] = (h - u) / p, t[1] = (m - o) / p, t[2] = (a - l) / p) : r > c && r > f ? (p = Math.sqrt(1 + r - c - f) * 2, t[3] = (h - u) / p, t[0] = 0.25 * p, t[1] = (a + l) / p, t[2] = (m + o) / p) : c > f ? (p = Math.sqrt(1 + c - r - f) * 2, t[3] = (m - o) / p, t[0] = (a + l) / p, t[1] = 0.25 * p, t[2] = (h + u) / p) : (p = Math.sqrt(1 + f - r - c) * 2, t[3] = (a - l) / p, t[0] = (m + o) / p, t[1] = (h + u) / p, t[2] = 0.25 * p), t;
  }
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
  static decompose(t, e, s, i) {
    e[0] = i[12], e[1] = i[13], e[2] = i[14];
    const n = i[0], r = i[1], a = i[2], o = i[4], l = i[5], c = i[6], h = i[8], m = i[9], u = i[10];
    s[0] = Math.sqrt(n * n + r * r + a * a), s[1] = Math.sqrt(o * o + l * l + c * c), s[2] = Math.sqrt(h * h + m * m + u * u);
    const f = 1 / s[0], g = 1 / s[1], p = 1 / s[2], y = n * f, L = r * g, x = a * p, M = o * f, b = l * g, w = c * p, T = h * f, v = m * g, P = u * p, z = y + b + P;
    let E = 0;
    return z > 0 ? (E = Math.sqrt(z + 1) * 2, t[3] = 0.25 * E, t[0] = (w - v) / E, t[1] = (T - x) / E, t[2] = (L - M) / E) : y > b && y > P ? (E = Math.sqrt(1 + y - b - P) * 2, t[3] = (w - v) / E, t[0] = 0.25 * E, t[1] = (L + M) / E, t[2] = (T + x) / E) : b > P ? (E = Math.sqrt(1 + b - y - P) * 2, t[3] = (T - x) / E, t[0] = (L + M) / E, t[1] = 0.25 * E, t[2] = (w + v) / E) : (E = Math.sqrt(1 + P - y - b) * 2, t[3] = (L - M) / E, t[0] = (T + x) / E, t[1] = (w + v) / E, t[2] = 0.25 * E), t;
  }
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
  static fromRotationTranslationScale(t, e, s, i) {
    const n = e[0], r = e[1], a = e[2], o = e[3], l = n + n, c = r + r, h = a + a, m = n * l, u = n * c, f = n * h, g = r * c, p = r * h, y = a * h, L = o * l, x = o * c, M = o * h, b = i[0], w = i[1], T = i[2];
    return t[0] = (1 - (g + y)) * b, t[1] = (u + M) * b, t[2] = (f - x) * b, t[3] = 0, t[4] = (u - M) * w, t[5] = (1 - (m + y)) * w, t[6] = (p + L) * w, t[7] = 0, t[8] = (f + x) * T, t[9] = (p - L) * T, t[10] = (1 - (m + g)) * T, t[11] = 0, t[12] = s[0], t[13] = s[1], t[14] = s[2], t[15] = 1, t;
  }
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
  static fromRotationTranslationScaleOrigin(t, e, s, i, n) {
    const r = e[0], a = e[1], o = e[2], l = e[3], c = r + r, h = a + a, m = o + o, u = r * c, f = r * h, g = r * m, p = a * h, y = a * m, L = o * m, x = l * c, M = l * h, b = l * m, w = i[0], T = i[1], v = i[2], P = n[0], z = n[1], E = n[2], F = (1 - (p + L)) * w, _ = (f + b) * w, R = (g - M) * w, k = (f - b) * T, B = (1 - (u + L)) * T, $ = (y + x) * T, U = (g + M) * v, Y = (y - x) * v, j = (1 - (u + p)) * v;
    return t[0] = F, t[1] = _, t[2] = R, t[3] = 0, t[4] = k, t[5] = B, t[6] = $, t[7] = 0, t[8] = U, t[9] = Y, t[10] = j, t[11] = 0, t[12] = s[0] + P - (F * P + k * z + U * E), t[13] = s[1] + z - (_ * P + B * z + Y * E), t[14] = s[2] + E - (R * P + $ * z + j * E), t[15] = 1, t;
  }
  /**
   * Calculates a 4x4 matrix from the given quaternion
   * @category Static
   *
   * @param out - mat4 receiving operation result
   * @param q - Quaternion to create matrix from
   * @returns `out`
   */
  static fromQuat(t, e) {
    const s = e[0], i = e[1], n = e[2], r = e[3], a = s + s, o = i + i, l = n + n, c = s * a, h = i * a, m = i * o, u = n * a, f = n * o, g = n * l, p = r * a, y = r * o, L = r * l;
    return t[0] = 1 - m - g, t[1] = h + L, t[2] = u - y, t[3] = 0, t[4] = h - L, t[5] = 1 - c - g, t[6] = f + p, t[7] = 0, t[8] = u + y, t[9] = f - p, t[10] = 1 - c - m, t[11] = 0, t[12] = 0, t[13] = 0, t[14] = 0, t[15] = 1, t;
  }
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
  static frustumNO(t, e, s, i, n, r, a = 1 / 0) {
    const o = 1 / (s - e), l = 1 / (n - i);
    if (t[0] = r * 2 * o, t[1] = 0, t[2] = 0, t[3] = 0, t[4] = 0, t[5] = r * 2 * l, t[6] = 0, t[7] = 0, t[8] = (s + e) * o, t[9] = (n + i) * l, t[11] = -1, t[12] = 0, t[13] = 0, t[15] = 0, a != null && a !== 1 / 0) {
      const c = 1 / (r - a);
      t[10] = (a + r) * c, t[14] = 2 * a * r * c;
    } else
      t[10] = -1, t[14] = -2 * r;
    return t;
  }
  /**
   * Alias for {@link Mat4.frustumNO}
   * @category Static
   * @deprecated Use {@link Mat4.frustumNO} or {@link Mat4.frustumZO} explicitly
   */
  static frustum(t, e, s, i, n, r, a = 1 / 0) {
    return t;
  }
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
  static frustumZO(t, e, s, i, n, r, a = 1 / 0) {
    const o = 1 / (s - e), l = 1 / (n - i);
    if (t[0] = r * 2 * o, t[1] = 0, t[2] = 0, t[3] = 0, t[4] = 0, t[5] = r * 2 * l, t[6] = 0, t[7] = 0, t[8] = (s + e) * o, t[9] = (n + i) * l, t[11] = -1, t[12] = 0, t[13] = 0, t[15] = 0, a != null && a !== 1 / 0) {
      const c = 1 / (r - a);
      t[10] = a * c, t[14] = a * r * c;
    } else
      t[10] = -1, t[14] = -r;
    return t;
  }
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
  static perspectiveNO(t, e, s, i, n = 1 / 0) {
    const r = 1 / Math.tan(e / 2);
    if (t[0] = r / s, t[1] = 0, t[2] = 0, t[3] = 0, t[4] = 0, t[5] = r, t[6] = 0, t[7] = 0, t[8] = 0, t[9] = 0, t[11] = -1, t[12] = 0, t[13] = 0, t[15] = 0, n != null && n !== 1 / 0) {
      const a = 1 / (i - n);
      t[10] = (n + i) * a, t[14] = 2 * n * i * a;
    } else
      t[10] = -1, t[14] = -2 * i;
    return t;
  }
  /**
   * Alias for {@link Mat4.perspectiveNO}
   * @category Static
   * @deprecated Use {@link Mat4.perspectiveNO} or {@link Mat4.perspectiveZO} explicitly
   */
  static perspective(t, e, s, i, n = 1 / 0) {
    return t;
  }
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
  static perspectiveZO(t, e, s, i, n = 1 / 0) {
    const r = 1 / Math.tan(e / 2);
    if (t[0] = r / s, t[1] = 0, t[2] = 0, t[3] = 0, t[4] = 0, t[5] = r, t[6] = 0, t[7] = 0, t[8] = 0, t[9] = 0, t[11] = -1, t[12] = 0, t[13] = 0, t[15] = 0, n != null && n !== 1 / 0) {
      const a = 1 / (i - n);
      t[10] = n * a, t[14] = n * i * a;
    } else
      t[10] = -1, t[14] = -i;
    return t;
  }
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
  static perspectiveFromFieldOfView(t, e, s, i) {
    const n = Math.tan(e.upDegrees * Math.PI / 180), r = Math.tan(e.downDegrees * Math.PI / 180), a = Math.tan(e.leftDegrees * Math.PI / 180), o = Math.tan(e.rightDegrees * Math.PI / 180), l = 2 / (a + o), c = 2 / (n + r);
    return t[0] = l, t[1] = 0, t[2] = 0, t[3] = 0, t[4] = 0, t[5] = c, t[6] = 0, t[7] = 0, t[8] = -((a - o) * l * 0.5), t[9] = (n - r) * c * 0.5, t[10] = i / (s - i), t[11] = -1, t[12] = 0, t[13] = 0, t[14] = i * s / (s - i), t[15] = 0, t;
  }
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
  static orthoNO(t, e, s, i, n, r, a) {
    const o = 1 / (e - s), l = 1 / (i - n), c = 1 / (r - a);
    return t[0] = -2 * o, t[1] = 0, t[2] = 0, t[3] = 0, t[4] = 0, t[5] = -2 * l, t[6] = 0, t[7] = 0, t[8] = 0, t[9] = 0, t[10] = 2 * c, t[11] = 0, t[12] = (e + s) * o, t[13] = (n + i) * l, t[14] = (a + r) * c, t[15] = 1, t;
  }
  /**
   * Alias for {@link Mat4.orthoNO}
   * @category Static
   * @deprecated Use {@link Mat4.orthoNO} or {@link Mat4.orthoZO} explicitly
   */
  static ortho(t, e, s, i, n, r, a) {
    return t;
  }
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
  static orthoZO(t, e, s, i, n, r, a) {
    const o = 1 / (e - s), l = 1 / (i - n), c = 1 / (r - a);
    return t[0] = -2 * o, t[1] = 0, t[2] = 0, t[3] = 0, t[4] = 0, t[5] = -2 * l, t[6] = 0, t[7] = 0, t[8] = 0, t[9] = 0, t[10] = c, t[11] = 0, t[12] = (e + s) * o, t[13] = (n + i) * l, t[14] = r * c, t[15] = 1, t;
  }
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
  static lookAt(t, e, s, i) {
    const n = e[0], r = e[1], a = e[2], o = i[0], l = i[1], c = i[2], h = s[0], m = s[1], u = s[2];
    if (Math.abs(n - h) < O && Math.abs(r - m) < O && Math.abs(a - u) < O)
      return I.identity(t);
    let f = n - h, g = r - m, p = a - u, y = 1 / Math.sqrt(f * f + g * g + p * p);
    f *= y, g *= y, p *= y;
    let L = l * p - c * g, x = c * f - o * p, M = o * g - l * f;
    y = Math.sqrt(L * L + x * x + M * M), y ? (y = 1 / y, L *= y, x *= y, M *= y) : (L = 0, x = 0, M = 0);
    let b = g * M - p * x, w = p * L - f * M, T = f * x - g * L;
    return y = Math.sqrt(b * b + w * w + T * T), y ? (y = 1 / y, b *= y, w *= y, T *= y) : (b = 0, w = 0, T = 0), t[0] = L, t[1] = b, t[2] = f, t[3] = 0, t[4] = x, t[5] = w, t[6] = g, t[7] = 0, t[8] = M, t[9] = T, t[10] = p, t[11] = 0, t[12] = -(L * n + x * r + M * a), t[13] = -(b * n + w * r + T * a), t[14] = -(f * n + g * r + p * a), t[15] = 1, t;
  }
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
  static targetTo(t, e, s, i) {
    const n = e[0], r = e[1], a = e[2], o = i[0], l = i[1], c = i[2];
    let h = n - s[0], m = r - s[1], u = a - s[2], f = h * h + m * m + u * u;
    f > 0 && (f = 1 / Math.sqrt(f), h *= f, m *= f, u *= f);
    let g = l * u - c * m, p = c * h - o * u, y = o * m - l * h;
    return f = g * g + p * p + y * y, f > 0 && (f = 1 / Math.sqrt(f), g *= f, p *= f, y *= f), t[0] = g, t[1] = p, t[2] = y, t[3] = 0, t[4] = m * y - u * p, t[5] = u * g - h * y, t[6] = h * p - m * g, t[7] = 0, t[8] = h, t[9] = m, t[10] = u, t[11] = 0, t[12] = n, t[13] = r, t[14] = a, t[15] = 1, t;
  }
  /**
   * Returns Frobenius norm of a {@link Mat4}
   * @category Static
   *
   * @param a - the matrix to calculate Frobenius norm of
   * @returns Frobenius norm
   */
  static frob(t) {
    return Math.sqrt(t[0] * t[0] + t[1] * t[1] + t[2] * t[2] + t[3] * t[3] + t[4] * t[4] + t[5] * t[5] + t[6] * t[6] + t[7] * t[7] + t[8] * t[8] + t[9] * t[9] + t[10] * t[10] + t[11] * t[11] + t[12] * t[12] + t[13] * t[13] + t[14] * t[14] + t[15] * t[15]);
  }
  /**
   * Adds two {@link Mat4}'s
   * @category Static
   *
   * @param out - the receiving matrix
   * @param a - the first operand
   * @param b - the second operand
   * @returns `out`
   */
  static add(t, e, s) {
    return t[0] = e[0] + s[0], t[1] = e[1] + s[1], t[2] = e[2] + s[2], t[3] = e[3] + s[3], t[4] = e[4] + s[4], t[5] = e[5] + s[5], t[6] = e[6] + s[6], t[7] = e[7] + s[7], t[8] = e[8] + s[8], t[9] = e[9] + s[9], t[10] = e[10] + s[10], t[11] = e[11] + s[11], t[12] = e[12] + s[12], t[13] = e[13] + s[13], t[14] = e[14] + s[14], t[15] = e[15] + s[15], t;
  }
  /**
   * Subtracts matrix b from matrix a
   * @category Static
   *
   * @param out - the receiving matrix
   * @param a - the first operand
   * @param b - the second operand
   * @returns `out`
   */
  static subtract(t, e, s) {
    return t[0] = e[0] - s[0], t[1] = e[1] - s[1], t[2] = e[2] - s[2], t[3] = e[3] - s[3], t[4] = e[4] - s[4], t[5] = e[5] - s[5], t[6] = e[6] - s[6], t[7] = e[7] - s[7], t[8] = e[8] - s[8], t[9] = e[9] - s[9], t[10] = e[10] - s[10], t[11] = e[11] - s[11], t[12] = e[12] - s[12], t[13] = e[13] - s[13], t[14] = e[14] - s[14], t[15] = e[15] - s[15], t;
  }
  /**
   * Alias for {@link Mat4.subtract}
   * @category Static
   */
  static sub(t, e, s) {
    return t;
  }
  /**
   * Multiply each element of the matrix by a scalar.
   * @category Static
   *
   * @param out - the receiving matrix
   * @param a - the matrix to scale
   * @param b - amount to scale the matrix's elements by
   * @returns `out`
   */
  static multiplyScalar(t, e, s) {
    return t[0] = e[0] * s, t[1] = e[1] * s, t[2] = e[2] * s, t[3] = e[3] * s, t[4] = e[4] * s, t[5] = e[5] * s, t[6] = e[6] * s, t[7] = e[7] * s, t[8] = e[8] * s, t[9] = e[9] * s, t[10] = e[10] * s, t[11] = e[11] * s, t[12] = e[12] * s, t[13] = e[13] * s, t[14] = e[14] * s, t[15] = e[15] * s, t;
  }
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
  static multiplyScalarAndAdd(t, e, s, i) {
    return t[0] = e[0] + s[0] * i, t[1] = e[1] + s[1] * i, t[2] = e[2] + s[2] * i, t[3] = e[3] + s[3] * i, t[4] = e[4] + s[4] * i, t[5] = e[5] + s[5] * i, t[6] = e[6] + s[6] * i, t[7] = e[7] + s[7] * i, t[8] = e[8] + s[8] * i, t[9] = e[9] + s[9] * i, t[10] = e[10] + s[10] * i, t[11] = e[11] + s[11] * i, t[12] = e[12] + s[12] * i, t[13] = e[13] + s[13] * i, t[14] = e[14] + s[14] * i, t[15] = e[15] + s[15] * i, t;
  }
  /**
   * Returns whether or not two {@link Mat4}s have exactly the same elements in the same position (when compared with ===)
   * @category Static
   *
   * @param a - The first matrix.
   * @param b - The second matrix.
   * @returns True if the matrices are equal, false otherwise.
   */
  static exactEquals(t, e) {
    return t[0] === e[0] && t[1] === e[1] && t[2] === e[2] && t[3] === e[3] && t[4] === e[4] && t[5] === e[5] && t[6] === e[6] && t[7] === e[7] && t[8] === e[8] && t[9] === e[9] && t[10] === e[10] && t[11] === e[11] && t[12] === e[12] && t[13] === e[13] && t[14] === e[14] && t[15] === e[15];
  }
  /**
   * Returns whether or not two {@link Mat4}s have approximately the same elements in the same position.
   * @category Static
   *
   * @param a - The first matrix.
   * @param b - The second matrix.
   * @returns True if the matrices are equal, false otherwise.
   */
  static equals(t, e) {
    const s = t[0], i = t[1], n = t[2], r = t[3], a = t[4], o = t[5], l = t[6], c = t[7], h = t[8], m = t[9], u = t[10], f = t[11], g = t[12], p = t[13], y = t[14], L = t[15], x = e[0], M = e[1], b = e[2], w = e[3], T = e[4], v = e[5], P = e[6], z = e[7], E = e[8], F = e[9], _ = e[10], R = e[11], k = e[12], B = e[13], $ = e[14], U = e[15];
    return Math.abs(s - x) <= O * Math.max(1, Math.abs(s), Math.abs(x)) && Math.abs(i - M) <= O * Math.max(1, Math.abs(i), Math.abs(M)) && Math.abs(n - b) <= O * Math.max(1, Math.abs(n), Math.abs(b)) && Math.abs(r - w) <= O * Math.max(1, Math.abs(r), Math.abs(w)) && Math.abs(a - T) <= O * Math.max(1, Math.abs(a), Math.abs(T)) && Math.abs(o - v) <= O * Math.max(1, Math.abs(o), Math.abs(v)) && Math.abs(l - P) <= O * Math.max(1, Math.abs(l), Math.abs(P)) && Math.abs(c - z) <= O * Math.max(1, Math.abs(c), Math.abs(z)) && Math.abs(h - E) <= O * Math.max(1, Math.abs(h), Math.abs(E)) && Math.abs(m - F) <= O * Math.max(1, Math.abs(m), Math.abs(F)) && Math.abs(u - _) <= O * Math.max(1, Math.abs(u), Math.abs(_)) && Math.abs(f - R) <= O * Math.max(1, Math.abs(f), Math.abs(R)) && Math.abs(g - k) <= O * Math.max(1, Math.abs(g), Math.abs(k)) && Math.abs(p - B) <= O * Math.max(1, Math.abs(p), Math.abs(B)) && Math.abs(y - $) <= O * Math.max(1, Math.abs(y), Math.abs($)) && Math.abs(L - U) <= O * Math.max(1, Math.abs(L), Math.abs(U));
  }
  /**
   * Returns a string representation of a {@link Mat4}
   * @category Static
   *
   * @param a - matrix to represent as a string
   * @returns string representation of the matrix
   */
  static str(t) {
    return `Mat4(${t.join(", ")})`;
  }
}
const V = new Float32Array(3);
I.prototype.mul = I.prototype.multiply;
I.sub = I.subtract;
I.mul = I.multiply;
I.frustum = I.frustumNO;
I.perspective = I.perspectiveNO;
I.ortho = I.orthoNO;
class C extends Float32Array {
  /**
  * The number of bytes in a {@link Vec3}.
  */
  static BYTE_LENGTH = 3 * Float32Array.BYTES_PER_ELEMENT;
  /**
  * Create a {@link Vec3}.
  */
  constructor(...t) {
    switch (t.length) {
      case 3:
        super(t);
        break;
      case 2:
        super(t[0], t[1], 3);
        break;
      case 1: {
        const e = t[0];
        typeof e == "number" ? super([e, e, e]) : super(e, 0, 3);
        break;
      }
      default:
        super(3);
        break;
    }
  }
  //============
  // Attributes
  //============
  // Getters and setters to make component access read better.
  // These are likely to be a little bit slower than direct array access.
  /**
   * The x component of the vector. Equivalent to `this[0];`
   * @category Vector components
   */
  get x() {
    return this[0];
  }
  set x(t) {
    this[0] = t;
  }
  /**
   * The y component of the vector. Equivalent to `this[1];`
   * @category Vector components
   */
  get y() {
    return this[1];
  }
  set y(t) {
    this[1] = t;
  }
  /**
   * The z component of the vector. Equivalent to `this[2];`
   * @category Vector components
   */
  get z() {
    return this[2];
  }
  set z(t) {
    this[2] = t;
  }
  // Alternate set of getters and setters in case this is being used to define
  // a color.
  /**
   * The r component of the vector. Equivalent to `this[0];`
   * @category Color components
   */
  get r() {
    return this[0];
  }
  set r(t) {
    this[0] = t;
  }
  /**
   * The g component of the vector. Equivalent to `this[1];`
   * @category Color components
   */
  get g() {
    return this[1];
  }
  set g(t) {
    this[1] = t;
  }
  /**
   * The b component of the vector. Equivalent to `this[2];`
   * @category Color components
   */
  get b() {
    return this[2];
  }
  set b(t) {
    this[2] = t;
  }
  /**
   * The magnitude (length) of this.
   * Equivalent to `Vec3.magnitude(this);`
   *
   * Magnitude is used because the `length` attribute is already defined by
   * TypedArrays to mean the number of elements in the array.
   */
  get magnitude() {
    const t = this[0], e = this[1], s = this[2];
    return Math.sqrt(t * t + e * e + s * s);
  }
  /**
   * Alias for {@link Vec3.magnitude}
   */
  get mag() {
    return this.magnitude;
  }
  /**
   * The squared magnitude (length) of `this`.
   * Equivalent to `Vec3.squaredMagnitude(this);`
   */
  get squaredMagnitude() {
    const t = this[0], e = this[1], s = this[2];
    return t * t + e * e + s * s;
  }
  /**
   * Alias for {@link Vec3.squaredMagnitude}
   */
  get sqrMag() {
    return this.squaredMagnitude;
  }
  /**
   * A string representation of `this`
   * Equivalent to `Vec3.str(this);`
   */
  get str() {
    return C.str(this);
  }
  //===================
  // Instances methods
  //===================
  /**
   * Copy the values from another {@link Vec3} into `this`.
   *
   * @param a the source vector
   * @returns `this`
   */
  copy(t) {
    return this.set(t), this;
  }
  /**
   * Adds a {@link Vec3} to `this`.
   * Equivalent to `Vec3.add(this, this, b);`
   *
   * @param b - The vector to add to `this`
   * @returns `this`
   */
  add(t) {
    return this[0] += t[0], this[1] += t[1], this[2] += t[2], this;
  }
  /**
   * Subtracts a {@link Vec3} from `this`.
   * Equivalent to `Vec3.subtract(this, this, b);`
   *
   * @param b - The vector to subtract from `this`
   * @returns `this`
   */
  subtract(t) {
    return this[0] -= t[0], this[1] -= t[1], this[2] -= t[2], this;
  }
  /**
   * Alias for {@link Vec3.subtract}
   */
  sub(t) {
    return this;
  }
  /**
   * Multiplies `this` by a {@link Vec3}.
   * Equivalent to `Vec3.multiply(this, this, b);`
   *
   * @param b - The vector to multiply `this` by
   * @returns `this`
   */
  multiply(t) {
    return this[0] *= t[0], this[1] *= t[1], this[2] *= t[2], this;
  }
  /**
   * Alias for {@link Vec3.multiply}
   */
  mul(t) {
    return this;
  }
  /**
   * Divides `this` by a {@link Vec3}.
   * Equivalent to `Vec3.divide(this, this, b);`
   *
   * @param b - The vector to divide `this` by
   * @returns `this`
   */
  divide(t) {
    return this[0] /= t[0], this[1] /= t[1], this[2] /= t[2], this;
  }
  /**
   * Alias for {@link Vec3.divide}
   */
  div(t) {
    return this;
  }
  /**
   * Scales `this` by a scalar number.
   * Equivalent to `Vec3.scale(this, this, b);`
   *
   * @param b - Amount to scale `this` by
   * @returns `this`
   */
  scale(t) {
    return this[0] *= t, this[1] *= t, this[2] *= t, this;
  }
  /**
   * Calculates `this` scaled by a scalar value then adds the result to `this`.
   * Equivalent to `Vec3.scaleAndAdd(this, this, b, scale);`
   *
   * @param b - The vector to add to `this`
   * @param scale - The amount to scale `b` by before adding
   * @returns `this`
   */
  scaleAndAdd(t, e) {
    return this[0] += t[0] * e, this[1] += t[1] * e, this[2] += t[2] * e, this;
  }
  /**
   * Calculates the euclidian distance between another {@link Vec3} and `this`.
   * Equivalent to `Vec3.distance(this, b);`
   *
   * @param b - The vector to calculate the distance to
   * @returns Distance between `this` and `b`
   */
  distance(t) {
    return C.distance(this, t);
  }
  /**
   * Alias for {@link Vec3.distance}
   */
  dist(t) {
    return 0;
  }
  /**
   * Calculates the squared euclidian distance between another {@link Vec3} and `this`.
   * Equivalent to `Vec3.squaredDistance(this, b);`
   *
   * @param b The vector to calculate the squared distance to
   * @returns Squared distance between `this` and `b`
   */
  squaredDistance(t) {
    return C.squaredDistance(this, t);
  }
  /**
   * Alias for {@link Vec3.squaredDistance}
   */
  sqrDist(t) {
    return 0;
  }
  /**
   * Negates the components of `this`.
   * Equivalent to `Vec3.negate(this, this);`
   *
   * @returns `this`
   */
  negate() {
    return this[0] *= -1, this[1] *= -1, this[2] *= -1, this;
  }
  /**
   * Inverts the components of `this`.
   * Equivalent to `Vec3.inverse(this, this);`
   *
   * @returns `this`
   */
  invert() {
    return this[0] = 1 / this[0], this[1] = 1 / this[1], this[2] = 1 / this[2], this;
  }
  /**
   * Sets each component of `this` to it's absolute value.
   * Equivalent to `Vec3.abs(this, this);`
   *
   * @returns `this`
   */
  abs() {
    return this[0] = Math.abs(this[0]), this[1] = Math.abs(this[1]), this[2] = Math.abs(this[2]), this;
  }
  /**
   * Calculates the dot product of this and another {@link Vec3}.
   * Equivalent to `Vec3.dot(this, b);`
   *
   * @param b - The second operand
   * @returns Dot product of `this` and `b`
   */
  dot(t) {
    return this[0] * t[0] + this[1] * t[1] + this[2] * t[2];
  }
  /**
   * Normalize `this`.
   * Equivalent to `Vec3.normalize(this, this);`
   *
   * @returns `this`
   */
  normalize() {
    return C.normalize(this, this);
  }
  //================
  // Static methods
  //================
  /**
   * Creates a new, empty vec3
   * @category Static
   *
   * @returns a new 3D vector
   */
  static create() {
    return new C();
  }
  /**
   * Creates a new vec3 initialized with values from an existing vector
   * @category Static
   *
   * @param a - vector to clone
   * @returns a new 3D vector
   */
  static clone(t) {
    return new C(t);
  }
  /**
   * Calculates the magnitude (length) of a {@link Vec3}
   * @category Static
   *
   * @param a - Vector to calculate magnitude of
   * @returns Magnitude of a
   */
  static magnitude(t) {
    let e = t[0], s = t[1], i = t[2];
    return Math.sqrt(e * e + s * s + i * i);
  }
  /**
   * Alias for {@link Vec3.magnitude}
   * @category Static
   */
  static mag(t) {
    return 0;
  }
  /**
   * Alias for {@link Vec3.magnitude}
   * @category Static
   * @deprecated Use {@link Vec3.magnitude} to avoid conflicts with builtin `length` methods/attribs
   *
   * @param a - vector to calculate length of
   * @returns length of a
   */
  // @ts-ignore: Length conflicts with Function.length
  static length(t) {
    return 0;
  }
  /**
   * Alias for {@link Vec3.magnitude}
   * @category Static
   * @deprecated Use {@link Vec3.mag}
   */
  static len(t) {
    return 0;
  }
  /**
   * Creates a new vec3 initialized with the given values
   * @category Static
   *
   * @param x - X component
   * @param y - Y component
   * @param z - Z component
   * @returns a new 3D vector
   */
  static fromValues(t, e, s) {
    return new C(t, e, s);
  }
  /**
   * Copy the values from one vec3 to another
   * @category Static
   *
   * @param out - the receiving vector
   * @param a - the source vector
   * @returns `out`
   */
  static copy(t, e) {
    return t[0] = e[0], t[1] = e[1], t[2] = e[2], t;
  }
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
  static set(t, e, s, i) {
    return t[0] = e, t[1] = s, t[2] = i, t;
  }
  /**
   * Adds two {@link Vec3}s
   * @category Static
   *
   * @param out - The receiving vector
   * @param a - The first operand
   * @param b - The second operand
   * @returns `out`
   */
  static add(t, e, s) {
    return t[0] = e[0] + s[0], t[1] = e[1] + s[1], t[2] = e[2] + s[2], t;
  }
  /**
   * Subtracts vector b from vector a
   * @category Static
   *
   * @param out - the receiving vector
   * @param a - the first operand
   * @param b - the second operand
   * @returns `out`
   */
  static subtract(t, e, s) {
    return t[0] = e[0] - s[0], t[1] = e[1] - s[1], t[2] = e[2] - s[2], t;
  }
  /**
   * Alias for {@link Vec3.subtract}
   * @category Static
   */
  static sub(t, e, s) {
    return [0, 0, 0];
  }
  /**
   * Multiplies two vec3's
   * @category Static
   *
   * @param out - the receiving vector
   * @param a - the first operand
   * @param b - the second operand
   * @returns `out`
   */
  static multiply(t, e, s) {
    return t[0] = e[0] * s[0], t[1] = e[1] * s[1], t[2] = e[2] * s[2], t;
  }
  /**
   * Alias for {@link Vec3.multiply}
   * @category Static
   */
  static mul(t, e, s) {
    return [0, 0, 0];
  }
  /**
   * Divides two vec3's
   * @category Static
   *
   * @param out - the receiving vector
   * @param a - the first operand
   * @param b - the second operand
   * @returns `out`
   */
  static divide(t, e, s) {
    return t[0] = e[0] / s[0], t[1] = e[1] / s[1], t[2] = e[2] / s[2], t;
  }
  /**
   * Alias for {@link Vec3.divide}
   * @category Static
   */
  static div(t, e, s) {
    return [0, 0, 0];
  }
  /**
   * Math.ceil the components of a vec3
   * @category Static
   *
   * @param out - the receiving vector
   * @param a - vector to ceil
   * @returns `out`
   */
  static ceil(t, e) {
    return t[0] = Math.ceil(e[0]), t[1] = Math.ceil(e[1]), t[2] = Math.ceil(e[2]), t;
  }
  /**
   * Math.floor the components of a vec3
   * @category Static
   *
   * @param out - the receiving vector
   * @param a - vector to floor
   * @returns `out`
   */
  static floor(t, e) {
    return t[0] = Math.floor(e[0]), t[1] = Math.floor(e[1]), t[2] = Math.floor(e[2]), t;
  }
  /**
   * Returns the minimum of two vec3's
   * @category Static
   *
   * @param out - the receiving vector
   * @param a - the first operand
   * @param b - the second operand
   * @returns `out`
   */
  static min(t, e, s) {
    return t[0] = Math.min(e[0], s[0]), t[1] = Math.min(e[1], s[1]), t[2] = Math.min(e[2], s[2]), t;
  }
  /**
   * Returns the maximum of two vec3's
   * @category Static
   *
   * @param out - the receiving vector
   * @param a - the first operand
   * @param b - the second operand
   * @returns `out`
   */
  static max(t, e, s) {
    return t[0] = Math.max(e[0], s[0]), t[1] = Math.max(e[1], s[1]), t[2] = Math.max(e[2], s[2]), t;
  }
  /**
   * symmetric round the components of a vec3
   * @category Static
   *
   * @param out - the receiving vector
   * @param a - vector to round
   * @returns `out`
   */
  /*static round(out: Vec3Like, a: Readonly<Vec3Like>): Vec3Like {
    out[0] = glMatrix.round(a[0]);
    out[1] = glMatrix.round(a[1]);
    out[2] = glMatrix.round(a[2]);
    return out;
  }*/
  /**
   * Scales a vec3 by a scalar number
   * @category Static
   *
   * @param out - the receiving vector
   * @param a - the vector to scale
   * @param scale - amount to scale the vector by
   * @returns `out`
   */
  static scale(t, e, s) {
    return t[0] = e[0] * s, t[1] = e[1] * s, t[2] = e[2] * s, t;
  }
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
  static scaleAndAdd(t, e, s, i) {
    return t[0] = e[0] + s[0] * i, t[1] = e[1] + s[1] * i, t[2] = e[2] + s[2] * i, t;
  }
  /**
   * Calculates the euclidian distance between two vec3's
   * @category Static
   *
   * @param a - the first operand
   * @param b - the second operand
   * @returns distance between a and b
   */
  static distance(t, e) {
    const s = e[0] - t[0], i = e[1] - t[1], n = e[2] - t[2];
    return Math.sqrt(s * s + i * i + n * n);
  }
  /**
   * Alias for {@link Vec3.distance}
   */
  static dist(t, e) {
    return 0;
  }
  /**
   * Calculates the squared euclidian distance between two vec3's
   * @category Static
   *
   * @param a - the first operand
   * @param b - the second operand
   * @returns squared distance between a and b
   */
  static squaredDistance(t, e) {
    const s = e[0] - t[0], i = e[1] - t[1], n = e[2] - t[2];
    return s * s + i * i + n * n;
  }
  /**
   * Alias for {@link Vec3.squaredDistance}
   */
  static sqrDist(t, e) {
    return 0;
  }
  /**
   * Calculates the squared length of a vec3
   * @category Static
   *
   * @param a - vector to calculate squared length of
   * @returns squared length of a
   */
  static squaredLength(t) {
    const e = t[0], s = t[1], i = t[2];
    return e * e + s * s + i * i;
  }
  /**
   * Alias for {@link Vec3.squaredLength}
   */
  static sqrLen(t, e) {
    return 0;
  }
  /**
   * Negates the components of a vec3
   * @category Static
   *
   * @param out - the receiving vector
   * @param a - vector to negate
   * @returns `out`
   */
  static negate(t, e) {
    return t[0] = -e[0], t[1] = -e[1], t[2] = -e[2], t;
  }
  /**
   * Returns the inverse of the components of a vec3
   * @category Static
   *
   * @param out - the receiving vector
   * @param a - vector to invert
   * @returns `out`
   */
  static inverse(t, e) {
    return t[0] = 1 / e[0], t[1] = 1 / e[1], t[2] = 1 / e[2], t;
  }
  /**
   * Returns the absolute value of the components of a {@link Vec3}
   * @category Static
   *
   * @param out - The receiving vector
   * @param a - Vector to compute the absolute values of
   * @returns `out`
   */
  static abs(t, e) {
    return t[0] = Math.abs(e[0]), t[1] = Math.abs(e[1]), t[2] = Math.abs(e[2]), t;
  }
  /**
   * Normalize a vec3
   * @category Static
   *
   * @param out - the receiving vector
   * @param a - vector to normalize
   * @returns `out`
   */
  static normalize(t, e) {
    const s = e[0], i = e[1], n = e[2];
    let r = s * s + i * i + n * n;
    return r > 0 && (r = 1 / Math.sqrt(r)), t[0] = e[0] * r, t[1] = e[1] * r, t[2] = e[2] * r, t;
  }
  /**
   * Calculates the dot product of two vec3's
   * @category Static
   *
   * @param a - the first operand
   * @param b - the second operand
   * @returns dot product of a and b
   */
  static dot(t, e) {
    return t[0] * e[0] + t[1] * e[1] + t[2] * e[2];
  }
  /**
   * Computes the cross product of two vec3's
   * @category Static
   *
   * @param out - the receiving vector
   * @param a - the first operand
   * @param b - the second operand
   * @returns `out`
   */
  static cross(t, e, s) {
    const i = e[0], n = e[1], r = e[2], a = s[0], o = s[1], l = s[2];
    return t[0] = n * l - r * o, t[1] = r * a - i * l, t[2] = i * o - n * a, t;
  }
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
  static lerp(t, e, s, i) {
    const n = e[0], r = e[1], a = e[2];
    return t[0] = n + i * (s[0] - n), t[1] = r + i * (s[1] - r), t[2] = a + i * (s[2] - a), t;
  }
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
  static slerp(t, e, s, i) {
    const n = Math.acos(Math.min(Math.max(C.dot(e, s), -1), 1)), r = Math.sin(n), a = Math.sin((1 - i) * n) / r, o = Math.sin(i * n) / r;
    return t[0] = a * e[0] + o * s[0], t[1] = a * e[1] + o * s[1], t[2] = a * e[2] + o * s[2], t;
  }
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
  static hermite(t, e, s, i, n, r) {
    const a = r * r, o = a * (2 * r - 3) + 1, l = a * (r - 2) + r, c = a * (r - 1), h = a * (3 - 2 * r);
    return t[0] = e[0] * o + s[0] * l + i[0] * c + n[0] * h, t[1] = e[1] * o + s[1] * l + i[1] * c + n[1] * h, t[2] = e[2] * o + s[2] * l + i[2] * c + n[2] * h, t;
  }
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
  static bezier(t, e, s, i, n, r) {
    const a = 1 - r, o = a * a, l = r * r, c = o * a, h = 3 * r * o, m = 3 * l * a, u = l * r;
    return t[0] = e[0] * c + s[0] * h + i[0] * m + n[0] * u, t[1] = e[1] * c + s[1] * h + i[1] * m + n[1] * u, t[2] = e[2] * c + s[2] * h + i[2] * m + n[2] * u, t;
  }
  /**
   * Generates a random vector with the given scale
   * @category Static
   *
   * @param out - the receiving vector
   * @param {Number} [scale] Length of the resulting vector. If omitted, a unit vector will be returned
   * @returns `out`
   */
  /*static random(out: Vec3Like, scale) {
      scale = scale === undefined ? 1.0 : scale;
  
      let r = glMatrix.RANDOM() * 2.0 * Math.PI;
      let z = glMatrix.RANDOM() * 2.0 - 1.0;
      let zScale = Math.sqrt(1.0 - z * z) * scale;
  
      out[0] = Math.cos(r) * zScale;
      out[1] = Math.sin(r) * zScale;
      out[2] = z * scale;
      return out;
    }*/
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
  static transformMat4(t, e, s) {
    const i = e[0], n = e[1], r = e[2], a = s[3] * i + s[7] * n + s[11] * r + s[15] || 1;
    return t[0] = (s[0] * i + s[4] * n + s[8] * r + s[12]) / a, t[1] = (s[1] * i + s[5] * n + s[9] * r + s[13]) / a, t[2] = (s[2] * i + s[6] * n + s[10] * r + s[14]) / a, t;
  }
  /**
   * Transforms the vec3 with a mat3.
   * @category Static
   *
   * @param out - the receiving vector
   * @param a - the vector to transform
   * @param m - the 3x3 matrix to transform with
   * @returns `out`
   */
  static transformMat3(t, e, s) {
    let i = e[0], n = e[1], r = e[2];
    return t[0] = i * s[0] + n * s[3] + r * s[6], t[1] = i * s[1] + n * s[4] + r * s[7], t[2] = i * s[2] + n * s[5] + r * s[8], t;
  }
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
  static transformQuat(t, e, s) {
    const i = s[0], n = s[1], r = s[2], a = s[3] * 2, o = e[0], l = e[1], c = e[2], h = n * c - r * l, m = r * o - i * c, u = i * l - n * o, f = (n * u - r * m) * 2, g = (r * h - i * u) * 2, p = (i * m - n * h) * 2;
    return t[0] = o + h * a + f, t[1] = l + m * a + g, t[2] = c + u * a + p, t;
  }
  /**
   * Rotate a 3D vector around the x-axis
   * @param out - The receiving vec3
   * @param a - The vec3 point to rotate
   * @param b - The origin of the rotation
   * @param rad - The angle of rotation in radians
   * @returns `out`
   */
  static rotateX(t, e, s, i) {
    const n = s[1], r = s[2], a = e[1] - n, o = e[2] - r;
    return t[0] = e[0], t[1] = a * Math.cos(i) - o * Math.sin(i) + n, t[2] = a * Math.sin(i) + o * Math.cos(i) + r, t;
  }
  /**
   * Rotate a 3D vector around the y-axis
   * @param out - The receiving vec3
   * @param a - The vec3 point to rotate
   * @param b - The origin of the rotation
   * @param rad - The angle of rotation in radians
   * @returns `out`
   */
  static rotateY(t, e, s, i) {
    const n = s[0], r = s[2], a = e[0] - n, o = e[2] - r;
    return t[0] = o * Math.sin(i) + a * Math.cos(i) + n, t[1] = e[1], t[2] = o * Math.cos(i) - a * Math.sin(i) + r, t;
  }
  /**
   * Rotate a 3D vector around the z-axis
   * @param out - The receiving vec3
   * @param a - The vec3 point to rotate
   * @param b - The origin of the rotation
   * @param rad - The angle of rotation in radians
   * @returns `out`
   */
  static rotateZ(t, e, s, i) {
    const n = s[0], r = s[1], a = e[0] - n, o = e[1] - r;
    return t[0] = a * Math.cos(i) - o * Math.sin(i) + n, t[1] = a * Math.sin(i) + o * Math.cos(i) + r, t[2] = s[2], t;
  }
  /**
   * Get the angle between two 3D vectors
   * @param a - The first operand
   * @param b - The second operand
   * @returns The angle in radians
   */
  static angle(t, e) {
    const s = t[0], i = t[1], n = t[2], r = e[0], a = e[1], o = e[2], l = Math.sqrt((s * s + i * i + n * n) * (r * r + a * a + o * o)), c = l && C.dot(t, e) / l;
    return Math.acos(Math.min(Math.max(c, -1), 1));
  }
  /**
   * Set the components of a vec3 to zero
   * @category Static
   *
   * @param out - the receiving vector
   * @returns `out`
   */
  static zero(t) {
    return t[0] = 0, t[1] = 0, t[2] = 0, t;
  }
  /**
   * Returns a string representation of a vector
   * @category Static
   *
   * @param a - vector to represent as a string
   * @returns string representation of the vector
   */
  static str(t) {
    return `Vec3(${t.join(", ")})`;
  }
  /**
   * Returns whether or not the vectors have exactly the same elements in the same position (when compared with ===)
   * @category Static
   *
   * @param a - The first vector.
   * @param b - The second vector.
   * @returns True if the vectors are equal, false otherwise.
   */
  static exactEquals(t, e) {
    return t[0] === e[0] && t[1] === e[1] && t[2] === e[2];
  }
  /**
   * Returns whether or not the vectors have approximately the same elements in the same position.
   * @category Static
   *
   * @param a - The first vector.
   * @param b - The second vector.
   * @returns True if the vectors are equal, false otherwise.
   */
  static equals(t, e) {
    const s = t[0], i = t[1], n = t[2], r = e[0], a = e[1], o = e[2];
    return Math.abs(s - r) <= O * Math.max(1, Math.abs(s), Math.abs(r)) && Math.abs(i - a) <= O * Math.max(1, Math.abs(i), Math.abs(a)) && Math.abs(n - o) <= O * Math.max(1, Math.abs(n), Math.abs(o));
  }
}
C.prototype.sub = C.prototype.subtract;
C.prototype.mul = C.prototype.multiply;
C.prototype.div = C.prototype.divide;
C.prototype.dist = C.prototype.distance;
C.prototype.sqrDist = C.prototype.squaredDistance;
C.sub = C.subtract;
C.mul = C.multiply;
C.div = C.divide;
C.dist = C.distance;
C.sqrDist = C.squaredDistance;
C.sqrLen = C.squaredLength;
C.mag = C.magnitude;
C.length = C.magnitude;
C.len = C.magnitude;
class D extends Float32Array {
  /**
   * The number of bytes in a {@link Vec4}.
   */
  static BYTE_LENGTH = 4 * Float32Array.BYTES_PER_ELEMENT;
  /**
   * Create a {@link Vec4}.
   */
  constructor(...t) {
    switch (t.length) {
      case 4:
        super(t);
        break;
      case 2:
        super(t[0], t[1], 4);
        break;
      case 1: {
        const e = t[0];
        typeof e == "number" ? super([e, e, e, e]) : super(e, 0, 4);
        break;
      }
      default:
        super(4);
        break;
    }
  }
  //============
  // Attributes
  //============
  // Getters and setters to make component access read better.
  // These are likely to be a little bit slower than direct array access.
  /**
   * The x component of the vector. Equivalent to `this[0];`
   * @category Vector components
   */
  get x() {
    return this[0];
  }
  set x(t) {
    this[0] = t;
  }
  /**
   * The y component of the vector. Equivalent to `this[1];`
   * @category Vector components
   */
  get y() {
    return this[1];
  }
  set y(t) {
    this[1] = t;
  }
  /**
   * The z component of the vector. Equivalent to `this[2];`
   * @category Vector components
   */
  get z() {
    return this[2];
  }
  set z(t) {
    this[2] = t;
  }
  /**
   * The w component of the vector. Equivalent to `this[3];`
   * @category Vector components
   */
  get w() {
    return this[3];
  }
  set w(t) {
    this[3] = t;
  }
  // Alternate set of getters and setters in case this is being used to define
  // a color.
  /**
   * The r component of the vector. Equivalent to `this[0];`
   * @category Color components
   */
  get r() {
    return this[0];
  }
  set r(t) {
    this[0] = t;
  }
  /**
   * The g component of the vector. Equivalent to `this[1];`
   * @category Color components
   */
  get g() {
    return this[1];
  }
  set g(t) {
    this[1] = t;
  }
  /**
   * The b component of the vector. Equivalent to `this[2];`
   * @category Color components
   */
  get b() {
    return this[2];
  }
  set b(t) {
    this[2] = t;
  }
  /**
   * The a component of the vector. Equivalent to `this[3];`
   * @category Color components
   */
  get a() {
    return this[3];
  }
  set a(t) {
    this[3] = t;
  }
  /**
   * The magnitude (length) of this.
   * Equivalent to `Vec4.magnitude(this);`
   *
   * Magnitude is used because the `length` attribute is already defined by
   * TypedArrays to mean the number of elements in the array.
   */
  get magnitude() {
    const t = this[0], e = this[1], s = this[2], i = this[3];
    return Math.sqrt(t * t + e * e + s * s + i * i);
  }
  /**
   * Alias for {@link Vec4.magnitude}
   */
  get mag() {
    return this.magnitude;
  }
  /**
   * A string representation of `this`
   * Equivalent to `Vec4.str(this);`
   */
  get str() {
    return D.str(this);
  }
  //===================
  // Instances methods
  //===================
  /**
   * Copy the values from another {@link Vec4} into `this`.
   *
   * @param a the source vector
   * @returns `this`
   */
  copy(t) {
    return super.set(t), this;
  }
  /**
   * Adds a {@link Vec4} to `this`.
   * Equivalent to `Vec4.add(this, this, b);`
   *
   * @param b - The vector to add to `this`
   * @returns `this`
   */
  add(t) {
    return this[0] += t[0], this[1] += t[1], this[2] += t[2], this[3] += t[3], this;
  }
  /**
   * Subtracts a {@link Vec4} from `this`.
   * Equivalent to `Vec4.subtract(this, this, b);`
   *
   * @param b - The vector to subtract from `this`
   * @returns `this`
   */
  subtract(t) {
    return this[0] -= t[0], this[1] -= t[1], this[2] -= t[2], this[3] -= t[3], this;
  }
  /**
   * Alias for {@link Vec4.subtract}
   */
  sub(t) {
    return this;
  }
  /**
   * Multiplies `this` by a {@link Vec4}.
   * Equivalent to `Vec4.multiply(this, this, b);`
   *
   * @param b - The vector to multiply `this` by
   * @returns `this`
   */
  multiply(t) {
    return this[0] *= t[0], this[1] *= t[1], this[2] *= t[2], this[3] *= t[3], this;
  }
  /**
   * Alias for {@link Vec4.multiply}
   */
  mul(t) {
    return this;
  }
  /**
   * Divides `this` by a {@link Vec4}.
   * Equivalent to `Vec4.divide(this, this, b);`
   *
   * @param b - The vector to divide `this` by
   * @returns `this`
   */
  divide(t) {
    return this[0] /= t[0], this[1] /= t[1], this[2] /= t[2], this[3] /= t[3], this;
  }
  /**
   * Alias for {@link Vec4.divide}
   */
  div(t) {
    return this;
  }
  /**
   * Scales `this` by a scalar number.
   * Equivalent to `Vec4.scale(this, this, b);`
   *
   * @param b - Amount to scale `this` by
   * @returns `this`
   */
  scale(t) {
    return this[0] *= t, this[1] *= t, this[2] *= t, this[3] *= t, this;
  }
  /**
   * Calculates `this` scaled by a scalar value then adds the result to `this`.
   * Equivalent to `Vec4.scaleAndAdd(this, this, b, scale);`
   *
   * @param b - The vector to add to `this`
   * @param scale - The amount to scale `b` by before adding
   * @returns `this`
   */
  scaleAndAdd(t, e) {
    return this[0] += t[0] * e, this[1] += t[1] * e, this[2] += t[2] * e, this[3] += t[3] * e, this;
  }
  /**
   * Calculates the euclidian distance between another {@link Vec4} and `this`.
   * Equivalent to `Vec4.distance(this, b);`
   *
   * @param b - The vector to calculate the distance to
   * @returns Distance between `this` and `b`
   */
  distance(t) {
    return D.distance(this, t);
  }
  /**
   * Alias for {@link Vec4.distance}
   */
  dist(t) {
    return 0;
  }
  /**
   * Calculates the squared euclidian distance between another {@link Vec4} and `this`.
   * Equivalent to `Vec4.squaredDistance(this, b);`
   *
   * @param b The vector to calculate the squared distance to
   * @returns Squared distance between `this` and `b`
   */
  squaredDistance(t) {
    return D.squaredDistance(this, t);
  }
  /**
   * Alias for {@link Vec4.squaredDistance}
   */
  sqrDist(t) {
    return 0;
  }
  /**
   * Negates the components of `this`.
   * Equivalent to `Vec4.negate(this, this);`
   *
   * @returns `this`
   */
  negate() {
    return this[0] *= -1, this[1] *= -1, this[2] *= -1, this[3] *= -1, this;
  }
  /**
   * Inverts the components of `this`.
   * Equivalent to `Vec4.inverse(this, this);`
   *
   * @returns `this`
   */
  invert() {
    return this[0] = 1 / this[0], this[1] = 1 / this[1], this[2] = 1 / this[2], this[3] = 1 / this[3], this;
  }
  /**
   * Sets each component of `this` to it's absolute value.
   * Equivalent to `Vec4.abs(this, this);`
   *
   * @returns `this`
   */
  abs() {
    return this[0] = Math.abs(this[0]), this[1] = Math.abs(this[1]), this[2] = Math.abs(this[2]), this[3] = Math.abs(this[3]), this;
  }
  /**
   * Calculates the dot product of this and another {@link Vec4}.
   * Equivalent to `Vec4.dot(this, b);`
   *
   * @param b - The second operand
   * @returns Dot product of `this` and `b`
   */
  dot(t) {
    return this[0] * t[0] + this[1] * t[1] + this[2] * t[2] + this[3] * t[3];
  }
  /**
   * Normalize `this`.
   * Equivalent to `Vec4.normalize(this, this);`
   *
   * @returns `this`
   */
  normalize() {
    return D.normalize(this, this);
  }
  //===================
  // Static methods
  //===================
  /**
   * Creates a new, empty {@link Vec4}
   * @category Static
   *
   * @returns a new 4D vector
   */
  static create() {
    return new D();
  }
  /**
   * Creates a new {@link Vec4} initialized with values from an existing vector
   * @category Static
   *
   * @param a - vector to clone
   * @returns a new 4D vector
   */
  static clone(t) {
    return new D(t);
  }
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
  static fromValues(t, e, s, i) {
    return new D(t, e, s, i);
  }
  /**
   * Copy the values from one {@link Vec4} to another
   * @category Static
   *
   * @param out - the receiving vector
   * @param a - the source vector
   * @returns `out`
   */
  static copy(t, e) {
    return t[0] = e[0], t[1] = e[1], t[2] = e[2], t[3] = e[3], t;
  }
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
  static set(t, e, s, i, n) {
    return t[0] = e, t[1] = s, t[2] = i, t[3] = n, t;
  }
  /**
   * Adds two {@link Vec4}s
   * @category Static
   *
   * @param out - The receiving vector
   * @param a - The first operand
   * @param b - The second operand
   * @returns `out`
   */
  static add(t, e, s) {
    return t[0] = e[0] + s[0], t[1] = e[1] + s[1], t[2] = e[2] + s[2], t[3] = e[3] + s[3], t;
  }
  /**
   * Subtracts vector b from vector a
   * @category Static
   *
   * @param out - the receiving vector
   * @param a - the first operand
   * @param b - the second operand
   * @returns `out`
   */
  static subtract(t, e, s) {
    return t[0] = e[0] - s[0], t[1] = e[1] - s[1], t[2] = e[2] - s[2], t[3] = e[3] - s[3], t;
  }
  /**
   * Alias for {@link Vec4.subtract}
   * @category Static
   */
  static sub(t, e, s) {
    return t;
  }
  /**
   * Multiplies two {@link Vec4}'s
   * @category Static
   *
   * @param out - the receiving vector
   * @param a - the first operand
   * @param b - the second operand
   * @returns `out`
   */
  static multiply(t, e, s) {
    return t[0] = e[0] * s[0], t[1] = e[1] * s[1], t[2] = e[2] * s[2], t[3] = e[3] * s[3], t;
  }
  /**
   * Alias for {@link Vec4.multiply}
   * @category Static
   */
  static mul(t, e, s) {
    return t;
  }
  /**
   * Divides two {@link Vec4}'s
   * @category Static
   *
   * @param out - the receiving vector
   * @param a - the first operand
   * @param b - the second operand
   * @returns `out`
   */
  static divide(t, e, s) {
    return t[0] = e[0] / s[0], t[1] = e[1] / s[1], t[2] = e[2] / s[2], t[3] = e[3] / s[3], t;
  }
  /**
   * Alias for {@link Vec4.divide}
   * @category Static
   */
  static div(t, e, s) {
    return t;
  }
  /**
   * Math.ceil the components of a {@link Vec4}
   * @category Static
   *
   * @param out - the receiving vector
   * @param a - vector to ceil
   * @returns `out`
   */
  static ceil(t, e) {
    return t[0] = Math.ceil(e[0]), t[1] = Math.ceil(e[1]), t[2] = Math.ceil(e[2]), t[3] = Math.ceil(e[3]), t;
  }
  /**
   * Math.floor the components of a {@link Vec4}
   * @category Static
   *
   * @param out - the receiving vector
   * @param a - vector to floor
   * @returns `out`
   */
  static floor(t, e) {
    return t[0] = Math.floor(e[0]), t[1] = Math.floor(e[1]), t[2] = Math.floor(e[2]), t[3] = Math.floor(e[3]), t;
  }
  /**
   * Returns the minimum of two {@link Vec4}'s
   * @category Static
   *
   * @param out - the receiving vector
   * @param a - the first operand
   * @param b - the second operand
   * @returns `out`
   */
  static min(t, e, s) {
    return t[0] = Math.min(e[0], s[0]), t[1] = Math.min(e[1], s[1]), t[2] = Math.min(e[2], s[2]), t[3] = Math.min(e[3], s[3]), t;
  }
  /**
   * Returns the maximum of two {@link Vec4}'s
   * @category Static
   *
   * @param out - the receiving vector
   * @param a - the first operand
   * @param b - the second operand
   * @returns `out`
   */
  static max(t, e, s) {
    return t[0] = Math.max(e[0], s[0]), t[1] = Math.max(e[1], s[1]), t[2] = Math.max(e[2], s[2]), t[3] = Math.max(e[3], s[3]), t;
  }
  /**
   * Math.round the components of a {@link Vec4}
   * @category Static
   *
   * @param out - the receiving vector
   * @param a - vector to round
   * @returns `out`
   */
  static round(t, e) {
    return t[0] = Math.round(e[0]), t[1] = Math.round(e[1]), t[2] = Math.round(e[2]), t[3] = Math.round(e[3]), t;
  }
  /**
   * Scales a {@link Vec4} by a scalar number
   * @category Static
   *
   * @param out - the receiving vector
   * @param a - the vector to scale
   * @param scale - amount to scale the vector by
   * @returns `out`
   */
  static scale(t, e, s) {
    return t[0] = e[0] * s, t[1] = e[1] * s, t[2] = e[2] * s, t[3] = e[3] * s, t;
  }
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
  static scaleAndAdd(t, e, s, i) {
    return t[0] = e[0] + s[0] * i, t[1] = e[1] + s[1] * i, t[2] = e[2] + s[2] * i, t[3] = e[3] + s[3] * i, t;
  }
  /**
   * Calculates the euclidian distance between two {@link Vec4}'s
   * @category Static
   *
   * @param a - the first operand
   * @param b - the second operand
   * @returns distance between a and b
   */
  static distance(t, e) {
    const s = e[0] - t[0], i = e[1] - t[1], n = e[2] - t[2], r = e[3] - t[3];
    return Math.hypot(s, i, n, r);
  }
  /**
   * Alias for {@link Vec4.distance}
   * @category Static
   */
  static dist(t, e) {
    return 0;
  }
  /**
   * Calculates the squared euclidian distance between two {@link Vec4}'s
   * @category Static
   *
   * @param a - the first operand
   * @param b - the second operand
   * @returns squared distance between a and b
   */
  static squaredDistance(t, e) {
    const s = e[0] - t[0], i = e[1] - t[1], n = e[2] - t[2], r = e[3] - t[3];
    return s * s + i * i + n * n + r * r;
  }
  /**
   * Alias for {@link Vec4.squaredDistance}
   * @category Static
   */
  static sqrDist(t, e) {
    return 0;
  }
  /**
   * Calculates the magnitude (length) of a {@link Vec4}
   * @category Static
   *
   * @param a - vector to calculate length of
   * @returns length of `a`
   */
  static magnitude(t) {
    const e = t[0], s = t[1], i = t[2], n = t[3];
    return Math.sqrt(e * e + s * s + i * i + n * n);
  }
  /**
   * Alias for {@link Vec4.magnitude}
   * @category Static
   */
  static mag(t) {
    return 0;
  }
  /**
   * Alias for {@link Vec4.magnitude}
   * @category Static
   * @deprecated Use {@link Vec4.magnitude} to avoid conflicts with builtin `length` methods/attribs
   */
  // @ts-ignore: Length conflicts with Function.length
  static length(t) {
    return 0;
  }
  /**
   * Alias for {@link Vec4.magnitude}
   * @category Static
   * @deprecated Use {@link Vec4.mag}
   */
  static len(t) {
    return 0;
  }
  /**
   * Calculates the squared length of a {@link Vec4}
   * @category Static
   *
   * @param a - vector to calculate squared length of
   * @returns squared length of a
   */
  static squaredLength(t) {
    const e = t[0], s = t[1], i = t[2], n = t[3];
    return e * e + s * s + i * i + n * n;
  }
  /**
   * Alias for {@link Vec4.squaredLength}
   * @category Static
   */
  static sqrLen(t) {
    return 0;
  }
  /**
   * Negates the components of a {@link Vec4}
   * @category Static
   *
   * @param out - the receiving vector
   * @param a - vector to negate
   * @returns `out`
   */
  static negate(t, e) {
    return t[0] = -e[0], t[1] = -e[1], t[2] = -e[2], t[3] = -e[3], t;
  }
  /**
   * Returns the inverse of the components of a {@link Vec4}
   * @category Static
   *
   * @param out - the receiving vector
   * @param a - vector to invert
   * @returns `out`
   */
  static inverse(t, e) {
    return t[0] = 1 / e[0], t[1] = 1 / e[1], t[2] = 1 / e[2], t[3] = 1 / e[3], t;
  }
  /**
   * Returns the absolute value of the components of a {@link Vec4}
   * @category Static
   *
   * @param out - The receiving vector
   * @param a - Vector to compute the absolute values of
   * @returns `out`
   */
  static abs(t, e) {
    return t[0] = Math.abs(e[0]), t[1] = Math.abs(e[1]), t[2] = Math.abs(e[2]), t[3] = Math.abs(e[3]), t;
  }
  /**
   * Normalize a {@link Vec4}
   * @category Static
   *
   * @param out - the receiving vector
   * @param a - vector to normalize
   * @returns `out`
   */
  static normalize(t, e) {
    const s = e[0], i = e[1], n = e[2], r = e[3];
    let a = s * s + i * i + n * n + r * r;
    return a > 0 && (a = 1 / Math.sqrt(a)), t[0] = s * a, t[1] = i * a, t[2] = n * a, t[3] = r * a, t;
  }
  /**
   * Calculates the dot product of two {@link Vec4}'s
   * @category Static
   *
   * @param a - the first operand
   * @param b - the second operand
   * @returns dot product of a and b
   */
  static dot(t, e) {
    return t[0] * e[0] + t[1] * e[1] + t[2] * e[2] + t[3] * e[3];
  }
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
  static cross(t, e, s, i) {
    const n = s[0] * i[1] - s[1] * i[0], r = s[0] * i[2] - s[2] * i[0], a = s[0] * i[3] - s[3] * i[0], o = s[1] * i[2] - s[2] * i[1], l = s[1] * i[3] - s[3] * i[1], c = s[2] * i[3] - s[3] * i[2], h = e[0], m = e[1], u = e[2], f = e[3];
    return t[0] = m * c - u * l + f * o, t[1] = -(h * c) + u * a - f * r, t[2] = h * l - m * a + f * n, t[3] = -(h * o) + m * r - u * n, t;
  }
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
  static lerp(t, e, s, i) {
    const n = e[0], r = e[1], a = e[2], o = e[3];
    return t[0] = n + i * (s[0] - n), t[1] = r + i * (s[1] - r), t[2] = a + i * (s[2] - a), t[3] = o + i * (s[3] - o), t;
  }
  /**
   * Generates a random vector with the given scale
   * @category Static
   *
   * @param out - the receiving vector
   * @param [scale] - Length of the resulting vector. If ommitted, a unit vector will be returned
   * @returns `out`
   */
  /*static random(out: Vec4Like, scale): Vec4Like {
      scale = scale || 1.0;
  
      // Marsaglia, George. Choosing a Point from the Surface of a
      // Sphere. Ann. Math. Statist. 43 (1972), no. 2, 645--646.
      // http://projecteuclid.org/euclid.aoms/1177692644;
      var v1, v2, v3, v4;
      var s1, s2;
      do {
        v1 = glMatrix.RANDOM() * 2 - 1;
        v2 = glMatrix.RANDOM() * 2 - 1;
        s1 = v1 * v1 + v2 * v2;
      } while (s1 >= 1);
      do {
        v3 = glMatrix.RANDOM() * 2 - 1;
        v4 = glMatrix.RANDOM() * 2 - 1;
        s2 = v3 * v3 + v4 * v4;
      } while (s2 >= 1);
  
      var d = Math.sqrt((1 - s1) / s2);
      out[0] = scale * v1;
      out[1] = scale * v2;
      out[2] = scale * v3 * d;
      out[3] = scale * v4 * d;
      return out;
    }*/
  /**
   * Transforms the {@link Vec4} with a {@link Mat4}.
   * @category Static
   *
   * @param out - the receiving vector
   * @param a - the vector to transform
   * @param m - matrix to transform with
   * @returns `out`
   */
  static transformMat4(t, e, s) {
    const i = e[0], n = e[1], r = e[2], a = e[3];
    return t[0] = s[0] * i + s[4] * n + s[8] * r + s[12] * a, t[1] = s[1] * i + s[5] * n + s[9] * r + s[13] * a, t[2] = s[2] * i + s[6] * n + s[10] * r + s[14] * a, t[3] = s[3] * i + s[7] * n + s[11] * r + s[15] * a, t;
  }
  /**
   * Transforms the {@link Vec4} with a {@link Quat}
   * @category Static
   *
   * @param out - the receiving vector
   * @param a - the vector to transform
   * @param q - quaternion to transform with
   * @returns `out`
   */
  static transformQuat(t, e, s) {
    const i = e[0], n = e[1], r = e[2], a = s[0], o = s[1], l = s[2], c = s[3], h = c * i + o * r - l * n, m = c * n + l * i - a * r, u = c * r + a * n - o * i, f = -a * i - o * n - l * r;
    return t[0] = h * c + f * -a + m * -l - u * -o, t[1] = m * c + f * -o + u * -a - h * -l, t[2] = u * c + f * -l + h * -o - m * -a, t[3] = e[3], t;
  }
  /**
   * Set the components of a {@link Vec4} to zero
   * @category Static
   *
   * @param out - the receiving vector
   * @returns `out`
   */
  static zero(t) {
    return t[0] = 0, t[1] = 0, t[2] = 0, t[3] = 0, t;
  }
  /**
   * Returns a string representation of a {@link Vec4}
   * @category Static
   *
   * @param a - vector to represent as a string
   * @returns string representation of the vector
   */
  static str(t) {
    return `Vec4(${t.join(", ")})`;
  }
  /**
   * Returns whether or not the vectors have exactly the same elements in the same position (when compared with ===)
   * @category Static
   *
   * @param a - The first vector.
   * @param b - The second vector.
   * @returns True if the vectors are equal, false otherwise.
   */
  static exactEquals(t, e) {
    return t[0] === e[0] && t[1] === e[1] && t[2] === e[2] && t[3] === e[3];
  }
  /**
   * Returns whether or not the vectors have approximately the same elements in the same position.
   * @category Static
   *
   * @param a - The first vector.
   * @param b - The second vector.
   * @returns True if the vectors are equal, false otherwise.
   */
  static equals(t, e) {
    const s = t[0], i = t[1], n = t[2], r = t[3], a = e[0], o = e[1], l = e[2], c = e[3];
    return Math.abs(s - a) <= O * Math.max(1, Math.abs(s), Math.abs(a)) && Math.abs(i - o) <= O * Math.max(1, Math.abs(i), Math.abs(o)) && Math.abs(n - l) <= O * Math.max(1, Math.abs(n), Math.abs(l)) && Math.abs(r - c) <= O * Math.max(1, Math.abs(r), Math.abs(c));
  }
}
D.prototype.sub = D.prototype.subtract;
D.prototype.mul = D.prototype.multiply;
D.prototype.div = D.prototype.divide;
D.prototype.dist = D.prototype.distance;
D.prototype.sqrDist = D.prototype.squaredDistance;
D.sub = D.subtract;
D.mul = D.multiply;
D.div = D.divide;
D.dist = D.distance;
D.sqrDist = D.squaredDistance;
D.sqrLen = D.squaredLength;
D.mag = D.magnitude;
D.length = D.magnitude;
D.len = D.magnitude;
class A extends Float32Array {
  /**
   * The number of bytes in a {@link Vec2}.
   */
  static BYTE_LENGTH = 2 * Float32Array.BYTES_PER_ELEMENT;
  /**
   * Create a {@link Vec2}.
   */
  constructor(...t) {
    switch (t.length) {
      case 2: {
        const e = t[0];
        typeof e == "number" ? super([e, t[1]]) : super(e, t[1], 2);
        break;
      }
      case 1: {
        const e = t[0];
        typeof e == "number" ? super([e, e]) : super(e, 0, 2);
        break;
      }
      default:
        super(2);
        break;
    }
  }
  //============
  // Attributes
  //============
  // Getters and setters to make component access read better.
  // These are likely to be a little bit slower than direct array access.
  /**
   * The x component of the vector. Equivalent to `this[0];`
   * @category Vector components
   */
  get x() {
    return this[0];
  }
  set x(t) {
    this[0] = t;
  }
  /**
   * The y component of the vector. Equivalent to `this[1];`
   * @category Vector components
   */
  get y() {
    return this[1];
  }
  set y(t) {
    this[1] = t;
  }
  // Alternate set of getters and setters in case this is being used to define
  // a color.
  /**
   * The r component of the vector. Equivalent to `this[0];`
   * @category Color components
   */
  get r() {
    return this[0];
  }
  set r(t) {
    this[0] = t;
  }
  /**
   * The g component of the vector. Equivalent to `this[1];`
   * @category Color components
   */
  get g() {
    return this[1];
  }
  set g(t) {
    this[1] = t;
  }
  /**
   * The magnitude (length) of this.
   * Equivalent to `Vec2.magnitude(this);`
   *
   * Magnitude is used because the `length` attribute is already defined by
   * TypedArrays to mean the number of elements in the array.
   */
  get magnitude() {
    return Math.hypot(this[0], this[1]);
  }
  /**
   * Alias for {@link Vec2.magnitude}
   */
  get mag() {
    return this.magnitude;
  }
  /**
   * The squared magnitude (length) of `this`.
   * Equivalent to `Vec2.squaredMagnitude(this);`
   */
  get squaredMagnitude() {
    const t = this[0], e = this[1];
    return t * t + e * e;
  }
  /**
   * Alias for {@link Vec2.squaredMagnitude}
   */
  get sqrMag() {
    return this.squaredMagnitude;
  }
  /**
   * A string representation of `this`
   * Equivalent to `Vec2.str(this);`
   */
  get str() {
    return A.str(this);
  }
  //===================
  // Instances methods
  //===================
  /**
   * Copy the values from another {@link Vec2} into `this`.
   *
   * @param a the source vector
   * @returns `this`
   */
  copy(t) {
    return this.set(t), this;
  }
  // Instead of zero(), use a.fill(0) for instances;
  /**
   * Adds a {@link Vec2} to `this`.
   * Equivalent to `Vec2.add(this, this, b);`
   *
   * @param b - The vector to add to `this`
   * @returns `this`
   */
  add(t) {
    return this[0] += t[0], this[1] += t[1], this;
  }
  /**
   * Subtracts a {@link Vec2} from `this`.
   * Equivalent to `Vec2.subtract(this, this, b);`
   *
   * @param b - The vector to subtract from `this`
   * @returns `this`
   */
  subtract(t) {
    return this[0] -= t[0], this[1] -= t[1], this;
  }
  /**
   * Alias for {@link Vec2.subtract}
   */
  sub(t) {
    return this;
  }
  /**
   * Multiplies `this` by a {@link Vec2}.
   * Equivalent to `Vec2.multiply(this, this, b);`
   *
   * @param b - The vector to multiply `this` by
   * @returns `this`
   */
  multiply(t) {
    return this[0] *= t[0], this[1] *= t[1], this;
  }
  /**
   * Alias for {@link Vec2.multiply}
   */
  mul(t) {
    return this;
  }
  /**
   * Divides `this` by a {@link Vec2}.
   * Equivalent to `Vec2.divide(this, this, b);`
   *
   * @param b - The vector to divide `this` by
   * @returns {Vec2} `this`
   */
  divide(t) {
    return this[0] /= t[0], this[1] /= t[1], this;
  }
  /**
   * Alias for {@link Vec2.divide}
   */
  div(t) {
    return this;
  }
  /**
   * Scales `this` by a scalar number.
   * Equivalent to `Vec2.scale(this, this, b);`
   *
   * @param b - Amount to scale `this` by
   * @returns `this`
   */
  scale(t) {
    return this[0] *= t, this[1] *= t, this;
  }
  /**
   * Calculates `this` scaled by a scalar value then adds the result to `this`.
   * Equivalent to `Vec2.scaleAndAdd(this, this, b, scale);`
   *
   * @param b - The vector to add to `this`
   * @param scale - The amount to scale `b` by before adding
   * @returns `this`
   */
  scaleAndAdd(t, e) {
    return this[0] += t[0] * e, this[1] += t[1] * e, this;
  }
  /**
   * Calculates the euclidian distance between another {@link Vec2} and `this`.
   * Equivalent to `Vec2.distance(this, b);`
   *
   * @param b - The vector to calculate the distance to
   * @returns Distance between `this` and `b`
   */
  distance(t) {
    return A.distance(this, t);
  }
  /**
   * Alias for {@link Vec2.distance}
   */
  dist(t) {
    return 0;
  }
  /**
   * Calculates the squared euclidian distance between another {@link Vec2} and `this`.
   * Equivalent to `Vec2.squaredDistance(this, b);`
   *
   * @param b The vector to calculate the squared distance to
   * @returns Squared distance between `this` and `b`
   */
  squaredDistance(t) {
    return A.squaredDistance(this, t);
  }
  /**
   * Alias for {@link Vec2.squaredDistance}
   */
  sqrDist(t) {
    return 0;
  }
  /**
   * Negates the components of `this`.
   * Equivalent to `Vec2.negate(this, this);`
   *
   * @returns `this`
   */
  negate() {
    return this[0] *= -1, this[1] *= -1, this;
  }
  /**
   * Inverts the components of `this`.
   * Equivalent to `Vec2.inverse(this, this);`
   *
   * @returns `this`
   */
  invert() {
    return this[0] = 1 / this[0], this[1] = 1 / this[1], this;
  }
  /**
   * Sets each component of `this` to it's absolute value.
   * Equivalent to `Vec2.abs(this, this);`
   *
   * @returns `this`
   */
  abs() {
    return this[0] = Math.abs(this[0]), this[1] = Math.abs(this[1]), this;
  }
  /**
   * Calculates the dot product of this and another {@link Vec2}.
   * Equivalent to `Vec2.dot(this, b);`
   *
   * @param b - The second operand
   * @returns Dot product of `this` and `b`
   */
  dot(t) {
    return this[0] * t[0] + this[1] * t[1];
  }
  /**
   * Normalize `this`.
   * Equivalent to `Vec2.normalize(this, this);`
   *
   * @returns `this`
   */
  normalize() {
    return A.normalize(this, this);
  }
  //================
  // Static methods
  //================
  /**
   * Creates a new, empty {@link Vec2}
   * @category Static
   *
   * @returns A new 2D vector
   */
  static create() {
    return new A();
  }
  /**
   * Creates a new {@link Vec2} initialized with values from an existing vector
   * @category Static
   *
   * @param a - Vector to clone
   * @returns A new 2D vector
   */
  static clone(t) {
    return new A(t);
  }
  /**
   * Creates a new {@link Vec2} initialized with the given values
   * @category Static
   *
   * @param x - X component
   * @param y - Y component
   * @returns A new 2D vector
   */
  static fromValues(t, e) {
    return new A(t, e);
  }
  /**
   * Copy the values from one {@link Vec2} to another
   * @category Static
   *
   * @param out - the receiving vector
   * @param a - The source vector
   * @returns `out`
   */
  static copy(t, e) {
    return t[0] = e[0], t[1] = e[1], t;
  }
  /**
   * Set the components of a {@link Vec2} to the given values
   * @category Static
   *
   * @param out - The receiving vector
   * @param x - X component
   * @param y - Y component
   * @returns `out`
   */
  static set(t, e, s) {
    return t[0] = e, t[1] = s, t;
  }
  /**
   * Adds two {@link Vec2}s
   * @category Static
   *
   * @param out - The receiving vector
   * @param a - The first operand
   * @param b - The second operand
   * @returns `out`
   */
  static add(t, e, s) {
    return t[0] = e[0] + s[0], t[1] = e[1] + s[1], t;
  }
  /**
   * Subtracts vector b from vector a
   * @category Static
   *
   * @param out - The receiving vector
   * @param a - The first operand
   * @param b - The second operand
   * @returns `out`
   */
  static subtract(t, e, s) {
    return t[0] = e[0] - s[0], t[1] = e[1] - s[1], t;
  }
  /**
   * Alias for {@link Vec2.subtract}
   * @category Static
   */
  static sub(t, e, s) {
    return [0, 0];
  }
  /**
   * Multiplies two {@link Vec2}s
   * @category Static
   *
   * @param out - The receiving vector
   * @param a - The first operand
   * @param b - The second operand
   * @returns `out`
   */
  static multiply(t, e, s) {
    return t[0] = e[0] * s[0], t[1] = e[1] * s[1], t;
  }
  /**
   * Alias for {@link Vec2.multiply}
   * @category Static
   */
  static mul(t, e, s) {
    return [0, 0];
  }
  /**
   * Divides two {@link Vec2}s
   * @category Static
   *
   * @param out - The receiving vector
   * @param a - The first operand
   * @param b - The second operand
   * @returns `out`
   */
  static divide(t, e, s) {
    return t[0] = e[0] / s[0], t[1] = e[1] / s[1], t;
  }
  /**
   * Alias for {@link Vec2.divide}
   * @category Static
   */
  static div(t, e, s) {
    return [0, 0];
  }
  /**
   * Math.ceil the components of a {@link Vec2}
   * @category Static
   *
   * @param out - The receiving vector
   * @param a - Vector to ceil
   * @returns `out`
   */
  static ceil(t, e) {
    return t[0] = Math.ceil(e[0]), t[1] = Math.ceil(e[1]), t;
  }
  /**
   * Math.floor the components of a {@link Vec2}
   * @category Static
   *
   * @param out - The receiving vector
   * @param a - Vector to floor
   * @returns `out`
   */
  static floor(t, e) {
    return t[0] = Math.floor(e[0]), t[1] = Math.floor(e[1]), t;
  }
  /**
   * Returns the minimum of two {@link Vec2}s
   * @category Static
   *
   * @param out - The receiving vector
   * @param a - The first operand
   * @param b - The second operand
   * @returns `out`
   */
  static min(t, e, s) {
    return t[0] = Math.min(e[0], s[0]), t[1] = Math.min(e[1], s[1]), t;
  }
  /**
   * Returns the maximum of two {@link Vec2}s
   * @category Static
   *
   * @param out - The receiving vector
   * @param a - The first operand
   * @param b - The second operand
   * @returns `out`
   */
  static max(t, e, s) {
    return t[0] = Math.max(e[0], s[0]), t[1] = Math.max(e[1], s[1]), t;
  }
  /**
   * Math.round the components of a {@link Vec2}
   * @category Static
   *
   * @param out - The receiving vector
   * @param a - Vector to round
   * @returns `out`
   */
  static round(t, e) {
    return t[0] = Math.round(e[0]), t[1] = Math.round(e[1]), t;
  }
  /**
   * Scales a {@link Vec2} by a scalar number
   * @category Static
   *
   * @param out - The receiving vector
   * @param a - The vector to scale
   * @param b - Amount to scale the vector by
   * @returns `out`
   */
  static scale(t, e, s) {
    return t[0] = e[0] * s, t[1] = e[1] * s, t;
  }
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
  static scaleAndAdd(t, e, s, i) {
    return t[0] = e[0] + s[0] * i, t[1] = e[1] + s[1] * i, t;
  }
  /**
   * Calculates the euclidian distance between two {@link Vec2}s
   * @category Static
   *
   * @param a - The first operand
   * @param b - The second operand
   * @returns distance between `a` and `b`
   */
  static distance(t, e) {
    return Math.hypot(e[0] - t[0], e[1] - t[1]);
  }
  /**
   * Alias for {@link Vec2.distance}
   * @category Static
   */
  static dist(t, e) {
    return 0;
  }
  /**
   * Calculates the squared euclidian distance between two {@link Vec2}s
   * @category Static
   *
   * @param a - The first operand
   * @param b - The second operand
   * @returns Squared distance between `a` and `b`
   */
  static squaredDistance(t, e) {
    const s = e[0] - t[0], i = e[1] - t[1];
    return s * s + i * i;
  }
  /**
   * Alias for {@link Vec2.distance}
   * @category Static
   */
  static sqrDist(t, e) {
    return 0;
  }
  /**
   * Calculates the magnitude (length) of a {@link Vec2}
   * @category Static
   *
   * @param a - Vector to calculate magnitude of
   * @returns Magnitude of a
   */
  static magnitude(t) {
    let e = t[0], s = t[1];
    return Math.sqrt(e * e + s * s);
  }
  /**
   * Alias for {@link Vec2.magnitude}
   * @category Static
   */
  static mag(t) {
    return 0;
  }
  /**
   * Alias for {@link Vec2.magnitude}
   * @category Static
   * @deprecated Use {@link Vec2.magnitude} to avoid conflicts with builtin `length` methods/attribs
   *
   * @param a - vector to calculate length of
   * @returns length of a
   */
  // @ts-ignore: Length conflicts with Function.length
  static length(t) {
    return 0;
  }
  /**
   * Alias for {@link Vec2.magnitude}
   * @category Static
   * @deprecated Use {@link Vec2.mag}
   */
  static len(t) {
    return 0;
  }
  /**
   * Calculates the squared length of a {@link Vec2}
   * @category Static
   *
   * @param a - Vector to calculate squared length of
   * @returns Squared length of a
   */
  static squaredLength(t) {
    const e = t[0], s = t[1];
    return e * e + s * s;
  }
  /**
   * Alias for {@link Vec2.squaredLength}
   */
  static sqrLen(t, e) {
    return 0;
  }
  /**
   * Negates the components of a {@link Vec2}
   * @category Static
   *
   * @param out - The receiving vector
   * @param a - Vector to negate
   * @returns `out`
   */
  static negate(t, e) {
    return t[0] = -e[0], t[1] = -e[1], t;
  }
  /**
   * Returns the inverse of the components of a {@link Vec2}
   * @category Static
   *
   * @param out - The receiving vector
   * @param a - Vector to invert
   * @returns `out`
   */
  static inverse(t, e) {
    return t[0] = 1 / e[0], t[1] = 1 / e[1], t;
  }
  /**
   * Returns the absolute value of the components of a {@link Vec2}
   * @category Static
   *
   * @param out - The receiving vector
   * @param a - Vector to compute the absolute values of
   * @returns `out`
   */
  static abs(t, e) {
    return t[0] = Math.abs(e[0]), t[1] = Math.abs(e[1]), t;
  }
  /**
   * Normalize a {@link Vec2}
   * @category Static
   *
   * @param out - The receiving vector
   * @param a - Vector to normalize
   * @returns `out`
   */
  static normalize(t, e) {
    const s = e[0], i = e[1];
    let n = s * s + i * i;
    return n > 0 && (n = 1 / Math.sqrt(n)), t[0] = e[0] * n, t[1] = e[1] * n, t;
  }
  /**
   * Calculates the dot product of two {@link Vec2}s
   * @category Static
   *
   * @param a - The first operand
   * @param b - The second operand
   * @returns Dot product of `a` and `b`
   */
  static dot(t, e) {
    return t[0] * e[0] + t[1] * e[1];
  }
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
  static cross(t, e, s) {
    const i = e[0] * s[1] - e[1] * s[0];
    return t[0] = t[1] = 0, t[2] = i, t;
  }
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
  static lerp(t, e, s, i) {
    const n = e[0], r = e[1];
    return t[0] = n + i * (s[0] - n), t[1] = r + i * (s[1] - r), t;
  }
  /**
   * Transforms the {@link Vec2} with a {@link Mat2}
   *
   * @param out - The receiving vector
   * @param a - The vector to transform
   * @param m - Matrix to transform with
   * @returns `out`
   */
  static transformMat2(t, e, s) {
    const i = e[0], n = e[1];
    return t[0] = s[0] * i + s[2] * n, t[1] = s[1] * i + s[3] * n, t;
  }
  /**
   * Transforms the {@link Vec2} with a {@link Mat2d}
   *
   * @param out - The receiving vector
   * @param a - The vector to transform
   * @param m - Matrix to transform with
   * @returns `out`
   */
  static transformMat2d(t, e, s) {
    const i = e[0], n = e[1];
    return t[0] = s[0] * i + s[2] * n + s[4], t[1] = s[1] * i + s[3] * n + s[5], t;
  }
  /**
   * Transforms the {@link Vec2} with a {@link Mat3}
   * 3rd vector component is implicitly '1'
   *
   * @param out - The receiving vector
   * @param a - The vector to transform
   * @param m - Matrix to transform with
   * @returns `out`
   */
  static transformMat3(t, e, s) {
    const i = e[0], n = e[1];
    return t[0] = s[0] * i + s[3] * n + s[6], t[1] = s[1] * i + s[4] * n + s[7], t;
  }
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
  static transformMat4(t, e, s) {
    const i = e[0], n = e[1];
    return t[0] = s[0] * i + s[4] * n + s[12], t[1] = s[1] * i + s[5] * n + s[13], t;
  }
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
  static rotate(t, e, s, i) {
    const n = e[0] - s[0], r = e[1] - s[1], a = Math.sin(i), o = Math.cos(i);
    return t[0] = n * o - r * a + s[0], t[1] = n * a + r * o + s[1], t;
  }
  /**
   * Get the angle between two 2D vectors
   * @category Static
   *
   * @param a - The first operand
   * @param b - The second operand
   * @returns The angle in radians
   */
  static angle(t, e) {
    const s = t[0], i = t[1], n = e[0], r = e[1], a = Math.sqrt(s * s + i * i) * Math.sqrt(n * n + r * r), o = a && (s * n + i * r) / a;
    return Math.acos(Math.min(Math.max(o, -1), 1));
  }
  /**
   * Set the components of a {@link Vec2} to zero
   * @category Static
   *
   * @param out - The receiving vector
   * @returns `out`
   */
  static zero(t) {
    return t[0] = 0, t[1] = 0, t;
  }
  /**
   * Returns whether or not the vectors have exactly the same elements in the same position (when compared with ===)
   * @category Static
   *
   * @param a - The first vector.
   * @param b - The second vector.
   * @returns `true` if the vectors components are ===, `false` otherwise.
   */
  static exactEquals(t, e) {
    return t[0] === e[0] && t[1] === e[1];
  }
  /**
   * Returns whether or not the vectors have approximately the same elements in the same position.
   * @category Static
   *
   * @param a - The first vector.
   * @param b - The second vector.
   * @returns `true` if the vectors are approximately equal, `false` otherwise.
   */
  static equals(t, e) {
    const s = t[0], i = t[1], n = e[0], r = e[1];
    return Math.abs(s - n) <= O * Math.max(1, Math.abs(s), Math.abs(n)) && Math.abs(i - r) <= O * Math.max(1, Math.abs(i), Math.abs(r));
  }
  /**
   * Returns a string representation of a vector
   * @category Static
   *
   * @param a - Vector to represent as a string
   * @returns String representation of the vector
   */
  static str(t) {
    return `Vec2(${t.join(", ")})`;
  }
}
A.prototype.sub = A.prototype.subtract;
A.prototype.mul = A.prototype.multiply;
A.prototype.div = A.prototype.divide;
A.prototype.dist = A.prototype.distance;
A.prototype.sqrDist = A.prototype.squaredDistance;
A.sub = A.subtract;
A.mul = A.multiply;
A.div = A.divide;
A.dist = A.distance;
A.sqrDist = A.squaredDistance;
A.sqrLen = A.squaredLength;
A.mag = A.magnitude;
A.length = A.magnitude;
A.len = A.magnitude;
function Me(d) {
  return new Promise((t, e) => {
    const s = document.createElement("img");
    s.onload = () => t(s), s.onerror = e, s.src = d, s.crossOrigin = "anonymous", s.loading = "eager";
  });
}
function be(d) {
  return new Promise((t, e) => {
    const s = document.createElement("video");
    let i = !1, n = !1, r = !1;
    s.addEventListener(
      "playing",
      () => {
        i = !0, a();
      },
      !0
    ), s.addEventListener(
      "timeupdate",
      () => {
        n = !0, a();
      },
      !0
    ), s.addEventListener(
      "error",
      (o) => {
        r = !0, e(o);
      },
      !0
    );
    function a() {
      i && n && !r && t(s);
    }
    s.src = d, s.playsInline = !0, s.crossOrigin = "anonymous", s.autoplay = !0, s.loop = !0, s.muted = !0, s.play();
  });
}
function ee(d, t = !1) {
  return t ? be(d) : Me(d);
}
function se(d) {
  return new Promise((t, e) => {
    (d instanceof HTMLImageElement ? d.complete : d.readyState >= 3) ? t(d) : (d.onload = () => t(d), d.onerror = e);
  });
}
function xe(d, t, e) {
  const s = d.data, i = d.width, n = d.height;
  let r, a, o, l, c, h, m, u, f, g, p, y, L;
  const x = i - 1, M = n - 1, b = t + 1, w = t + b, T = t + 1, v = t + T, P = 1 / (w * v), z = [], E = [], F = [], _ = [], R = [], k = [];
  for (; e-- > 0; ) {
    for (L = y = 0, h = 0; h < n; h++) {
      for (r = s[L] * b, a = s[L + 1] * b, o = s[L + 2] * b, l = s[L + 3] * b, m = 1; m <= t; m++)
        u = L + ((m > x ? x : m) << 2), r += s[u++], a += s[u++], o += s[u++], l += s[u];
      for (c = 0; c < i; c++)
        z[y] = r, E[y] = a, F[y] = o, _[y] = l, h === 0 && (R[c] = Math.min(c + b, x) << 2, k[c] = Math.max(c - t, 0) << 2), f = L + R[c], g = L + k[c], r += s[f++] - s[g++], a += s[f++] - s[g++], o += s[f++] - s[g++], l += s[f] - s[g], y++;
      L += i << 2;
    }
    for (c = 0; c < i; c++) {
      for (p = c, r = z[p] * T, a = E[p] * T, o = F[p] * T, l = _[p] * T, m = 1; m <= t; m++)
        p += m > M ? 0 : i, r += z[p], a += E[p], o += F[p], l += _[p];
      for (y = c << 2, h = 0; h < n; h++)
        s[y] = r * P + 0.5 | 0, s[y + 1] = a * P + 0.5 | 0, s[y + 2] = o * P + 0.5 | 0, s[y + 3] = l * P + 0.5 | 0, c === 0 && (R[h] = Math.min(h + T, M) * i, k[h] = Math.max(h - t, 0) * i), f = c + R[h], g = c + k[h], r += z[f] - z[g], a += E[f] - E[g], o += F[f] - F[g], l += _[f] - _[g], y += i << 2;
    }
  }
}
function Te(d, t) {
  const e = d.data;
  for (let s = 0; s < e.length; s += 4) {
    const i = e[s], n = e[s + 1], r = e[s + 2], a = e[s + 3], o = i * 0.3 + n * 0.59 + r * 0.11;
    e[s] = o * (1 - t) + i * t, e[s + 1] = o * (1 - t) + n * t, e[s + 2] = o * (1 - t) + r * t, e[s + 3] = a;
  }
}
function we(d, t) {
  const e = d.data;
  for (let s = 0; s < e.length; s += 4) {
    const i = e[s], n = e[s + 1], r = e[s + 2], a = e[s + 3];
    e[s] = i * t, e[s + 1] = n * t, e[s + 2] = r * t, e[s + 3] = a;
  }
}
function $t(d, t) {
  const e = d.data;
  for (let s = 0; s < e.length; s += 4) {
    const i = e[s], n = e[s + 1], r = e[s + 2], a = e[s + 3];
    e[s] = (i - 128) * t + 128, e[s + 1] = (n - 128) * t + 128, e[s + 2] = (r - 128) * t + 128, e[s + 3] = a;
  }
}
const S = (d, t, e, s, i = 0, n = 0, r = 1, a = 1) => Object.freeze({ cx: d, cy: t, x: e, y: s, ur: i, vr: n, up: r, vp: a }), ct = (d, t, e) => Object.freeze({ width: d, height: t, conf: e }), qt = [
  // TODO: 竖屏推荐
  ct(5, 5, [
    S(0, 0, -1, -1, 0, 0, 1, 1),
    S(1, 0, -0.5, -1, 0, 0, 1, 1),
    S(2, 0, 0, -1, 0, 0, 1, 1),
    S(3, 0, 0.5, -1, 0, 0, 1, 1),
    S(4, 0, 1, -1, 0, 0, 1, 1),
    S(0, 1, -1, -0.5, 0, 0, 1, 1),
    S(1, 1, -0.5, -0.5, 0, 0, 1, 1),
    S(2, 1, -0.0052029684413368305, -0.6131420587090777, 0, 0, 1, 1),
    S(3, 1, 0.5884227308309977, -0.3990805107556692, 0, 0, 1, 1),
    S(4, 1, 1, -0.5, 0, 0, 1, 1),
    S(0, 2, -1, 0, 0, 0, 1, 1),
    S(1, 2, -0.4210024670505933, -0.11895058380429502, 0, 0, 1, 1),
    S(2, 2, -0.1019613423315412, -0.023812118047224606, 0, -47, 0.629, 0.849),
    S(3, 2, 0.40275125660925437, -0.06345314544600389, 0, 0, 1, 1),
    S(4, 2, 1, 0, 0, 0, 1, 1),
    S(0, 3, -1, 0.5, 0, 0, 1, 1),
    S(1, 3, 0.06801958477287173, 0.5205913248960121, -31, -45, 1, 1),
    S(2, 3, 0.21446469120128908, 0.29331610114301043, 6, -56, 0.566, 1.321),
    S(3, 3, 0.5, 0.5, 0, 0, 1, 1),
    S(4, 3, 1, 0.5, 0, 0, 1, 1),
    S(0, 4, -1, 1, 0, 0, 1, 1),
    S(1, 4, -0.31378372841550195, 1, 0, 0, 1, 1),
    S(2, 4, 0.26153633255328046, 1, 0, 0, 1, 1),
    S(3, 4, 0.5, 1, 0, 0, 1, 1),
    S(4, 4, 1, 1, 0, 0, 1, 1)
  ]),
  // TODO: 横屏推荐
  ct(4, 4, [
    S(0, 0, -1, -1, 0, 0, 1, 1),
    S(1, 0, -0.33333333333333337, -1, 0, 0, 1, 1),
    S(2, 0, 0.33333333333333326, -1, 0, 0, 1, 1),
    S(3, 0, 1, -1, 0, 0, 1, 1),
    S(0, 1, -1, -0.04495399932657351, 0, 0, 1, 1),
    S(1, 1, -0.24056117520129328, -0.22465999020104, 0, 0, 1, 1),
    S(2, 1, 0.334758885767489, -0.00531297192779423, 0, 0, 1, 1),
    S(3, 1, 0.9989920470678106, -0.3382976020775408, 8, 0, 0.566, 1.792),
    S(0, 2, -1, 0.33333333333333326, 0, 0, 1, 1),
    S(1, 2, -0.3425497314639411, -27501607956947893e-21, 0, 0, 1, 1),
    S(2, 2, 0.3321437945812673, 0.1981776353859399, 0, 0, 1, 1),
    S(3, 2, 1, 0.0766118180296832, 0, 0, 1, 1),
    S(0, 3, -1, 1, 0, 0, 1, 1),
    S(1, 3, -0.33333333333333337, 1, 0, 0, 1, 1),
    S(2, 3, 0.33333333333333326, 1, 0, 0, 1, 1),
    S(3, 3, 1, 1, 0, 0, 1, 1)
  ]),
  ct(4, 4, [
    S(0, 0, -1, -1, 0, 0, 1, 2.075),
    S(1, 0, -0.33333333333333337, -1, 0, 0, 1, 1),
    S(2, 0, 0.33333333333333326, -1, 0, 0, 1, 1),
    S(3, 0, 1, -1, 0, 0, 1, 1),
    S(0, 1, -1, -0.4545779491139603, 0, 0, 1, 1),
    S(1, 1, -0.33333333333333337, -0.33333333333333337, 0, 0, 1, 1),
    S(2, 1, 0.0889403142626457, -0.6025711180694033, -32, 45, 1, 1),
    S(3, 1, 1, -0.33333333333333337, 0, 0, 1, 1),
    S(0, 2, -1, -0.07402408608567845, 1, 0, 1, 0.094),
    S(1, 2, -0.2719422694359541, 0.09775369930903222, 25, -18, 1.321, 0),
    S(2, 2, 0.19877414408395877, 0.4307383294587789, 48, -40, 0.755, 0.975),
    S(3, 2, 1, 0.33333333333333326, -37, 0, 1, 1),
    S(0, 3, -1, 1, 0, 0, 1, 1),
    S(1, 3, -0.33333333333333337, 1, 0, 0, 1, 1),
    S(2, 3, 0.5125850864305672, 1, -20, -18, 0, 1.604),
    S(3, 3, 1, 1, 0, 0, 1, 1)
  ]),
  ct(5, 5, [
    S(0, 0, -1, -1, 0, 0, 1, 1),
    S(1, 0, -0.4501953125, -1, 0, 55, 1, 2.075),
    S(2, 0, 0.1953125, -1, 0, 0, 1, 1),
    S(3, 0, 0.4580078125, -1, 0, -25, 1, 1),
    S(4, 0, 1, -1, 0, 0, 1, 1),
    S(0, 1, -1, -0.2514475377525607, -16, 0, 2.327, 0.943),
    S(1, 1, -0.55859375, -0.6609325945787148, 47, 0, 2.358, 0.377),
    S(2, 1, 0.232421875, -0.5244375756366635, -66, -25, 1.855, 1.164),
    S(3, 1, 0.685546875, -0.3753706470552125, 0, 0, 1, 1),
    S(4, 1, 1, -0.6699125300354287, 0, 0, 1, 1),
    S(0, 2, -1, 0.035910396862284255, 0, 0, 1, 1),
    S(1, 2, -0.4921875, 0.005378616309457018, 90, 23, 1, 1.981),
    S(2, 2, 0.021484375, -0.1365043639066228, 0, 42, 1, 1),
    S(3, 2, 0.4765625, 0.05925822904974043, -30, 0, 1.95, 0.44),
    S(4, 2, 1, 0.251428847823418, 0, 0, 1, 1),
    S(0, 3, -1, 0.6968336464764276, -68, 0, 1, 0.786),
    S(1, 3, -0.6904296875, 0.5890744209958608, -68, 0, 1, 1),
    S(2, 3, 0.1845703125, 0.3879238667654693, 61, 0, 1, 1),
    S(3, 3, 0.60546875, 0.4633553246018661, -47, -59, 0.849, 1.73),
    S(4, 3, 1, 0.6214021886400309, -33, 0, 0.377, 1.604),
    S(0, 4, -1, 1, 0, 0, 1, 1),
    S(1, 4, -0.5, 1, 0, -73, 1, 1),
    S(2, 4, -0.3271484375, 1, 0, -24, 0.314, 2.704),
    S(3, 4, 0.5, 1, 0, 0, 1, 1),
    S(4, 4, 1, 1, 0, 0, 1, 1)
  ])
], H = (d, t) => Math.random() * (t - d) + d;
function Se(d, t, e) {
  return Math.min(Math.max(d, t), e);
}
function Ee(d, t, e) {
  const s = Se((e - d) / (t - d), 0, 1);
  return s * s * (3 - 2 * s);
}
function ve(d, t, e, s = 2, i = 0.5, n = 0.1) {
  let r = [], a = i;
  for (let c = 0; c < e; c++) {
    r[c] = [];
    for (let h = 0; h < t; h++)
      r[c][h] = d[c * t + h];
  }
  const o = [
    [1, 2, 1],
    [2, 4, 2],
    [1, 2, 1]
  ], l = 16;
  for (let c = 0; c < s; c++) {
    const h = [];
    for (let m = 0; m < e; m++) {
      h[m] = [];
      for (let u = 0; u < t; u++) {
        if (u === 0 || u === t - 1 || m === 0 || m === e - 1) {
          h[m][u] = r[m][u];
          continue;
        }
        let f = 0, g = 0, p = 0, y = 0, L = 0, x = 0;
        for (let $ = -1; $ <= 1; $++)
          for (let U = -1; U <= 1; U++) {
            const Y = o[$ + 1][U + 1], j = r[m + $][u + U];
            f += j.x * Y, g += j.y * Y, p += j.ur * Y, y += j.vr * Y, L += j.up * Y, x += j.vp * Y;
          }
        const M = f / l, b = g / l, w = p / l, T = y / l, v = L / l, P = x / l, z = r[m][u], E = z.x * (1 - a) + M * a, F = z.y * (1 - a) + b * a, _ = z.ur * (1 - a) + w * a, R = z.vr * (1 - a) + T * a, k = z.up * (1 - a) + v * a, B = z.vp * (1 - a) + P * a;
        h[m][u] = S(u, m, E, F, _, R, k, B);
      }
    }
    r = h, a = Math.min(1, Math.max(a + n, 0));
  }
  for (let c = 0; c < e; c++)
    for (let h = 0; h < t; h++)
      d[c * t + h] = r[c][h];
}
function pt(d, t) {
  return Pe(Math.sin(d * 12.9898 + t * 78.233) * 43758.5453);
}
function Pe(d) {
  return d - Math.floor(d);
}
function ze(d, t) {
  const e = Math.floor(d), s = Math.floor(t), i = e + 1, n = s + 1, r = d - e, a = t - s, o = r * r * (3 - 2 * r), l = a * a * (3 - 2 * a), c = pt(e, s), h = pt(i, s), m = pt(e, n), u = pt(i, n), f = c * (1 - o) + h * o, g = m * (1 - o) + u * o;
  return f * (1 - l) + g * l;
}
function Ie(d, t, e, s = 1e-3) {
  const i = d(t + s, e), n = d(t - s, e), r = d(t, e + s), a = d(t, e - s), o = (i - n) / (2 * s), l = (r - a) / (2 * s), c = Math.sqrt(o * o + l * l) || 1;
  return [o / c, l / c];
}
function ke(d, t, e = H(0.4, 0.6), s = H(0.3, 0.6), i = 0.8, n = Math.floor(H(3, 5)), r = H(0.2, 0.3), a = H(-0.1, -0.05)) {
  const o = d, l = t, c = [], h = 2 / (o - 1), m = 2 / (l - 1);
  for (let u = 0; u < l; u++)
    for (let f = 0; f < o; f++) {
      const g = f / (o - 1) * 2 - 1, p = u / (l - 1) * 2 - 1, y = f === 0 || f === o - 1 || u === 0 || u === l - 1, L = y ? 0 : H(-e * h, e * h), x = y ? 0 : H(-e * m, e * m);
      let M = g + L, b = p + x;
      const w = y ? 0 : H(-60, 60), T = y ? 0 : H(-60, 60), v = y ? 1 : H(0.8, 1.2), P = y ? 1 : H(0.8, 1.2);
      if (!y) {
        const z = (g + 1) / 2, E = (p + 1) / 2, [F, _] = Ie(ze, z, E, 1e-3);
        let R = F * s, k = _ * s;
        const B = Math.min(z, 1 - z, E, 1 - E), $ = Ee(0, 1, B);
        R *= $, k *= $, M = M * (1 - i) + (M + R) * i, b = b * (1 - i) + (b + k) * i;
      }
      c.push(S(f, u, M, b, w, T, v, P));
    }
  return ve(c, o, l, n, r, a), ct(o, l, c);
}
const De = `precision highp float;\r
\r
varying vec3 v_color;\r
varying vec2 v_uv;\r
uniform sampler2D u_texture;\r
uniform float u_time;\r
uniform float u_volume;\r
uniform float u_alpha;\r
\r
// 预计算常量\r
const float INV_255 = 1.0 / 255.0;\r
const float HALF_INV_255 = 0.5 / 255.0;\r
const float GRADIENT_NOISE_A = 52.9829189;\r
const vec2 GRADIENT_NOISE_B = vec2(0.06711056, 0.00583715);\r
\r
/* Gradient noise from Jorge Jimenez's presentation: */\r
/* http://www.iryoku.com/next-generation-post-processing-in-call-of-duty-advanced-warfare */\r
float gradientNoise(in vec2 uv) {\r
    return fract(GRADIENT_NOISE_A * fract(dot(uv, GRADIENT_NOISE_B)));\r
}\r
\r
// 优化的旋转函数，避免重复计算sin/cos\r
vec2 rot(vec2 v, float angle) {\r
    float s = sin(angle);\r
    float c = cos(angle);\r
    return vec2(c * v.x - s * v.y, s * v.x + c * v.y);\r
}\r
\r
void main() {\r
    // 合并计算以减少指令数\r
    float volumeEffect = u_volume * 2.0;\r
    float timeVolume = u_time + u_volume;\r
    \r
    float dither = INV_255 * gradientNoise(gl_FragCoord.xy) - HALF_INV_255;\r
    vec2 centeredUV = v_uv - vec2(0.2);\r
    vec2 rotatedUV = rot(centeredUV, timeVolume * 2.0);\r
    vec2 finalUV = rotatedUV * max(0.001, 1.0 - volumeEffect) + vec2(0.5);\r
    \r
    vec4 result = texture2D(u_texture, finalUV);\r
    \r
    float alphaVolumeFactor = u_alpha * max(0.5, 1.0 - u_volume * 0.5);\r
    result.rgb *= v_color * alphaVolumeFactor;\r
    result.a *= alphaVolumeFactor;\r
    \r
    result.rgb += vec3(dither);\r
    \r
    float dist = distance(v_uv, vec2(0.5));\r
    float vignette = smoothstep(0.8, 0.3, dist);\r
    float mask = 0.6 + vignette * 0.4;\r
    result.rgb *= mask;\r
    \r
    gl_FragColor = result;\r
}\r
`, Fe = `precision highp float;

attribute vec2 a_pos;
attribute vec3 a_color;
attribute vec2 a_uv;
varying vec3 v_color;
varying vec2 v_uv;

uniform float u_aspect;

void main() {
    v_color = a_color;
    v_uv = a_uv;
    vec2 pos = a_pos;
    if (u_aspect > 1.0) {
        pos.y *= u_aspect;
    } else {
        pos.x /= u_aspect;
    }
    gl_Position = vec4(pos, 0.0, 1.0);
}
`;
class Ae {
  constructor(t, e, s, i = "unknown") {
    this.label = i, this.gl = t, this.vertexShader = this.createShader(t.VERTEX_SHADER, e), this.fragmentShader = this.createShader(
      t.FRAGMENT_SHADER,
      s
    ), this.program = this.createProgram();
    const n = t.getProgramParameter(this.program, t.ACTIVE_ATTRIBUTES), r = {};
    for (let a = 0; a < n; a++) {
      const o = t.getActiveAttrib(this.program, a);
      if (!o) continue;
      const l = t.getAttribLocation(this.program, o.name);
      l !== -1 && (r[o.name] = l);
    }
    this.attrs = r;
  }
  gl;
  program;
  vertexShader;
  fragmentShader;
  attrs;
  createShader(t, e) {
    const s = this.gl, i = s.createShader(t);
    if (!i) throw new Error("Failed to create shader");
    if (s.shaderSource(i, e), s.compileShader(i), !s.getShaderParameter(i, s.COMPILE_STATUS))
      throw new Error(
        `Failed to compile shader for type ${t} "${this.label}": ${s.getShaderInfoLog(i)}`
      );
    return i;
  }
  createProgram() {
    const t = this.gl, e = t.createProgram();
    if (!e) throw new Error("Failed to create program");
    if (t.attachShader(e, this.vertexShader), t.attachShader(e, this.fragmentShader), t.linkProgram(e), t.validateProgram(e), !t.getProgramParameter(e, t.LINK_STATUS)) {
      const s = t.getProgramInfoLog(e);
      throw t.deleteProgram(e), new Error(`Failed to link program "${this.label}": ${s}`);
    }
    return e;
  }
  use() {
    this.gl.useProgram(this.program);
  }
  notFoundUniforms = /* @__PURE__ */ new Set();
  warnUniformNotFound(t) {
    this.notFoundUniforms.has(t) || (this.notFoundUniforms.add(t), console.warn(
      `Failed to get uniform location for program "${this.label}": ${t}`
    ));
  }
  setUniform1f(t, e) {
    const s = this.gl, i = s.getUniformLocation(this.program, t);
    i ? s.uniform1f(i, e) : this.warnUniformNotFound(t);
  }
  setUniform2f(t, e, s) {
    const i = this.gl, n = i.getUniformLocation(this.program, t);
    n ? i.uniform2f(n, e, s) : this.warnUniformNotFound(t);
  }
  setUniform1i(t, e) {
    const s = this.gl, i = s.getUniformLocation(this.program, t);
    i ? s.uniform1i(i, e) : this.warnUniformNotFound(t);
  }
  dispose() {
    const t = this.gl;
    t.deleteShader(this.vertexShader), t.deleteShader(this.fragmentShader), t.deleteProgram(this.program);
  }
}
class _e {
  constructor(t, e, s, i) {
    this.gl = t, this.attrPos = e, this.attrColor = s, this.attrUV = i;
    const n = t.createBuffer();
    if (!n) throw new Error("Failed to create vertex buffer");
    this.vertexBuffer = n;
    const r = t.createBuffer();
    if (!r) throw new Error("Failed to create index buffer");
    this.indexBuffer = r, this.bind(), this.vertexData = new Float32Array(0), this.indexData = new Uint16Array(0), this.resize(2, 2), this.update();
  }
  vertexWidth = 0;
  vertexHeight = 0;
  vertexBuffer;
  indexBuffer;
  vertexData;
  indexData;
  vertexIndexLength = 0;
  // 调试用途，开启线框模式
  wireFrame = !1;
  setWireFrame(t) {
    this.wireFrame = t, this.resize(this.vertexWidth, this.vertexHeight);
  }
  setVertexPos(t, e, s, i) {
    const n = (t + e * this.vertexWidth) * 7;
    if (n >= this.vertexData.length - 1) {
      console.warn("Vertex position out of range", n, this.vertexData.length);
      return;
    }
    this.vertexData[n] = s, this.vertexData[n + 1] = i;
  }
  setVertexColor(t, e, s, i, n) {
    const r = (t + e * this.vertexWidth) * 7 + 2;
    if (r >= this.vertexData.length - 2) {
      console.warn("Vertex color out of range", r, this.vertexData.length);
      return;
    }
    this.vertexData[r] = s, this.vertexData[r + 1] = i, this.vertexData[r + 2] = n;
  }
  setVertexUV(t, e, s, i) {
    const n = (t + e * this.vertexWidth) * 7 + 5;
    if (n >= this.vertexData.length - 1) {
      console.warn("Vertex UV out of range", n, this.vertexData.length);
      return;
    }
    this.vertexData[n] = s, this.vertexData[n + 1] = i;
  }
  // 批量设置顶点数据的优化方法
  setVertexData(t, e, s, i, n, r, a, o, l) {
    const c = (t + e * this.vertexWidth) * 7;
    if (c >= this.vertexData.length - 6) {
      console.warn("Vertex data out of range", c, this.vertexData.length);
      return;
    }
    const h = this.vertexData;
    h[c] = s, h[c + 1] = i, h[c + 2] = n, h[c + 3] = r, h[c + 4] = a, h[c + 5] = o, h[c + 6] = l;
  }
  getVertexIndexLength() {
    return this.vertexIndexLength;
  }
  draw() {
    const t = this.gl;
    this.wireFrame ? t.drawElements(t.LINES, this.vertexIndexLength, t.UNSIGNED_SHORT, 0) : t.drawElements(
      t.TRIANGLES,
      this.vertexIndexLength,
      t.UNSIGNED_SHORT,
      0
    );
  }
  resize(t, e) {
    this.vertexWidth = t, this.vertexHeight = e, this.vertexIndexLength = t * e * 6, this.wireFrame && (this.vertexIndexLength = t * e * 10);
    const s = new Float32Array(
      t * e * 7
    ), i = new Uint16Array(this.vertexIndexLength);
    this.vertexData = s, this.indexData = i;
    for (let r = 0; r < e; r++)
      for (let a = 0; a < t; a++) {
        const o = a / (t - 1) * 2 - 1, l = r / (e - 1) * 2 - 1;
        this.setVertexPos(a, r, o || 0, l || 0), this.setVertexColor(a, r, 1, 1, 1), this.setVertexUV(a, r, a / (t - 1), r / (e - 1));
      }
    for (let r = 0; r < e - 1; r++)
      for (let a = 0; a < t - 1; a++)
        if (this.wireFrame) {
          const o = (r * t + a) * 10;
          i[o] = r * t + a, i[o + 1] = r * t + a + 1, i[o + 2] = r * t + a + 1, i[o + 3] = (r + 1) * t + a, i[o + 4] = (r + 1) * t + a, i[o + 5] = (r + 1) * t + a + 1, i[o + 6] = (r + 1) * t + a + 1, i[o + 7] = r * t + a + 1, i[o + 8] = r * t + a, i[o + 9] = (r + 1) * t + a;
        } else {
          const o = (r * t + a) * 6;
          i[o] = r * t + a, i[o + 1] = r * t + a + 1, i[o + 2] = (r + 1) * t + a, i[o + 3] = r * t + a + 1, i[o + 4] = (r + 1) * t + a + 1, i[o + 5] = (r + 1) * t + a;
        }
    const n = this.gl;
    n.bindBuffer(n.ELEMENT_ARRAY_BUFFER, this.indexBuffer), n.bufferData(n.ELEMENT_ARRAY_BUFFER, this.indexData, n.STATIC_DRAW);
  }
  bind() {
    const t = this.gl;
    t.bindBuffer(t.ARRAY_BUFFER, this.vertexBuffer), t.bindBuffer(t.ELEMENT_ARRAY_BUFFER, this.indexBuffer), this.attrPos !== void 0 && (t.vertexAttribPointer(this.attrPos, 2, t.FLOAT, !1, 28, 0), t.enableVertexAttribArray(this.attrPos)), this.attrColor !== void 0 && (t.vertexAttribPointer(this.attrColor, 3, t.FLOAT, !1, 28, 8), t.enableVertexAttribArray(this.attrColor)), this.attrUV !== void 0 && (t.vertexAttribPointer(this.attrUV, 2, t.FLOAT, !1, 28, 20), t.enableVertexAttribArray(this.attrUV));
  }
  update() {
    const t = this.gl;
    t.bindBuffer(t.ARRAY_BUFFER, this.vertexBuffer), t.bufferData(t.ARRAY_BUFFER, this.vertexData, t.DYNAMIC_DRAW);
  }
  dispose() {
    this.gl.deleteBuffer(this.vertexBuffer), this.gl.deleteBuffer(this.indexBuffer);
  }
}
class Ce {
  color = C.fromValues(1, 1, 1);
  location = A.fromValues(0, 0);
  uTangent = A.fromValues(0, 0);
  vTangent = A.fromValues(0, 0);
  _uRot = 0;
  _vRot = 0;
  _uScale = 1;
  _vScale = 1;
  constructor() {
    Object.seal(this);
  }
  get uRot() {
    return this._uRot;
  }
  get vRot() {
    return this._vRot;
  }
  set uRot(t) {
    this._uRot = t, this.updateUTangent();
  }
  set vRot(t) {
    this._vRot = t, this.updateVTangent();
  }
  get uScale() {
    return this._uScale;
  }
  get vScale() {
    return this._vScale;
  }
  set uScale(t) {
    this._uScale = t, this.updateUTangent();
  }
  set vScale(t) {
    this._vScale = t, this.updateVTangent();
  }
  updateUTangent() {
    this.uTangent[0] = Math.cos(this._uRot) * this._uScale, this.uTangent[1] = Math.sin(this._uRot) * this._uScale;
  }
  updateVTangent() {
    this.vTangent[0] = -Math.sin(this._vRot) * this._vScale, this.vTangent[1] = Math.cos(this._vRot) * this._vScale;
  }
}
const at = I.fromValues(2, -2, 1, 1, -3, 3, -2, -1, 0, 0, 1, 0, 1, 0, 0, 0), lt = I.clone(at).transpose(), Z = D.create(), ft = D.create(), K = D.create(), tt = I.create(), et = I.create();
function Re(d, t, e, s, i = A.create()) {
  Z[0] = d ** 3, Z[1] = d ** 2, Z[2] = d, Z[3] = 1, ft.copy(Z), K[0] = t ** 3, K[1] = t ** 2, K[2] = t, K[3] = 1, tt.copy(e).transpose(), I.mul(tt, tt, at), I.mul(tt, lt, tt), D.transformMat4(Z, Z, tt);
  const n = K.dot(Z);
  et.copy(s).transpose(), I.mul(et, et, at), I.mul(et, lt, et), D.transformMat4(ft, ft, et);
  const r = K.dot(ft);
  return i.x = n, i.y = r, i;
}
function Vt(d, t, e, s, i, n = I.create()) {
  const r = (l) => l.location[i], a = (l) => l.uTangent[i], o = (l) => l.vTangent[i];
  return n[0] = r(d), n[1] = r(t), n[2] = o(d), n[3] = o(t), n[4] = r(e), n[5] = r(s), n[6] = o(e), n[7] = o(s), n[8] = a(d), n[9] = a(t), n[10] = 0, n[11] = 0, n[12] = a(e), n[13] = a(s), n[14] = 0, n[15] = 0, n;
}
function vt(d, t, e, s, i, n = I.create()) {
  const r = (a) => a.color[i];
  return n.fill(0), n[0] = r(d), n[1] = r(t), n[4] = r(e), n[5] = r(s), n;
}
const G = D.create(), ut = D.create(), gt = D.create(), J = D.create(), st = I.create(), it = I.create(), nt = I.create(), yt = C.create();
function Oe(d, t, e, s, i) {
  return G[0] = d ** 3, G[1] = d ** 2, G[2] = d, G[3] = 1, ut.copy(G), gt.copy(G), J[0] = t ** 3, J[1] = t ** 2, J[2] = t, J[3] = 1, st.copy(e).transpose(), I.mul(st, st, at), I.mul(st, lt, st), D.transformMat4(G, G, st), yt.r = J.dot(G), it.copy(s).transpose(), I.mul(it, it, at), I.mul(it, lt, it), D.transformMat4(ut, ut, it), yt.g = J.dot(ut), nt.copy(i).transpose(), I.mul(nt, nt, at), I.mul(nt, lt, nt), D.transformMat4(gt, gt, nt), yt.b = J.dot(gt), yt;
}
class We {
  _width = 0;
  _height = 0;
  _data = [];
  constructor(t, e) {
    this.resize(t, e), Object.seal(this);
  }
  resize(t, e) {
    this._width = t, this._height = e, this._data = new Array(t * e).fill(0);
  }
  set(t, e, s) {
    this._data[t + e * this._width] = s;
  }
  get(t, e) {
    return this._data[t + e * this._width];
  }
  get width() {
    return this._width;
  }
  get height() {
    return this._height;
  }
}
class Ne extends _e {
  /**
   * 细分级别，越大曲线越平滑，但是性能消耗也越大
   */
  _subDivisions = 10;
  _controlPoints = new We(3, 3);
  constructor(t, e, s, i) {
    super(t, e, s, i), this.resizeControlPoints(3, 3), Object.seal(this);
  }
  setWireFrame(t) {
    super.setWireFrame(t), this.updateMesh();
  }
  /**
   * 以当前的控制点矩阵大小和细分级别为参考重新设置细分级别，此操作不会重设控制点数据
   * @param subDivisions 细分级别
   */
  resetSubdivition(t) {
    this._subDivisions = t, super.resize(
      (this._controlPoints.width - 1) * t,
      (this._controlPoints.height - 1) * t
    );
  }
  /**
   * 重设控制点矩阵尺寸，将会重置所有控制点的颜色和坐标数据
   * 请在调用此方法后重新设置颜色和坐标，并调用 updateMesh 方法更新网格
   * @param width 控制点宽度数量，必须大于等于 2
   * @param height 控制点高度数量，必须大于等于 2
   */
  resizeControlPoints(t, e) {
    if (!(t >= 2 && e >= 2))
      throw new Error("Control points must be larger than 3x3 or equal");
    this._controlPoints.resize(t, e);
    for (let s = 0; s < e; s++)
      for (let i = 0; i < t; i++) {
        const n = new Ce();
        n.location.x = i / (t - 1) * 2 - 1, n.location.y = s / (e - 1) * 2 - 1, n.uTangent.x = 2 / (t - 1), n.vTangent.y = 2 / (e - 1), this._controlPoints.set(i, s, n);
      }
    this.resetSubdivition(this._subDivisions);
  }
  /**
   * 获取指定位置的控制点，然后可以设置颜色和坐标属性
   * 留意颜色属性和坐标属性的值范围均参考 WebGL 的定义
   * 即颜色各个组件取值 [0-1]，坐标取值 [-1, 1]
   * 点的位置以画面左下角为原点 (0,0)
   * @param x 需要获取的控制点的 x 坐标
   * @param y 需要获取的控制点的 y 坐标
   * @returns 控制点对象
   */
  getControlPoint(t, e) {
    return this._controlPoints.get(t, e);
  }
  tmpV2 = A.create();
  // 预分配重复使用的矩阵，避免频繁创建
  tempX = I.create();
  tempY = I.create();
  tempR = I.create();
  tempG = I.create();
  tempB = I.create();
  /**
   * 更新最终呈现的网格数据，此方法应在所有控制点或细分参数的操作完成后调用
   */
  updateMesh() {
    const t = this._subDivisions - 1, e = t * (this._controlPoints.height - 1), s = t * (this._controlPoints.width - 1), i = this._controlPoints.width, n = this._controlPoints.height, r = this._subDivisions, a = 1 / t, o = 1 / s, l = 1 / e;
    for (let c = 0; c < i - 1; c++)
      for (let h = 0; h < n - 1; h++) {
        const m = this._controlPoints.get(c, h), u = this._controlPoints.get(c, h + 1), f = this._controlPoints.get(c + 1, h), g = this._controlPoints.get(c + 1, h + 1);
        Vt(m, u, f, g, "x", this.tempX), Vt(m, u, f, g, "y", this.tempY), vt(m, u, f, g, "r", this.tempR), vt(m, u, f, g, "g", this.tempG), vt(m, u, f, g, "b", this.tempB);
        const p = c / (i - 1), y = h / (n - 1), L = h * r, x = c * r;
        for (let M = 0; M < r; M++) {
          const b = M * a, w = L + M;
          for (let T = 0; T < r; T++) {
            const v = T * a, P = x + T, [z, E] = Re(
              b,
              v,
              this.tempX,
              this.tempY,
              this.tmpV2
            ), [F, _, R] = Oe(
              b,
              v,
              this.tempR,
              this.tempG,
              this.tempB
            ), k = p + T * o, B = 1 - y - M * l;
            this.setVertexData(w, P, z, E, F, _, R, k, B);
          }
        }
      }
    this.update();
  }
}
class Ht {
  constructor(t, e) {
    this.gl = t;
    const s = t.createTexture();
    if (!s) throw new Error("Failed to create texture");
    this.tex = s, t.activeTexture(t.TEXTURE0), t.bindTexture(t.TEXTURE_2D, s), t.texImage2D(
      t.TEXTURE_2D,
      0,
      t.RGBA,
      t.RGBA,
      t.UNSIGNED_BYTE,
      e
    ), t.texParameteri(t.TEXTURE_2D, t.TEXTURE_MIN_FILTER, t.LINEAR), t.texParameteri(t.TEXTURE_2D, t.TEXTURE_MAG_FILTER, t.LINEAR), t.texParameteri(t.TEXTURE_2D, t.TEXTURE_WRAP_S, t.MIRRORED_REPEAT), t.texParameteri(t.TEXTURE_2D, t.TEXTURE_WRAP_T, t.MIRRORED_REPEAT);
  }
  tex;
  bind() {
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.tex);
  }
  dispose() {
    this.gl.deleteTexture(this.tex);
  }
}
function Be(d, t) {
  if ("OffscreenCanvas" in window) return new OffscreenCanvas(d, t);
  const e = document.createElement("canvas");
  return e.width = d, e.height = t, e;
}
class si extends te {
  gl;
  lastFrameTime = 0;
  frameTime = 0;
  currentImageData;
  lastTickTime = 0;
  smoothedVolume = 0;
  volume = 0;
  tickHandle = 0;
  maxFPS = 60;
  paused = !1;
  staticMode = !1;
  mainProgram;
  manualControl = !1;
  reduceImageSizeCanvas = Be(
    32,
    32
  );
  targetSize = A.fromValues(0, 0);
  currentSize = A.fromValues(0, 0);
  isNoCover = !0;
  meshStates = [];
  _disposed = !1;
  // 性能监控
  frameCount = 0;
  lastFPSUpdate = 0;
  currentFPS = 0;
  enablePerformanceMonitoring = !1;
  setManualControl(t) {
    this.manualControl = t;
  }
  setWireFrame(t) {
    for (const e of this.meshStates)
      e.mesh.setWireFrame(t);
  }
  getControlPoint(t, e) {
    return this.meshStates[this.meshStates.length - 1]?.mesh?.getControlPoint(
      t,
      e
    );
  }
  resizeControlPoints(t, e) {
    return this.meshStates[this.meshStates.length - 1]?.mesh?.resizeControlPoints(t, e);
  }
  resetSubdivition(t) {
    return this.meshStates[this.meshStates.length - 1]?.mesh?.resetSubdivition(
      t
    );
  }
  onTick(t) {
    if (this.tickHandle = 0, this.paused || this._disposed) return;
    this.updatePerformanceStats(t), Number.isNaN(this.lastFrameTime) && (this.lastFrameTime = t);
    const e = t - this.lastTickTime, s = t - this.lastFrameTime;
    if (this.lastFrameTime = t, e < 1e3 / this.maxFPS) {
      this.requestTick();
      return;
    }
    this.frameTime += s * this.flowSpeed, this.onRedraw(this.frameTime, s) && this.staticMode ? this.staticMode && (this.lastFrameTime = Number.NaN) : this.requestTick(), this.lastTickTime = t;
  }
  checkIfResize() {
    const [t, e] = [this.targetSize.x, this.targetSize.y], [s, i] = [this.currentSize.x, this.currentSize.y];
    if (t !== s || e !== i) {
      super.onResize(t, e);
      const n = this.gl;
      n.bindFramebuffer(n.FRAMEBUFFER, null), n.viewport(0, 0, t, e), this.currentSize.x = t, this.currentSize.y = e;
    }
  }
  onRedraw(t, e) {
    const s = this.meshStates[this.meshStates.length - 1];
    let i = !1;
    const n = e / 500;
    if (s)
      if (s.mesh.bind(), this.manualControl && s.mesh.updateMesh(), this.isNoCover) {
        let o = !1;
        for (let l = this.meshStates.length - 1; l >= 0; l--) {
          const c = this.meshStates[l];
          c.alpha = Math.max(0, c.alpha - n), c.alpha > 0 ? o = !0 : (c.mesh.dispose(), c.texture.dispose(), this.meshStates.splice(l, 1));
        }
        i = !o;
      } else {
        if (s.alpha = Math.min(
          1,
          s.alpha + n
        ), s.alpha >= 1) {
          const o = this.meshStates.splice(0, this.meshStates.length - 1);
          for (const l of o)
            l.mesh.dispose(), l.texture.dispose();
        }
        i = this.meshStates.length === 1 && s.alpha >= 1;
      }
    const r = this.gl;
    r.bindFramebuffer(r.FRAMEBUFFER, null), r.blendFunc(r.SRC_ALPHA, r.ONE_MINUS_SRC_ALPHA), r.clear(r.COLOR_BUFFER_BIT), this.checkIfResize();
    const a = Math.min(1, e / 100);
    this.smoothedVolume += (this.volume - this.smoothedVolume) * a, this.mainProgram.use(), r.activeTexture(r.TEXTURE0), this.mainProgram.setUniform1f("u_time", t / 1e4), this.mainProgram.setUniform1f(
      "u_aspect",
      this.manualControl ? 1 : this.canvas.width / this.canvas.height
    ), this.mainProgram.setUniform1i("u_texture", 0), this.mainProgram.setUniform1f("u_volume", this.volume);
    for (const o of this.meshStates)
      this.mainProgram.setUniform1f("u_alpha", o.alpha), o.texture.bind(), o.mesh.bind(), o.mesh.draw();
    return r.flush(), i;
  }
  onTickBinded = this.onTick.bind(this);
  requestTick() {
    this._disposed || this.tickHandle === 0 && (this.tickHandle = requestAnimationFrame(this.onTickBinded));
  }
  supportTextureFloat = !0;
  constructor(t) {
    super(t);
    const e = t.getContext("webgl");
    if (!e) throw new Error("WebGL not supported");
    e.getExtension("EXT_color_buffer_float") || console.warn("EXT_color_buffer_float not supported"), e.getExtension("EXT_float_blend") || (console.warn("EXT_float_blend not supported"), this.supportTextureFloat = !1), e.getExtension("OES_texture_float_linear") || console.warn("OES_texture_float_linear not supported"), e.getExtension("OES_texture_float") || (this.supportTextureFloat = !1, console.warn("OES_texture_float not supported")), this.gl = e, e.enable(e.BLEND), e.enable(e.DEPTH_TEST), e.depthFunc(e.ALWAYS), this.mainProgram = new Ae(
      e,
      Fe,
      De,
      "main-program-mg"
    ), this.requestTick();
  }
  onResize(t, e) {
    this.targetSize.x = Math.ceil(t), this.targetSize.y = Math.ceil(e), this.requestTick();
  }
  setStaticMode(t) {
    this.staticMode = t, this.lastFrameTime = performance.now(), this.requestTick();
  }
  setFPS(t) {
    this.maxFPS = t;
  }
  pause() {
    this.tickHandle && (cancelAnimationFrame(this.tickHandle), this.tickHandle = 0), this.paused = !0;
  }
  resume() {
    this.paused = !1, this.requestTick();
  }
  async setAlbum(t, e) {
    if (t === void 0 || typeof t == "string" && t.trim().length === 0) {
      this.isNoCover = !0;
      return;
    }
    let s = null, i = 5;
    for (; !s && i > 0; )
      try {
        typeof t == "string" ? s = await ee(t, e) : s = await se(t);
      } catch (c) {
        console.warn(
          `failed on loading album resource, retrying (${i})`,
          {
            albumSource: t,
            error: c
          }
        ), i--;
      }
    if (!s) {
      console.error("Failed to load album resource", t), this.isNoCover = !0;
      return;
    }
    this.isNoCover = !1;
    const n = this.reduceImageSizeCanvas, r = n.getContext("2d", {
      willReadFrequently: !0
    });
    if (!r) throw new Error("Failed to create canvas context");
    r.clearRect(0, 0, n.width, n.height);
    const a = s instanceof HTMLVideoElement ? s.videoWidth : s.naturalWidth, o = s instanceof HTMLVideoElement ? s.videoHeight : s.naturalHeight;
    if (a * o === 0) throw new Error("Invalid image size");
    r.drawImage(s, 0, 0, a, o, 0, 0, n.width, n.height);
    const l = r.getImageData(0, 0, n.width, n.height);
    if ($t(l, 0.4), Te(l, 3), $t(l, 1.7), we(l, 0.75), xe(l, 2, 4), this.manualControl && this.meshStates.length > 0)
      this.meshStates[0].texture.dispose(), this.meshStates[0].texture = new Ht(this.gl, l);
    else {
      const c = new Ne(
        this.gl,
        this.mainProgram.attrs.a_pos,
        this.mainProgram.attrs.a_color,
        this.mainProgram.attrs.a_uv
      );
      c.resetSubdivition(15);
      const h = Math.random() > 0.8 ? ke(6, 6) : qt[Math.floor(Math.random() * qt.length)];
      c.resizeControlPoints(h.width, h.height);
      const m = 2 / (h.width - 1), u = 2 / (h.height - 1);
      for (const p of h.conf) {
        const y = c.getControlPoint(p.cx, p.cy);
        y.location.x = p.x, y.location.y = p.y, y.uRot = p.ur * Math.PI / 180, y.vRot = p.vr * Math.PI / 180, y.uScale = m * p.up, y.vScale = u * p.vp;
      }
      c.updateMesh(), this.currentImageData = l;
      const f = new Ht(this.gl, l), g = {
        mesh: c,
        texture: f,
        alpha: 0
      };
      this.meshStates.push(g);
    }
    this.requestTick();
  }
  setLowFreqVolume(t) {
    this.volume = t / 10;
  }
  setHasLyric(t) {
  }
  dispose() {
    super.dispose(), this.tickHandle && (cancelAnimationFrame(this.tickHandle), this.tickHandle = 0), this._disposed = !0, this.mainProgram.dispose();
    for (const t of this.meshStates)
      t.mesh.dispose(), t.texture.dispose();
  }
  enablePerformanceMonitor(t) {
    this.enablePerformanceMonitoring = t, t && (this.frameCount = 0, this.lastFPSUpdate = performance.now());
  }
  getCurrentFPS() {
    return this.currentFPS;
  }
  updatePerformanceStats(t) {
    this.enablePerformanceMonitoring && (this.frameCount++, t - this.lastFPSUpdate > 1e3 && (this.currentFPS = this.frameCount, this.frameCount = 0, this.lastFPSUpdate = t));
  }
}
class $e extends ye {
  time = 0;
}
class ii extends te {
  constructor(t) {
    super(t), this.canvas = t, this.app = new ue({
      view: t,
      resizeTo: this.canvas,
      powerPreference: "low-power",
      backgroundAlpha: 1
    }), this.rebuildFilters(), this.app.ticker.maxFPS = 30, this.app.ticker.add(this.onTick), this.app.ticker.start();
  }
  app;
  curContainer;
  staticMode = !1;
  lastContainer = /* @__PURE__ */ new Set();
  onTick = (t) => {
    for (const e of this.lastContainer)
      e.alpha = Math.max(0, e.alpha - t / 60), e.alpha <= 0 && (this.app.stage.removeChild(e), this.lastContainer.delete(e), e.destroy(!0));
    if (this.curContainer) {
      this.curContainer.alpha = Math.min(
        1,
        this.curContainer.alpha + t / 60
      );
      const [e, s, i, n] = this.curContainer.children, r = Math.max(this.app.screen.width, this.app.screen.height);
      e.position.set(this.app.screen.width / 2, this.app.screen.height / 2), s.position.set(
        this.app.screen.width / 2.5,
        this.app.screen.height / 2.5
      ), i.position.set(this.app.screen.width / 2, this.app.screen.height / 2), n.position.set(this.app.screen.width / 2, this.app.screen.height / 2), e.width = r * Math.sqrt(2), e.height = e.width, s.width = r * 0.8, s.height = s.width, i.width = r * 0.5, i.height = i.width, n.width = r * 0.25, n.height = n.width, this.curContainer.time += t * this.flowSpeed, e.rotation += t / 1e3 * this.flowSpeed, s.rotation -= t / 500 * this.flowSpeed, i.rotation += t / 1e3 * this.flowSpeed, n.rotation -= t / 750 * this.flowSpeed, i.x = this.app.screen.width / 2 + this.app.screen.width / 4 * Math.cos(this.curContainer.time / 1e3 * 0.75), i.y = this.app.screen.height / 2 + this.app.screen.width / 4 * Math.cos(this.curContainer.time / 1e3 * 0.75), n.x = this.app.screen.width / 2 + this.app.screen.width / 4 * 0.1 + Math.cos(this.curContainer.time * 6e-3 * 0.75), n.y = this.app.screen.height / 2 + this.app.screen.width / 4 * 0.1 + Math.cos(this.curContainer.time * 6e-3 * 0.75), this.curContainer.alpha >= 1 && this.lastContainer.size === 0 && this.staticMode && this.app.ticker.stop();
    }
  };
  onResize(t, e) {
    super.onResize(t, e), this.app.resize(), this.rebuildFilters();
  }
  setRenderScale(t) {
    super.setRenderScale(t), this.rebuildFilters();
  }
  rebuildFilters() {
    const t = Math.min(this.canvas.width, this.canvas.height), e = Math.max(this.canvas.width, this.canvas.height), s = new Et();
    s.saturate(1.2, !1);
    const i = new Et();
    i.brightness(0.6, !1);
    const n = new Et();
    n.contrast(0.3, !0);
    for (const r of this.app.stage.filters ?? [])
      r.destroy();
    this.app.stage.filters = [], this.app.stage.filters.push(new X(5, 1)), this.app.stage.filters.push(new X(10, 1)), this.app.stage.filters.push(new X(20, 2)), this.app.stage.filters.push(new X(40, 2)), this.app.stage.filters.push(new X(80, 2)), t > 768 && this.app.stage.filters.push(new X(160, 4)), t > 768 * 2 && this.app.stage.filters.push(new X(320, 4)), this.app.stage.filters.push(s, i, n), this.app.stage.filters.push(new X(5, 1)), Math.random() > 0.5 ? (this.app.stage.filters.push(
      new dt({
        radius: (e + t) / 2,
        strength: 1,
        center: [0.25, 1]
      })
    ), this.app.stage.filters.push(
      new dt({
        radius: (e + t) / 2,
        strength: 1,
        center: [0.75, 0]
      })
    )) : (this.app.stage.filters.push(
      new dt({
        radius: (e + t) / 2,
        strength: 1,
        center: [0.75, 1]
      })
    ), this.app.stage.filters.push(
      new dt({
        radius: (e + t) / 2,
        strength: 1,
        center: [0.25, 0]
      })
    ));
  }
  setStaticMode(t = !1) {
    this.staticMode = t, this.app.ticker.start();
  }
  setFPS(t) {
    this.app.ticker.maxFPS = t;
  }
  pause() {
    this.app.ticker.stop(), this.app.render();
  }
  resume() {
    this.app.ticker.start();
  }
  setLowFreqVolume(t) {
  }
  setHasLyric(t) {
  }
  async setAlbum(t, e) {
    if (!t || typeof t == "string" && t.trim().length === 0)
      return;
    let s = null, i = 5, n = null;
    for (; !n?.baseTexture?.resource?.valid && i > 0; )
      try {
        typeof t == "string" ? s = await ee(t, e) : s = await se(t), n = ge.from(s, {
          resourceOptions: {
            autoLoad: !1
          }
        }), await n.baseTexture.resource.load();
      } catch (h) {
        console.warn(
          `failed on loading album image, retrying (${i})`,
          t,
          h
        ), n = null, i--;
      }
    if (!n) return;
    const r = new $e(), a = new mt(n), o = new mt(n), l = new mt(n), c = new mt(n);
    a.anchor.set(0.5, 0.5), o.anchor.set(0.5, 0.5), l.anchor.set(0.5, 0.5), c.anchor.set(0.5, 0.5), a.rotation = Math.random() * Math.PI * 2, o.rotation = Math.random() * Math.PI * 2, l.rotation = Math.random() * Math.PI * 2, c.rotation = Math.random() * Math.PI * 2, r.addChild(a, o, l, c), this.curContainer && this.lastContainer.add(this.curContainer), this.curContainer = r, this.app.stage.addChild(r), this.curContainer.alpha = 0, this.app.ticker.start();
  }
  dispose() {
    super.dispose(), this.app.ticker.remove(this.onTick), this.app.destroy(!0);
  }
  getElement() {
    return this.canvas;
  }
}
class ie {
  element;
  renderer;
  constructor(t, e) {
    this.renderer = t, this.element = e, e.style.pointerEvents = "none", e.style.zIndex = "-1", e.style.contain = "strict";
  }
  static new(t) {
    const e = document.createElement("canvas");
    return new ie(new t(e), e);
  }
  setRenderScale(t) {
    this.renderer.setRenderScale(t);
  }
  setFlowSpeed(t) {
    this.renderer.setFlowSpeed(t);
  }
  setStaticMode(t) {
    this.renderer.setStaticMode(t);
  }
  setFPS(t) {
    this.renderer.setFPS(t);
  }
  pause() {
    this.renderer.pause();
  }
  resume() {
    this.renderer.resume();
  }
  setLowFreqVolume(t) {
    this.renderer.setLowFreqVolume(t);
  }
  setHasLyric(t) {
    this.renderer.setHasLyric(t);
  }
  setAlbum(t, e) {
    return this.renderer.setAlbum(t, e);
  }
  getElement() {
    return this.element;
  }
  dispose() {
    this.renderer.dispose(), this.element.remove();
  }
}
const qe = "_lyricLine_ut4sn_6", Ve = "_lyricBgLine_ut4sn_50", He = "_active_ut4sn_62", Ue = "_hasDuetLine_ut4sn_78", Ye = "_lyricDuetLine_ut4sn_79", je = "_lyricMainLine_ut4sn_98", Ge = "_romanWord_ut4sn_107", Xe = "_emphasizeWrapper_ut4sn_113", Ze = "_emphasize_ut4sn_113", Je = "_lyricSubLine_ut4sn_136", Qe = "_disableSpring_ut4sn_143", Ke = "_interludeDots_ut4sn_151", ts = "_enabled_ut4sn_163", es = "_tmpDisableTransition_ut4sn_189", W = {
  lyricLine: qe,
  lyricBgLine: Ve,
  active: He,
  hasDuetLine: Ue,
  lyricDuetLine: Ye,
  lyricMainLine: je,
  romanWord: Ge,
  emphasizeWrapper: Xe,
  emphasize: Ze,
  lyricSubLine: Je,
  disableSpring: Qe,
  interludeDots: Ke,
  enabled: ts,
  tmpDisableTransition: es
}, ne = -1, wt = 0, ht = 1, xt = 2, Ft = 3, At = 4, _t = 5, Ct = 6, re = 7, ae = 8, Ut = typeof self == "object" ? self : globalThis, ss = (d, t) => {
  const e = (i, n) => (d.set(n, i), i), s = (i) => {
    if (d.has(i))
      return d.get(i);
    const [n, r] = t[i];
    switch (n) {
      case wt:
      case ne:
        return e(r, i);
      case ht: {
        const a = e([], i);
        for (const o of r)
          a.push(s(o));
        return a;
      }
      case xt: {
        const a = e({}, i);
        for (const [o, l] of r)
          a[s(o)] = s(l);
        return a;
      }
      case Ft:
        return e(new Date(r), i);
      case At: {
        const { source: a, flags: o } = r;
        return e(new RegExp(a, o), i);
      }
      case _t: {
        const a = e(/* @__PURE__ */ new Map(), i);
        for (const [o, l] of r)
          a.set(s(o), s(l));
        return a;
      }
      case Ct: {
        const a = e(/* @__PURE__ */ new Set(), i);
        for (const o of r)
          a.add(s(o));
        return a;
      }
      case re: {
        const { name: a, message: o } = r;
        return e(new Ut[a](o), i);
      }
      case ae:
        return e(BigInt(r), i);
      case "BigInt":
        return e(Object(BigInt(r)), i);
      case "ArrayBuffer":
        return e(new Uint8Array(r).buffer, r);
      case "DataView": {
        const { buffer: a } = new Uint8Array(r);
        return e(new DataView(a), r);
      }
    }
    return e(new Ut[n](r), i);
  };
  return s;
}, Yt = (d) => ss(/* @__PURE__ */ new Map(), d)(0), rt = "", { toString: is } = {}, { keys: ns } = Object, ot = (d) => {
  const t = typeof d;
  if (t !== "object" || !d)
    return [wt, t];
  const e = is.call(d).slice(8, -1);
  switch (e) {
    case "Array":
      return [ht, rt];
    case "Object":
      return [xt, rt];
    case "Date":
      return [Ft, rt];
    case "RegExp":
      return [At, rt];
    case "Map":
      return [_t, rt];
    case "Set":
      return [Ct, rt];
    case "DataView":
      return [ht, e];
  }
  return e.includes("Array") ? [ht, e] : e.includes("Error") ? [re, e] : [xt, e];
}, Lt = ([d, t]) => d === wt && (t === "function" || t === "symbol"), rs = (d, t, e, s) => {
  const i = (r, a) => {
    const o = s.push(r) - 1;
    return e.set(a, o), o;
  }, n = (r) => {
    if (e.has(r))
      return e.get(r);
    let [a, o] = ot(r);
    switch (a) {
      case wt: {
        let c = r;
        switch (o) {
          case "bigint":
            a = ae, c = r.toString();
            break;
          case "function":
          case "symbol":
            if (d)
              throw new TypeError("unable to serialize " + o);
            c = null;
            break;
          case "undefined":
            return i([ne], r);
        }
        return i([a, c], r);
      }
      case ht: {
        if (o) {
          let m = r;
          return o === "DataView" ? m = new Uint8Array(r.buffer) : o === "ArrayBuffer" && (m = new Uint8Array(r)), i([o, [...m]], r);
        }
        const c = [], h = i([a, c], r);
        for (const m of r)
          c.push(n(m));
        return h;
      }
      case xt: {
        if (o)
          switch (o) {
            case "BigInt":
              return i([o, r.toString()], r);
            case "Boolean":
            case "Number":
            case "String":
              return i([o, r.valueOf()], r);
          }
        if (t && "toJSON" in r)
          return n(r.toJSON());
        const c = [], h = i([a, c], r);
        for (const m of ns(r))
          (d || !Lt(ot(r[m]))) && c.push([n(m), n(r[m])]);
        return h;
      }
      case Ft:
        return i([a, r.toISOString()], r);
      case At: {
        const { source: c, flags: h } = r;
        return i([a, { source: c, flags: h }], r);
      }
      case _t: {
        const c = [], h = i([a, c], r);
        for (const [m, u] of r)
          (d || !(Lt(ot(m)) || Lt(ot(u)))) && c.push([n(m), n(u)]);
        return h;
      }
      case Ct: {
        const c = [], h = i([a, c], r);
        for (const m of r)
          (d || !Lt(ot(m))) && c.push(n(m));
        return h;
      }
    }
    const { message: l } = r;
    return i([a, { name: o, message: l }], r);
  };
  return n;
}, jt = (d, { json: t, lossy: e } = {}) => {
  const s = [];
  return rs(!(t || e), !!t, /* @__PURE__ */ new Map(), s)(d), s;
}, Gt = typeof structuredClone == "function" ? (
  /* c8 ignore start */
  (d, t) => t && ("json" in t || "lossy" in t) ? Yt(jt(d, t)) : structuredClone(d)
) : (d, t) => Yt(jt(d, t)), as = (d, t) => d.size === t.size && [...d].every((e) => t.has(e)), os = (d) => /^[\p{Unified_Ideograph}\u0800-\u9FFC]+$/u.test(d);
function cs(d) {
  return (e) => (d(e + 1e-3) - d(e - 1e-3)) / (2 * 1e-3);
}
function Xt(d) {
  return cs(d);
}
class Tt {
  currentPosition = 0;
  targetPosition = 0;
  currentTime = 0;
  params = {};
  currentSolver;
  getV;
  getV2;
  queueParams;
  queuePosition;
  constructor(t = 0) {
    this.targetPosition = t, this.currentPosition = this.targetPosition, this.currentSolver = () => this.targetPosition, this.getV = () => 0, this.getV2 = () => 0;
  }
  resetSolver() {
    const t = this.getV(this.currentTime);
    this.currentTime = 0, this.currentSolver = ls(
      this.currentPosition,
      t,
      this.targetPosition,
      0,
      this.params
    ), this.getV = Xt(this.currentSolver), this.getV2 = Xt(this.getV);
  }
  arrived() {
    return Math.abs(this.targetPosition - this.currentPosition) < 0.01 && this.getV(this.currentTime) < 0.01 && this.getV2(this.currentTime) < 0.01 && this.queueParams === void 0 && this.queuePosition === void 0;
  }
  setPosition(t) {
    this.targetPosition = t, this.currentPosition = t, this.currentSolver = () => this.targetPosition, this.getV = () => 0, this.getV2 = () => 0;
  }
  update(t = 0) {
    this.currentTime += t, this.currentPosition = this.currentSolver(this.currentTime), this.queueParams && (this.queueParams.time -= t, this.queueParams.time <= 0 && this.updateParams({
      ...this.queueParams
    })), this.queuePosition && (this.queuePosition.time -= t, this.queuePosition.time <= 0 && this.setTargetPosition(this.queuePosition.position)), this.arrived() && this.setPosition(this.targetPosition);
  }
  updateParams(t, e = 0) {
    e > 0 ? this.queueParams = {
      ...this.queuePosition ?? {},
      ...t,
      time: e
    } : (this.queuePosition = void 0, this.params = {
      ...this.params,
      ...t
    }, this.resetSolver());
  }
  setTargetPosition(t, e = 0) {
    e > 0 ? this.queuePosition = {
      ...this.queuePosition ?? {},
      position: t,
      time: e
    } : (this.queuePosition = void 0, this.targetPosition = t, this.resetSolver());
  }
  getCurrentPosition() {
    return this.currentPosition;
  }
}
function ls(d, t, e, s = 0, i) {
  const n = i?.soft ?? !1, r = i?.stiffness ?? 100, a = i?.damping ?? 10, o = i?.mass ?? 1, l = e - d;
  if (n || 1 <= a / (2 * Math.sqrt(r * o))) {
    const f = -Math.sqrt(r / o), g = -f * l - t;
    return (p) => (p -= s, p < 0 ? d : e - (l + p * g) * Math.E ** (p * f));
  }
  const c = Math.sqrt(4 * o * r - a ** 2), h = (a * l - 2 * o * t) / c, m = 0.5 * c / o, u = -(0.5 * a) / o;
  return (f) => (f -= s, f < 0 ? d : e - (Math.cos(f * m) * l + Math.sin(f * m) * h) * Math.E ** (f * u));
}
const It = [], kt = [];
let Dt = !1;
function hs() {
  let d = kt.shift();
  for (; d; ) {
    try {
      d.resolve(d.task());
    } catch (t) {
      d.reject(t);
    }
    d = kt.shift();
  }
  for (d = It.shift(); d; ) {
    try {
      d.resolve(d.task());
    } catch (t) {
      d.reject(t);
    }
    d = It.shift();
  }
  Dt = !1;
}
function oe() {
  Dt || (Dt = !0, requestAnimationFrame(hs));
}
function ce(d) {
  const t = {
    task: d,
    resolve: () => {
    },
    reject: () => {
    }
  }, e = new Promise((s, i) => {
    t.resolve = s, t.reject = i;
  });
  return It.push(t), oe(), e;
}
function Zt(d) {
  const t = {
    task: d,
    resolve: () => {
    },
    reject: () => {
    }
  }, e = new Promise((s, i) => {
    t.resolve = s, t.reject = i;
  });
  return kt.push(t), oe(), e;
}
class ds {
  constructor(t) {
    this.lyricPlayer = t, this.element.setAttribute("class", W.lyricLine), this.rebuildStyle();
  }
  element = document.createElement("div");
  left = 0;
  top = 0;
  delay = 0;
  // 由 LyricPlayer 来设置
  lineSize = [0, 0];
  lineTransforms = {
    posX: new Tt(0),
    posY: new Tt(0)
  };
  async measureSize() {
    return await ce(() => [
      this.element.clientWidth,
      this.element.clientHeight
    ]);
  }
  lastStyle = "";
  show() {
    this.rebuildStyle();
  }
  hide() {
    this.rebuildStyle();
  }
  rebuildStyle() {
    let t = `transform:translate(${this.lineTransforms.posX.getCurrentPosition().toFixed(2)}px,${this.lineTransforms.posY.getCurrentPosition().toFixed(2)}px);`;
    !this.lyricPlayer.getEnableSpring() && this.isInSight && (t += `transition-delay:${this.delay}ms;`), t !== this.lastStyle && (this.lastStyle = t, this.element.setAttribute("style", t));
  }
  getElement() {
    return this.element;
  }
  setTransform(t = this.left, e = this.top, s = !1, i = 0) {
    this.left = t, this.top = e, this.delay = i * 1e3 | 0, s || !this.lyricPlayer.getEnableSpring() ? (s && this.element.classList.add(W.tmpDisableTransition), this.lineTransforms.posX.setPosition(t), this.lineTransforms.posY.setPosition(e), this.lyricPlayer.getEnableSpring() ? this.rebuildStyle() : this.show(), s && requestAnimationFrame(() => {
      this.element.classList.remove(W.tmpDisableTransition);
    })) : (this.lineTransforms.posX.setTargetPosition(t, i), this.lineTransforms.posY.setTargetPosition(e, i));
  }
  update(t = 0) {
    this.lyricPlayer.getEnableSpring() && (this.lineTransforms.posX.update(t), this.lineTransforms.posY.update(t), this.isInSight ? this.show() : this.hide());
  }
  get isInSight() {
    const t = this.lineTransforms.posX.getCurrentPosition(), e = this.lineTransforms.posY.getCurrentPosition(), s = t + this.lineSize[0], i = e + this.lineSize[1], n = this.lyricPlayer.size[0], r = this.lyricPlayer.size[1];
    return !(t > n || e > r || s < 0 || i < 0);
  }
  dispose() {
    this.element.remove();
  }
}
function ms(d) {
  const e = 2.5949095;
  return d < 0.5 ? (2 * d) ** 2 * ((e + 1) * 2 * d - e) / 2 : ((2 * d - 2) ** 2 * ((e + 1) * (d * 2 - 2) + e) + 2) / 2;
}
function ps(d) {
  return d === 1 ? 1 : 1 - 2 ** (-10 * d);
}
const Q = (d, t, e) => Math.max(d, Math.min(t, e));
class fs {
  element = document.createElement("div");
  dot0 = document.createElement("span");
  dot1 = document.createElement("span");
  dot2 = document.createElement("span");
  left = 0;
  top = 0;
  playing = !0;
  lastStyle = "";
  currentInterlude;
  currentTime = 0;
  targetBreatheDuration = 1500;
  constructor() {
    this.element.className = W.interludeDots, this.element.appendChild(this.dot0), this.element.appendChild(this.dot1), this.element.appendChild(this.dot2);
  }
  getElement() {
    return this.element;
  }
  setTransform(t = this.left, e = this.top) {
    this.left = t, this.top = e, this.update();
  }
  setInterlude(t) {
    this.currentInterlude = t, this.currentTime = t?.[0] ?? 0, t ? this.element.classList.add(W.enabled) : this.element.classList.remove(W.enabled);
  }
  pause() {
    this.playing = !1, this.element.classList.remove(W.playing);
  }
  resume() {
    this.playing = !0, this.element.classList.add(W.playing);
  }
  update(t = 0) {
    if (!this.playing) return;
    this.currentTime += t;
    let e = "";
    if (e += `transform:translate(${this.left.toFixed(
      2
    )}px, ${this.top.toFixed(2)}px)`, this.currentInterlude) {
      const s = this.currentInterlude[1] - this.currentInterlude[0], i = this.currentTime - this.currentInterlude[0];
      if (i <= s) {
        const n = s / Math.ceil(s / this.targetBreatheDuration);
        let r = 1, a = 1;
        r *= Math.sin(1.5 * Math.PI - i / n * 2) / 20 + 1, i < 2e3 && (r *= ps(i / 2e3)), i < 500 ? a = 0 : i < 1e3 && (a *= (i - 500) / 500), s - i < 750 && (r *= 1 - ms(
          (750 - (s - i)) / 750 / 2
        )), s - i < 375 && (a *= Q(
          0,
          (s - i) / 375,
          1
        ));
        const o = Math.max(0, s - 750);
        r = Math.max(0, r) * 0.7, e += ` scale(${r})`;
        const l = Q(
          0.25,
          i * 3 / o * 0.75,
          1
        ), c = Q(
          0.25,
          (i - o / 3) * 3 / o * 0.75,
          1
        ), h = Q(
          0.25,
          (i - o / 3 * 2) * 3 / o * 0.75,
          1
        );
        this.dot0.style.opacity = `${Q(
          0,
          Math.max(0, a * l),
          1
        )}`, this.dot1.style.opacity = `${Q(
          0,
          Math.max(0, a * c),
          1
        )}`, this.dot2.style.opacity = `${Q(
          0,
          Math.max(0, a * h),
          1
        )}`;
      } else
        e += " scale(0)", this.dot0.style.opacity = "0", this.dot1.style.opacity = "0", this.dot2.style.opacity = "0";
      e += ";", this.lastStyle !== e && (this.element.setAttribute("style", e), this.lastStyle = e);
    }
  }
  dispose() {
    this.element.remove();
  }
}
class Rt extends EventTarget {
  element = document.createElement("div");
  currentTime = 0;
  /** @internal */
  lyricLinesSize = /* @__PURE__ */ new WeakMap();
  /** @internal */
  lyricLineElementMap = /* @__PURE__ */ new WeakMap();
  currentLyricLines = [];
  // protected currentLyricLineObjects: LyricLineBase[] = [];
  processedLines = [];
  lyricLinesIndexes = /* @__PURE__ */ new WeakMap();
  hotLines = /* @__PURE__ */ new Set();
  bufferedLines = /* @__PURE__ */ new Set();
  isNonDynamic = !1;
  hasDuetLine = !1;
  scrollToIndex = 0;
  disableSpring = !1;
  interludeDotsSize = [0, 0];
  interludeDots = new fs();
  bottomLine = new ds(this);
  enableBlur = !0;
  enableScale = !0;
  hidePassedLines = !1;
  scrollBoundary = [0, 0];
  currentLyricLineObjects = [];
  isSeeking = !1;
  lastCurrentTime = 0;
  alignAnchor = "center";
  alignPosition = 0.35;
  scrollOffset = 0;
  size = [0, 0];
  allowScroll = !0;
  isPageVisible = !0;
  initialLayoutFinished = !1;
  /**
   * 视图额外预渲染（overscan）距离，单位：像素。
   * 用于决定在视口之外多少距离内也认为是“可见”，以便提前创建/保留行元素。
   */
  overscanPx = 300;
  posXSpringParams = {
    mass: 1,
    damping: 10,
    stiffness: 100
  };
  posYSpringParams = {
    mass: 0.9,
    damping: 15,
    stiffness: 90
  };
  scaleSpringParams = {
    mass: 2,
    damping: 25,
    stiffness: 100
  };
  scaleForBGSpringParams = {
    mass: 1,
    damping: 20,
    stiffness: 50
  };
  onPageShow = () => {
    this.isPageVisible = !0, this.setCurrentTime(this.currentTime, !0);
  };
  onPageHide = () => {
    this.isPageVisible = !1;
  };
  scrolledHandler = 0;
  isScrolled = !1;
  /** @internal */
  resizeObserver = new ResizeObserver(((t) => {
    let e = !1, s = !1;
    for (const i of t)
      if (i.target === this.element) {
        const n = i.contentRect;
        this.size[0] = n.width, this.size[1] = n.height, s = !0;
      } else if (i.target === this.interludeDots.getElement())
        this.interludeDotsSize[0] = i.target.clientWidth, this.interludeDotsSize[1] = i.target.clientHeight, e = !0;
      else if (i.target === this.bottomLine.getElement()) {
        const n = [
          i.target.clientWidth,
          i.target.clientHeight
        ], r = this.bottomLine.lineSize;
        (n[0] !== r[0] || n[1] !== r[1]) && (this.bottomLine.lineSize = n, e = !0);
      } else {
        const n = this.lyricLineElementMap.get(i.target);
        if (n) {
          const r = [
            i.target.clientWidth,
            i.target.clientHeight
          ], a = this.lyricLinesSize.get(
            n
          ) ?? [0, 0];
          (r[0] !== a[0] || r[1] !== a[1]) && (this.lyricLinesSize.set(n, r), n.onLineSizeChange(r), e = !0);
        }
      }
    e && this.calcLayout(!0), s && this.onResize();
  }));
  wordFadeWidth = 0.5;
  targetAlignIndex = 0;
  constructor() {
    super(), this.resizeObserver.observe(this.element), this.resizeObserver.observe(this.interludeDots.getElement()), this.element.classList.add(W.lyricPlayer), this.element.appendChild(this.interludeDots.getElement()), this.element.appendChild(this.bottomLine.getElement()), this.interludeDots.setTransform(0, 200), window.addEventListener("pageshow", this.onPageShow), window.addEventListener("pagehide", this.onPageHide);
    let t = 0, e = "none", s = 0, i = 0, n = 0, r = Symbol("amll-scroll"), a = 0, o = 0;
    this.element.addEventListener("touchstart", (l) => {
      this.beginScrollHandler() && (l.preventDefault(), t = this.scrollOffset, s = l.touches[0].screenY, a = s, i = Date.now(), n = 0);
    }), this.element.addEventListener("touchmove", (l) => {
      if (this.beginScrollHandler()) {
        l.preventDefault();
        const c = l.touches[0].screenY, h = c - s, m = c - a, u = m > 0 ? "down" : m < 0 ? "up" : "none";
        e !== u ? (e = u, t = this.scrollOffset, s = c, i = Date.now()) : this.scrollOffset = t - h, a = c, o = Date.now(), this.limitScrollOffset(), this.calcLayout(!0);
      }
    }), this.element.addEventListener("touchend", (l) => {
      if (this.beginScrollHandler()) {
        l.preventDefault(), s = 0;
        const c = Date.now();
        if (c - o > 100) return this.endScrollHandler();
        const h = c - i;
        n = (this.scrollOffset - t) / h * 1e3;
        let m = 0;
        const u = Symbol("amll-scroll");
        r = u;
        const f = (g) => {
          m ||= g, r === u && this.beginScrollHandler() && (this.scrollOffset += n * (g - m) / 1e3, n *= 0.99, this.limitScrollOffset(), this.calcLayout(!0), Math.abs(n) > 1 && !this.scrollBoundary.includes(this.scrollOffset) && requestAnimationFrame(f), this.endScrollHandler(), m = g);
        };
        requestAnimationFrame(f), this.endScrollHandler();
      }
    }), this.element.addEventListener("wheel", (l) => {
      this.beginScrollHandler() && (l.deltaMode === l.DOM_DELTA_PIXEL ? (this.scrollOffset += l.deltaY, this.limitScrollOffset(), this.calcLayout(!0)) : (this.scrollOffset += l.deltaY * 50, this.limitScrollOffset(), this.calcLayout(!1)), this.endScrollHandler());
    });
  }
  beginScrollHandler() {
    const t = this.allowScroll;
    return t && (this.isScrolled = !0, clearTimeout(this.scrolledHandler), this.scrolledHandler = setTimeout(() => {
      this.isScrolled = !1, this.scrollOffset = 0;
    }, 5e3)), t;
  }
  endScrollHandler() {
  }
  limitScrollOffset() {
    this.scrollOffset = Math.max(
      Math.min(this.scrollBoundary[1], this.scrollOffset),
      this.scrollBoundary[0]
    );
  }
  /**
   * 设置文字动画的渐变宽度，单位以歌词行的主文字字体大小的倍数为单位，默认为 0.5，即一个全角字符的一半宽度
   *
   * 如果要模拟 Apple Music for Android 的效果，可以设置为 1
   *
   * 如果要模拟 Apple Music for iPad 的效果，可以设置为 0.5
   *
   * 如果想要近乎禁用渐变效果，可以设置成非常接近 0 的小数（例如 `0.0001` ），但是**不可以为 0**
   *
   * @param value 需要设置的渐变宽度，单位以歌词行的主文字字体大小的倍数为单位，默认为 0.5
   */
  setWordFadeWidth(t = 0.5) {
    this.wordFadeWidth = Math.max(1e-4, t);
  }
  /**
   * 是否启用歌词行缩放效果，默认启用
   *
   * 如果启用，非选中的歌词行会轻微缩小以凸显当前播放歌词行效果
   *
   * 此效果对性能影响微乎其微，推荐启用
   * @param enable 是否启用歌词行缩放效果
   */
  setEnableScale(t = !0) {
    this.enableScale = t, this.calcLayout();
  }
  /**
   * 获取当前是否启用了歌词行缩放效果
   * @returns 是否启用歌词行缩放效果
   */
  getEnableScale() {
    return this.enableScale;
  }
  /**
   * 获取当前文字动画的渐变宽度，单位以歌词行的主文字字体大小的倍数为单位
   * @returns 当前文字动画的渐变宽度，单位以歌词行的主文字字体大小的倍数为单位
   */
  getWordFadeWidth() {
    return this.wordFadeWidth;
  }
  setIsSeeking(t) {
    this.isSeeking = t;
  }
  /**
   * 设置是否隐藏已经播放过的歌词行，默认不隐藏
   * @param hide 是否隐藏已经播放过的歌词行，默认不隐藏
   */
  setHidePassedLines(t) {
    this.hidePassedLines = t, this.calcLayout();
  }
  /**
   * 设置是否启用歌词行的模糊效果
   * @param enable 是否启用
   */
  setEnableBlur(t) {
    this.enableBlur !== t && (this.enableBlur = t, this.calcLayout());
  }
  /**
   * 设置目标歌词行的对齐方式，默认为 `center`
   *
   * - 设置成 `top` 的话将会向目标歌词行的顶部对齐
   * - 设置成 `bottom` 的话将会向目标歌词行的底部对齐
   * - 设置成 `center` 的话将会向目标歌词行的垂直中心对齐
   * @param alignAnchor 歌词行对齐方式，详情见函数说明
   */
  setAlignAnchor(t) {
    this.alignAnchor = t;
  }
  /**
   * 设置默认的歌词行对齐位置，相对于整个歌词播放组件的大小位置，默认为 `0.5`
   * @param alignPosition 一个 `[0.0-1.0]` 之间的任意数字，代表组件高度由上到下的比例位置
   */
  setAlignPosition(t) {
    this.alignPosition = t;
  }
  /**
   * 设置 overscan（视图上下额外缓冲渲染区）距离，单位：像素。
   * @param px 像素值，默认 300
   */
  setOverscanPx(t) {
    this.overscanPx = Math.max(0, t | 0);
  }
  /** 获取当前 overscan 像素距离 */
  getOverscanPx() {
    return this.overscanPx;
  }
  /**
   * 设置是否使用物理弹簧算法实现歌词动画效果，默认启用
   *
   * 如果启用，则会通过弹簧算法实时处理歌词位置，但是需要性能足够强劲的电脑方可流畅运行
   *
   * 如果不启用，则会回退到基于 `transition` 的过渡效果，对低性能的机器比较友好，但是效果会比较单一
   */
  setEnableSpring(t = !0) {
    this.disableSpring = !t, t ? this.element.classList.remove(W.disableSpring) : this.element.classList.add(W.disableSpring), this.calcLayout(!0);
  }
  /**
   * 获取当前是否启用了物理弹簧
   * @returns 是否启用物理弹簧
   */
  getEnableSpring() {
    return !this.disableSpring;
  }
  /**
   * 获取当前播放时间里是否处于间奏区间
   * 如果是则会返回单位为毫秒的始末时间
   * 否则返回 undefined
   *
   * 这个只允许内部调用
   * @returns [开始时间,结束时间,大概处于的歌词行ID,下一句是否为对唱歌词] 或 undefined 如果不处于间奏区间
   */
  getCurrentInterlude() {
    if (this.bufferedLines.size > 0) return;
    const t = this.currentTime + 20, e = this.scrollToIndex;
    if (e === 0) {
      if (this.processedLines[0]?.startTime) {
        if (this.processedLines[0].startTime > t)
          return [
            t,
            Math.max(t, this.processedLines[0].startTime - 250),
            -2,
            this.processedLines[0].isDuet
          ];
        if (this.processedLines[1].startTime > t && this.processedLines[0].endTime < t)
          return [
            Math.max(this.processedLines[0].endTime, t),
            this.processedLines[1].startTime,
            0,
            this.processedLines[1].isDuet
          ];
      }
    } else if (this.processedLines[e]?.endTime && this.processedLines[e + 1]?.startTime) {
      if (this.processedLines[e + 1].startTime > t && this.processedLines[e].endTime < t)
        return [
          Math.max(this.processedLines[e].endTime, t),
          this.processedLines[e + 1].startTime,
          e,
          this.processedLines[e + 1].isDuet
        ];
      if (this.processedLines[e + 2]?.startTime && this.processedLines[e + 2].startTime > t && this.processedLines[e + 1].endTime < t)
        return [
          Math.max(this.processedLines[e + 1].endTime, t),
          this.processedLines[e + 2].startTime,
          e + 1,
          this.processedLines[e + 2].isDuet
        ];
    }
  }
  /**
   * 设置当前播放歌词，要注意传入后这个数组内的信息不得修改，否则会发生错误
   * @param lines 歌词数组
   * @param initialTime 初始时间，默认为 0
   */
  setLyricLines(t, e = 0) {
    this.initialLayoutFinished = !0;
    for (const s of t)
      for (const i of s.words)
        i.word = i.word.replace(/\s+/g, " ");
    this.lastCurrentTime = e, this.currentTime = e, this.currentLyricLines = Gt(t), this.processedLines = Gt(t), this.isNonDynamic = !0;
    for (const s of this.processedLines)
      if (s.words.length > 1) {
        this.isNonDynamic = !1;
        break;
      }
    this.hasDuetLine = this.processedLines.some((s) => s.isDuet);
    for (let s = this.processedLines.length - 1; s >= 0; s--) {
      const i = this.processedLines[s];
      if (i.isBG) continue;
      const n = this.processedLines[s - 1];
      n ? i.startTime = Math.max(
        Math.min(n.endTime, i.startTime),
        i.startTime - 1e3
      ) : i.startTime = Math.max(0, i.startTime - 1e3);
    }
    for (let s = this.processedLines.length - 1; s >= 0; s--) {
      const i = this.processedLines[s];
      if (i.isBG) continue;
      const n = this.processedLines[s + 1];
      if (n?.isBG) {
        const r = Math.min(
          ...n.words.filter((c) => c.word.trim().length > 0).map((c) => c.startTime),
          i.startTime
        ), a = Math.max(
          ...n.words.filter((c) => c.word.trim().length > 0).map((c) => c.endTime),
          i.endTime
        ), o = Math.min(r, i.startTime), l = Math.max(a, i.endTime);
        n.startTime = o, n.endTime = l;
      }
    }
    for (const s of this.currentLyricLineObjects)
      s.dispose();
    this.interludeDots.setInterlude(void 0), this.hotLines.clear(), this.bufferedLines.clear(), this.setCurrentTime(0, !0);
  }
  /**
   * 设置当前播放进度，单位为毫秒且**必须是整数**，此时将会更新内部的歌词进度信息
   * 内部会根据调用间隔和播放进度自动决定如何滚动和显示歌词，所以这个的调用频率越快越准确越好
   *
   * 调用完成后，可以每帧调用 `update` 函数来执行歌词动画效果
   * @param time 当前播放进度，单位为毫秒
   */
  setCurrentTime(t, e = !1) {
    if (this.currentTime = t, !this.initialLayoutFinished && !e) return;
    const s = /* @__PURE__ */ new Set(), i = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set();
    for (const r of this.hotLines) {
      const a = this.processedLines[r];
      if (a) {
        if (a.isBG) continue;
        const o = this.processedLines[r + 1];
        if (o?.isBG) {
          const l = this.processedLines[r + 2], c = Math.min(a.startTime, o?.startTime), h = Math.min(
            Math.max(a.endTime, l?.startTime ?? Number.MAX_VALUE),
            Math.max(a.endTime, o?.endTime)
          );
          (c > t || h <= t) && (this.hotLines.delete(r), s.add(r), this.hotLines.delete(r + 1), s.add(r + 1), e && (this.currentLyricLineObjects[r]?.disable(), this.currentLyricLineObjects[r + 1]?.disable()));
        } else (a.startTime > t || a.endTime <= t) && (this.hotLines.delete(r), s.add(r), e && this.currentLyricLineObjects[r]?.disable());
      } else
        this.hotLines.delete(r), s.add(r), e && this.currentLyricLineObjects[r]?.disable();
    }
    this.currentLyricLineObjects.forEach((r, a, o) => {
      const l = r.getLine();
      !l.isBG && l.startTime <= t && l.endTime > t && (this.hotLines.has(a) || (this.hotLines.add(a), n.add(a), e && r.enable(), o[a + 1]?.getLine()?.isBG && (this.hotLines.add(a + 1), n.add(a + 1), e && o[a + 1].enable())));
    });
    for (const r of this.bufferedLines)
      this.hotLines.has(r) || (i.add(r), e && this.currentLyricLineObjects[r]?.disable());
    if (e) {
      this.bufferedLines.size > 0 ? this.scrollToIndex = Math.min(...this.bufferedLines) : this.scrollToIndex = this.processedLines.findIndex(
        (r) => r.startTime >= t
      ), this.bufferedLines.clear();
      for (const r of this.hotLines)
        this.bufferedLines.add(r);
      this.calcLayout();
    } else if (i.size > 0 || n.size > 0)
      if (i.size === 0 && n.size > 0) {
        for (const r of n)
          this.bufferedLines.add(r), this.currentLyricLineObjects[r]?.enable();
        this.scrollToIndex = Math.min(...this.bufferedLines), this.calcLayout();
      } else if (n.size === 0 && i.size > 0) {
        if (as(i, this.bufferedLines)) {
          for (const r of this.bufferedLines)
            this.hotLines.has(r) || (this.bufferedLines.delete(r), this.currentLyricLineObjects[r]?.disable());
          this.calcLayout();
        }
      } else {
        for (const r of n)
          this.bufferedLines.add(r), this.currentLyricLineObjects[r]?.enable();
        for (const r of i)
          this.bufferedLines.delete(r), this.currentLyricLineObjects[r]?.disable();
        this.bufferedLines.size > 0 && (this.scrollToIndex = Math.min(...this.bufferedLines)), this.calcLayout();
      }
    this.lastCurrentTime = t;
  }
  /**
   * 重新布局定位歌词行的位置，调用完成后再逐帧调用 `update`
   * 函数即可让歌词通过动画移动到目标位置。
   *
   * 函数有一个 `force` 参数，用于指定是否强制修改布局，也就是不经过动画直接调整元素位置和大小。
   *
   * 此函数还有一个 `reflow` 参数，用于指定是否需要重新计算布局
   *
   * 因为计算布局必定会导致浏览器重排布局，所以会大幅度影响流畅度和性能，故请只在以下情况下将其​设置为 true：
   *
   * 1. 歌词页面大小发生改变时（这个组件会自行处理）
   * 2. 加载了新的歌词时（不论前后歌词是否完全一样）
   * 3. 用户自行跳转了歌曲播放位置（不论距离远近）
   *
   * @param force 是否不经过动画直接修改布局定位
   * @param reflow 是否进行重新布局（重新计算每行歌词大小）
   */
  async calcLayout(t = !1) {
    const e = this.getCurrentInterlude();
    let s = -this.scrollOffset, i = this.scrollToIndex, n = 0;
    e ? (n = e[1] - e[0], n >= 4e3 && this.currentLyricLineObjects[e[2] + 1] && (i = e[2] + 1)) : this.interludeDots.setInterlude(void 0);
    const r = this.size[1] / 5, a = this.currentLyricLineObjects.slice(0, i).reduce(
      (u, f) => u + (f.getLine().isBG && this.isPlaying ? 0 : this.lyricLinesSize.get(f)?.[1] ?? r),
      0
    );
    this.scrollBoundary[0] = -a, s -= a, s += this.size[1] * this.alignPosition;
    const o = this.currentLyricLineObjects[i];
    if (this.targetAlignIndex = i, o) {
      const u = this.lyricLinesSize.get(o)?.[1] ?? r;
      switch (this.alignAnchor) {
        case "bottom":
          s -= u;
          break;
        case "center":
          s -= u / 2;
          break;
      }
    }
    const l = Math.max(...this.bufferedLines);
    let c = 0, h = t ? 0 : 0.05, m = !1;
    this.currentLyricLineObjects.forEach((u, f) => {
      const g = this.bufferedLines.has(f), p = g || f >= this.scrollToIndex && f < l, y = u.getLine();
      !m && n >= 4e3 && (f === this.scrollToIndex && e?.[2] === -2 || f === this.scrollToIndex + 1) && (m = !0, this.interludeDots.setTransform(0, s), e && this.interludeDots.setInterlude([e[0], e[1]]), s += this.interludeDotsSize[1]);
      let L;
      this.hidePassedLines ? f < (e ? e[2] + 1 : this.scrollToIndex) && this.isPlaying ? L = 1e-5 : g ? L = 0.85 : L = this.isNonDynamic ? 0.2 : 1 : g ? L = 0.85 : L = this.isNonDynamic ? 0.2 : 1;
      let x = 0;
      this.enableBlur && (p ? x = 0 : (x = 1, f < this.scrollToIndex ? x += Math.abs(this.scrollToIndex - f) + 1 : x += Math.abs(
        f - Math.max(this.scrollToIndex, l)
      )));
      const M = this.enableScale ? 97 : 100;
      let b = 100;
      !p && this.isPlaying && (y.isBG ? b = 75 : b = M), u.setTransform(
        s,
        b,
        L,
        window.innerWidth <= 1024 ? x * 0.8 : x,
        !1,
        c
      ), y.isBG && (p || !this.isPlaying) ? s += this.lyricLinesSize.get(u)?.[1] ?? r : y.isBG || (s += this.lyricLinesSize.get(u)?.[1] ?? r), s >= 0 && !this.isSeeking && (y.isBG || (c += h), f >= this.scrollToIndex && (h /= 1.05));
    }), this.scrollBoundary[1] = s + this.scrollOffset - this.size[1] / 2, this.bottomLine.setTransform(0, s, !1, c);
  }
  /**
   * 设置所有歌词行在横坐标上的弹簧属性，包括重量、弹力和阻力。
   *
   * @param params 需要设置的弹簧属性，提供的属性将会覆盖原来的属性，未提供的属性将会保持原样
   * @deprecated 考虑到横向弹簧效果并不常见，所以这个函数将会在未来的版本中移除
   */
  setLinePosXSpringParams(t = {}) {
  }
  /**
   * 设置所有歌词行在​纵坐标上的弹簧属性，包括重量、弹力和阻力。
   *
   * @param params 需要设置的弹簧属性，提供的属性将会覆盖原来的属性，未提供的属性将会保持原样
   */
  setLinePosYSpringParams(t = {}) {
    this.posYSpringParams = {
      ...this.posYSpringParams,
      ...t
    }, this.bottomLine.lineTransforms.posY.updateParams(this.posYSpringParams);
    for (const e of this.currentLyricLineObjects)
      e.lineTransforms.posY.updateParams(this.posYSpringParams);
  }
  /**
   * 设置所有歌词行在​缩放大小上的弹簧属性，包括重量、弹力和阻力。
   *
   * @param params 需要设置的弹簧属性，提供的属性将会覆盖原来的属性，未提供的属性将会保持原样
   */
  setLineScaleSpringParams(t = {}) {
    this.scaleSpringParams = {
      ...this.scaleSpringParams,
      ...t
    }, this.scaleForBGSpringParams = {
      ...this.scaleForBGSpringParams,
      ...t
    };
    for (const e of this.currentLyricLineObjects)
      e.getLine().isBG ? e.lineTransforms.scale.updateParams(this.scaleForBGSpringParams) : e.lineTransforms.scale.updateParams(this.scaleSpringParams);
  }
  isPlaying = !0;
  /**
   * 暂停部分效果演出，目前会暂停播放间奏点的动画，且将背景歌词显示出来
   */
  pause() {
    this.interludeDots.pause(), this.isPlaying && (this.isPlaying = !1, this.calcLayout());
  }
  /**
   * 恢复部分效果演出，目前会恢复播放间奏点的动画
   */
  resume() {
    this.interludeDots.resume(), this.isPlaying || (this.isPlaying = !0, this.calcLayout());
  }
  /**
   * 更新动画，这个函数应该被逐帧调用或者在以下情况下调用一次：
   *
   * 1. 刚刚调用完设置歌词函数的时候
   * @param delta 距离上一次被调用到现在的时长，单位为毫秒（可为浮点数）
   */
  update(t = 0) {
    this.bottomLine.update(t / 1e3), this.interludeDots.update(t / 1e3);
  }
  onResize() {
  }
  /**
   * 获取一个特殊的底栏元素，默认是空白的，可以往内部添加任意元素
   *
   * 这个元素始终在歌词的底部，可以用于显示歌曲创作者等信息
   *
   * 但是请勿删除该元素，只能在内部存放元素
   *
   * @returns 一个元素，可以往内部添加任意元素
   */
  getBottomLineElement() {
    return this.bottomLine.getElement();
  }
  /**
   * 重置用户滚动状态
   *
   * 请在用户完成滚动点击跳转歌词时调用本事件再调用 `calcLayout` 以正确滚动到目标位置
   */
  resetScroll() {
    this.isScrolled = !1, this.scrollOffset = 0, clearTimeout(this.scrolledHandler), this.scrolledHandler = 0;
  }
  /**
   * 获取当前歌词数组
   *
   * 一般和最后调用 `setLyricLines` 给予的参数一样
   * @returns 当前歌词数组
   */
  getLyricLines() {
    return this.currentLyricLines;
  }
  /**
   * 获取当前歌词的播放位置
   *
   * 一般和最后调用 `setCurrentTime` 给予的参数一样
   * @returns 当前播放位置
   */
  getCurrentTime() {
    return this.currentTime;
  }
  getElement() {
    return this.element;
  }
  dispose() {
    this.element.remove(), window.removeEventListener("pageshow", this.onPageShow), window.removeEventListener("pagehide", this.onPageHide);
  }
}
class q extends EventTarget {
  top = 0;
  scale = 1;
  blur = 0;
  opacity = 1;
  delay = 0;
  lineTransforms = {
    posY: new Tt(0),
    scale: new Tt(100)
  };
  onLineSizeChange(t) {
  }
  setTransform(t = this.top, e = this.scale, s = this.opacity, i = this.blur, n = !1, r = 0) {
    this.top = t, this.scale = e, this.opacity = s, this.blur = i, this.delay = r;
  }
  /**
   * 判定歌词是否可以应用强调辉光效果
   *
   * 果子在对辉光效果的解释是一种强调（emphasized）效果
   *
   * 条件是一个单词时长大于等于 1s 且长度小于等于 7
   *
   * @param word 单词
   * @returns 是否可以应用强调辉光效果
   */
  static shouldEmphasize(t) {
    return os(t.word) ? t.endTime - t.startTime >= 1e3 : t.endTime - t.startTime >= 1e3 && t.word.trim().length <= 7 && t.word.trim().length > 1;
  }
  dispose() {
  }
}
function us(d) {
  return d && d.__esModule && Object.prototype.hasOwnProperty.call(d, "default") ? d.default : d;
}
var Pt, Jt;
function gs() {
  if (Jt) return Pt;
  Jt = 1;
  var d = 4, t = 1e-3, e = 1e-7, s = 10, i = 11, n = 1 / (i - 1), r = typeof Float32Array == "function";
  function a(g, p) {
    return 1 - 3 * p + 3 * g;
  }
  function o(g, p) {
    return 3 * p - 6 * g;
  }
  function l(g) {
    return 3 * g;
  }
  function c(g, p, y) {
    return ((a(p, y) * g + o(p, y)) * g + l(p)) * g;
  }
  function h(g, p, y) {
    return 3 * a(p, y) * g * g + 2 * o(p, y) * g + l(p);
  }
  function m(g, p, y, L, x) {
    var M, b, w = 0;
    do
      b = p + (y - p) / 2, M = c(b, L, x) - g, M > 0 ? y = b : p = b;
    while (Math.abs(M) > e && ++w < s);
    return b;
  }
  function u(g, p, y, L) {
    for (var x = 0; x < d; ++x) {
      var M = h(p, y, L);
      if (M === 0)
        return p;
      var b = c(p, y, L) - g;
      p -= b / M;
    }
    return p;
  }
  function f(g) {
    return g;
  }
  return Pt = function(p, y, L, x) {
    if (!(0 <= p && p <= 1 && 0 <= L && L <= 1))
      throw new Error("bezier x values must be in [0, 1] range");
    if (p === y && L === x)
      return f;
    for (var M = r ? new Float32Array(i) : new Array(i), b = 0; b < i; ++b)
      M[b] = c(b * n, p, L);
    function w(T) {
      for (var v = 0, P = 1, z = i - 1; P !== z && M[P] <= T; ++P)
        v += n;
      --P;
      var E = (T - M[P]) / (M[P + 1] - M[P]), F = v + E * n, _ = h(F, p, L);
      return _ >= t ? u(T, F, p, L) : _ === 0 ? F : m(T, v, v + n, p, L);
    }
    return function(v) {
      return v === 0 ? 0 : v === 1 ? 1 : c(w(v), y, x);
    };
  }, Pt;
}
var ys = gs();
const St = /* @__PURE__ */ us(ys), Ls = /^[\p{Unified_Ideograph}\u0800-\u9FFC]+$/u;
function Ot(d) {
  const t = [];
  for (const n of d) {
    const r = n.word.replace(/\s/g, "").length, a = n.word.split(" ").filter((o) => o.trim().length > 0);
    if (a.length > 1) {
      n.word.startsWith(" ") && t.push({
        word: " ",
        romanWord: "",
        startTime: 0,
        endTime: 0,
        obscene: !1
      });
      let o = 0;
      for (const l of a) {
        const c = {
          word: l,
          romanWord: "",
          obscene: n.obscene,
          startTime: n.startTime + o / r * (n.endTime - n.startTime),
          endTime: n.startTime + (o + l.length) / r * (n.endTime - n.startTime)
        };
        t.push(c), t.push({
          word: " ",
          romanWord: "",
          startTime: 0,
          endTime: 0,
          obscene: !1
        }), o += l.length;
      }
      n.word.endsWith(" ") || t.pop();
    } else
      t.push({
        ...n
      });
  }
  let e = [], s = [];
  const i = [];
  for (const n of t) {
    const r = n.word;
    e.push(r), s.push(n), r.length > 0 && r.trim().length === 0 ? (e.pop(), s.pop(), s.length === 1 ? i.push(s[0]) : s.length > 1 && i.push(s), i.push(n), e = [], s = []) : (!/^\s*[^\s]*\s*$/.test(e.join("")) || Ls.test(r)) && (e.pop(), s.pop(), s.length === 1 ? i.push(s[0]) : s.length > 1 && i.push(s), e = [r], s = [n]);
  }
  return s.length === 1 ? i.push(s[0]) : i.push(s), i;
}
function le() {
  return [
    1,
    0,
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    0,
    1
  ];
}
function he(d, t = 1, e = { x: 0, y: 0 }) {
  const [s, i] = [e.x, e.y];
  return [
    d[0] * t,
    d[1] * t,
    d[2] * t,
    d[3],
    d[4] * t,
    d[5] * t,
    d[6] * t,
    d[7],
    d[8] * t,
    d[9] * t,
    d[10] * t,
    d[11],
    d[12] - s * t + s,
    d[13] - i * t + i,
    d[14],
    d[15]
  ];
}
function de(d, t = 4) {
  const e = (s, i) => s.toFixed(t);
  return `matrix3d(${d.map(e).join(", ")})`;
}
const Mt = 32, me = (d, t) => (e) => Math.min(1, Math.max(0, (e - d) / (t - d))), Wt = 0.5, Ms = me(0, Wt), bs = me(Wt, 1), xs = St(0.2, 0.4, 0.58, 1), Ts = St(0.3, 0, 0.58, 1), ws = (d) => (t) => t < d ? xs(Ms(t)) : 1 - Ts(bs(t));
function Qt(d, t = 0, e = "rgba(0,0,0,var(--bright-mask-alpha, 1.0))", s = "rgba(0,0,0,var(--dark-mask-alpha, 1.0))") {
  const i = 2 + d + t, n = d / i, r = (1 - n) / 2;
  return [
    `linear-gradient(to right,${e} ${r * 100}%,${s} ${(r + n) * 100}%)`,
    i
  ];
}
let Ss = class extends MouseEvent {
  constructor(t, e) {
    super(e.type, e), this.line = t;
  }
};
function Es(d) {
  const t = d.match(/matrix\(([^)]+)\)/);
  if (t) {
    const e = t[1].split(", "), s = Number.parseFloat(e[0]), i = Number.parseFloat(e[3]);
    return (s + i) / 2;
  }
  return 1;
}
let vs = class extends q {
  constructor(t, e = {
    words: [],
    translatedLyric: "",
    romanLyric: "",
    startTime: 0,
    endTime: 0,
    isBG: !1,
    isDuet: !1
  }) {
    super(), this.lyricPlayer = t, this.lyricLine = e, this._prevParentEl = t.getElement(), t.resizeObserver.observe(this.element), this.element.setAttribute("class", W.lyricLine), this.lyricLine.isBG && this.element.classList.add(W.lyricBgLine), this.lyricLine.isDuet && this.element.classList.add(W.lyricDuetLine), this.lineTransforms.posY.setPosition(window.innerHeight * 2), this.element.appendChild(document.createElement("div")), this.element.appendChild(document.createElement("div")), this.element.appendChild(document.createElement("div"));
    const s = this.element.children[0], i = this.element.children[1], n = this.element.children[2];
    s.setAttribute("class", W.lyricMainLine), i.setAttribute("class", W.lyricSubLine), n.setAttribute("class", W.lyricSubLine), this.rebuildStyle();
  }
  element = document.createElement("div");
  splittedWords = [];
  // 标记是否已经构建了行内的实际 DOM（单词与动画等）
  built = !1;
  // 由 LyricPlayer 来设置
  lineSize = [0, 0];
  listenersMap = /* @__PURE__ */ new Map();
  onMouseEvent = (t) => {
    const e = new Ss(this, t);
    for (const s of this.listenersMap.get(t.type) ?? [])
      s.call(this, e);
    if (!this.dispatchEvent(e) || e.defaultPrevented)
      return t.preventDefault(), t.stopPropagation(), t.stopImmediatePropagation(), !1;
  };
  addMouseEventListener(t, e, s) {
    if (e) {
      const i = this.listenersMap.get(t) ?? /* @__PURE__ */ new Set();
      i.size === 0 && this.element.addEventListener(t, this.onMouseEvent, s), i.add(e), this.listenersMap.set(t, i);
    }
  }
  removeMouseEventListener(t, e, s) {
    if (e) {
      const i = this.listenersMap.get(t);
      i && (i.delete(e), i.size === 0 && this.element.removeEventListener(t, this.onMouseEvent, s));
    }
  }
  areWordsOnSameLine(t, e) {
    if (t?.mainElement && e?.mainElement) {
      const s = t.mainElement, i = e.mainElement, n = s.getBoundingClientRect(), r = i.getBoundingClientRect();
      return Math.abs(n.top - r.top) < 10;
    }
    return !0;
  }
  isEnabled = !1;
  async enable(t = this.lyricLine.startTime) {
    this.isEnabled = !0, this.element.classList.add(W.active);
    const e = this.element.children[0];
    for (const s of this.splittedWords) {
      for (const i of s.elementAnimations)
        i.currentTime = 0, i.playbackRate = 1, i.play();
      for (const i of s.maskAnimations)
        i.currentTime = Math.min(
          this.totalDuration,
          Math.max(0, t - this.lyricLine.startTime)
        ), i.playbackRate = 1, i.play();
    }
    e.classList.add(W.active);
  }
  disable() {
    this.isEnabled = !1, this.element.classList.remove(W.active);
    const t = this.element.children[0];
    for (const e of this.splittedWords)
      for (const s of e.elementAnimations)
        (s.id === "float-word" || s.id.includes("emphasize-word-float-only")) && (s.playbackRate = -1, s.play());
    t.classList.remove(W.active);
  }
  lastWord;
  async resume() {
    if (this.isEnabled)
      for (const t of this.splittedWords) {
        for (const e of t.elementAnimations)
          (!this.lastWord || this.splittedWords.indexOf(this.lastWord) < this.splittedWords.indexOf(t)) && e.play();
        for (const e of t.maskAnimations)
          (!this.lastWord || this.splittedWords.indexOf(this.lastWord) < this.splittedWords.indexOf(t)) && e.play();
      }
  }
  async pause() {
    if (this.isEnabled)
      for (const t of this.splittedWords) {
        for (const e of t.elementAnimations)
          e.pause();
        for (const e of t.maskAnimations)
          e.pause();
      }
  }
  setMaskAnimationState(t = 0) {
    const e = t - this.lyricLine.startTime;
    for (const s of this.splittedWords)
      for (const i of s.maskAnimations)
        i.currentTime = Math.min(this.totalDuration, Math.max(0, e)), i.playbackRate = 1, e >= 0 && e < this.totalDuration ? i.play() : i.pause();
  }
  getLine() {
    return this.lyricLine;
  }
  _hide = !0;
  _prevParentEl;
  lastStyle = "";
  show() {
    this._hide = !1, this.element.parentElement || (this._prevParentEl.appendChild(this.element), this.lyricPlayer.resizeObserver.observe(this.element)), this.built || (this.rebuildElement(), this.built = !0, this.updateMaskImageSync()), this.rebuildStyle();
  }
  hide() {
    this._hide = !0, this.element.parentElement && (this._prevParentEl.removeChild(this.element), this.lyricPlayer.resizeObserver.unobserve(this.element)), this.built && (this.disposeElements(), this.built = !1);
  }
  rebuildStyle() {
    let t = "";
    t += `transform:translateY(${this.lineTransforms.posY.getCurrentPosition().toFixed(
      1
    )}px) scale(${(this.lineTransforms.scale.getCurrentPosition() / 100).toFixed(4)});`, !this.lyricPlayer.getEnableSpring() && this.isInSight && (t += `transition-delay:${this.delay}ms;`), t += `filter:blur(${Math.min(32, this.blur)}px);`, t !== this.lastStyle && (this.lastStyle = t, this.element.setAttribute("style", t));
  }
  rebuildElement() {
    this.disposeElements();
    const t = this.element.children[0], e = this.element.children[1], s = this.element.children[2];
    if (this.lyricPlayer._getIsNonDynamic()) {
      t.innerText = this.lyricLine.words.map((n) => n.word).join(""), this.setSubLinesText(e, s);
      return;
    }
    const i = Ot(this.lyricLine.words);
    t.innerHTML = "";
    for (const n of i)
      if (Array.isArray(n)) {
        if (n.length === 0) continue;
        this.buildChunkGroup(n, t);
      } else n.word.trim().length === 0 ? t.appendChild(document.createTextNode(" ")) : this.buildSingleWord(n, t);
    this.setSubLinesText(e, s);
  }
  /** 设置翻译与音译行文本 */
  setSubLinesText(t, e) {
    t.innerText = this.lyricLine.translatedLyric, e.innerText = this.lyricLine.romanLyric;
  }
  /** 处理一组连写（无空格）单词，包含强调效果 */
  buildChunkGroup(t, e) {
    const s = t.reduce(
      (a, o) => (a.endTime = Math.max(a.endTime, o.endTime), a.startTime = Math.min(a.startTime, o.startTime), a.word += o.word, a),
      {
        word: "",
        romanWord: "",
        startTime: Number.POSITIVE_INFINITY,
        endTime: Number.NEGATIVE_INFINITY,
        wordType: "normal",
        obscene: !1
      }
    ), i = t.map((a) => q.shouldEmphasize(a)).reduce((a, o) => a || o, q.shouldEmphasize(s)), n = document.createElement("span");
    n.classList.add(W.emphasizeWrapper);
    const r = [];
    for (const a of t) {
      const o = document.createElement("span");
      if (i) {
        o.classList.add(W.emphasize);
        const l = [];
        for (const h of a.word.trim()) {
          const m = document.createElement("span");
          m.innerText = h, l.push(m), r.push(m), o.appendChild(m);
        }
        const c = {
          ...a,
          mainElement: o,
          subElements: l,
          elementAnimations: [this.initFloatAnimation(a, o)],
          maskAnimations: [],
          width: 0,
          height: 0,
          padding: 0,
          shouldEmphasize: i
        };
        this.splittedWords.push(c);
      } else {
        if (a.romanWord && a.romanWord.trim().length > 0) {
          const l = document.createElement("div"), c = document.createElement("div");
          l.innerText = a.word, c.innerText = a.romanWord, c.classList.add(W.romanWord), o.appendChild(l), o.appendChild(c);
        } else
          o.innerText = a.word;
        this.splittedWords.push({
          ...a,
          mainElement: o,
          subElements: [],
          elementAnimations: [this.initFloatAnimation(a, o)],
          maskAnimations: [],
          width: 0,
          height: 0,
          padding: 0,
          shouldEmphasize: i
        });
      }
      n.appendChild(o);
    }
    i && this.splittedWords[this.splittedWords.length - 1].elementAnimations.push(
      ...this.initEmphasizeAnimation(
        s,
        r,
        s.endTime - s.startTime,
        s.startTime - this.lyricLine.startTime
      )
    ), s.word.trimStart() !== s.word && e.appendChild(document.createTextNode(" ")), e.appendChild(n), s.word.trimEnd() !== s.word && q.shouldEmphasize(s) && e.appendChild(document.createTextNode(" "));
  }
  /** 渲染单个词（含强调与音译处理） */
  buildSingleWord(t, e) {
    const s = q.shouldEmphasize(t), i = document.createElement("span"), n = {
      ...t,
      mainElement: i,
      subElements: [],
      elementAnimations: [this.initFloatAnimation(t, i)],
      maskAnimations: [],
      width: 0,
      height: 0,
      padding: 0,
      shouldEmphasize: s
    };
    if (s) {
      i.classList.add(W.emphasize);
      const r = [];
      for (const o of t.word.trim()) {
        const l = document.createElement("span");
        l.innerText = o, r.push(l), i.appendChild(l);
      }
      if (t.romanWord && t.romanWord.trim().length > 0) {
        const o = document.createElement("div");
        o.innerText = t.romanWord, o.classList.add(W.romanWord), i.appendChild(o);
      }
      n.subElements = r;
      const a = Math.abs(n.endTime - n.startTime);
      n.elementAnimations.push(
        ...this.initEmphasizeAnimation(
          t,
          r,
          a,
          n.startTime - this.lyricLine.startTime
        )
      );
    } else if (t.romanWord && t.romanWord.trim().length > 0) {
      const r = document.createElement("div"), a = document.createElement("div");
      r.innerText = t.word, a.innerText = t.romanWord, a.classList.add(W.romanWord), i.appendChild(r), i.appendChild(a);
    } else
      i.innerText = t.word.trim();
    t.word.trimStart() !== t.word && e.appendChild(document.createTextNode(" ")), e.appendChild(i), t.word.trimEnd() !== t.word && e.appendChild(document.createTextNode(" ")), this.splittedWords.push(n);
  }
  initFloatAnimation(t, e) {
    const s = t.startTime - this.lyricLine.startTime, i = Math.max(1e3, t.endTime - t.startTime);
    let n = 0.05;
    this.lyricLine.isBG && (n *= 2);
    const r = e.animate(
      [
        {
          transform: "translateY(0px)"
        },
        {
          transform: `translateY(${-n}em)`
        }
      ],
      {
        duration: Number.isFinite(i) ? i : 0,
        delay: Number.isFinite(s) ? s : 0,
        id: "float-word",
        composite: "add",
        fill: "both",
        easing: "ease-out"
      }
    );
    return r.pause(), r;
  }
  // 按照原 Apple Music 参考，强调效果只应用缩放、轻微左右位移和辉光效果，原主要的悬浮位移效果不变
  // 为了避免产生锯齿抖动感，使用 matrix3d 来实现缩放和位移
  initEmphasizeAnimation(t, e, s, i) {
    const n = Math.max(0, i);
    let r = Math.max(1e3, s), a = [], o = r / 2e3;
    o = o > 1 ? Math.sqrt(o) : o ** 3;
    let l = r / 3e3;
    l = l > 1 ? Math.sqrt(l) : l ** 3, o *= 0.6, l *= 0.5, this.lyricLine.words.length > 0 && t.word.includes(
      this.lyricLine.words[this.lyricLine.words.length - 1].word
    ) && (o *= 1.6, l *= 1.5, r *= 1.2), o = Math.min(1.2, o), l = Math.min(0.8, l);
    const c = Number.isFinite(r) ? r : 0, h = ws(Wt);
    return a = e.flatMap((m, u, f) => {
      const g = n + r / 2.5 / f.length * u, p = [], y = new Array(Mt).fill(0).map((b, w) => {
        const T = (w + 1) / Mt, v = h(T), P = h(T) * l, z = he(le(), 1 + v * 0.1 * o), E = -v * 0.03 * o * (f.length / 2 - u), F = -v * 0.025 * o;
        return {
          offset: T,
          transform: `${de(
            z,
            4
          )} translate(${E}em, ${F}em)`,
          textShadow: `0 0 ${Math.min(
            0.3,
            l * 0.3
          )}em rgba(255, 255, 255, ${P})`
        };
      }), L = m.animate(y, {
        duration: c,
        delay: Number.isFinite(g) ? g : 0,
        id: `emphasize-word-${m.innerText}-${u}`,
        iterations: 1,
        composite: "replace",
        fill: "both"
      });
      L.onfinish = () => {
        L.pause();
      }, L.pause(), p.push(L);
      const x = new Array(Mt).fill(0).map((b, w) => {
        const T = (w + 1) / Mt;
        let v = Math.sin(T * Math.PI);
        return this.lyricLine.isBG && (v *= 2), {
          offset: T,
          transform: `translateY(${-v * 0.05}em)`
        };
      }), M = m.animate(x, {
        duration: c * 1.4,
        delay: Number.isFinite(g) ? g - 400 : 0,
        id: "emphasize-word-float",
        iterations: 1,
        composite: "add",
        fill: "both"
      });
      return M.onfinish = () => {
        M.pause();
      }, M.pause(), p.push(M), p;
    }), a;
  }
  get totalDuration() {
    return this.lyricLine.endTime - this.lyricLine.startTime;
  }
  onLineSizeChange(t) {
    this.updateMaskImageSync();
  }
  updateMaskImageSync() {
    for (const t of this.splittedWords) {
      const e = t.mainElement;
      e ? (t.padding = Number.parseFloat(getComputedStyle(e).paddingLeft), t.width = e.clientWidth - t.padding * 2, t.height = e.clientHeight - t.padding * 2) : (t.width = 0, t.height = 0, t.padding = 0);
    }
    this.lyricPlayer.supportMaskImage ? this.generateWebAnimationBasedMaskImage() : this.generateCalcBasedMaskImage(), this.isEnabled && this.enable(this.lyricPlayer.getCurrentTime());
  }
  generateCalcBasedMaskImage() {
    for (const t of this.splittedWords) {
      const e = t.mainElement;
      if (e) {
        t.width = e.clientWidth, t.height = e.clientHeight;
        const s = t.height * this.lyricPlayer.getWordFadeWidth(), [i, n] = Qt(
          s / t.width
        ), r = `${n * 100}% 100%`;
        this.lyricPlayer.supportMaskImage ? (e.style.maskImage = i, e.style.maskRepeat = "no-repeat", e.style.maskOrigin = "left", e.style.maskSize = r) : (e.style.webkitMaskImage = i, e.style.webkitMaskRepeat = "no-repeat", e.style.webkitMaskOrigin = "left", e.style.webkitMaskSize = r);
        const a = t.width + s, o = `clamp(${-a}px,calc(${-a}px + (var(--amll-player-time) - ${t.startTime})*${a / Math.abs(t.endTime - t.startTime)}px),0px) 0px, left top`;
        e.style.maskPosition = o, e.style.webkitMaskPosition = o;
      }
    }
  }
  generateWebAnimationBasedMaskImage() {
    const t = Math.max(
      this.splittedWords.reduce((e, s) => Math.max(s.endTime, e), 0),
      this.lyricLine.endTime
    ) - this.lyricLine.startTime;
    this.splittedWords.forEach((e, s) => {
      const i = e.mainElement;
      if (i) {
        const n = e.height * this.lyricPlayer.getWordFadeWidth(), [r, a] = Qt(
          n / (e.width + e.padding * 2)
        ), o = `${a * 100}% 100%`;
        this.lyricPlayer.supportMaskImage ? (i.style.maskImage = r, i.style.maskRepeat = "no-repeat", i.style.maskOrigin = "left", i.style.maskSize = o) : (i.style.webkitMaskImage = r, i.style.webkitMaskRepeat = "no-repeat", i.style.webkitMaskOrigin = "left", i.style.webkitMaskSize = o);
        const l = this.splittedWords.slice(0, s).reduce((x, M) => x + M.width, 0) + (this.splittedWords[0] ? n : 0), c = -(e.width + e.padding * 2 + n), h = (x) => Math.max(c, Math.min(0, x));
        let m = -l - e.width - e.padding - n, u = 0;
        const f = [];
        let g = m, p = 0;
        const y = () => {
          const x = m - g, M = Math.max(0, Math.min(1, u)), b = M - p, w = Math.abs(b / x);
          if (m > c && g < c) {
            const P = Math.abs(g - c) * w, z = `${h(g)}px 0`, E = {
              offset: p + P,
              maskPosition: z
            };
            f.push(E);
          }
          if (m > 0 && g < 0) {
            const P = Math.abs(g) * w, z = `${h(m)}px 0`, E = {
              offset: p + P,
              maskPosition: z
            };
            f.push(E);
          }
          const T = `${h(m)}px 0`, v = {
            offset: M,
            maskPosition: T
          };
          f.push(v), g = m, p = M;
        };
        y();
        let L = 0;
        this.splittedWords.forEach((x, M) => {
          {
            const b = x.startTime - this.lyricLine.startTime, w = b - L;
            u += w / t, w > 0 && y(), L = b;
          }
          {
            const b = x.endTime - x.startTime;
            u += b / t, m += x.width, M === 0 && (m += n * 1.5), M === this.splittedWords.length - 1 && (m += n * 0.5), b > 0 && y(), L += b;
          }
        });
        for (const x of e.maskAnimations)
          x.cancel();
        try {
          const x = i.animate(f, {
            duration: t || 1,
            id: `fade-word-${e.word}-${s}`,
            fill: "both"
          });
          x.pause(), e.maskAnimations = [x];
        } catch (x) {
          console.warn("应用渐变动画发生错误", f, t, x);
        }
      }
    });
  }
  getElement() {
    return this.element;
  }
  setTransform(t = this.top, e = this.scale, s = 1, i = 0, n = !1, r = 0) {
    super.setTransform(t, e, s, i, n, r);
    const a = this.isInSight, o = this.lyricPlayer.getEnableSpring();
    this.top = t, this.scale = e, this.delay = r * 1e3 | 0;
    const l = this.element.children[0];
    if (l.style.opacity = `${s}`, n || !o)
      if (this.blur = Math.min(32, i), this.lineTransforms.posY.setPosition(t), this.lineTransforms.scale.setPosition(e), o)
        this.rebuildStyle();
      else {
        const c = this.isInSight;
        a || c ? this.show() : this.hide();
      }
    else if (this.lineTransforms.posY.setTargetPosition(t, r), this.lineTransforms.scale.setTargetPosition(e), this.blur !== Math.min(32, i)) {
      this.blur = Math.min(32, i);
      const c = i.toFixed(3);
      this.element.style.filter = `blur(${c}px)`;
    }
  }
  update(t = 0) {
    if (this.lyricPlayer.getEnableSpring())
      if (this.lineTransforms.posY.update(t), this.lineTransforms.scale.update(t), this.isInSight ? this.show() : this.hide(), this.lyricPlayer.getEnableSpring())
        this.element.style.setProperty(
          "--bright-mask-alpha",
          `${Math.max(
            0,
            Math.min(
              1,
              this.lineTransforms.scale.getCurrentPosition() / 100 - 0.97
            ) / 0.03
          ) * 0.8 + 0.2}`
        ), this.element.style.setProperty(
          "--dark-mask-alpha",
          `${Math.max(
            0,
            Math.min(
              1,
              this.lineTransforms.scale.getCurrentPosition() / 100 - 0.97
            ) / 0.03
          ) * 0.2 + 0.2}`
        );
      else {
        const s = window.getComputedStyle(this.element).transform, i = Es(s);
        this.element.style.setProperty(
          "--bright-mask-alpha",
          `${Math.max(0, Math.min(1, (i - 0.97) / 0.03)) * 0.8 + 0.2}`
        ), this.element.style.setProperty(
          "--dark-mask-alpha",
          `${Math.max(0, Math.min(1, (i - 0.97) / 0.03)) * 0.2 + 0.2}`
        );
      }
  }
  _getDebugTargetPos() {
    return `[位移: ${this.top}; 缩放: ${this.scale}; 延时: ${this.delay}]`;
  }
  get isInSight() {
    const t = this.lineTransforms.posY.getCurrentPosition(), e = this.lyricPlayer.lyricLinesSize.get(this)?.[1] ?? 0, s = t + e, i = this.lyricPlayer.size[1], n = this.lyricPlayer.getOverscanPx();
    return !(t > i + e + n || s < -e - n);
  }
  disposeElements() {
    for (const i of this.splittedWords) {
      for (const n of i.elementAnimations)
        n.cancel();
      for (const n of i.maskAnimations)
        n.cancel();
      for (const n of i.subElements)
        n.remove(), n.parentNode?.removeChild(n);
      i.elementAnimations = [], i.maskAnimations = [], i.subElements = [], i.mainElement?.parentNode && i.mainElement.parentNode.removeChild(i.mainElement);
    }
    this.splittedWords = [];
    const t = this.element.children[0], e = this.element.children[1], s = this.element.children[2];
    t && (t.innerHTML = ""), e && (e.innerHTML = ""), s && (s.innerHTML = "");
  }
  dispose() {
    this.disposeElements(), this.lyricPlayer.resizeObserver.unobserve(this.element), this.element.remove();
  }
};
class pe extends MouseEvent {
  constructor(t, e, s) {
    super(`line-${s.type}`, s), this.lineIndex = t, this.line = e;
  }
}
class ai extends Rt {
  currentLyricLineObjects = [];
  onResize() {
    const t = getComputedStyle(this.element);
    this._baseFontSize = Number.parseFloat(t.fontSize), this.rebuildStyle();
  }
  supportPlusLighter = CSS.supports("mix-blend-mode", "plus-lighter");
  supportMaskImage = CSS.supports("mask-image", "none");
  innerSize = [0, 0];
  onLineClickedHandler = (t) => {
    const e = new pe(
      this.lyricLinesIndexes.get(t.line) ?? -1,
      t.line,
      t
    );
    this.dispatchEvent(e) || (t.preventDefault(), t.stopPropagation(), t.stopImmediatePropagation());
  };
  /**
   * 是否为非逐词歌词
   * @internal
   */
  _getIsNonDynamic() {
    return this.isNonDynamic;
  }
  _baseFontSize = Number.parseFloat(
    getComputedStyle(this.element).fontSize
  );
  get baseFontSize() {
    return this._baseFontSize;
  }
  constructor() {
    super(), this.onResize(), this.element.classList.add("amll-lyric-player", "dom"), this.disableSpring && this.element.classList.add(W.disableSpring);
  }
  rebuildStyle() {
  }
  setWordFadeWidth(t = 0.5) {
    super.setWordFadeWidth(t);
    for (const e of this.currentLyricLineObjects)
      e.updateMaskImageSync();
  }
  /**
   * 设置当前播放歌词，要注意传入后这个数组内的信息不得修改，否则会发生错误
   * @param lines 歌词数组
   * @param initialTime 初始时间，默认为 0
   */
  setLyricLines(t, e = 0) {
    super.setLyricLines(t, e), this.hasDuetLine ? this.element.classList.add(W.hasDuetLine) : this.element.classList.remove(W.hasDuetLine), this.supportMaskImage || this.element.style.setProperty("--amll-player-time", `${e}`);
    for (const s of this.currentLyricLineObjects)
      s.removeMouseEventListener("click", this.onLineClickedHandler), s.removeMouseEventListener("contextmenu", this.onLineClickedHandler), s.dispose();
    this.currentLyricLineObjects = this.processedLines.map((s, i) => {
      const n = new vs(this, s);
      return n.addMouseEventListener("click", this.onLineClickedHandler), n.addMouseEventListener("contextmenu", this.onLineClickedHandler), this.lyricLinesIndexes.set(n, i), this.lyricLineElementMap.set(n.getElement(), n), n;
    }), this.setLinePosXSpringParams({}), this.setLinePosYSpringParams({}), this.setLineScaleSpringParams({}), this.calcLayout(!0), this.update(0);
  }
  pause() {
    super.pause(), this.element.classList.remove("playing"), this.interludeDots.pause();
    for (const t of this.currentLyricLineObjects)
      t.pause();
  }
  resume() {
    super.resume(), this.element.classList.add("playing"), this.interludeDots.resume();
    for (const t of this.currentLyricLineObjects)
      t.resume();
  }
  update(t = 0) {
    if (!this.initialLayoutFinished || (super.update(t), this.supportMaskImage || this.element.style.setProperty(
      "--amll-player-time",
      `${this.currentTime}`
    ), !this.isPageVisible)) return;
    const e = t / 1e3;
    this.interludeDots.update(t), this.bottomLine.update(e);
    for (const s of this.currentLyricLineObjects)
      s.update(e);
  }
  dispose() {
    super.dispose(), this.element.remove();
    for (const t of this.currentLyricLineObjects)
      t.dispose();
    this.bottomLine.dispose(), this.interludeDots.dispose();
  }
}
const Ps = /^\s+/, zs = /^[\p{L}0-9!"#$%&’()*+,-./:;<=>?@\[\]^_`\{|\}~]+/iu;
function* Is(d, t, e, s = 0) {
  let i = s, n = 0, r = 0, a = 0, o = !1, l = null;
  const c = d.measureText(" ");
  for (; a < t.length; ) {
    const h = t.substring(a);
    if (l = h.match(Ps), l) {
      o = !0, r = a, a += l[0].length;
      continue;
    }
    if (l = h.match(zs), l) {
      a += l[0].length;
      const m = l[0], u = d.measureText(m);
      i + u.width > e.maxWidth && (i = 0, n++, o = !1), o && (o = !1, yield {
        text: " ",
        index: r,
        lineIndex: n,
        width: 0,
        height: e.fontSize,
        x: i
      }, i += c.width);
      let f = "", g = null;
      for (const p of m) {
        const y = d.measureText(`${f}${p}`), L = d.measureText(p);
        f !== "" && (i = i + y.width - L.width), i + L.width > e.maxWidth && (i = 0, n++), yield {
          text: p,
          index: a,
          lineIndex: n,
          width: L.width,
          height: e.fontSize,
          x: i
        }, f = p, g = L;
      }
      g && (i += g.width);
      continue;
    }
    {
      o && (o = !1, yield {
        text: " ",
        index: r,
        lineIndex: n,
        width: 0,
        height: e.fontSize,
        x: i
      }, i += c.width);
      const m = d.measureText(t[a]);
      i + m.width > e.maxWidth && (i = 0, n++), yield {
        text: t[a],
        index: a,
        lineIndex: n,
        width: m.width,
        height: e.fontSize,
        x: i
      }, i += m.width;
    }
    a++;
  }
  return { x: i, lineIndex: n };
}
function* zt(d, t, e, s = 0) {
  let i = {
    text: "",
    index: 0,
    lineIndex: 0,
    width: 0,
    height: 0,
    x: 0
  };
  for (const n of Is(d, t, e, s))
    n.lineIndex !== i.lineIndex ? (i.text.length && (yield i), i = {
      ...n
    }) : (i.text += n.text, i.width = n.x + n.width);
  i.text.length && (yield i);
}
class ks extends q {
  constructor(t, e = {
    words: [],
    translatedLyric: "",
    romanLyric: "",
    startTime: 0,
    endTime: 0,
    isBG: !1,
    isDuet: !1
  }) {
    super(), this.player = t, this.line = e, this.relayout();
  }
  getLine() {
    return this.line;
  }
  lineSize = [0, 0];
  measureSize() {
    const t = Math.max(
      0,
      ...this.layoutWords.flat().map((n) => n.lineIndex + 1)
    ), e = Math.max(
      0,
      ...this.translatedLayoutWords.map((n) => n.lineIndex + 1)
    ), s = Math.max(
      0,
      ...this.romanLayoutWords.map((n) => n.lineIndex + 1)
    ), i = this.player.baseFontSize;
    return this.lineSize = [
      this.player.size[0],
      (t + e + s) * i + this.player.size[1] * 0.04
    ], [...this.lineSize];
  }
  layoutWords = [];
  translatedLayoutWords = [];
  romanLayoutWords = [];
  lineCanvas = document.createElement("canvas");
  /** @internal */
  relayout() {
    const t = {
      fontSize: this.player.baseFontSize,
      maxWidth: this.player.size[0] - 50,
      lineHeight: this.player.baseFontSize
    }, e = this.player.ctx;
    this.player.setFontSize(1);
    for (const n of Ot(this.line.words))
      Array.isArray(n) && n.length;
    this.layoutWords = [
      [...zt(e, this.line.words.map((n) => n.word).join(""), t)]
    ], this.player.setFontSize(0.5), this.translatedLayoutWords = [
      ...zt(e, this.line.translatedLyric, t)
    ], this.romanLayoutWords = [...zt(e, this.line.romanLyric, t)], this.measureSize(), this.lineCanvas.width = this.player.ctx.canvas.width, this.lineCanvas.height = this.lineSize[1] * devicePixelRatio;
    const s = this.lineCanvas.getContext("2d");
    s.globalAlpha = 1, this.player.setFontSize(1), s.font = e.font, s.scale(devicePixelRatio, devicePixelRatio), s.fillStyle = "white", s.textBaseline = "top", s.textAlign = "left", s.font = `${this.player.baseFontSize}px ${this.player.baseFontFamily}`;
    let i = 0;
    for (const n of this.layoutWords)
      for (const r of n)
        s.fillText(
          r.text,
          r.x,
          r.lineIndex * this.player.baseFontSize * this.player.baseLineHeight
        ), i = r.lineIndex;
    s.translate(0, (i + 1) * this.player.baseFontSize), this.player.setFontSize(0.5), s.font = e.font, s.globalAlpha = 0.5, i = 0;
    for (const n of this.translatedLayoutWords)
      s.fillText(
        n.text,
        n.x,
        n.lineIndex * this.player.baseFontSize * this.player.baseLineHeight
      ), i = n.lineIndex;
    s.translate(0, (i + 1) * this.player.baseFontSize);
    for (const n of this.romanLayoutWords)
      s.fillText(
        n.text,
        n.x,
        n.lineIndex * this.player.baseFontSize * this.player.baseLineHeight
      );
  }
  enabled = !1;
  enable() {
    this.enabled = !0;
  }
  disable() {
    this.enabled = !1;
  }
  resume() {
  }
  pause() {
  }
  setTransform(t = this.top, e = this.scale, s = this.opacity, i = this.blur, n = !1, r = this.delay) {
    const a = Math.min(32, i);
    this.blur = a, this.opacity = s, n ? (this.lineTransforms.posY.setPosition(t), this.lineTransforms.scale.setPosition(e)) : (this.lineTransforms.posY.setTargetPosition(t, r), this.lineTransforms.scale.setTargetPosition(e));
  }
  get isInSight() {
    const t = this.lineTransforms.posY.getCurrentPosition(), e = this.lineSize[0], s = t + this.lineSize[1], i = this.player.size[1];
    return !(t > i || e < 0 || s < 0);
  }
  update(t) {
    if (this.lineTransforms.posY.update(t), this.lineTransforms.scale.update(t), !this.isInSight) return;
    const e = this.player.ctx;
    e.save(), e.fillStyle = "white", e.filter = `blur(${this.blur}px)`, e.textRendering = "geometricPrecision", e.globalAlpha = this.opacity, e.translate(0, this.lineTransforms.posY.getCurrentPosition()), e.scale(1 / devicePixelRatio, 1 / devicePixelRatio), this.lineCanvas.width * this.lineCanvas.height > 0 && e.drawImage(this.lineCanvas, 0, 0), e.restore();
  }
}
class oi extends Rt {
  canvasElement = document.createElement("canvas");
  currentLyricLineObjects = [];
  /** @internal */
  ctx = this.canvasElement.getContext("2d");
  /** @internal */
  baseLineHeight = 1;
  /** @internal */
  baseFontSize = 30;
  /** @internal */
  baseFontFamily = "sans-serif";
  constructor() {
    super(), this.element.classList.add("amll-lyric-player", "dom"), this.canvasElement.style.width = "100%", this.canvasElement.style.height = "100%", this.canvasElement.style.display = "block", this.canvasElement.style.position = "absolute", this.onResize(), this.update(), this.element.addEventListener("mousemove", (t) => {
      t.preventDefault();
    }), this.element.addEventListener("click", (t) => {
      t.preventDefault();
    }), this.element.addEventListener("contextmenu", (t) => {
      t.preventDefault();
    }), this.element.appendChild(this.canvasElement), this.element.appendChild(this.interludeDots.getElement()), this.element.appendChild(this.bottomLine.getElement());
  }
  setLyricLines(t, e) {
    super.setLyricLines(t, e), this.currentLyricLineObjects = this.processedLines.map(
      (s) => new ks(this, s)
    ), this.setLinePosYSpringParams({}), this.setLineScaleSpringParams({}), this.calcLayout(!0);
  }
  onResize() {
    const t = getComputedStyle(this.element);
    this.baseFontSize = Number.parseFloat(t.fontSize) || 30, this.baseFontFamily = t.fontFamily;
    const e = this.canvasElement.clientWidth, s = this.canvasElement.clientHeight;
    this.size[0] = e - this.baseFontSize * 2, this.size[1] = s, this.canvasElement.width = e * devicePixelRatio, this.canvasElement.height = s * devicePixelRatio;
    for (const i of this.currentLyricLineObjects)
      i.relayout();
    console.log("CanvasLyricPlayer.onResize", this.size), this.calcLayout(!0);
  }
  /**
   * @internal
   * @param size
   */
  setFontSize(t) {
    this.ctx.font = `${this.baseFontSize * t}px ${this.baseFontFamily}`;
  }
  update(t = 0) {
    super.update(t);
    const e = this.ctx, s = this.size[0], i = this.size[1];
    e.resetTransform(), e.scale(devicePixelRatio, devicePixelRatio), e.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height), e.fillStyle = "currentColor", e.font = `${this.baseFontSize}px ${this.baseFontFamily}`, e.textRendering = "optimizeSpeed", e.textAlign = "left", e.save(), e.translate(this.baseFontSize, 0);
    for (const n of this.currentLyricLineObjects)
      n.update(t / 1e3);
    e.restore(), e.font = `15px ${this.baseFontFamily}`, e.fillStyle = "#FFFFFF55", e.textAlign = "right", e.fillText("CanvasLyricPlayer 播放器", s - 16, i - 16);
  }
}
function Ds(d, t = 20) {
  let e = 0;
  return (...i) => {
    clearTimeout(e), e = setTimeout(() => d(...i), t);
  };
}
const Fs = "_lyricLine_1jop6_6", As = "_lyricBgLine_1jop6_36", _s = "_active_1jop6_49", Cs = "_hasDuetLine_1jop6_65", Rs = "_lyricDuetLine_1jop6_66", Os = "_lyricMainLine_1jop6_80", Ws = "_lyricSubLine_1jop6_90", Ns = "_tmpDisableTransition_1jop6_134", N = {
  lyricLine: Fs,
  lyricBgLine: As,
  active: _s,
  hasDuetLine: Cs,
  lyricDuetLine: Rs,
  lyricMainLine: Os,
  lyricSubLine: Ws,
  tmpDisableTransition: Ns
};
function Bs(d) {
  const t = [];
  function e() {
    const s = t[0];
    s && d(...s.args).then((i) => {
      s.resolve(i);
    }).catch((i) => {
      s.reject(i);
    }).finally(() => {
      t.shift(), t.length > 0 && e();
    });
  }
  return ((...s) => new Promise((i, n) => {
    t.push({ resolve: i, reject: n, args: s }), t.length === 1 && e();
  }));
}
const bt = 32, fe = (d, t) => (e) => Math.min(1, Math.max(0, (e - d) / (t - d))), Nt = 0.5, $s = fe(0, Nt), qs = fe(Nt, 1), Vs = St(0.2, 0.4, 0.58, 1), Hs = St(0.3, 0, 0.58, 1), Us = (d) => (t) => t < d ? Vs($s(t)) : 1 - Hs(qs(t));
function Kt(d, t = 0, e = "rgba(0,0,0,var(--bright-mask-alpha, 1.0))", s = "rgba(0,0,0,var(--dark-mask-alpha, 1.0))") {
  const i = 2 + d + t, n = d / i, r = (1 - n) / 2;
  return [
    `linear-gradient(to right,${e} ${r * 100}%,${s} ${(r + n) * 100}%)`,
    i
  ];
}
class Ys extends MouseEvent {
  constructor(t, e) {
    super(e.type, e), this.line = t;
  }
}
function js(d) {
  const t = d.match(/matrix\(([^)]+)\)/);
  if (t) {
    const e = t[1].split(", "), s = Number.parseFloat(e[0]), i = Number.parseFloat(e[3]);
    return (s + i) / 2;
  }
  return 1;
}
class Gs extends q {
  constructor(t, e = {
    words: [],
    translatedLyric: "",
    romanLyric: "",
    startTime: 0,
    endTime: 0,
    isBG: !1,
    isDuet: !1
  }) {
    super(), this.lyricPlayer = t, this.lyricLine = e, this._prevParentEl = t.getElement(), this.element.setAttribute("class", N.lyricLine), this.lyricLine.isBG && this.element.classList.add(N.lyricBgLine), this.lyricLine.isDuet && this.element.classList.add(N.lyricDuetLine), this.element.appendChild(document.createElement("div")), this.element.appendChild(document.createElement("div")), this.element.appendChild(document.createElement("div"));
    const s = this.element.children[0], i = this.element.children[1], n = this.element.children[2];
    s.setAttribute("class", N.lyricMainLine), i.setAttribute("class", N.lyricSubLine), n.setAttribute("class", N.lyricSubLine), this.rebuildElement(), this.rebuildStyle(), this.markMaskImageDirty("Initial construction");
  }
  element = document.createElement("div");
  splittedWords = [];
  // 由 LyricPlayer 来设置
  lineSize = [0, 0];
  listenersMap = /* @__PURE__ */ new Map();
  onMouseEvent = (t) => {
    const e = new Ys(this, t);
    for (const s of this.listenersMap.get(t.type) ?? [])
      s.call(this, e);
    if (!this.dispatchEvent(e) || e.defaultPrevented)
      return t.preventDefault(), t.stopPropagation(), t.stopImmediatePropagation(), !1;
  };
  addMouseEventListener(t, e, s) {
    if (e) {
      const i = this.listenersMap.get(t) ?? /* @__PURE__ */ new Set();
      i.size === 0 && this.element.addEventListener(t, this.onMouseEvent, s), i.add(e), this.listenersMap.set(t, i);
    }
  }
  removeMouseEventListener(t, e, s) {
    if (e) {
      const i = this.listenersMap.get(t);
      i && (i.delete(e), i.size === 0 && this.element.removeEventListener(t, this.onMouseEvent, s));
    }
  }
  areWordsOnSameLine(t, e) {
    if (t?.mainElement && e?.mainElement) {
      const s = t.mainElement, i = e.mainElement, n = s.getBoundingClientRect(), r = i.getBoundingClientRect();
      return Math.abs(n.top - r.top) < 10;
    }
    return !0;
  }
  isEnabled = !1;
  async enable(t = this.lyricLine.startTime) {
    this.isEnabled = !0, this.element.classList.add(N.active), await this.waitMaskImageUpdated();
    const e = this.element.children[0];
    for (const s of this.splittedWords) {
      for (const i of s.elementAnimations)
        i.currentTime = 0, i.playbackRate = 1, i.play();
      for (const i of s.maskAnimations)
        i.currentTime = Math.min(
          this.totalDuration,
          Math.max(0, t - this.lyricLine.startTime)
        ), i.playbackRate = 1, i.play();
    }
    e.classList.add(N.active);
  }
  disable() {
    this.isEnabled = !1, this.element.classList.remove(N.active);
    const t = this.element.children[0];
    for (const e of this.splittedWords)
      for (const s of e.elementAnimations)
        (s.id === "float-word" || s.id.includes("emphasize-word-float-only")) && (s.playbackRate = -1, s.play());
    t.classList.remove(N.active);
  }
  lastWord;
  async resume() {
    if (await this.waitMaskImageUpdated(), !!this.isEnabled)
      for (const t of this.splittedWords) {
        for (const e of t.elementAnimations)
          (!this.lastWord || this.splittedWords.indexOf(this.lastWord) < this.splittedWords.indexOf(t)) && e.play();
        for (const e of t.maskAnimations)
          (!this.lastWord || this.splittedWords.indexOf(this.lastWord) < this.splittedWords.indexOf(t)) && e.play();
      }
  }
  async pause() {
    if (await this.waitMaskImageUpdated(), !!this.isEnabled)
      for (const t of this.splittedWords) {
        for (const e of t.elementAnimations)
          e.pause();
        for (const e of t.maskAnimations)
          e.pause();
      }
  }
  setMaskAnimationState(t = 0) {
    const e = t - this.lyricLine.startTime;
    for (const s of this.splittedWords)
      for (const i of s.maskAnimations)
        i.currentTime = Math.min(this.totalDuration, Math.max(0, e)), i.playbackRate = 1, e >= 0 && e < this.totalDuration ? i.play() : i.pause();
  }
  measureLockMark = !1;
  measureLock = Bs(
    async (t) => {
      this.measureLockMark || (this.measureLockMark = !0, await t(), this.measureLockMark = !1);
    }
  );
  getLine() {
    return this.lyricLine;
  }
  _prevParentEl;
  lastStyle = "";
  show() {
    this.rebuildStyle();
  }
  hide() {
  }
  rebuildStyle() {
  }
  rebuildElement() {
    this.disposeElements();
    const t = this.element.children[0], e = this.element.children[1], s = this.element.children[2];
    if (this.lyricPlayer._getIsNonDynamic()) {
      t.innerText = this.lyricLine.words.map((n) => n.word).join(""), e.innerText = this.lyricLine.translatedLyric, s.innerText = this.lyricLine.romanLyric;
      return;
    }
    const i = Ot(this.lyricLine.words);
    t.innerHTML = "";
    for (const n of i)
      if (Array.isArray(n)) {
        if (n.length === 0) continue;
        const r = n.reduce(
          (c, h) => (c.endTime = Math.max(c.endTime, h.endTime), c.startTime = Math.min(c.startTime, h.startTime), c.word += h.word, c),
          {
            word: "",
            romanWord: "",
            startTime: Number.POSITIVE_INFINITY,
            endTime: Number.NEGATIVE_INFINITY,
            wordType: "normal",
            obscene: !1
          }
        ), a = n.map((c) => q.shouldEmphasize(c)).reduce((c, h) => c || h, q.shouldEmphasize(r)), o = document.createElement("span");
        o.classList.add(N.emphasizeWrapper);
        const l = [];
        for (const c of n) {
          const h = document.createElement("span");
          if (a) {
            h.classList.add(N.emphasize);
            const m = [];
            for (const f of c.word.trim()) {
              const g = document.createElement("span");
              g.innerText = f, m.push(g), l.push(g), h.appendChild(g);
            }
            const u = {
              ...c,
              mainElement: h,
              subElements: m,
              // elementAnimations: [this.initFloatAnimation(word, mainWordEl)],
              elementAnimations: [],
              // this.initFloatAnimation(word, mainWordEl)
              maskAnimations: [],
              width: 0,
              height: 0,
              padding: 0,
              shouldEmphasize: a
            };
            this.splittedWords.push(u);
          } else
            h.innerText = c.word, this.splittedWords.push({
              ...c,
              mainElement: h,
              subElements: [],
              // elementAnimations: [this.initFloatAnimation(word, mainWordEl)],
              elementAnimations: [],
              // this.initFloatAnimation(word, mainWordEl)
              maskAnimations: [],
              width: 0,
              height: 0,
              padding: 0,
              shouldEmphasize: a
            });
          o.appendChild(h);
        }
        a && this.splittedWords[this.splittedWords.length - 1].elementAnimations.push(
          ...this.initEmphasizeAnimation(
            r,
            l,
            r.endTime - r.startTime,
            r.startTime - this.lyricLine.startTime
          )
        ), r.word.trimStart() !== r.word && t.appendChild(document.createTextNode(" ")), t.appendChild(o), r.word.trimEnd() !== r.word && q.shouldEmphasize(r) && t.appendChild(document.createTextNode(" "));
      } else if (n.word.trim().length === 0)
        t.appendChild(document.createTextNode(" "));
      else {
        const r = q.shouldEmphasize(n), a = document.createElement("span"), o = {
          ...n,
          mainElement: a,
          subElements: [],
          // elementAnimations: [this.initFloatAnimation(chunk, mainWordEl)],
          elementAnimations: [],
          // this.initFloatAnimation(chunk, mainWordEl)
          maskAnimations: [],
          width: 0,
          height: 0,
          padding: 0,
          shouldEmphasize: r
        };
        if (q.shouldEmphasize(n)) {
          a.classList.add(N.emphasize);
          const l = [];
          for (const h of n.word.trim()) {
            const m = document.createElement("span");
            m.innerText = h, l.push(m), a.appendChild(m);
          }
          o.subElements = l;
          const c = Math.abs(o.endTime - o.startTime);
          o.elementAnimations.push(
            ...this.initEmphasizeAnimation(
              n,
              l,
              c,
              o.startTime - this.lyricLine.startTime
            )
          );
        } else
          a.innerText = n.word.trim();
        n.word.trimStart() !== n.word && t.appendChild(document.createTextNode(" ")), t.appendChild(a), n.word.trimEnd() !== n.word && t.appendChild(document.createTextNode(" ")), this.splittedWords.push(o);
      }
    e.innerText = this.lyricLine.translatedLyric, s.innerText = this.lyricLine.romanLyric;
  }
  initFloatAnimation(t, e) {
    const s = t.startTime - this.lyricLine.startTime, i = Math.max(1e3, t.endTime - t.startTime);
    let n = 0.05;
    this.lyricLine.isBG && (n *= 2);
    const r = e.animate(
      [
        {
          transform: "translateY(0px)"
        },
        {
          transform: `translateY(${-n}em)`
        }
      ],
      {
        duration: Number.isFinite(i) ? i : 0,
        delay: Number.isFinite(s) ? s : 0,
        id: "float-word",
        composite: "add",
        fill: "both",
        easing: "ease-out"
      }
    );
    return r.pause(), r;
  }
  // 按照原 Apple Music 参考，强调效果只应用缩放、轻微左右位移和辉光效果，原主要的悬浮位移效果不变
  // 为了避免产生锯齿抖动感，使用 matrix3d 来实现缩放和位移
  initEmphasizeAnimation(t, e, s, i) {
    const n = Math.max(0, i);
    let r = Math.max(1e3, s), a = [], o = r / 2e3;
    o = o > 1 ? Math.sqrt(o) : o ** 3;
    let l = r / 3e3;
    l = l > 1 ? Math.sqrt(l) : l ** 3, o *= 0.6, l *= 0.5, this.lyricLine.words.length > 0 && t.word.includes(
      this.lyricLine.words[this.lyricLine.words.length - 1].word
    ) && (o *= 1.6, l *= 1.5, r *= 1.2), o = Math.min(1.2, o), l = Math.min(0.8, l);
    const c = Number.isFinite(r) ? r : 0, h = Us(Nt);
    return a = e.flatMap((m, u, f) => {
      const g = n + r / 2.5 / f.length * u, p = [], y = new Array(bt).fill(0).map((b, w) => {
        const T = (w + 1) / bt, v = h(T), P = h(T) * l, z = he(le(), 1 + v * 0.1 * o), E = -v * 0.03 * o * (f.length / 2 - u), F = -v * 0.025 * o;
        return {
          offset: T,
          transform: `${de(
            z,
            4
          )} translate(${E}em, ${F}em)`,
          textShadow: `0 0 ${Math.min(
            0.3,
            l * 0.3
          )}em rgba(255, 255, 255, ${P})`
        };
      }), L = m.animate(y, {
        duration: c,
        delay: Number.isFinite(g) ? g : 0,
        id: `emphasize-word-${m.innerText}-${u}`,
        iterations: 1,
        composite: "replace",
        fill: "both"
      });
      L.onfinish = () => {
        L.pause();
      }, L.pause(), p.push(L);
      const x = new Array(bt).fill(0).map((b, w) => {
        const T = (w + 1) / bt;
        let v = Math.sin(T * Math.PI);
        return this.lyricLine.isBG && (v *= 2), {
          offset: T,
          transform: `translateY(${-v * 0.05}em)`
        };
      }), M = m.animate(x, {
        duration: c * 1.4,
        delay: Number.isFinite(g) ? g - 400 : 0,
        id: "emphasize-word-float",
        iterations: 1,
        composite: "add",
        fill: "both"
      });
      return M.onfinish = () => {
        M.pause();
      }, M.pause(), p.push(M), p;
    }), a;
  }
  get totalDuration() {
    return this.lyricLine.endTime - this.lyricLine.startTime;
  }
  maskImageDirty = !1;
  markImageDirtyPromiseResolve = /* @__PURE__ */ new Set();
  markImageDirtyPromise = new Promise((t) => {
    this.markImageDirtyPromiseResolve.add(t);
  });
  markMaskImageDirty(t = "") {
    this.maskImageDirty = !0, this.element.classList.contains(N.dirty) || this.element.classList.add(N.dirty);
    const e = Promise.all([
      this.markImageDirtyPromise,
      new Promise((s) => {
        this.markImageDirtyPromiseResolve.add(s);
      })
    ]).then(() => {
    });
    return this.markImageDirtyPromise = e, e;
  }
  waitMaskImageUpdated() {
    return this.markImageDirtyPromise;
  }
  async updateMaskImage() {
    if (this.element.checkVisibility({
      contentVisibilityAuto: !0
    })) {
      this.maskImageDirty = !1, await this.measureLock(async () => {
        await Promise.all(
          this.splittedWords.map(async (t) => {
            const e = t.mainElement;
            e ? await ce(() => {
              t.padding = Number.parseFloat(
                getComputedStyle(e).paddingLeft
              ), t.width = e.clientWidth - t.padding * 2, t.height = e.clientHeight - t.padding * 2;
            }) : (t.width = 0, t.height = 0, t.padding = 0), t.width * t.height === 0 && console.warn("Word size is zero");
          })
        ), await Zt(() => {
          this.lyricPlayer.supportMaskImage ? this.generateWebAnimationBasedMaskImage() : this.generateCalcBasedMaskImage();
        });
      });
      for (const t of this.markImageDirtyPromiseResolve)
        t(), this.markImageDirtyPromiseResolve.delete(t);
      await Zt(() => {
        this.element.classList.remove(N.dirty);
      });
    }
  }
  generateCalcBasedMaskImage() {
    for (const t of this.splittedWords) {
      const e = t.mainElement;
      if (e) {
        t.width = e.clientWidth, t.height = e.clientHeight;
        const s = t.height * this.lyricPlayer.getWordFadeWidth(), [i, n] = Kt(
          s / t.width
        ), r = `${n * 100}% 100%`;
        this.lyricPlayer.supportMaskImage ? (e.style.maskImage = i, e.style.maskRepeat = "no-repeat", e.style.maskOrigin = "left", e.style.maskSize = r) : (e.style.webkitMaskImage = i, e.style.webkitMaskRepeat = "no-repeat", e.style.webkitMaskOrigin = "left", e.style.webkitMaskSize = r);
        const a = t.width + s, o = `clamp(${-a}px,calc(${-a}px + (var(--amll-player-time) - ${t.startTime})*${a / Math.abs(t.endTime - t.startTime)}px),0px) 0px, left top`;
        e.style.maskPosition = o, e.style.webkitMaskPosition = o;
      }
    }
  }
  generateWebAnimationBasedMaskImage() {
    const t = Math.max(
      this.splittedWords.reduce((e, s) => Math.max(s.endTime, e), 0),
      this.lyricLine.endTime
    ) - this.lyricLine.startTime;
    this.splittedWords.forEach((e, s) => {
      const i = e.mainElement;
      if (i) {
        const n = e.height * this.lyricPlayer.getWordFadeWidth(), [r, a] = Kt(
          n / (e.width + e.padding * 2)
        ), o = `${a * 100}% 100%`;
        this.lyricPlayer.supportMaskImage ? (i.style.maskImage = r, i.style.maskRepeat = "no-repeat", i.style.maskOrigin = "left", i.style.maskSize = o) : (i.style.webkitMaskImage = r, i.style.webkitMaskRepeat = "no-repeat", i.style.webkitMaskOrigin = "left", i.style.webkitMaskSize = o);
        const l = this.splittedWords.slice(0, s).reduce((x, M) => x + M.width, 0) + (this.splittedWords[0] ? n : 0), c = -(e.width + e.padding * 2 + n), h = (x) => Math.max(c, Math.min(0, x));
        let m = -l - e.width - e.padding - n, u = 0;
        const f = [];
        let g = m, p = 0;
        const y = () => {
          const x = m - g, M = Math.max(0, Math.min(1, u)), b = M - p, w = Math.abs(b / x);
          if (m > c && g < c) {
            const P = Math.abs(g - c) * w, z = `${h(g)}px 0`, E = {
              offset: p + P,
              maskPosition: z
            };
            f.push(E);
          }
          if (m > 0 && g < 0) {
            const P = Math.abs(g) * w, z = `${h(m)}px 0`, E = {
              offset: p + P,
              maskPosition: z
            };
            f.push(E);
          }
          const T = `${h(m)}px 0`, v = {
            offset: M,
            maskPosition: T
          };
          f.push(v), g = m, p = M;
        };
        y();
        let L = 0;
        this.splittedWords.forEach((x, M) => {
          {
            const b = x.startTime - this.lyricLine.startTime, w = b - L;
            u += w / t, w > 0 && y(), L = b;
          }
          {
            const b = x.endTime - x.startTime;
            u += b / t, m += x.width, M === 0 && (m += n * 1.5), M === this.splittedWords.length - 1 && (m += n * 0.5), b > 0 && y(), L += b;
          }
        });
        for (const x of e.maskAnimations)
          x.cancel();
        try {
          const x = i.animate(f, {
            duration: t || 1,
            id: `fade-word-${e.word}-${s}`,
            fill: "both"
          });
          x.pause(), e.maskAnimations = [x];
        } catch (x) {
          console.warn("应用渐变动画发生错误", f, t, x);
        }
      }
    });
  }
  getElement() {
    return this.element;
  }
  setTransform(t = this.top, e = this.scale, s = 1, i = 0, n = !1, r = 0) {
    super.setTransform(t, e, s, i, n, r);
    const a = this.isInSight, o = this.lyricPlayer.getEnableSpring();
    this.top = t, this.scale = e, this.delay = r * 1e3 | 0;
    const l = this.element.children[0];
    if (l.style.opacity = `${s}`, n || !o) {
      if (n && this.element.classList.add(N.tmpDisableTransition), this.lineTransforms.posY.setPosition(t), this.lineTransforms.scale.setPosition(e), o)
        this.rebuildStyle();
      else {
        const c = this.isInSight;
        a || c ? this.show() : this.hide();
      }
      n && requestAnimationFrame(() => {
        this.element.classList.remove(N.tmpDisableTransition);
      });
    } else
      this.lineTransforms.posY.setTargetPosition(t, r), this.lineTransforms.scale.setTargetPosition(e);
  }
  update(t = 0) {
    if (this.lyricPlayer.getEnableSpring())
      if (this.lineTransforms.posY.update(t), this.lineTransforms.scale.update(t), this.isInSight ? (this.show(), this.maskImageDirty && this.updateMaskImage()) : this.hide(), this.lyricPlayer.getEnableSpring())
        this.element.style.setProperty(
          "--bright-mask-alpha",
          `${Math.max(
            0,
            Math.min(
              1,
              this.lineTransforms.scale.getCurrentPosition() / 100 - 0.97
            ) / 0.03
          ) * 0.8 + 0.2}`
        ), this.element.style.setProperty(
          "--dark-mask-alpha",
          `${Math.max(
            0,
            Math.min(
              1,
              this.lineTransforms.scale.getCurrentPosition() / 100 - 0.97
            ) / 0.03
          ) * 0.2 + 0.2}`
        );
      else {
        const s = window.getComputedStyle(this.element).transform, i = js(s);
        this.element.style.setProperty(
          "--bright-mask-alpha",
          `${Math.max(0, Math.min(1, (i - 0.97) / 0.03)) * 0.8 + 0.2}`
        ), this.element.style.setProperty(
          "--dark-mask-alpha",
          `${Math.max(0, Math.min(1, (i - 0.97) / 0.03)) * 0.2 + 0.2}`
        );
      }
  }
  _getDebugTargetPos() {
    return `[位移: ${this.top}; 缩放: ${this.scale}; 延时: ${this.delay}]`;
  }
  get isInSight() {
    const t = this.lineTransforms.posY.getCurrentPosition(), e = this.lineSize[1], s = t + e, i = this.lyricPlayer.size[1];
    return !(t > i + e || s < -e);
  }
  disposeElements() {
    for (const t of this.splittedWords) {
      for (const e of t.elementAnimations)
        e.cancel();
      for (const e of t.maskAnimations)
        e.cancel();
      for (const e of t.subElements)
        e.remove(), e.parentNode?.removeChild(e);
      t.elementAnimations = [], t.maskAnimations = [], t.subElements = [], t.mainElement.remove(), t.mainElement.parentNode?.removeChild(t.mainElement);
    }
    this.splittedWords = [];
  }
  dispose() {
    this.disposeElements(), this.element.remove();
  }
}
class ci extends Rt {
  currentLyricLineObjects = [];
  debounceCalcLayout = Ds(
    () => this.calcLayout(!0).then(
      () => this.currentLyricLineObjects.map(async (t, e) => {
        t.markMaskImageDirty("DomLyricPlayer onResize"), await t.waitMaskImageUpdated(), this.hotLines.has(e) && (t.enable(this.currentTime), t.resume());
      })
    ),
    1e3
  );
  onResize() {
    const t = getComputedStyle(this.element);
    this._baseFontSize = Number.parseFloat(t.fontSize);
    const e = this.element.clientWidth - Number.parseFloat(t.paddingLeft) - Number.parseFloat(t.paddingRight), s = this.element.clientHeight - Number.parseFloat(t.paddingTop) - Number.parseFloat(t.paddingBottom);
    this.innerSize[0] = e, this.innerSize[1] = s, this.rebuildStyle(), this.debounceCalcLayout();
  }
  supportPlusLighter = CSS.supports("mix-blend-mode", "plus-lighter");
  supportMaskImage = CSS.supports("mask-image", "none");
  innerSize = [0, 0];
  onLineClickedHandler = (t) => {
    const e = new pe(
      this.lyricLinesIndexes.get(t.line) ?? -1,
      t.line,
      t
    );
    this.dispatchEvent(e) || (t.preventDefault(), t.stopPropagation(), t.stopImmediatePropagation());
  };
  /**
   * 是否为非逐词歌词
   * @internal
   */
  _getIsNonDynamic() {
    return this.isNonDynamic;
  }
  _baseFontSize = Number.parseFloat(
    getComputedStyle(this.element).fontSize
  );
  get baseFontSize() {
    return this._baseFontSize;
  }
  constructor() {
    super(), this.onResize(), this.element.classList.add("amll-lyric-player", "dom-slim"), this.disableSpring && this.element.classList.add(N.disableSpring);
  }
  rebuildStyle() {
    const t = this.innerSize[0], e = this.innerSize[1];
    this.element.style.setProperty("--amll-lp-width", `${t.toFixed(4)}px`), this.element.style.setProperty(
      "--amll-lp-height",
      `${e.toFixed(4)}px`
    );
  }
  setWordFadeWidth(t = 0.5) {
    super.setWordFadeWidth(t);
    for (const e of this.currentLyricLineObjects)
      e.markMaskImageDirty("DomLyricPlayer setWordFadeWidth");
  }
  /**
   * 设置当前播放歌词，要注意传入后这个数组内的信息不得修改，否则会发生错误
   * @param lines 歌词数组
   * @param initialTime 初始时间，默认为 0
   */
  setLyricLines(t, e = 0) {
    super.setLyricLines(t, e), this.hasDuetLine ? this.element.classList.add(N.hasDuetLine) : this.element.classList.remove(N.hasDuetLine);
    for (const s of this.currentLyricLineObjects)
      s.removeMouseEventListener("click", this.onLineClickedHandler), s.removeMouseEventListener("contextmenu", this.onLineClickedHandler), s.dispose();
    this.currentLyricLineObjects = this.processedLines.map((s, i) => {
      const n = new Gs(this, s);
      return n.addMouseEventListener("click", this.onLineClickedHandler), n.addMouseEventListener("contextmenu", this.onLineClickedHandler), this.element.appendChild(n.getElement()), this.lyricLinesIndexes.set(n, i), n.markMaskImageDirty("DomLyricPlayer setLyricLines"), n;
    }), this.setLinePosXSpringParams({}), this.setLinePosYSpringParams({}), this.setLineScaleSpringParams({}), this.calcLayout(!0).then(() => {
      this.initialLayoutFinished = !0;
    });
  }
  pause() {
    super.pause(), this.interludeDots.pause();
    for (const t of this.currentLyricLineObjects)
      t.pause();
  }
  resume() {
    super.resume(), this.interludeDots.resume();
    for (const t of this.currentLyricLineObjects)
      t.resume();
  }
  update(t = 0) {
    if (!this.initialLayoutFinished || (super.update(t), !this.isPageVisible)) return;
    const e = t / 1e3;
    this.interludeDots.update(t), this.bottomLine.update(e);
    for (const s of this.currentLyricLineObjects)
      s.update(e);
  }
  async calcLayout(t) {
    await super.calcLayout(t);
    const e = this.currentLyricLineObjects[this.targetAlignIndex], s = e.getElement(), i = s.checkVisibility({
      contentVisibilityAuto: !0
    }), n = this.element.getBoundingClientRect().top;
    i || s.scrollIntoView({
      block: "center",
      behavior: "instant"
    });
    const r = s.clientHeight;
    let o = s.getBoundingClientRect().top - n - this.size[1] * this.alignPosition;
    if (e)
      switch (this.alignAnchor) {
        case "bottom":
          o += r;
          break;
        case "center":
          o += r / 2;
          break;
      }
    this.element.scrollBy({
      top: o,
      behavior: "smooth"
    });
  }
  dispose() {
    super.dispose(), this.element.remove();
    for (const t of this.currentLyricLineObjects)
      t.dispose();
    this.bottomLine.dispose(), this.interludeDots.dispose();
  }
}
export {
  Le as AbstractBaseRenderer,
  ie as BackgroundRender,
  te as BaseRenderer,
  oi as CanvasLyricPlayer,
  ai as DomLyricPlayer,
  ci as DomSlimLyricPlayer,
  pe as LyricLineMouseEvent,
  ai as LyricPlayer,
  Rt as LyricPlayerBase,
  si as MeshGradientRenderer,
  ii as PixiRenderer
};
//# sourceMappingURL=amll-core.js.map
