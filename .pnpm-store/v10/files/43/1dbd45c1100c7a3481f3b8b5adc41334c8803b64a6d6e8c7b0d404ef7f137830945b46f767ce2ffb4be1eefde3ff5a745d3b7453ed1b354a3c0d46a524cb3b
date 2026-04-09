import { LyricLine } from '../../interfaces.ts';
import { LyricLineBase } from '../base.ts';
import { CanvasLyricPlayer } from './index.ts';
export declare class CanvasLyricLine extends LyricLineBase {
    private player;
    private line;
    constructor(player: CanvasLyricPlayer, line?: LyricLine);
    getLine(): LyricLine;
    private lineSize;
    measureSize(): [number, number];
    private layoutWords;
    private translatedLayoutWords;
    private romanLayoutWords;
    private lineCanvas;
    /** @internal */
    relayout(): void;
    private enabled;
    enable(): void;
    disable(): void;
    resume(): void;
    pause(): void;
    setTransform(top?: number, scale?: number, opacity?: number, blur?: number, force?: boolean, delay?: number): void;
    get isInSight(): boolean;
    update(delta?: number): void;
}
//# sourceMappingURL=lyric-line.d.ts.map