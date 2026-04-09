import { BaseRenderer } from './base';
export declare class PixiRenderer extends BaseRenderer {
    protected canvas: HTMLCanvasElement;
    private app;
    private curContainer?;
    private staticMode;
    private lastContainer;
    private onTick;
    constructor(canvas: HTMLCanvasElement);
    protected onResize(width: number, height: number): void;
    setRenderScale(scale: number): void;
    private rebuildFilters;
    setStaticMode(enable?: boolean): void;
    setFPS(fps: number): void;
    pause(): void;
    resume(): void;
    setLowFreqVolume(_volume: number): void;
    setHasLyric(_hasLyric: boolean): void;
    setAlbum(albumSource?: string | HTMLImageElement | HTMLVideoElement, isVideo?: boolean): Promise<void>;
    dispose(): void;
    getElement(): HTMLElement;
}
//# sourceMappingURL=pixi-renderer.d.ts.map