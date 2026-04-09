import { Condition } from './Condition';
declare type ArgsExceptLast<F extends (...args: any[]) => any> = F extends (a: any, c: any) => any ? Parameters<(condition: Condition) => 0> : F extends (a: any, b: any, c: any) => any ? Parameters<(condition: Condition, value: Parameters<F>[1]) => 0> : Parameters<(condition: Condition, value: Parameters<F>[1], options: Parameters<F>[2], ...args: unknown[]) => 0>;
export declare type Interpreter<T extends Condition, R> = (condition: T, ...args: any[]) => R;
export declare type AnyInterpreter = Interpreter<any, any>;
export interface InterpretationContext<T extends AnyInterpreter> {
    interpret(...args: ArgsExceptLast<T>): ReturnType<T>;
}
export interface InterpreterOptions {
    numberOfArguments?: 1 | 2 | 3;
    getInterpreterName?(condition: Condition, context: this): string;
}
export declare function createInterpreter<T extends AnyInterpreter, U extends {} = {}>(interpreters: Record<string, T>, rawOptions?: U): (...args: ArgsExceptLast<T>) => ReturnType<T>;
export {};
