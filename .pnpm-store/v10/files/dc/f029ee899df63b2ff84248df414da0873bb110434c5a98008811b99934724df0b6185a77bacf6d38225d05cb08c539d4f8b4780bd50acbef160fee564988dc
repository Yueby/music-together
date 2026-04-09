import { Condition } from '@ucast/mongo2js';
import { AnyAbility } from '../PureAbility';
import { RuleOf } from '../RuleIndex';
import { ExtractSubjectType } from '../types';
export type RuleToQueryConverter<T extends AnyAbility, R = object> = (rule: RuleOf<T>) => R;
export interface AbilityQuery<T = object> {
    $or?: T[];
    $and?: T[];
}
export declare function rulesToQuery<T extends AnyAbility, R = object>(ability: T, action: Parameters<T['rulesFor']>[0], subjectType: ExtractSubjectType<Parameters<T['rulesFor']>[1]>, convert: RuleToQueryConverter<T, R>): AbilityQuery<R> | null;
export declare function rulesToAST<T extends AnyAbility>(ability: T, action: Parameters<T['rulesFor']>[0], subjectType: ExtractSubjectType<Parameters<T['rulesFor']>[1]>): Condition | null;
