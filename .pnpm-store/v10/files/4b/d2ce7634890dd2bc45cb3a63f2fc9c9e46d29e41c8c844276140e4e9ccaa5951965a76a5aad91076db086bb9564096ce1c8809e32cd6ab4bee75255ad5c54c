export interface Note<T> {
    type: string;
    message?: string;
    originalValue?: T;
}
export declare abstract class Condition<T = unknown> {
    readonly operator: string;
    readonly value: T;
    private _notes;
    constructor(operator: string, value: T);
    get notes(): ReadonlyArray<Note<T>> | undefined;
    addNote(note: Note<T>): void;
}
export declare class DocumentCondition<T> extends Condition<T> {
}
export declare class CompoundCondition<T extends Condition = Condition> extends DocumentCondition<T[]> {
    constructor(operator: string, conditions: T[]);
}
export declare const ITSELF = "__itself__";
export declare class FieldCondition<T = unknown> extends Condition<T> {
    readonly field: string | typeof ITSELF;
    constructor(operator: string, field: string | typeof ITSELF, value: T);
}
export declare const NULL_CONDITION: DocumentCondition<null>;
export declare type ConditionValue<T> = T extends Condition<infer V> ? V : unknown;
