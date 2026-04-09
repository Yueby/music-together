export interface LinearParams {
    duration: number;
}
export declare class Linear {
    private currentPosition;
    private targetPosition;
    private currentTime;
    private params;
    private currentSolver;
    private startTime;
    private queueParams;
    private queuePosition;
    constructor(currentPosition?: number);
    private resetSolver;
    arrived(): boolean;
    setPosition(targetPosition: number): void;
    update(delta?: number): void;
    updateParams(params: Partial<LinearParams>, delay?: number): void;
    setTargetPosition(targetPosition: number, delay?: number): void;
    getCurrentPosition(): number;
}
//# sourceMappingURL=linear.d.ts.map