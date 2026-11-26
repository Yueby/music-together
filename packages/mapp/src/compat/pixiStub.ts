/**
 * Lightweight build-time stub for `@pixi/*` inside the mini-app bundle.
 *
 * `@applemusic-like-lyrics/core` statically imports Pixi classes for `PixiRenderer`
 * (`TimedContainer extends Container` evaluates at module load time), even though the mini-app
 * sets `hostRuntime.pixiBackground = false` and always uses `MeshGradientRenderer` (plain WebGL).
 * Aliasing `@pixi/*` here keeps `MeshGradientRenderer` and `LyricPlayer` intact while omitting
 * the unused PixiJS engine from `app.js`.
 */
export class Container {}
export class Application {}
export class Texture {}
export class Sprite {}
export class BlurFilter {}
export class BulgePinchFilter {}
export class ColorMatrixFilter {}
export const utils = {
  isWebGLSupported: () => false,
}
