import { PureAbility, AbilityOptions, AbilityOptionsOf } from './PureAbility';
import { RawRuleFrom } from './RawRule';
import { AbilityTuple } from './types';
import { MongoQuery } from './matchers/conditions';
import { Public, RawRuleOf } from './RuleIndex';
/**
 * @deprecated use createMongoAbility function instead and MongoAbility<Abilities> interface.
 * In the next major version PureAbility will be renamed to Ability and this class will be removed
 */
export declare class Ability<A extends AbilityTuple = AbilityTuple, C extends MongoQuery = MongoQuery> extends PureAbility<A, C> {
    constructor(rules?: RawRuleFrom<A, C>[], options?: AbilityOptions<A, C>);
}
export interface AnyMongoAbility extends Public<PureAbility<any, MongoQuery>> {
}
export interface MongoAbility<A extends AbilityTuple = AbilityTuple, C extends MongoQuery = MongoQuery> extends PureAbility<A, C> {
}
/**
 * Creates Ability with MongoDB conditions matcher
 */
export declare function createMongoAbility<T extends AnyMongoAbility = MongoAbility>(rules?: RawRuleOf<T>[], options?: AbilityOptionsOf<T>): T;
export declare function createMongoAbility<A extends AbilityTuple = AbilityTuple, C extends MongoQuery = MongoQuery>(rules?: RawRuleFrom<A, C>[], options?: AbilityOptions<A, C>): MongoAbility<A, C>;
