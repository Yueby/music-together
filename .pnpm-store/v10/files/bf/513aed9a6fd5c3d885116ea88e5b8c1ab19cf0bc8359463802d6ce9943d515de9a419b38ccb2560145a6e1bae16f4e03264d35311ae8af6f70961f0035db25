import { AbstractBaseRenderer, BaseRenderer } from './base.ts';
/**
 * @fileoverview
 * 一个播放歌词的组件
 * @author SteveXMH
 */
export { AbstractBaseRenderer, BaseRenderer } from './base.ts';
export { MeshGradientRenderer } from './mesh-renderer/index.ts';
export { PixiRenderer } from './pixi-renderer.ts';
export declare class BackgroundRender<Renderer extends BaseRenderer> implements AbstractBaseRenderer {
    private element;
    private renderer;
    constructor(renderer: Renderer, canvas: HTMLCanvasElement);
    static new<Renderer extends BaseRenderer>(type: {
        new (canvas: HTMLCanvasElement): Renderer;
    }): BackgroundRender<Renderer>;
    setRenderScale(scale: number): void;
    setFlowSpeed(speed: number): void;
    setStaticMode(enable: boolean): void;
    setFPS(fps: number): void;
    pause(): void;
    resume(): void;
    setLowFreqVolume(volume: number): void;
    setHasLyric(hasLyric: boolean): void;
    setAlbum(albumSource: string | HTMLImageElement | HTMLVideoElement, isVideo?: boolean): Promise<void>;
    getElement(): HTMLCanvasElement;
    dispose(): void;
}
//# sourceMappingURL=index.d.ts.map