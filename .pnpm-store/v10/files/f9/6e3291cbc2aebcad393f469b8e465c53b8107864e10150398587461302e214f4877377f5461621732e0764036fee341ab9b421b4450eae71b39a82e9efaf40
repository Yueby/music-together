import { Condition } from './Condition';
import { Parse } from './types';
import { AnyInterpreter } from './interpreter';
declare type Bound<T> = T extends (first: Condition, ...args: infer A) => any ? {
    (...args: A): ReturnType<T>;
    ast: Condition;
} : never;
export declare function createTranslatorFactory<Lang, Interpreter extends AnyInterpreter>(parse: Parse<Lang>, interpret: Interpreter): (query: Lang, ...args: unknown[]) => Bound<Interpreter>;
export {};
