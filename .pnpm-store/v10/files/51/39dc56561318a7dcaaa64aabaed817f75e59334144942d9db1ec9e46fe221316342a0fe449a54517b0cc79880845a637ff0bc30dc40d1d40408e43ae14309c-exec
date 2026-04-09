/**
 * Enables Swizzle operations on {@link Vec2}, {@link Vec3}, and {@link Vec4} types.
 *
 * Swizzle operations are performed by using the `.` operator in conjunction with any combination
 * of between two to four component names, either from the set `xyzw` or `rgbw` (though not intermixed).
 * They return a new vector with the same number of components as specified in the swizzle attribute.
 *
 * @example
 * ```js
 * import { Vec3, EnableSwizzles } from 'gl-matrix';
 *
 * EnableSwizzles();
 *
 * let v = new Vec3(0, 1, 2);
 *
 * v.yx // returns new Vec2(1, 0);
 * v.xzy // returns new Vec3(0, 2, 1);
 * v.zyxz // returns new Vec4(2, 1, 0, 2);
 *
 * v.rgb // returns new Vec3(0, 1, 2);
 * v.rbg // returns new Vec3(0, 2, 1);
 * v.gg // returns new Vec2(1, 1);
 * ```
 */
export declare function EnableSwizzles(): void;
