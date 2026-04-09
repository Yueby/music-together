import { Disposable, HasElement, LyricLine, LyricWord } from '../interfaces.ts';
import { Spring, SpringParams } from '../utils/spring.ts';
import { BottomLineEl } from './bottom-line.ts';
import { InterludeDots } from './dom/interlude-dots.ts';
/**
 * 歌词播放器的基类，已经包含了有关歌词操作和排版的功能，子类需要为其实现对应的显示展示操作
 */
export declare abstract class LyricPlayerBase extends EventTarget implements HasElement, Disposable {
    protected element: HTMLElement;
    protected currentTime: number;
    /** @internal */
    lyricLinesSize: WeakMap<LyricLineBase, [number, number]>;
    /** @internal */
    lyricLineElementMap: WeakMap<Element, LyricLineBase>;
    protected currentLyricLines: LyricLine[];
    protected processedLines: LyricLine[];
    protected lyricLinesIndexes: WeakMap<LyricLineBase, number>;
    protected hotLines: Set<number>;
    protected bufferedLines: Set<number>;
    protected isNonDynamic: boolean;
    protected hasDuetLine: boolean;
    protected scrollToIndex: number;
    protected disableSpring: boolean;
    protected interludeDotsSize: [number, number];
    protected interludeDots: InterludeDots;
    protected bottomLine: BottomLineEl;
    protected enableBlur: boolean;
    protected enableScale: boolean;
    protected hidePassedLines: boolean;
    protected scrollBoundary: number[];
    protected currentLyricLineObjects: LyricLineBase[];
    protected isSeeking: boolean;
    protected lastCurrentTime: number;
    protected alignAnchor: "top" | "bottom" | "center";
    protected alignPosition: number;
    protected scrollOffset: number;
    readonly size: [number, number];
    protected allowScroll: boolean;
    protected isPageVisible: boolean;
    protected initialLayoutFinished: boolean;
    /**
     * 视图额外预渲染（overscan）距离，单位：像素。
     * 用于决定在视口之外多少距离内也认为是“可见”，以便提前创建/保留行元素。
     */
    protected overscanPx: number;
    protected posXSpringParams: Partial<SpringParams>;
    protected posYSpringParams: Partial<SpringParams>;
    protected scaleSpringParams: Partial<SpringParams>;
    protected scaleForBGSpringParams: Partial<SpringParams>;
    private onPageShow;
    private onPageHide;
    private scrolledHandler;
    protected isScrolled: boolean;
    /** @internal */
    resizeObserver: ResizeObserver;
    protected wordFadeWidth: number;
    protected targetAlignIndex: number;
    constructor();
    private beginScrollHandler;
    private endScrollHandler;
    private limitScrollOffset;
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
    setWordFadeWidth(value?: number): void;
    /**
     * 是否启用歌词行缩放效果，默认启用
     *
     * 如果启用，非选中的歌词行会轻微缩小以凸显当前播放歌词行效果
     *
     * 此效果对性能影响微乎其微，推荐启用
     * @param enable 是否启用歌词行缩放效果
     */
    setEnableScale(enable?: boolean): void;
    /**
     * 获取当前是否启用了歌词行缩放效果
     * @returns 是否启用歌词行缩放效果
     */
    getEnableScale(): boolean;
    /**
     * 获取当前文字动画的渐变宽度，单位以歌词行的主文字字体大小的倍数为单位
     * @returns 当前文字动画的渐变宽度，单位以歌词行的主文字字体大小的倍数为单位
     */
    getWordFadeWidth(): number;
    setIsSeeking(isSeeking: boolean): void;
    /**
     * 设置是否隐藏已经播放过的歌词行，默认不隐藏
     * @param hide 是否隐藏已经播放过的歌词行，默认不隐藏
     */
    setHidePassedLines(hide: boolean): void;
    /**
     * 设置是否启用歌词行的模糊效果
     * @param enable 是否启用
     */
    setEnableBlur(enable: boolean): void;
    /**
     * 设置目标歌词行的对齐方式，默认为 `center`
     *
     * - 设置成 `top` 的话将会向目标歌词行的顶部对齐
     * - 设置成 `bottom` 的话将会向目标歌词行的底部对齐
     * - 设置成 `center` 的话将会向目标歌词行的垂直中心对齐
     * @param alignAnchor 歌词行对齐方式，详情见函数说明
     */
    setAlignAnchor(alignAnchor: "top" | "bottom" | "center"): void;
    /**
     * 设置默认的歌词行对齐位置，相对于整个歌词播放组件的大小位置，默认为 `0.5`
     * @param alignPosition 一个 `[0.0-1.0]` 之间的任意数字，代表组件高度由上到下的比例位置
     */
    setAlignPosition(alignPosition: number): void;
    /**
     * 设置 overscan（视图上下额外缓冲渲染区）距离，单位：像素。
     * @param px 像素值，默认 300
     */
    setOverscanPx(px: number): void;
    /** 获取当前 overscan 像素距离 */
    getOverscanPx(): number;
    /**
     * 设置是否使用物理弹簧算法实现歌词动画效果，默认启用
     *
     * 如果启用，则会通过弹簧算法实时处理歌词位置，但是需要性能足够强劲的电脑方可流畅运行
     *
     * 如果不启用，则会回退到基于 `transition` 的过渡效果，对低性能的机器比较友好，但是效果会比较单一
     */
    setEnableSpring(enable?: boolean): void;
    /**
     * 获取当前是否启用了物理弹簧
     * @returns 是否启用物理弹簧
     */
    getEnableSpring(): boolean;
    /**
     * 获取当前播放时间里是否处于间奏区间
     * 如果是则会返回单位为毫秒的始末时间
     * 否则返回 undefined
     *
     * 这个只允许内部调用
     * @returns [开始时间,结束时间,大概处于的歌词行ID,下一句是否为对唱歌词] 或 undefined 如果不处于间奏区间
     */
    protected getCurrentInterlude(): [number, number, number, boolean] | undefined;
    /**
     * 设置当前播放歌词，要注意传入后这个数组内的信息不得修改，否则会发生错误
     * @param lines 歌词数组
     * @param initialTime 初始时间，默认为 0
     */
    setLyricLines(lines: LyricLine[], initialTime?: number): void;
    /**
     * 设置当前播放进度，单位为毫秒且**必须是整数**，此时将会更新内部的歌词进度信息
     * 内部会根据调用间隔和播放进度自动决定如何滚动和显示歌词，所以这个的调用频率越快越准确越好
     *
     * 调用完成后，可以每帧调用 `update` 函数来执行歌词动画效果
     * @param time 当前播放进度，单位为毫秒
     */
    setCurrentTime(time: number, isSeek?: boolean): void;
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
    calcLayout(sync?: boolean): Promise<void>;
    /**
     * 设置所有歌词行在横坐标上的弹簧属性，包括重量、弹力和阻力。
     *
     * @param params 需要设置的弹簧属性，提供的属性将会覆盖原来的属性，未提供的属性将会保持原样
     * @deprecated 考虑到横向弹簧效果并不常见，所以这个函数将会在未来的版本中移除
     */
    setLinePosXSpringParams(_params?: Partial<SpringParams>): void;
    /**
     * 设置所有歌词行在​纵坐标上的弹簧属性，包括重量、弹力和阻力。
     *
     * @param params 需要设置的弹簧属性，提供的属性将会覆盖原来的属性，未提供的属性将会保持原样
     */
    setLinePosYSpringParams(params?: Partial<SpringParams>): void;
    /**
     * 设置所有歌词行在​缩放大小上的弹簧属性，包括重量、弹力和阻力。
     *
     * @param params 需要设置的弹簧属性，提供的属性将会覆盖原来的属性，未提供的属性将会保持原样
     */
    setLineScaleSpringParams(params?: Partial<SpringParams>): void;
    protected isPlaying: boolean;
    /**
     * 暂停部分效果演出，目前会暂停播放间奏点的动画，且将背景歌词显示出来
     */
    pause(): void;
    /**
     * 恢复部分效果演出，目前会恢复播放间奏点的动画
     */
    resume(): void;
    /**
     * 更新动画，这个函数应该被逐帧调用或者在以下情况下调用一次：
     *
     * 1. 刚刚调用完设置歌词函数的时候
     * @param delta 距离上一次被调用到现在的时长，单位为毫秒（可为浮点数）
     */
    update(delta?: number): void;
    protected onResize(): void;
    /**
     * 获取一个特殊的底栏元素，默认是空白的，可以往内部添加任意元素
     *
     * 这个元素始终在歌词的底部，可以用于显示歌曲创作者等信息
     *
     * 但是请勿删除该元素，只能在内部存放元素
     *
     * @returns 一个元素，可以往内部添加任意元素
     */
    getBottomLineElement(): HTMLElement;
    /**
     * 重置用户滚动状态
     *
     * 请在用户完成滚动点击跳转歌词时调用本事件再调用 `calcLayout` 以正确滚动到目标位置
     */
    resetScroll(): void;
    /**
     * 获取当前歌词数组
     *
     * 一般和最后调用 `setLyricLines` 给予的参数一样
     * @returns 当前歌词数组
     */
    getLyricLines(): LyricLine[];
    /**
     * 获取当前歌词的播放位置
     *
     * 一般和最后调用 `setCurrentTime` 给予的参数一样
     * @returns 当前播放位置
     */
    getCurrentTime(): number;
    getElement(): HTMLElement;
    dispose(): void;
}
/**
 * 所有标准歌词行的基类
 * @internal
 */
export declare abstract class LyricLineBase extends EventTarget implements Disposable {
    protected top: number;
    protected scale: number;
    protected blur: number;
    protected opacity: number;
    protected delay: number;
    readonly lineTransforms: {
        posY: Spring;
        scale: Spring;
    };
    abstract getLine(): LyricLine;
    abstract enable(): void;
    abstract disable(): void;
    abstract resume(): void;
    abstract pause(): void;
    onLineSizeChange(_size: [number, number]): void;
    setTransform(top?: number, scale?: number, opacity?: number, blur?: number, _force?: boolean, delay?: number): void;
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
    static shouldEmphasize(word: LyricWord): boolean;
    abstract update(delta?: number): void;
    dispose(): void;
}
//# sourceMappingURL=base.d.ts.map