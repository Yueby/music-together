import { LyricLine } from '../../interfaces.ts';
import { LyricPlayerBase } from '../base.ts';
import { CanvasLyricLine } from './lyric-line.ts';
export declare class CanvasLyricPlayer extends LyricPlayerBase {
    private canvasElement;
    currentLyricLineObjects: CanvasLyricLine[];
    /** @internal */
    readonly ctx: CanvasRenderingContext2D;
    /** @internal */
    baseLineHeight: number;
    /** @internal */
    baseFontSize: number;
    /** @internal */
    baseFontFamily: string;
    constructor();
    setLyricLines(lines: LyricLine[], initialTime?: number): void;
    onResize(): void;
    /**
     * @internal
     * @param size
     */
    setFontSize(emSize: number): void;
    update(delta?: number): void;
}
//# sourceMappingURL=index.d.ts.map