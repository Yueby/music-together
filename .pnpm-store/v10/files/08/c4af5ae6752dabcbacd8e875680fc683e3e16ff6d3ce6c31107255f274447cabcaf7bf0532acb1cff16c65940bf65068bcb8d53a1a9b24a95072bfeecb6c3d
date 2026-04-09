import { LyricLine } from '../../interfaces.ts';
import { LyricLineBase, LyricPlayerBase } from '../base.ts';
import { LyricLineEl } from './lyric-line.ts';
/**
 * 歌词行鼠标相关事件，可以获取到歌词行的索引和歌词行元素
 */
export declare class LyricLineMouseEvent extends MouseEvent {
    /**
     * 歌词行索引
     */
    readonly lineIndex: number;
    /**
     * 歌词行元素
     */
    readonly line: LyricLineBase;
    constructor(
    /**
     * 歌词行索引
     */
    lineIndex: number, 
    /**
     * 歌词行元素
     */
    line: LyricLineBase, event: MouseEvent);
}
export type LyricLineMouseEventListener = (evt: LyricLineMouseEvent) => void;
/**
 * 歌词播放组件，本框架的核心组件
 *
 * 尽可能贴切 Apple Music for iPad 的歌词效果设计，且做了力所能及的优化措施
 */
export declare class DomLyricPlayer extends LyricPlayerBase {
    currentLyricLineObjects: LyricLineEl[];
    onResize(): void;
    readonly supportPlusLighter: boolean;
    readonly supportMaskImage: boolean;
    readonly innerSize: [number, number];
    private readonly onLineClickedHandler;
    /**
     * 是否为非逐词歌词
     * @internal
     */
    _getIsNonDynamic(): boolean;
    private _baseFontSize;
    get baseFontSize(): number;
    constructor();
    private rebuildStyle;
    setWordFadeWidth(value?: number): void;
    /**
     * 设置当前播放歌词，要注意传入后这个数组内的信息不得修改，否则会发生错误
     * @param lines 歌词数组
     * @param initialTime 初始时间，默认为 0
     */
    setLyricLines(lines: LyricLine[], initialTime?: number): void;
    pause(): void;
    resume(): void;
    update(delta?: number): void;
    dispose(): void;
}
//# sourceMappingURL=index.d.ts.map