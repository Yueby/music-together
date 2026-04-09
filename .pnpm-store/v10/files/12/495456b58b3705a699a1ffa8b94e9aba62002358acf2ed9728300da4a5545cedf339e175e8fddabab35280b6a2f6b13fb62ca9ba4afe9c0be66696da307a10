import { PureComponent, ReactNode } from 'react';
import { AbilityTuple, SubjectType, AnyAbility, Generics, Abilities, IfString } from '@casl/ability';
type AbilityCanProps<T extends Abilities, Else = IfString<T, {
    do: T;
} | {
    I: T;
}>> = T extends AbilityTuple ? {
    do: T[0];
    on: T[1];
    field?: string;
} | {
    I: T[0];
    a: Extract<T[1], SubjectType>;
    field?: string;
} | {
    I: T[0];
    an: Extract<T[1], SubjectType>;
    field?: string;
} | {
    I: T[0];
    this: Exclude<T[1], SubjectType>;
    field?: string;
} : Else;
interface ExtraProps {
    not?: boolean;
    passThrough?: boolean;
}
interface CanExtraProps<T extends AnyAbility> extends ExtraProps {
    ability: T;
    children: ReactNode | ((isAllowed: boolean, ability: T) => ReactNode);
}
interface BoundCanExtraProps<T extends AnyAbility> extends ExtraProps {
    ability?: T;
    children: ReactNode | ((isAllowed: boolean, ability: T) => ReactNode);
}
export type CanProps<T extends AnyAbility> = AbilityCanProps<Generics<T>['abilities']> & CanExtraProps<T>;
export type BoundCanProps<T extends AnyAbility> = AbilityCanProps<Generics<T>['abilities']> & BoundCanExtraProps<T>;
export declare class Can<T extends AnyAbility> extends PureComponent<CanProps<T>, {
    t: boolean;
}> {
    private _isAllowed;
    private _ability;
    private _unsubscribeFromAbility;
    state: {
        t: boolean;
    };
    componentWillUnmount(): void;
    private _connectToAbility;
    get allowed(): boolean;
    private _canRender;
    render(): ReactNode;
    private _renderChildren;
}
export {};
