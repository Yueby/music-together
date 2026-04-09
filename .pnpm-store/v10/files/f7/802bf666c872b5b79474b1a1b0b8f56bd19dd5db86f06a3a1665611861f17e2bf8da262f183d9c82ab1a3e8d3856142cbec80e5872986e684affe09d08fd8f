import { Condition, CompoundCondition } from './Condition';
export declare function isCompound(operator: string, condition: Condition): condition is CompoundCondition;
export declare function optimizedCompoundCondition<T extends Condition>(operator: string, conditions: T[]): T | CompoundCondition<T>;
export declare const identity: <T>(x: T) => T;
export declare const object: () => any;
export declare const ignoreValue: IgnoreValue;
export interface IgnoreValue {
    readonly ['__@type@__']: 'ignore value';
}
export declare function hasOperators<T>(value: any, instructions: Record<string, unknown>, skipIgnore?: boolean): value is T;
export declare function objectKeysSkipIgnore(anyObject: Record<string, unknown>): string[];
export declare function pushIfNonNullCondition(conditions: Condition[], condition: Condition): void;
