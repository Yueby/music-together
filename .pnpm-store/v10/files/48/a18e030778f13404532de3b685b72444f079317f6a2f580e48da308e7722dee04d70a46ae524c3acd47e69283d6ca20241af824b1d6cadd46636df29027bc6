export interface TextLayoutResult {
    text: string;
    index: number;
    lineIndex: number;
    width: number;
    height: number;
    x: number;
}
export interface TextLayoutConfig {
    fontSize: number;
    maxWidth: number;
    lineHeight: number;
    /**
     * 是否统一空格宽度，即不论空白字符有多少个，都只占用一个字符的宽度
     */
    uniformSpace: boolean;
}
export interface TextLayoutFinalState {
    x: number;
    lineIndex: number;
}
/**
 * 对指定文本进行布局，返回每个字符的位置信息
 * 目前仅可支持普通拉丁字符和 CJK 字符
 * @param ctx 2D 画板上下文
 * @param text 文本
 * @param config 字体大小
 * @param initialX 初始 X 坐标，对于需要布局多段文本的情况下有所帮助
 */
export declare function layoutWord(ctx: CanvasRenderingContext2D, text: string, config: TextLayoutConfig, initialX?: number): Generator<TextLayoutResult, TextLayoutFinalState, void>;
/**
 * 对指定文本进行布局，返回每段文字的位置信息
 * 目前仅可支持普通拉丁字符和 CJK 字符
 * @param ctx 2D 画板上下文
 * @param text 文本
 * @param config 字体大小
 * @param initialX 初始 X 坐标，对于需要布局多段文本的情况下有所帮助
 */
export declare function layoutLine(ctx: CanvasRenderingContext2D, text: string, config: TextLayoutConfig, initialX?: number): Generator<TextLayoutResult, void, void>;
//# sourceMappingURL=text-layout.d.ts.map