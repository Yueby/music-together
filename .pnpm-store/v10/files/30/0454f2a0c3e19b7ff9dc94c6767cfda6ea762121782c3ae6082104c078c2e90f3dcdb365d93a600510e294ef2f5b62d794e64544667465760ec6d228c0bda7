import { Condition, ParsingInstruction, ObjectQueryParser, FieldQueryOperators } from '@ucast/core';
import { MongoQuery } from './types';
export interface ParseOptions {
    field: string;
}
export declare class MongoQueryParser extends ObjectQueryParser<MongoQuery<any>> {
    constructor(instructions: Record<string, ParsingInstruction>);
    parse<Q extends MongoQuery<any>, FQ extends FieldQueryOperators<Q> = FieldQueryOperators<Q>>(query: Q | FQ, options?: ParseOptions): Condition;
}
