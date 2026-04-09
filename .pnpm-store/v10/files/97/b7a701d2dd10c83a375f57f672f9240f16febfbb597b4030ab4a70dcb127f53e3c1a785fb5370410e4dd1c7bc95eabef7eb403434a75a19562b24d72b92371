import { z } from 'zod';
import { SourceFile } from 'ts-morph';
import { registryBaseColorSchema } from '../schema/index.js';
import { C as Config } from '../get-config-D6gTsP_D.js';

declare const styleMapSchema: z.ZodRecord<z.ZodString, z.ZodString>;
type StyleMap = z.infer<typeof styleMapSchema>;
declare function createStyleMap(input: string): Record<string, string>;

type TransformerStyle<Output = SourceFile> = (opts: {
    sourceFile: SourceFile;
    styleMap: StyleMap;
}) => Promise<Output>;
declare function transformStyle(source: string, { styleMap, transformers, }: {
    styleMap: StyleMap;
    transformers?: TransformerStyle<SourceFile>[];
}): Promise<string>;

type TransformOpts = {
    filename: string;
    raw: string;
    config: Config;
    baseColor?: z.infer<typeof registryBaseColorSchema>;
    transformJsx?: boolean;
    isRemote?: boolean;
};
type Transformer<Output = SourceFile> = (opts: TransformOpts & {
    sourceFile: SourceFile;
}) => Promise<Output>;

declare const transformIcons: Transformer;

declare const transformMenu: Transformer;

declare const transformRender: Transformer;

declare function transformDirection(source: string, rtl: boolean): Promise<string>;

export { createStyleMap, transformDirection, transformIcons, transformMenu, transformRender, transformStyle };
