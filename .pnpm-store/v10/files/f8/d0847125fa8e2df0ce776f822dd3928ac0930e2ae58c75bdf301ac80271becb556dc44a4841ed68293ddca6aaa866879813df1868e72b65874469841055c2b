import { CompoundInstruction, FieldInstruction, DocumentInstruction, Comparable, FieldParsingContext, ObjectQueryFieldParsingContext } from '@ucast/core';
import { MongoQuery } from './types';
export declare const $and: CompoundInstruction<MongoQuery<any>[]>;
export declare const $or: CompoundInstruction<(import("./types").MongoQueryOperators<any> | ({
    [x: string]: any;
} & import("./types").MongoQueryTopLevelOperators<any>))[], {}>;
export declare const $nor: CompoundInstruction<MongoQuery<any>[]>;
export declare const $not: FieldInstruction<MongoQuery<any> | RegExp>;
export declare const $elemMatch: FieldInstruction<MongoQuery<any>, ObjectQueryFieldParsingContext>;
export declare const $size: FieldInstruction<number>;
export declare const $in: FieldInstruction<unknown[]>;
export declare const $nin: FieldInstruction<unknown[], FieldParsingContext>;
export declare const $all: FieldInstruction<unknown[], FieldParsingContext>;
export declare const $mod: FieldInstruction<[number, number]>;
export declare const $exists: FieldInstruction<boolean>;
export declare const $gte: FieldInstruction<Comparable>;
export declare const $gt: FieldInstruction<string | number | Date, FieldParsingContext>;
export declare const $lt: FieldInstruction<string | number | Date, FieldParsingContext>;
export declare const $lte: FieldInstruction<string | number | Date, FieldParsingContext>;
export declare const $eq: FieldInstruction;
export declare const $ne: FieldInstruction<unknown, FieldParsingContext>;
export interface RegExpFieldContext extends FieldParsingContext {
    query: {
        $options?: string;
    };
}
export declare const $regex: FieldInstruction<string | RegExp, RegExpFieldContext>;
export declare const $options: FieldInstruction;
export declare const $where: DocumentInstruction<() => boolean>;
