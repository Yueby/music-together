import type { CLEAR_MODES } from '@pixi/core';
import { Filter } from '@pixi/core';
import type { FilterSystem } from '@pixi/core';
import type { Point } from '@pixi/core';
import type { RenderTexture } from '@pixi/core';

/**
 * Bulges or pinches the image in a circle.<br>
 * ![original](../tools/screenshots/dist/original.png)![filter](../tools/screenshots/dist/bulge-pinch.gif)
 *
 * @class
 * @extends PIXI.Filter
 * @see {@link https://www.npmjs.com/package/@pixi/filter-bulge-pinch|@pixi/filter-bulge-pinch}
 * @see {@link https://www.npmjs.com/package/pixi-filters|pixi-filters}
 */
export declare class BulgePinchFilter extends Filter {
    /** Default constructor options. */
    static readonly defaults: BulgePinchFilterOptions;
    /**
     * @param {object} [options] - Options to use for filter.
     * @param {PIXI.Point|Array<number>} [options.center=[0,0]] - The x and y coordinates of the center
     *        of the circle of effect.
     * @param {number} [options.radius=100] - The radius of the circle of effect.
     * @param {number} [options.strength=1] - -1 to 1 (-1 is strong pinch, 0 is no effect, 1 is strong bulge)
     */
    constructor(options?: Partial<BulgePinchFilterOptions>);
    apply(filterManager: FilterSystem, input: RenderTexture, output: RenderTexture, clear: CLEAR_MODES): void;
    /**
     * The radius of the circle of effect.
     */
    get radius(): number;
    set radius(value: number);
    /**
     * The strength of the effect. -1 to 1 (-1 is strong pinch, 0 is no effect, 1 is strong bulge)
     */
    get strength(): number;
    set strength(value: number);
    /**
     * The x and y coordinates of the center of the circle of effect.
     *
     * @member {PIXI.Point | Array<number>}
     */
    get center(): PointLike;
    set center(value: PointLike);
}

export declare interface BulgePinchFilterOptions {
    center: PointLike;
    radius: number;
    strength: number;
}

declare type PointLike = Point | number[];

export { }
