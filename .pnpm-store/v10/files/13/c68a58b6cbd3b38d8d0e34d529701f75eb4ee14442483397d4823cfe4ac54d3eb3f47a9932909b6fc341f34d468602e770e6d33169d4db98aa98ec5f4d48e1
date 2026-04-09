import { Disposable } from '../interfaces.ts';
export interface SpringParams {
    mass: number;
    damping: number;
    stiffness: number;
}
type CSSStyleKeys = {
    [Style in keyof CSSStyleDeclaration]: Style extends string ? CSSStyleDeclaration[Style] extends string ? Style : never : never;
}[keyof CSSStyleDeclaration];
/**
 * 基于 Web Animation API 的弹簧动画工具类，效果上可能逊于实时演算的版本
 */
export declare class WebAnimationSpring extends EventTarget implements Disposable {
    private element;
    private styleName;
    private valueGenerator;
    private currentPosition;
    private currentAnimation;
    private targetPosition;
    private isStatic;
    private params;
    private currentSolver;
    private getV;
    constructor(element: HTMLElement, styleName: CSSStyleKeys, valueGenerator: (value: number) => string, currentPosition?: number);
    makeStatic(): void;
    setTargetPosition(targetPosition: number): void;
    getCurrentPosition(): number;
    getCurrentVelocity(): number;
    private onStepFinished;
    stop(): void;
    dispose(): void;
}
export {};
//# sourceMappingURL=wa-spring.d.ts.map