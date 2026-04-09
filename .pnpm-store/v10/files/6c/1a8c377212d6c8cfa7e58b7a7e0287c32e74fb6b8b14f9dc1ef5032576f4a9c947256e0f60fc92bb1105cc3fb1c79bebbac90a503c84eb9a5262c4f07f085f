import { Condition } from '../Condition';
import { NamedInstruction, ParsingInstruction, FieldParsingContext, ParsingContext } from '../types';
export declare type FieldQueryOperators<T extends {}> = {
    [K in keyof T]: T[K] extends {} ? T[K] : never;
}[keyof T];
export interface QueryOptions {
    operatorToConditionName?(name: string): string;
    defaultOperatorName?: string;
    fieldContext?: Record<string, unknown>;
    documentContext?: Record<string, unknown>;
    useIgnoreValue?: boolean;
    mergeFinalConditions?(conditions: Condition[]): Condition;
}
export declare type ObjectQueryFieldParsingContext = ParsingContext<FieldParsingContext & {
    query: {};
    hasOperators<T>(value: unknown): value is T;
}>;
export declare class ObjectQueryParser<T extends Record<any, any>, U extends FieldQueryOperators<T> = FieldQueryOperators<T>> {
    private readonly _instructions;
    private _fieldInstructionContext;
    private _documentInstructionContext;
    private readonly _options;
    private readonly _objectKeys;
    constructor(instructions: Record<string, ParsingInstruction>, options?: QueryOptions);
    setParse(parse: this['parse']): void;
    protected parseField(field: string, operator: string, value: unknown, parentQuery: {}): Condition<unknown>;
    protected parseInstruction(instruction: NamedInstruction, value: unknown, context: ParsingContext<{}>): Condition<unknown>;
    protected parseFieldOperators(field: string, value: U): Condition<unknown>[];
    parse<Q extends T>(query: Q): Condition;
}
