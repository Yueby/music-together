import { FieldCondition } from '@ucast/core';
import { JsInterpretationOptions, JsInterpreter } from './types';
export type AnyObject = Record<PropertyKey, unknown>;
export type GetField = (object: any, field: string) => any;
export declare function includes<T>(items: T[], value: T, compare: JsInterpretationOptions['compare']): boolean;
export declare function isArrayAndNotNumericField<T>(object: T | T[], field: string): object is T[];
export declare function getValueByPath(object: AnyObject, field: string, get: GetField): any;
export declare function testValueOrArray<T, U = T>(test: JsInterpreter<FieldCondition<T>, U>): JsInterpreter<FieldCondition<T>, AnyObject | U>;
export declare const hasOwn: (o: object, v: PropertyKey) => boolean;
