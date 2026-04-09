import { LyricLine } from '../../interfaces.ts';
import { LyricPlayerBase } from '../base.ts';
import { LyricLineEl } from './lyric-line.ts';
/**
 * 歌词播放组件，本框架的核心组件
 *
 * 尽可能贴切 Apple Music for iPad 的歌词效果设计，且做了力所能及的优化措施
 */
export declare class DomSlimLyricPlayer extends LyricPlayerBase {
    currentLyricLineObjects: LyricLineEl[];
    private debounceCalcLayout;
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
    calcLayout(sync?: boolean): Promise<void>;
    dispose(): void;
}
//# sourceMappingURL=index.d.ts.map