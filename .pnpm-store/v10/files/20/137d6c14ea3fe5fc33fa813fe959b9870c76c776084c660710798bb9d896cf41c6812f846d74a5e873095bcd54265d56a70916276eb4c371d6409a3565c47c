import { AnyAbility } from './PureAbility';
import { Normalize } from './types';
import { Generics } from './RuleIndex';
export type GetErrorMessage = (error: ForbiddenError<AnyAbility>) => string;
/** @deprecated will be removed in the next major release */
export declare const getDefaultErrorMessage: GetErrorMessage;
declare const NativeError: new (message: string) => Error;
export declare class ForbiddenError<T extends AnyAbility> extends NativeError {
    readonly ability: T;
    action: Normalize<Generics<T>['abilities']>[0];
    subject: Generics<T>['abilities'][1];
    field?: string;
    subjectType: string;
    static _defaultErrorMessage: GetErrorMessage;
    static setDefaultMessage(messageOrFn: string | GetErrorMessage): void;
    static from<U extends AnyAbility>(ability: U): ForbiddenError<U>;
    constructor(ability: T);
    setMessage(message: string): this;
    throwUnlessCan(...args: Parameters<T['can']>): void;
    unlessCan(...args: Parameters<T['can']>): this | undefined;
}
export {};
