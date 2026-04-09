import { z } from 'zod';

declare const registryConfigItemSchema: z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodObject<{
    url: z.ZodEffects<z.ZodString, string, string>;
    params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    url: string;
    params?: Record<string, string> | undefined;
    headers?: Record<string, string> | undefined;
}, {
    url: string;
    params?: Record<string, string> | undefined;
    headers?: Record<string, string> | undefined;
}>]>;
declare const registryConfigSchema: z.ZodRecord<z.ZodEffects<z.ZodString, string, string>, z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodObject<{
    url: z.ZodEffects<z.ZodString, string, string>;
    params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    url: string;
    params?: Record<string, string> | undefined;
    headers?: Record<string, string> | undefined;
}, {
    url: string;
    params?: Record<string, string> | undefined;
    headers?: Record<string, string> | undefined;
}>]>>;
declare const rawConfigSchema: z.ZodObject<{
    $schema: z.ZodOptional<z.ZodString>;
    style: z.ZodString;
    rsc: z.ZodDefault<z.ZodBoolean>;
    tsx: z.ZodDefault<z.ZodBoolean>;
    tailwind: z.ZodObject<{
        config: z.ZodOptional<z.ZodString>;
        css: z.ZodString;
        baseColor: z.ZodString;
        cssVariables: z.ZodDefault<z.ZodBoolean>;
        prefix: z.ZodOptional<z.ZodDefault<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        css: string;
        baseColor: string;
        cssVariables: boolean;
        config?: string | undefined;
        prefix?: string | undefined;
    }, {
        css: string;
        baseColor: string;
        config?: string | undefined;
        cssVariables?: boolean | undefined;
        prefix?: string | undefined;
    }>;
    iconLibrary: z.ZodOptional<z.ZodString>;
    rtl: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    menuColor: z.ZodOptional<z.ZodDefault<z.ZodEnum<["default", "inverted"]>>>;
    menuAccent: z.ZodOptional<z.ZodDefault<z.ZodEnum<["subtle", "bold"]>>>;
    aliases: z.ZodObject<{
        components: z.ZodString;
        utils: z.ZodString;
        ui: z.ZodOptional<z.ZodString>;
        lib: z.ZodOptional<z.ZodString>;
        hooks: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        components: string;
        utils: string;
        ui?: string | undefined;
        lib?: string | undefined;
        hooks?: string | undefined;
    }, {
        components: string;
        utils: string;
        ui?: string | undefined;
        lib?: string | undefined;
        hooks?: string | undefined;
    }>;
    registries: z.ZodOptional<z.ZodRecord<z.ZodEffects<z.ZodString, string, string>, z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodObject<{
        url: z.ZodEffects<z.ZodString, string, string>;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        url: string;
        params?: Record<string, string> | undefined;
        headers?: Record<string, string> | undefined;
    }, {
        url: string;
        params?: Record<string, string> | undefined;
        headers?: Record<string, string> | undefined;
    }>]>>>;
}, "strict", z.ZodTypeAny, {
    tailwind: {
        css: string;
        baseColor: string;
        cssVariables: boolean;
        config?: string | undefined;
        prefix?: string | undefined;
    };
    style: string;
    rsc: boolean;
    tsx: boolean;
    aliases: {
        components: string;
        utils: string;
        ui?: string | undefined;
        lib?: string | undefined;
        hooks?: string | undefined;
    };
    $schema?: string | undefined;
    iconLibrary?: string | undefined;
    rtl?: boolean | undefined;
    menuColor?: "default" | "inverted" | undefined;
    menuAccent?: "subtle" | "bold" | undefined;
    registries?: Record<string, string | {
        url: string;
        params?: Record<string, string> | undefined;
        headers?: Record<string, string> | undefined;
    }> | undefined;
}, {
    tailwind: {
        css: string;
        baseColor: string;
        config?: string | undefined;
        cssVariables?: boolean | undefined;
        prefix?: string | undefined;
    };
    style: string;
    aliases: {
        components: string;
        utils: string;
        ui?: string | undefined;
        lib?: string | undefined;
        hooks?: string | undefined;
    };
    $schema?: string | undefined;
    rsc?: boolean | undefined;
    tsx?: boolean | undefined;
    iconLibrary?: string | undefined;
    rtl?: boolean | undefined;
    menuColor?: "default" | "inverted" | undefined;
    menuAccent?: "subtle" | "bold" | undefined;
    registries?: Record<string, string | {
        url: string;
        params?: Record<string, string> | undefined;
        headers?: Record<string, string> | undefined;
    }> | undefined;
}>;
declare const configSchema: z.ZodObject<{
    $schema: z.ZodOptional<z.ZodString>;
    style: z.ZodString;
    rsc: z.ZodDefault<z.ZodBoolean>;
    tsx: z.ZodDefault<z.ZodBoolean>;
    tailwind: z.ZodObject<{
        config: z.ZodOptional<z.ZodString>;
        css: z.ZodString;
        baseColor: z.ZodString;
        cssVariables: z.ZodDefault<z.ZodBoolean>;
        prefix: z.ZodOptional<z.ZodDefault<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        css: string;
        baseColor: string;
        cssVariables: boolean;
        config?: string | undefined;
        prefix?: string | undefined;
    }, {
        css: string;
        baseColor: string;
        config?: string | undefined;
        cssVariables?: boolean | undefined;
        prefix?: string | undefined;
    }>;
    iconLibrary: z.ZodOptional<z.ZodString>;
    rtl: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    menuColor: z.ZodOptional<z.ZodDefault<z.ZodEnum<["default", "inverted"]>>>;
    menuAccent: z.ZodOptional<z.ZodDefault<z.ZodEnum<["subtle", "bold"]>>>;
    aliases: z.ZodObject<{
        components: z.ZodString;
        utils: z.ZodString;
        ui: z.ZodOptional<z.ZodString>;
        lib: z.ZodOptional<z.ZodString>;
        hooks: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        components: string;
        utils: string;
        ui?: string | undefined;
        lib?: string | undefined;
        hooks?: string | undefined;
    }, {
        components: string;
        utils: string;
        ui?: string | undefined;
        lib?: string | undefined;
        hooks?: string | undefined;
    }>;
    registries: z.ZodOptional<z.ZodRecord<z.ZodEffects<z.ZodString, string, string>, z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodObject<{
        url: z.ZodEffects<z.ZodString, string, string>;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        url: string;
        params?: Record<string, string> | undefined;
        headers?: Record<string, string> | undefined;
    }, {
        url: string;
        params?: Record<string, string> | undefined;
        headers?: Record<string, string> | undefined;
    }>]>>>;
} & {
    resolvedPaths: z.ZodObject<{
        cwd: z.ZodString;
        tailwindConfig: z.ZodString;
        tailwindCss: z.ZodString;
        utils: z.ZodString;
        components: z.ZodString;
        lib: z.ZodString;
        hooks: z.ZodString;
        ui: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        components: string;
        ui: string;
        utils: string;
        lib: string;
        hooks: string;
        cwd: string;
        tailwindConfig: string;
        tailwindCss: string;
    }, {
        components: string;
        ui: string;
        utils: string;
        lib: string;
        hooks: string;
        cwd: string;
        tailwindConfig: string;
        tailwindCss: string;
    }>;
}, "strict", z.ZodTypeAny, {
    tailwind: {
        css: string;
        baseColor: string;
        cssVariables: boolean;
        config?: string | undefined;
        prefix?: string | undefined;
    };
    style: string;
    rsc: boolean;
    tsx: boolean;
    aliases: {
        components: string;
        utils: string;
        ui?: string | undefined;
        lib?: string | undefined;
        hooks?: string | undefined;
    };
    resolvedPaths: {
        components: string;
        ui: string;
        utils: string;
        lib: string;
        hooks: string;
        cwd: string;
        tailwindConfig: string;
        tailwindCss: string;
    };
    $schema?: string | undefined;
    iconLibrary?: string | undefined;
    rtl?: boolean | undefined;
    menuColor?: "default" | "inverted" | undefined;
    menuAccent?: "subtle" | "bold" | undefined;
    registries?: Record<string, string | {
        url: string;
        params?: Record<string, string> | undefined;
        headers?: Record<string, string> | undefined;
    }> | undefined;
}, {
    tailwind: {
        css: string;
        baseColor: string;
        config?: string | undefined;
        cssVariables?: boolean | undefined;
        prefix?: string | undefined;
    };
    style: string;
    aliases: {
        components: string;
        utils: string;
        ui?: string | undefined;
        lib?: string | undefined;
        hooks?: string | undefined;
    };
    resolvedPaths: {
        components: string;
        ui: string;
        utils: string;
        lib: string;
        hooks: string;
        cwd: string;
        tailwindConfig: string;
        tailwindCss: string;
    };
    $schema?: string | undefined;
    rsc?: boolean | undefined;
    tsx?: boolean | undefined;
    iconLibrary?: string | undefined;
    rtl?: boolean | undefined;
    menuColor?: "default" | "inverted" | undefined;
    menuAccent?: "subtle" | "bold" | undefined;
    registries?: Record<string, string | {
        url: string;
        params?: Record<string, string> | undefined;
        headers?: Record<string, string> | undefined;
    }> | undefined;
}>;
declare const workspaceConfigSchema: z.ZodRecord<z.ZodString, z.ZodObject<{
    $schema: z.ZodOptional<z.ZodString>;
    style: z.ZodString;
    rsc: z.ZodDefault<z.ZodBoolean>;
    tsx: z.ZodDefault<z.ZodBoolean>;
    tailwind: z.ZodObject<{
        config: z.ZodOptional<z.ZodString>;
        css: z.ZodString;
        baseColor: z.ZodString;
        cssVariables: z.ZodDefault<z.ZodBoolean>;
        prefix: z.ZodOptional<z.ZodDefault<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        css: string;
        baseColor: string;
        cssVariables: boolean;
        config?: string | undefined;
        prefix?: string | undefined;
    }, {
        css: string;
        baseColor: string;
        config?: string | undefined;
        cssVariables?: boolean | undefined;
        prefix?: string | undefined;
    }>;
    iconLibrary: z.ZodOptional<z.ZodString>;
    rtl: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    menuColor: z.ZodOptional<z.ZodDefault<z.ZodEnum<["default", "inverted"]>>>;
    menuAccent: z.ZodOptional<z.ZodDefault<z.ZodEnum<["subtle", "bold"]>>>;
    aliases: z.ZodObject<{
        components: z.ZodString;
        utils: z.ZodString;
        ui: z.ZodOptional<z.ZodString>;
        lib: z.ZodOptional<z.ZodString>;
        hooks: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        components: string;
        utils: string;
        ui?: string | undefined;
        lib?: string | undefined;
        hooks?: string | undefined;
    }, {
        components: string;
        utils: string;
        ui?: string | undefined;
        lib?: string | undefined;
        hooks?: string | undefined;
    }>;
    registries: z.ZodOptional<z.ZodRecord<z.ZodEffects<z.ZodString, string, string>, z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodObject<{
        url: z.ZodEffects<z.ZodString, string, string>;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        url: string;
        params?: Record<string, string> | undefined;
        headers?: Record<string, string> | undefined;
    }, {
        url: string;
        params?: Record<string, string> | undefined;
        headers?: Record<string, string> | undefined;
    }>]>>>;
} & {
    resolvedPaths: z.ZodObject<{
        cwd: z.ZodString;
        tailwindConfig: z.ZodString;
        tailwindCss: z.ZodString;
        utils: z.ZodString;
        components: z.ZodString;
        lib: z.ZodString;
        hooks: z.ZodString;
        ui: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        components: string;
        ui: string;
        utils: string;
        lib: string;
        hooks: string;
        cwd: string;
        tailwindConfig: string;
        tailwindCss: string;
    }, {
        components: string;
        ui: string;
        utils: string;
        lib: string;
        hooks: string;
        cwd: string;
        tailwindConfig: string;
        tailwindCss: string;
    }>;
}, "strict", z.ZodTypeAny, {
    tailwind: {
        css: string;
        baseColor: string;
        cssVariables: boolean;
        config?: string | undefined;
        prefix?: string | undefined;
    };
    style: string;
    rsc: boolean;
    tsx: boolean;
    aliases: {
        components: string;
        utils: string;
        ui?: string | undefined;
        lib?: string | undefined;
        hooks?: string | undefined;
    };
    resolvedPaths: {
        components: string;
        ui: string;
        utils: string;
        lib: string;
        hooks: string;
        cwd: string;
        tailwindConfig: string;
        tailwindCss: string;
    };
    $schema?: string | undefined;
    iconLibrary?: string | undefined;
    rtl?: boolean | undefined;
    menuColor?: "default" | "inverted" | undefined;
    menuAccent?: "subtle" | "bold" | undefined;
    registries?: Record<string, string | {
        url: string;
        params?: Record<string, string> | undefined;
        headers?: Record<string, string> | undefined;
    }> | undefined;
}, {
    tailwind: {
        css: string;
        baseColor: string;
        config?: string | undefined;
        cssVariables?: boolean | undefined;
        prefix?: string | undefined;
    };
    style: string;
    aliases: {
        components: string;
        utils: string;
        ui?: string | undefined;
        lib?: string | undefined;
        hooks?: string | undefined;
    };
    resolvedPaths: {
        components: string;
        ui: string;
        utils: string;
        lib: string;
        hooks: string;
        cwd: string;
        tailwindConfig: string;
        tailwindCss: string;
    };
    $schema?: string | undefined;
    rsc?: boolean | undefined;
    tsx?: boolean | undefined;
    iconLibrary?: string | undefined;
    rtl?: boolean | undefined;
    menuColor?: "default" | "inverted" | undefined;
    menuAccent?: "subtle" | "bold" | undefined;
    registries?: Record<string, string | {
        url: string;
        params?: Record<string, string> | undefined;
        headers?: Record<string, string> | undefined;
    }> | undefined;
}>>;
declare const registryItemTypeSchema: z.ZodEnum<["registry:lib", "registry:block", "registry:component", "registry:ui", "registry:hook", "registry:page", "registry:file", "registry:theme", "registry:style", "registry:item", "registry:base", "registry:font", "registry:example", "registry:internal"]>;
declare const registryItemFileSchema: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
    path: z.ZodString;
    content: z.ZodOptional<z.ZodString>;
    type: z.ZodEnum<["registry:file", "registry:page"]>;
    target: z.ZodString;
}, "strip", z.ZodTypeAny, {
    path: string;
    type: "registry:page" | "registry:file";
    target: string;
    content?: string | undefined;
}, {
    path: string;
    type: "registry:page" | "registry:file";
    target: string;
    content?: string | undefined;
}>, z.ZodObject<{
    path: z.ZodString;
    content: z.ZodOptional<z.ZodString>;
    type: z.ZodEnum<["registry:lib", "registry:block", "registry:component", "registry:ui", "registry:hook", "registry:theme", "registry:style", "registry:item", "registry:base", "registry:font", "registry:example", "registry:internal"]>;
    target: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    path: string;
    type: "registry:lib" | "registry:block" | "registry:component" | "registry:ui" | "registry:hook" | "registry:theme" | "registry:style" | "registry:item" | "registry:base" | "registry:font" | "registry:example" | "registry:internal";
    content?: string | undefined;
    target?: string | undefined;
}, {
    path: string;
    type: "registry:lib" | "registry:block" | "registry:component" | "registry:ui" | "registry:hook" | "registry:theme" | "registry:style" | "registry:item" | "registry:base" | "registry:font" | "registry:example" | "registry:internal";
    content?: string | undefined;
    target?: string | undefined;
}>]>;
declare const registryItemTailwindSchema: z.ZodObject<{
    config: z.ZodOptional<z.ZodObject<{
        content: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        theme: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        plugins: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        content?: string[] | undefined;
        theme?: Record<string, any> | undefined;
        plugins?: string[] | undefined;
    }, {
        content?: string[] | undefined;
        theme?: Record<string, any> | undefined;
        plugins?: string[] | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    config?: {
        content?: string[] | undefined;
        theme?: Record<string, any> | undefined;
        plugins?: string[] | undefined;
    } | undefined;
}, {
    config?: {
        content?: string[] | undefined;
        theme?: Record<string, any> | undefined;
        plugins?: string[] | undefined;
    } | undefined;
}>;
declare const registryItemCssVarsSchema: z.ZodObject<{
    theme: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    light: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    dark: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    theme?: Record<string, string> | undefined;
    light?: Record<string, string> | undefined;
    dark?: Record<string, string> | undefined;
}, {
    theme?: Record<string, string> | undefined;
    light?: Record<string, string> | undefined;
    dark?: Record<string, string> | undefined;
}>;
declare const registryItemCssSchema: z.ZodRecord<z.ZodString, z.ZodType<any, z.ZodTypeDef, any>>;
declare const registryItemEnvVarsSchema: z.ZodRecord<z.ZodString, z.ZodString>;
declare const registryItemFontSchema: z.ZodObject<{
    family: z.ZodString;
    provider: z.ZodLiteral<"google">;
    import: z.ZodString;
    variable: z.ZodString;
    weight: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    subsets: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    family: string;
    provider: "google";
    import: string;
    variable: string;
    weight?: string[] | undefined;
    subsets?: string[] | undefined;
}, {
    family: string;
    provider: "google";
    import: string;
    variable: string;
    weight?: string[] | undefined;
    subsets?: string[] | undefined;
}>;
declare const registryItemCommonSchema: z.ZodObject<{
    $schema: z.ZodOptional<z.ZodString>;
    extends: z.ZodOptional<z.ZodString>;
    name: z.ZodString;
    title: z.ZodOptional<z.ZodString>;
    author: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    dependencies: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    devDependencies: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    registryDependencies: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    files: z.ZodOptional<z.ZodArray<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
        path: z.ZodString;
        content: z.ZodOptional<z.ZodString>;
        type: z.ZodEnum<["registry:file", "registry:page"]>;
        target: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        path: string;
        type: "registry:page" | "registry:file";
        target: string;
        content?: string | undefined;
    }, {
        path: string;
        type: "registry:page" | "registry:file";
        target: string;
        content?: string | undefined;
    }>, z.ZodObject<{
        path: z.ZodString;
        content: z.ZodOptional<z.ZodString>;
        type: z.ZodEnum<["registry:lib", "registry:block", "registry:component", "registry:ui", "registry:hook", "registry:theme", "registry:style", "registry:item", "registry:base", "registry:font", "registry:example", "registry:internal"]>;
        target: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        path: string;
        type: "registry:lib" | "registry:block" | "registry:component" | "registry:ui" | "registry:hook" | "registry:theme" | "registry:style" | "registry:item" | "registry:base" | "registry:font" | "registry:example" | "registry:internal";
        content?: string | undefined;
        target?: string | undefined;
    }, {
        path: string;
        type: "registry:lib" | "registry:block" | "registry:component" | "registry:ui" | "registry:hook" | "registry:theme" | "registry:style" | "registry:item" | "registry:base" | "registry:font" | "registry:example" | "registry:internal";
        content?: string | undefined;
        target?: string | undefined;
    }>]>, "many">>;
    tailwind: z.ZodOptional<z.ZodObject<{
        config: z.ZodOptional<z.ZodObject<{
            content: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            theme: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
            plugins: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            content?: string[] | undefined;
            theme?: Record<string, any> | undefined;
            plugins?: string[] | undefined;
        }, {
            content?: string[] | undefined;
            theme?: Record<string, any> | undefined;
            plugins?: string[] | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        config?: {
            content?: string[] | undefined;
            theme?: Record<string, any> | undefined;
            plugins?: string[] | undefined;
        } | undefined;
    }, {
        config?: {
            content?: string[] | undefined;
            theme?: Record<string, any> | undefined;
            plugins?: string[] | undefined;
        } | undefined;
    }>>;
    cssVars: z.ZodOptional<z.ZodObject<{
        theme: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        light: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        dark: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        theme?: Record<string, string> | undefined;
        light?: Record<string, string> | undefined;
        dark?: Record<string, string> | undefined;
    }, {
        theme?: Record<string, string> | undefined;
        light?: Record<string, string> | undefined;
        dark?: Record<string, string> | undefined;
    }>>;
    css: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodType<any, z.ZodTypeDef, any>>>;
    envVars: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    meta: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    docs: z.ZodOptional<z.ZodString>;
    categories: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    name: string;
    tailwind?: {
        config?: {
            content?: string[] | undefined;
            theme?: Record<string, any> | undefined;
            plugins?: string[] | undefined;
        } | undefined;
    } | undefined;
    $schema?: string | undefined;
    css?: Record<string, any> | undefined;
    extends?: string | undefined;
    title?: string | undefined;
    author?: string | undefined;
    description?: string | undefined;
    dependencies?: string[] | undefined;
    devDependencies?: string[] | undefined;
    registryDependencies?: string[] | undefined;
    files?: ({
        path: string;
        type: "registry:page" | "registry:file";
        target: string;
        content?: string | undefined;
    } | {
        path: string;
        type: "registry:lib" | "registry:block" | "registry:component" | "registry:ui" | "registry:hook" | "registry:theme" | "registry:style" | "registry:item" | "registry:base" | "registry:font" | "registry:example" | "registry:internal";
        content?: string | undefined;
        target?: string | undefined;
    })[] | undefined;
    cssVars?: {
        theme?: Record<string, string> | undefined;
        light?: Record<string, string> | undefined;
        dark?: Record<string, string> | undefined;
    } | undefined;
    envVars?: Record<string, string> | undefined;
    meta?: Record<string, any> | undefined;
    docs?: string | undefined;
    categories?: string[] | undefined;
}, {
    name: string;
    tailwind?: {
        config?: {
            content?: string[] | undefined;
            theme?: Record<string, any> | undefined;
            plugins?: string[] | undefined;
        } | undefined;
    } | undefined;
    $schema?: string | undefined;
    css?: Record<string, any> | undefined;
    extends?: string | undefined;
    title?: string | undefined;
    author?: string | undefined;
    description?: string | undefined;
    dependencies?: string[] | undefined;
    devDependencies?: string[] | undefined;
    registryDependencies?: string[] | undefined;
    files?: ({
        path: string;
        type: "registry:page" | "registry:file";
        target: string;
        content?: string | undefined;
    } | {
        path: string;
        type: "registry:lib" | "registry:block" | "registry:component" | "registry:ui" | "registry:hook" | "registry:theme" | "registry:style" | "registry:item" | "registry:base" | "registry:font" | "registry:example" | "registry:internal";
        content?: string | undefined;
        target?: string | undefined;
    })[] | undefined;
    cssVars?: {
        theme?: Record<string, string> | undefined;
        light?: Record<string, string> | undefined;
        dark?: Record<string, string> | undefined;
    } | undefined;
    envVars?: Record<string, string> | undefined;
    meta?: Record<string, any> | undefined;
    docs?: string | undefined;
    categories?: string[] | undefined;
}>;
declare const registryItemSchema: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
    $schema: z.ZodOptional<z.ZodString>;
    extends: z.ZodOptional<z.ZodString>;
    name: z.ZodString;
    title: z.ZodOptional<z.ZodString>;
    author: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    dependencies: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    devDependencies: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    registryDependencies: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    files: z.ZodOptional<z.ZodArray<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
        path: z.ZodString;
        content: z.ZodOptional<z.ZodString>;
        type: z.ZodEnum<["registry:file", "registry:page"]>;
        target: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        path: string;
        type: "registry:page" | "registry:file";
        target: string;
        content?: string | undefined;
    }, {
        path: string;
        type: "registry:page" | "registry:file";
        target: string;
        content?: string | undefined;
    }>, z.ZodObject<{
        path: z.ZodString;
        content: z.ZodOptional<z.ZodString>;
        type: z.ZodEnum<["registry:lib", "registry:block", "registry:component", "registry:ui", "registry:hook", "registry:theme", "registry:style", "registry:item", "registry:base", "registry:font", "registry:example", "registry:internal"]>;
        target: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        path: string;
        type: "registry:lib" | "registry:block" | "registry:component" | "registry:ui" | "registry:hook" | "registry:theme" | "registry:style" | "registry:item" | "registry:base" | "registry:font" | "registry:example" | "registry:internal";
        content?: string | undefined;
        target?: string | undefined;
    }, {
        path: string;
        type: "registry:lib" | "registry:block" | "registry:component" | "registry:ui" | "registry:hook" | "registry:theme" | "registry:style" | "registry:item" | "registry:base" | "registry:font" | "registry:example" | "registry:internal";
        content?: string | undefined;
        target?: string | undefined;
    }>]>, "many">>;
    tailwind: z.ZodOptional<z.ZodObject<{
        config: z.ZodOptional<z.ZodObject<{
            content: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            theme: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
            plugins: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            content?: string[] | undefined;
            theme?: Record<string, any> | undefined;
            plugins?: string[] | undefined;
        }, {
            content?: string[] | undefined;
            theme?: Record<string, any> | undefined;
            plugins?: string[] | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        config?: {
            content?: string[] | undefined;
            theme?: Record<string, any> | undefined;
            plugins?: string[] | undefined;
        } | undefined;
    }, {
        config?: {
            content?: string[] | undefined;
            theme?: Record<string, any> | undefined;
            plugins?: string[] | undefined;
        } | undefined;
    }>>;
    cssVars: z.ZodOptional<z.ZodObject<{
        theme: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        light: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        dark: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        theme?: Record<string, string> | undefined;
        light?: Record<string, string> | undefined;
        dark?: Record<string, string> | undefined;
    }, {
        theme?: Record<string, string> | undefined;
        light?: Record<string, string> | undefined;
        dark?: Record<string, string> | undefined;
    }>>;
    css: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodType<any, z.ZodTypeDef, any>>>;
    envVars: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    meta: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    docs: z.ZodOptional<z.ZodString>;
    categories: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
} & {
    type: z.ZodLiteral<"registry:base">;
    config: z.ZodOptional<z.ZodObject<{
        $schema: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        style: z.ZodOptional<z.ZodString>;
        rsc: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
        tsx: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
        tailwind: z.ZodOptional<z.ZodObject<{
            config: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            css: z.ZodOptional<z.ZodString>;
            baseColor: z.ZodOptional<z.ZodString>;
            cssVariables: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
            prefix: z.ZodOptional<z.ZodOptional<z.ZodDefault<z.ZodString>>>;
        }, "strip", z.ZodTypeAny, {
            config?: string | undefined;
            css?: string | undefined;
            baseColor?: string | undefined;
            cssVariables?: boolean | undefined;
            prefix?: string | undefined;
        }, {
            config?: string | undefined;
            css?: string | undefined;
            baseColor?: string | undefined;
            cssVariables?: boolean | undefined;
            prefix?: string | undefined;
        }>>;
        iconLibrary: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        rtl: z.ZodOptional<z.ZodOptional<z.ZodDefault<z.ZodBoolean>>>;
        menuColor: z.ZodOptional<z.ZodOptional<z.ZodDefault<z.ZodEnum<["default", "inverted"]>>>>;
        menuAccent: z.ZodOptional<z.ZodOptional<z.ZodDefault<z.ZodEnum<["subtle", "bold"]>>>>;
        aliases: z.ZodOptional<z.ZodObject<{
            components: z.ZodOptional<z.ZodString>;
            utils: z.ZodOptional<z.ZodString>;
            ui: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            lib: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            hooks: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            components?: string | undefined;
            ui?: string | undefined;
            utils?: string | undefined;
            lib?: string | undefined;
            hooks?: string | undefined;
        }, {
            components?: string | undefined;
            ui?: string | undefined;
            utils?: string | undefined;
            lib?: string | undefined;
            hooks?: string | undefined;
        }>>;
        registries: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodEffects<z.ZodString, string, string>, z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodObject<{
            url: z.ZodEffects<z.ZodString, string, string>;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
            headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            url: string;
            params?: Record<string, string> | undefined;
            headers?: Record<string, string> | undefined;
        }, {
            url: string;
            params?: Record<string, string> | undefined;
            headers?: Record<string, string> | undefined;
        }>]>>>>;
    }, "strict", z.ZodTypeAny, {
        tailwind?: {
            config?: string | undefined;
            css?: string | undefined;
            baseColor?: string | undefined;
            cssVariables?: boolean | undefined;
            prefix?: string | undefined;
        } | undefined;
        $schema?: string | undefined;
        style?: string | undefined;
        rsc?: boolean | undefined;
        tsx?: boolean | undefined;
        iconLibrary?: string | undefined;
        rtl?: boolean | undefined;
        menuColor?: "default" | "inverted" | undefined;
        menuAccent?: "subtle" | "bold" | undefined;
        aliases?: {
            components?: string | undefined;
            ui?: string | undefined;
            utils?: string | undefined;
            lib?: string | undefined;
            hooks?: string | undefined;
        } | undefined;
        registries?: Record<string, string | {
            url: string;
            params?: Record<string, string> | undefined;
            headers?: Record<string, string> | undefined;
        }> | undefined;
    }, {
        tailwind?: {
            config?: string | undefined;
            css?: string | undefined;
            baseColor?: string | undefined;
            cssVariables?: boolean | undefined;
            prefix?: string | undefined;
        } | undefined;
        $schema?: string | undefined;
        style?: string | undefined;
        rsc?: boolean | undefined;
        tsx?: boolean | undefined;
        iconLibrary?: string | undefined;
        rtl?: boolean | undefined;
        menuColor?: "default" | "inverted" | undefined;
        menuAccent?: "subtle" | "bold" | undefined;
        aliases?: {
            components?: string | undefined;
            ui?: string | undefined;
            utils?: string | undefined;
            lib?: string | undefined;
            hooks?: string | undefined;
        } | undefined;
        registries?: Record<string, string | {
            url: string;
            params?: Record<string, string> | undefined;
            headers?: Record<string, string> | undefined;
        }> | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    type: "registry:base";
    name: string;
    tailwind?: {
        config?: {
            content?: string[] | undefined;
            theme?: Record<string, any> | undefined;
            plugins?: string[] | undefined;
        } | undefined;
    } | undefined;
    $schema?: string | undefined;
    config?: {
        tailwind?: {
            config?: string | undefined;
            css?: string | undefined;
            baseColor?: string | undefined;
            cssVariables?: boolean | undefined;
            prefix?: string | undefined;
        } | undefined;
        $schema?: string | undefined;
        style?: string | undefined;
        rsc?: boolean | undefined;
        tsx?: boolean | undefined;
        iconLibrary?: string | undefined;
        rtl?: boolean | undefined;
        menuColor?: "default" | "inverted" | undefined;
        menuAccent?: "subtle" | "bold" | undefined;
        aliases?: {
            components?: string | undefined;
            ui?: string | undefined;
            utils?: string | undefined;
            lib?: string | undefined;
            hooks?: string | undefined;
        } | undefined;
        registries?: Record<string, string | {
            url: string;
            params?: Record<string, string> | undefined;
            headers?: Record<string, string> | undefined;
        }> | undefined;
    } | undefined;
    css?: Record<string, any> | undefined;
    extends?: string | undefined;
    title?: string | undefined;
    author?: string | undefined;
    description?: string | undefined;
    dependencies?: string[] | undefined;
    devDependencies?: string[] | undefined;
    registryDependencies?: string[] | undefined;
    files?: ({
        path: string;
        type: "registry:page" | "registry:file";
        target: string;
        content?: string | undefined;
    } | {
        path: string;
        type: "registry:lib" | "registry:block" | "registry:component" | "registry:ui" | "registry:hook" | "registry:theme" | "registry:style" | "registry:item" | "registry:base" | "registry:font" | "registry:example" | "registry:internal";
        content?: string | undefined;
        target?: string | undefined;
    })[] | undefined;
    cssVars?: {
        theme?: Record<string, string> | undefined;
        light?: Record<string, string> | undefined;
        dark?: Record<string, string> | undefined;
    } | undefined;
    envVars?: Record<string, string> | undefined;
    meta?: Record<string, any> | undefined;
    docs?: string | undefined;
    categories?: string[] | undefined;
}, {
    type: "registry:base";
    name: string;
    tailwind?: {
        config?: {
            content?: string[] | undefined;
            theme?: Record<string, any> | undefined;
            plugins?: string[] | undefined;
        } | undefined;
    } | undefined;
    $schema?: string | undefined;
    config?: {
        tailwind?: {
            config?: string | undefined;
            css?: string | undefined;
            baseColor?: string | undefined;
            cssVariables?: boolean | undefined;
            prefix?: string | undefined;
        } | undefined;
        $schema?: string | undefined;
        style?: string | undefined;
        rsc?: boolean | undefined;
        tsx?: boolean | undefined;
        iconLibrary?: string | undefined;
        rtl?: boolean | undefined;
        menuColor?: "default" | "inverted" | undefined;
        menuAccent?: "subtle" | "bold" | undefined;
        aliases?: {
            components?: string | undefined;
            ui?: string | undefined;
            utils?: string | undefined;
            lib?: string | undefined;
            hooks?: string | undefined;
        } | undefined;
        registries?: Record<string, string | {
            url: string;
            params?: Record<string, string> | undefined;
            headers?: Record<string, string> | undefined;
        }> | undefined;
    } | undefined;
    css?: Record<string, any> | undefined;
    extends?: string | undefined;
    title?: string | undefined;
    author?: string | undefined;
    description?: string | undefined;
    dependencies?: string[] | undefined;
    devDependencies?: string[] | undefined;
    registryDependencies?: string[] | undefined;
    files?: ({
        path: string;
        type: "registry:page" | "registry:file";
        target: string;
        content?: string | undefined;
    } | {
        path: string;
        type: "registry:lib" | "registry:block" | "registry:component" | "registry:ui" | "registry:hook" | "registry:theme" | "registry:style" | "registry:item" | "registry:base" | "registry:font" | "registry:example" | "registry:internal";
        content?: string | undefined;
        target?: string | undefined;
    })[] | undefined;
    cssVars?: {
        theme?: Record<string, string> | undefined;
        light?: Record<string, string> | undefined;
        dark?: Record<string, string> | undefined;
    } | undefined;
    envVars?: Record<string, string> | undefined;
    meta?: Record<string, any> | undefined;
    docs?: string | undefined;
    categories?: string[] | undefined;
}>, z.ZodObject<{
    $schema: z.ZodOptional<z.ZodString>;
    extends: z.ZodOptional<z.ZodString>;
    name: z.ZodString;
    title: z.ZodOptional<z.ZodString>;
    author: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    dependencies: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    devDependencies: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    registryDependencies: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    files: z.ZodOptional<z.ZodArray<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
        path: z.ZodString;
        content: z.ZodOptional<z.ZodString>;
        type: z.ZodEnum<["registry:file", "registry:page"]>;
        target: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        path: string;
        type: "registry:page" | "registry:file";
        target: string;
        content?: string | undefined;
    }, {
        path: string;
        type: "registry:page" | "registry:file";
        target: string;
        content?: string | undefined;
    }>, z.ZodObject<{
        path: z.ZodString;
        content: z.ZodOptional<z.ZodString>;
        type: z.ZodEnum<["registry:lib", "registry:block", "registry:component", "registry:ui", "registry:hook", "registry:theme", "registry:style", "registry:item", "registry:base", "registry:font", "registry:example", "registry:internal"]>;
        target: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        path: string;
        type: "registry:lib" | "registry:block" | "registry:component" | "registry:ui" | "registry:hook" | "registry:theme" | "registry:style" | "registry:item" | "registry:base" | "registry:font" | "registry:example" | "registry:internal";
        content?: string | undefined;
        target?: string | undefined;
    }, {
        path: string;
        type: "registry:lib" | "registry:block" | "registry:component" | "registry:ui" | "registry:hook" | "registry:theme" | "registry:style" | "registry:item" | "registry:base" | "registry:font" | "registry:example" | "registry:internal";
        content?: string | undefined;
        target?: string | undefined;
    }>]>, "many">>;
    tailwind: z.ZodOptional<z.ZodObject<{
        config: z.ZodOptional<z.ZodObject<{
            content: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            theme: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
            plugins: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            content?: string[] | undefined;
            theme?: Record<string, any> | undefined;
            plugins?: string[] | undefined;
        }, {
            content?: string[] | undefined;
            theme?: Record<string, any> | undefined;
            plugins?: string[] | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        config?: {
            content?: string[] | undefined;
            theme?: Record<string, any> | undefined;
            plugins?: string[] | undefined;
        } | undefined;
    }, {
        config?: {
            content?: string[] | undefined;
            theme?: Record<string, any> | undefined;
            plugins?: string[] | undefined;
        } | undefined;
    }>>;
    cssVars: z.ZodOptional<z.ZodObject<{
        theme: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        light: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        dark: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        theme?: Record<string, string> | undefined;
        light?: Record<string, string> | undefined;
        dark?: Record<string, string> | undefined;
    }, {
        theme?: Record<string, string> | undefined;
        light?: Record<string, string> | undefined;
        dark?: Record<string, string> | undefined;
    }>>;
    css: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodType<any, z.ZodTypeDef, any>>>;
    envVars: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    meta: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    docs: z.ZodOptional<z.ZodString>;
    categories: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
} & {
    type: z.ZodLiteral<"registry:font">;
    font: z.ZodObject<{
        family: z.ZodString;
        provider: z.ZodLiteral<"google">;
        import: z.ZodString;
        variable: z.ZodString;
        weight: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        subsets: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        family: string;
        provider: "google";
        import: string;
        variable: string;
        weight?: string[] | undefined;
        subsets?: string[] | undefined;
    }, {
        family: string;
        provider: "google";
        import: string;
        variable: string;
        weight?: string[] | undefined;
        subsets?: string[] | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    type: "registry:font";
    name: string;
    font: {
        family: string;
        provider: "google";
        import: string;
        variable: string;
        weight?: string[] | undefined;
        subsets?: string[] | undefined;
    };
    tailwind?: {
        config?: {
            content?: string[] | undefined;
            theme?: Record<string, any> | undefined;
            plugins?: string[] | undefined;
        } | undefined;
    } | undefined;
    $schema?: string | undefined;
    css?: Record<string, any> | undefined;
    extends?: string | undefined;
    title?: string | undefined;
    author?: string | undefined;
    description?: string | undefined;
    dependencies?: string[] | undefined;
    devDependencies?: string[] | undefined;
    registryDependencies?: string[] | undefined;
    files?: ({
        path: string;
        type: "registry:page" | "registry:file";
        target: string;
        content?: string | undefined;
    } | {
        path: string;
        type: "registry:lib" | "registry:block" | "registry:component" | "registry:ui" | "registry:hook" | "registry:theme" | "registry:style" | "registry:item" | "registry:base" | "registry:font" | "registry:example" | "registry:internal";
        content?: string | undefined;
        target?: string | undefined;
    })[] | undefined;
    cssVars?: {
        theme?: Record<string, string> | undefined;
        light?: Record<string, string> | undefined;
        dark?: Record<string, string> | undefined;
    } | undefined;
    envVars?: Record<string, string> | undefined;
    meta?: Record<string, any> | undefined;
    docs?: string | undefined;
    categories?: string[] | undefined;
}, {
    type: "registry:font";
    name: string;
    font: {
        family: string;
        provider: "google";
        import: string;
        variable: string;
        weight?: string[] | undefined;
        subsets?: string[] | undefined;
    };
    tailwind?: {
        config?: {
            content?: string[] | undefined;
            theme?: Record<string, any> | undefined;
            plugins?: string[] | undefined;
        } | undefined;
    } | undefined;
    $schema?: string | undefined;
    css?: Record<string, any> | undefined;
    extends?: string | undefined;
    title?: string | undefined;
    author?: string | undefined;
    description?: string | undefined;
    dependencies?: string[] | undefined;
    devDependencies?: string[] | undefined;
    registryDependencies?: string[] | undefined;
    files?: ({
        path: string;
        type: "registry:page" | "registry:file";
        target: string;
        content?: string | undefined;
    } | {
        path: string;
        type: "registry:lib" | "registry:block" | "registry:component" | "registry:ui" | "registry:hook" | "registry:theme" | "registry:style" | "registry:item" | "registry:base" | "registry:font" | "registry:example" | "registry:internal";
        content?: string | undefined;
        target?: string | undefined;
    })[] | undefined;
    cssVars?: {
        theme?: Record<string, string> | undefined;
        light?: Record<string, string> | undefined;
        dark?: Record<string, string> | undefined;
    } | undefined;
    envVars?: Record<string, string> | undefined;
    meta?: Record<string, any> | undefined;
    docs?: string | undefined;
    categories?: string[] | undefined;
}>, z.ZodObject<{
    $schema: z.ZodOptional<z.ZodString>;
    extends: z.ZodOptional<z.ZodString>;
    name: z.ZodString;
    title: z.ZodOptional<z.ZodString>;
    author: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    dependencies: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    devDependencies: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    registryDependencies: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    files: z.ZodOptional<z.ZodArray<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
        path: z.ZodString;
        content: z.ZodOptional<z.ZodString>;
        type: z.ZodEnum<["registry:file", "registry:page"]>;
        target: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        path: string;
        type: "registry:page" | "registry:file";
        target: string;
        content?: string | undefined;
    }, {
        path: string;
        type: "registry:page" | "registry:file";
        target: string;
        content?: string | undefined;
    }>, z.ZodObject<{
        path: z.ZodString;
        content: z.ZodOptional<z.ZodString>;
        type: z.ZodEnum<["registry:lib", "registry:block", "registry:component", "registry:ui", "registry:hook", "registry:theme", "registry:style", "registry:item", "registry:base", "registry:font", "registry:example", "registry:internal"]>;
        target: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        path: string;
        type: "registry:lib" | "registry:block" | "registry:component" | "registry:ui" | "registry:hook" | "registry:theme" | "registry:style" | "registry:item" | "registry:base" | "registry:font" | "registry:example" | "registry:internal";
        content?: string | undefined;
        target?: string | undefined;
    }, {
        path: string;
        type: "registry:lib" | "registry:block" | "registry:component" | "registry:ui" | "registry:hook" | "registry:theme" | "registry:style" | "registry:item" | "registry:base" | "registry:font" | "registry:example" | "registry:internal";
        content?: string | undefined;
        target?: string | undefined;
    }>]>, "many">>;
    tailwind: z.ZodOptional<z.ZodObject<{
        config: z.ZodOptional<z.ZodObject<{
            content: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            theme: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
            plugins: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            content?: string[] | undefined;
            theme?: Record<string, any> | undefined;
            plugins?: string[] | undefined;
        }, {
            content?: string[] | undefined;
            theme?: Record<string, any> | undefined;
            plugins?: string[] | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        config?: {
            content?: string[] | undefined;
            theme?: Record<string, any> | undefined;
            plugins?: string[] | undefined;
        } | undefined;
    }, {
        config?: {
            content?: string[] | undefined;
            theme?: Record<string, any> | undefined;
            plugins?: string[] | undefined;
        } | undefined;
    }>>;
    cssVars: z.ZodOptional<z.ZodObject<{
        theme: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        light: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        dark: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        theme?: Record<string, string> | undefined;
        light?: Record<string, string> | undefined;
        dark?: Record<string, string> | undefined;
    }, {
        theme?: Record<string, string> | undefined;
        light?: Record<string, string> | undefined;
        dark?: Record<string, string> | undefined;
    }>>;
    css: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodType<any, z.ZodTypeDef, any>>>;
    envVars: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    meta: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    docs: z.ZodOptional<z.ZodString>;
    categories: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
} & {
    type: z.ZodEnum<["registry:lib", "registry:block", "registry:component", "registry:ui", "registry:hook", "registry:page", "registry:file", "registry:theme", "registry:style", "registry:item", "registry:example", "registry:internal"]>;
}, "strip", z.ZodTypeAny, {
    type: "registry:lib" | "registry:block" | "registry:component" | "registry:ui" | "registry:hook" | "registry:page" | "registry:file" | "registry:theme" | "registry:style" | "registry:item" | "registry:example" | "registry:internal";
    name: string;
    tailwind?: {
        config?: {
            content?: string[] | undefined;
            theme?: Record<string, any> | undefined;
            plugins?: string[] | undefined;
        } | undefined;
    } | undefined;
    $schema?: string | undefined;
    css?: Record<string, any> | undefined;
    extends?: string | undefined;
    title?: string | undefined;
    author?: string | undefined;
    description?: string | undefined;
    dependencies?: string[] | undefined;
    devDependencies?: string[] | undefined;
    registryDependencies?: string[] | undefined;
    files?: ({
        path: string;
        type: "registry:page" | "registry:file";
        target: string;
        content?: string | undefined;
    } | {
        path: string;
        type: "registry:lib" | "registry:block" | "registry:component" | "registry:ui" | "registry:hook" | "registry:theme" | "registry:style" | "registry:item" | "registry:base" | "registry:font" | "registry:example" | "registry:internal";
        content?: string | undefined;
        target?: string | undefined;
    })[] | undefined;
    cssVars?: {
        theme?: Record<string, string> | undefined;
        light?: Record<string, string> | undefined;
        dark?: Record<string, string> | undefined;
    } | undefined;
    envVars?: Record<string, string> | undefined;
    meta?: Record<string, any> | undefined;
    docs?: string | undefined;
    categories?: string[] | undefined;
}, {
    type: "registry:lib" | "registry:block" | "registry:component" | "registry:ui" | "registry:hook" | "registry:page" | "registry:file" | "registry:theme" | "registry:style" | "registry:item" | "registry:example" | "registry:internal";
    name: string;
    tailwind?: {
        config?: {
            content?: string[] | undefined;
            theme?: Record<string, any> | undefined;
            plugins?: string[] | undefined;
        } | undefined;
    } | undefined;
    $schema?: string | undefined;
    css?: Record<string, any> | undefined;
    extends?: string | undefined;
    title?: string | undefined;
    author?: string | undefined;
    description?: string | undefined;
    dependencies?: string[] | undefined;
    devDependencies?: string[] | undefined;
    registryDependencies?: string[] | undefined;
    files?: ({
        path: string;
        type: "registry:page" | "registry:file";
        target: string;
        content?: string | undefined;
    } | {
        path: string;
        type: "registry:lib" | "registry:block" | "registry:component" | "registry:ui" | "registry:hook" | "registry:theme" | "registry:style" | "registry:item" | "registry:base" | "registry:font" | "registry:example" | "registry:internal";
        content?: string | undefined;
        target?: string | undefined;
    })[] | undefined;
    cssVars?: {
        theme?: Record<string, string> | undefined;
        light?: Record<string, string> | undefined;
        dark?: Record<string, string> | undefined;
    } | undefined;
    envVars?: Record<string, string> | undefined;
    meta?: Record<string, any> | undefined;
    docs?: string | undefined;
    categories?: string[] | undefined;
}>]>;
type RegistryItem = z.infer<typeof registryItemSchema>;
type RegistryBaseItem = Extract<RegistryItem, {
    type: "registry:base";
}>;
type RegistryFontItem = Extract<RegistryItem, {
    type: "registry:font";
}>;
declare const registrySchema: z.ZodObject<{
    name: z.ZodString;
    homepage: z.ZodString;
    items: z.ZodArray<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
        $schema: z.ZodOptional<z.ZodString>;
        extends: z.ZodOptional<z.ZodString>;
        name: z.ZodString;
        title: z.ZodOptional<z.ZodString>;
        author: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodString>;
        dependencies: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        devDependencies: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        registryDependencies: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        files: z.ZodOptional<z.ZodArray<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
            path: z.ZodString;
            content: z.ZodOptional<z.ZodString>;
            type: z.ZodEnum<["registry:file", "registry:page"]>;
            target: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            path: string;
            type: "registry:page" | "registry:file";
            target: string;
            content?: string | undefined;
        }, {
            path: string;
            type: "registry:page" | "registry:file";
            target: string;
            content?: string | undefined;
        }>, z.ZodObject<{
            path: z.ZodString;
            content: z.ZodOptional<z.ZodString>;
            type: z.ZodEnum<["registry:lib", "registry:block", "registry:component", "registry:ui", "registry:hook", "registry:theme", "registry:style", "registry:item", "registry:base", "registry:font", "registry:example", "registry:internal"]>;
            target: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            path: string;
            type: "registry:lib" | "registry:block" | "registry:component" | "registry:ui" | "registry:hook" | "registry:theme" | "registry:style" | "registry:item" | "registry:base" | "registry:font" | "registry:example" | "registry:internal";
            content?: string | undefined;
            target?: string | undefined;
        }, {
            path: string;
            type: "registry:lib" | "registry:block" | "registry:component" | "registry:ui" | "registry:hook" | "registry:theme" | "registry:style" | "registry:item" | "registry:base" | "registry:font" | "registry:example" | "registry:internal";
            content?: string | undefined;
            target?: string | undefined;
        }>]>, "many">>;
        tailwind: z.ZodOptional<z.ZodObject<{
            config: z.ZodOptional<z.ZodObject<{
                content: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                theme: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
                plugins: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            }, "strip", z.ZodTypeAny, {
                content?: string[] | undefined;
                theme?: Record<string, any> | undefined;
                plugins?: string[] | undefined;
            }, {
                content?: string[] | undefined;
                theme?: Record<string, any> | undefined;
                plugins?: string[] | undefined;
            }>>;
        }, "strip", z.ZodTypeAny, {
            config?: {
                content?: string[] | undefined;
                theme?: Record<string, any> | undefined;
                plugins?: string[] | undefined;
            } | undefined;
        }, {
            config?: {
                content?: string[] | undefined;
                theme?: Record<string, any> | undefined;
                plugins?: string[] | undefined;
            } | undefined;
        }>>;
        cssVars: z.ZodOptional<z.ZodObject<{
            theme: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
            light: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
            dark: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            theme?: Record<string, string> | undefined;
            light?: Record<string, string> | undefined;
            dark?: Record<string, string> | undefined;
        }, {
            theme?: Record<string, string> | undefined;
            light?: Record<string, string> | undefined;
            dark?: Record<string, string> | undefined;
        }>>;
        css: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodType<any, z.ZodTypeDef, any>>>;
        envVars: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        meta: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        docs: z.ZodOptional<z.ZodString>;
        categories: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    } & {
        type: z.ZodLiteral<"registry:base">;
        config: z.ZodOptional<z.ZodObject<{
            $schema: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            style: z.ZodOptional<z.ZodString>;
            rsc: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
            tsx: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
            tailwind: z.ZodOptional<z.ZodObject<{
                config: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                css: z.ZodOptional<z.ZodString>;
                baseColor: z.ZodOptional<z.ZodString>;
                cssVariables: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
                prefix: z.ZodOptional<z.ZodOptional<z.ZodDefault<z.ZodString>>>;
            }, "strip", z.ZodTypeAny, {
                config?: string | undefined;
                css?: string | undefined;
                baseColor?: string | undefined;
                cssVariables?: boolean | undefined;
                prefix?: string | undefined;
            }, {
                config?: string | undefined;
                css?: string | undefined;
                baseColor?: string | undefined;
                cssVariables?: boolean | undefined;
                prefix?: string | undefined;
            }>>;
            iconLibrary: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            rtl: z.ZodOptional<z.ZodOptional<z.ZodDefault<z.ZodBoolean>>>;
            menuColor: z.ZodOptional<z.ZodOptional<z.ZodDefault<z.ZodEnum<["default", "inverted"]>>>>;
            menuAccent: z.ZodOptional<z.ZodOptional<z.ZodDefault<z.ZodEnum<["subtle", "bold"]>>>>;
            aliases: z.ZodOptional<z.ZodObject<{
                components: z.ZodOptional<z.ZodString>;
                utils: z.ZodOptional<z.ZodString>;
                ui: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                lib: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                hooks: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            }, "strip", z.ZodTypeAny, {
                components?: string | undefined;
                ui?: string | undefined;
                utils?: string | undefined;
                lib?: string | undefined;
                hooks?: string | undefined;
            }, {
                components?: string | undefined;
                ui?: string | undefined;
                utils?: string | undefined;
                lib?: string | undefined;
                hooks?: string | undefined;
            }>>;
            registries: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodEffects<z.ZodString, string, string>, z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodObject<{
                url: z.ZodEffects<z.ZodString, string, string>;
                params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
            }, "strip", z.ZodTypeAny, {
                url: string;
                params?: Record<string, string> | undefined;
                headers?: Record<string, string> | undefined;
            }, {
                url: string;
                params?: Record<string, string> | undefined;
                headers?: Record<string, string> | undefined;
            }>]>>>>;
        }, "strict", z.ZodTypeAny, {
            tailwind?: {
                config?: string | undefined;
                css?: string | undefined;
                baseColor?: string | undefined;
                cssVariables?: boolean | undefined;
                prefix?: string | undefined;
            } | undefined;
            $schema?: string | undefined;
            style?: string | undefined;
            rsc?: boolean | undefined;
            tsx?: boolean | undefined;
            iconLibrary?: string | undefined;
            rtl?: boolean | undefined;
            menuColor?: "default" | "inverted" | undefined;
            menuAccent?: "subtle" | "bold" | undefined;
            aliases?: {
                components?: string | undefined;
                ui?: string | undefined;
                utils?: string | undefined;
                lib?: string | undefined;
                hooks?: string | undefined;
            } | undefined;
            registries?: Record<string, string | {
                url: string;
                params?: Record<string, string> | undefined;
                headers?: Record<string, string> | undefined;
            }> | undefined;
        }, {
            tailwind?: {
                config?: string | undefined;
                css?: string | undefined;
                baseColor?: string | undefined;
                cssVariables?: boolean | undefined;
                prefix?: string | undefined;
            } | undefined;
            $schema?: string | undefined;
            style?: string | undefined;
            rsc?: boolean | undefined;
            tsx?: boolean | undefined;
            iconLibrary?: string | undefined;
            rtl?: boolean | undefined;
            menuColor?: "default" | "inverted" | undefined;
            menuAccent?: "subtle" | "bold" | undefined;
            aliases?: {
                components?: string | undefined;
                ui?: string | undefined;
                utils?: string | undefined;
                lib?: string | undefined;
                hooks?: string | undefined;
            } | undefined;
            registries?: Record<string, string | {
                url: string;
                params?: Record<string, string> | undefined;
                headers?: Record<string, string> | undefined;
            }> | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        type: "registry:base";
        name: string;
        tailwind?: {
            config?: {
                content?: string[] | undefined;
                theme?: Record<string, any> | undefined;
                plugins?: string[] | undefined;
            } | undefined;
        } | undefined;
        $schema?: string | undefined;
        config?: {
            tailwind?: {
                config?: string | undefined;
                css?: string | undefined;
                baseColor?: string | undefined;
                cssVariables?: boolean | undefined;
                prefix?: string | undefined;
            } | undefined;
            $schema?: string | undefined;
            style?: string | undefined;
            rsc?: boolean | undefined;
            tsx?: boolean | undefined;
            iconLibrary?: string | undefined;
            rtl?: boolean | undefined;
            menuColor?: "default" | "inverted" | undefined;
            menuAccent?: "subtle" | "bold" | undefined;
            aliases?: {
                components?: string | undefined;
                ui?: string | undefined;
                utils?: string | undefined;
                lib?: string | undefined;
                hooks?: string | undefined;
            } | undefined;
            registries?: Record<string, string | {
                url: string;
                params?: Record<string, string> | undefined;
                headers?: Record<string, string> | undefined;
            }> | undefined;
        } | undefined;
        css?: Record<string, any> | undefined;
        extends?: string | undefined;
        title?: string | undefined;
        author?: string | undefined;
        description?: string | undefined;
        dependencies?: string[] | undefined;
        devDependencies?: string[] | undefined;
        registryDependencies?: string[] | undefined;
        files?: ({
            path: string;
            type: "registry:page" | "registry:file";
            target: string;
            content?: string | undefined;
        } | {
            path: string;
            type: "registry:lib" | "registry:block" | "registry:component" | "registry:ui" | "registry:hook" | "registry:theme" | "registry:style" | "registry:item" | "registry:base" | "registry:font" | "registry:example" | "registry:internal";
            content?: string | undefined;
            target?: string | undefined;
        })[] | undefined;
        cssVars?: {
            theme?: Record<string, string> | undefined;
            light?: Record<string, string> | undefined;
            dark?: Record<string, string> | undefined;
        } | undefined;
        envVars?: Record<string, string> | undefined;
        meta?: Record<string, any> | undefined;
        docs?: string | undefined;
        categories?: string[] | undefined;
    }, {
        type: "registry:base";
        name: string;
        tailwind?: {
            config?: {
                content?: string[] | undefined;
                theme?: Record<string, any> | undefined;
                plugins?: string[] | undefined;
            } | undefined;
        } | undefined;
        $schema?: string | undefined;
        config?: {
            tailwind?: {
                config?: string | undefined;
                css?: string | undefined;
                baseColor?: string | undefined;
                cssVariables?: boolean | undefined;
                prefix?: string | undefined;
            } | undefined;
            $schema?: string | undefined;
            style?: string | undefined;
            rsc?: boolean | undefined;
            tsx?: boolean | undefined;
            iconLibrary?: string | undefined;
            rtl?: boolean | undefined;
            menuColor?: "default" | "inverted" | undefined;
            menuAccent?: "subtle" | "bold" | undefined;
            aliases?: {
                components?: string | undefined;
                ui?: string | undefined;
                utils?: string | undefined;
                lib?: string | undefined;
                hooks?: string | undefined;
            } | undefined;
            registries?: Record<string, string | {
                url: string;
                params?: Record<string, string> | undefined;
                headers?: Record<string, string> | undefined;
            }> | undefined;
        } | undefined;
        css?: Record<string, any> | undefined;
        extends?: string | undefined;
        title?: string | undefined;
        author?: string | undefined;
        description?: string | undefined;
        dependencies?: string[] | undefined;
        devDependencies?: string[] | undefined;
        registryDependencies?: string[] | undefined;
        files?: ({
            path: string;
            type: "registry:page" | "registry:file";
            target: string;
            content?: string | undefined;
        } | {
            path: string;
            type: "registry:lib" | "registry:block" | "registry:component" | "registry:ui" | "registry:hook" | "registry:theme" | "registry:style" | "registry:item" | "registry:base" | "registry:font" | "registry:example" | "registry:internal";
            content?: string | undefined;
            target?: string | undefined;
        })[] | undefined;
        cssVars?: {
            theme?: Record<string, string> | undefined;
            light?: Record<string, string> | undefined;
            dark?: Record<string, string> | undefined;
        } | undefined;
        envVars?: Record<string, string> | undefined;
        meta?: Record<string, any> | undefined;
        docs?: string | undefined;
        categories?: string[] | undefined;
    }>, z.ZodObject<{
        $schema: z.ZodOptional<z.ZodString>;
        extends: z.ZodOptional<z.ZodString>;
        name: z.ZodString;
        title: z.ZodOptional<z.ZodString>;
        author: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodString>;
        dependencies: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        devDependencies: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        registryDependencies: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        files: z.ZodOptional<z.ZodArray<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
            path: z.ZodString;
            content: z.ZodOptional<z.ZodString>;
            type: z.ZodEnum<["registry:file", "registry:page"]>;
            target: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            path: string;
            type: "registry:page" | "registry:file";
            target: string;
            content?: string | undefined;
        }, {
            path: string;
            type: "registry:page" | "registry:file";
            target: string;
            content?: string | undefined;
        }>, z.ZodObject<{
            path: z.ZodString;
            content: z.ZodOptional<z.ZodString>;
            type: z.ZodEnum<["registry:lib", "registry:block", "registry:component", "registry:ui", "registry:hook", "registry:theme", "registry:style", "registry:item", "registry:base", "registry:font", "registry:example", "registry:internal"]>;
            target: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            path: string;
            type: "registry:lib" | "registry:block" | "registry:component" | "registry:ui" | "registry:hook" | "registry:theme" | "registry:style" | "registry:item" | "registry:base" | "registry:font" | "registry:example" | "registry:internal";
            content?: string | undefined;
            target?: string | undefined;
        }, {
            path: string;
            type: "registry:lib" | "registry:block" | "registry:component" | "registry:ui" | "registry:hook" | "registry:theme" | "registry:style" | "registry:item" | "registry:base" | "registry:font" | "registry:example" | "registry:internal";
            content?: string | undefined;
            target?: string | undefined;
        }>]>, "many">>;
        tailwind: z.ZodOptional<z.ZodObject<{
            config: z.ZodOptional<z.ZodObject<{
                content: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                theme: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
                plugins: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            }, "strip", z.ZodTypeAny, {
                content?: string[] | undefined;
                theme?: Record<string, any> | undefined;
                plugins?: string[] | undefined;
            }, {
                content?: string[] | undefined;
                theme?: Record<string, any> | undefined;
                plugins?: string[] | undefined;
            }>>;
        }, "strip", z.ZodTypeAny, {
            config?: {
                content?: string[] | undefined;
                theme?: Record<string, any> | undefined;
                plugins?: string[] | undefined;
            } | undefined;
        }, {
            config?: {
                content?: string[] | undefined;
                theme?: Record<string, any> | undefined;
                plugins?: string[] | undefined;
            } | undefined;
        }>>;
        cssVars: z.ZodOptional<z.ZodObject<{
            theme: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
            light: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
            dark: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            theme?: Record<string, string> | undefined;
            light?: Record<string, string> | undefined;
            dark?: Record<string, string> | undefined;
        }, {
            theme?: Record<string, string> | undefined;
            light?: Record<string, string> | undefined;
            dark?: Record<string, string> | undefined;
        }>>;
        css: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodType<any, z.ZodTypeDef, any>>>;
        envVars: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        meta: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        docs: z.ZodOptional<z.ZodString>;
        categories: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    } & {
        type: z.ZodLiteral<"registry:font">;
        font: z.ZodObject<{
            family: z.ZodString;
            provider: z.ZodLiteral<"google">;
            import: z.ZodString;
            variable: z.ZodString;
            weight: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            subsets: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            family: string;
            provider: "google";
            import: string;
            variable: string;
            weight?: string[] | undefined;
            subsets?: string[] | undefined;
        }, {
            family: string;
            provider: "google";
            import: string;
            variable: string;
            weight?: string[] | undefined;
            subsets?: string[] | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        type: "registry:font";
        name: string;
        font: {
            family: string;
            provider: "google";
            import: string;
            variable: string;
            weight?: string[] | undefined;
            subsets?: string[] | undefined;
        };
        tailwind?: {
            config?: {
                content?: string[] | undefined;
                theme?: Record<string, any> | undefined;
                plugins?: string[] | undefined;
            } | undefined;
        } | undefined;
        $schema?: string | undefined;
        css?: Record<string, any> | undefined;
        extends?: string | undefined;
        title?: string | undefined;
        author?: string | undefined;
        description?: string | undefined;
        dependencies?: string[] | undefined;
        devDependencies?: string[] | undefined;
        registryDependencies?: string[] | undefined;
        files?: ({
            path: string;
            type: "registry:page" | "registry:file";
            target: string;
            content?: string | undefined;
        } | {
            path: string;
            type: "registry:lib" | "registry:block" | "registry:component" | "registry:ui" | "registry:hook" | "registry:theme" | "registry:style" | "registry:item" | "registry:base" | "registry:font" | "registry:example" | "registry:internal";
            content?: string | undefined;
            target?: string | undefined;
        })[] | undefined;
        cssVars?: {
            theme?: Record<string, string> | undefined;
            light?: Record<string, string> | undefined;
            dark?: Record<string, string> | undefined;
        } | undefined;
        envVars?: Record<string, string> | undefined;
        meta?: Record<string, any> | undefined;
        docs?: string | undefined;
        categories?: string[] | undefined;
    }, {
        type: "registry:font";
        name: string;
        font: {
            family: string;
            provider: "google";
            import: string;
            variable: string;
            weight?: string[] | undefined;
            subsets?: string[] | undefined;
        };
        tailwind?: {
            config?: {
                content?: string[] | undefined;
                theme?: Record<string, any> | undefined;
                plugins?: string[] | undefined;
            } | undefined;
        } | undefined;
        $schema?: string | undefined;
        css?: Record<string, any> | undefined;
        extends?: string | undefined;
        title?: string | undefined;
        author?: string | undefined;
        description?: string | undefined;
        dependencies?: string[] | undefined;
        devDependencies?: string[] | undefined;
        registryDependencies?: string[] | undefined;
        files?: ({
            path: string;
            type: "registry:page" | "registry:file";
            target: string;
            content?: string | undefined;
        } | {
            path: string;
            type: "registry:lib" | "registry:block" | "registry:component" | "registry:ui" | "registry:hook" | "registry:theme" | "registry:style" | "registry:item" | "registry:base" | "registry:font" | "registry:example" | "registry:internal";
            content?: string | undefined;
            target?: string | undefined;
        })[] | undefined;
        cssVars?: {
            theme?: Record<string, string> | undefined;
            light?: Record<string, string> | undefined;
            dark?: Record<string, string> | undefined;
        } | undefined;
        envVars?: Record<string, string> | undefined;
        meta?: Record<string, any> | undefined;
        docs?: string | undefined;
        categories?: string[] | undefined;
    }>, z.ZodObject<{
        $schema: z.ZodOptional<z.ZodString>;
        extends: z.ZodOptional<z.ZodString>;
        name: z.ZodString;
        title: z.ZodOptional<z.ZodString>;
        author: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodString>;
        dependencies: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        devDependencies: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        registryDependencies: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        files: z.ZodOptional<z.ZodArray<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
            path: z.ZodString;
            content: z.ZodOptional<z.ZodString>;
            type: z.ZodEnum<["registry:file", "registry:page"]>;
            target: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            path: string;
            type: "registry:page" | "registry:file";
            target: string;
            content?: string | undefined;
        }, {
            path: string;
            type: "registry:page" | "registry:file";
            target: string;
            content?: string | undefined;
        }>, z.ZodObject<{
            path: z.ZodString;
            content: z.ZodOptional<z.ZodString>;
            type: z.ZodEnum<["registry:lib", "registry:block", "registry:component", "registry:ui", "registry:hook", "registry:theme", "registry:style", "registry:item", "registry:base", "registry:font", "registry:example", "registry:internal"]>;
            target: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            path: string;
            type: "registry:lib" | "registry:block" | "registry:component" | "registry:ui" | "registry:hook" | "registry:theme" | "registry:style" | "registry:item" | "registry:base" | "registry:font" | "registry:example" | "registry:internal";
            content?: string | undefined;
            target?: string | undefined;
        }, {
            path: string;
            type: "registry:lib" | "registry:block" | "registry:component" | "registry:ui" | "registry:hook" | "registry:theme" | "registry:style" | "registry:item" | "registry:base" | "registry:font" | "registry:example" | "registry:internal";
            content?: string | undefined;
            target?: string | undefined;
        }>]>, "many">>;
        tailwind: z.ZodOptional<z.ZodObject<{
            config: z.ZodOptional<z.ZodObject<{
                content: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                theme: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
                plugins: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            }, "strip", z.ZodTypeAny, {
                content?: string[] | undefined;
                theme?: Record<string, any> | undefined;
                plugins?: string[] | undefined;
            }, {
                content?: string[] | undefined;
                theme?: Record<string, any> | undefined;
                plugins?: string[] | undefined;
            }>>;
        }, "strip", z.ZodTypeAny, {
            config?: {
                content?: string[] | undefined;
                theme?: Record<string, any> | undefined;
                plugins?: string[] | undefined;
            } | undefined;
        }, {
            config?: {
                content?: string[] | undefined;
                theme?: Record<string, any> | undefined;
                plugins?: string[] | undefined;
            } | undefined;
        }>>;
        cssVars: z.ZodOptional<z.ZodObject<{
            theme: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
            light: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
            dark: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            theme?: Record<string, string> | undefined;
            light?: Record<string, string> | undefined;
            dark?: Record<string, string> | undefined;
        }, {
            theme?: Record<string, string> | undefined;
            light?: Record<string, string> | undefined;
            dark?: Record<string, string> | undefined;
        }>>;
        css: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodType<any, z.ZodTypeDef, any>>>;
        envVars: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        meta: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        docs: z.ZodOptional<z.ZodString>;
        categories: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    } & {
        type: z.ZodEnum<["registry:lib", "registry:block", "registry:component", "registry:ui", "registry:hook", "registry:page", "registry:file", "registry:theme", "registry:style", "registry:item", "registry:example", "registry:internal"]>;
    }, "strip", z.ZodTypeAny, {
        type: "registry:lib" | "registry:block" | "registry:component" | "registry:ui" | "registry:hook" | "registry:page" | "registry:file" | "registry:theme" | "registry:style" | "registry:item" | "registry:example" | "registry:internal";
        name: string;
        tailwind?: {
            config?: {
                content?: string[] | undefined;
                theme?: Record<string, any> | undefined;
                plugins?: string[] | undefined;
            } | undefined;
        } | undefined;
        $schema?: string | undefined;
        css?: Record<string, any> | undefined;
        extends?: string | undefined;
        title?: string | undefined;
        author?: string | undefined;
        description?: string | undefined;
        dependencies?: string[] | undefined;
        devDependencies?: string[] | undefined;
        registryDependencies?: string[] | undefined;
        files?: ({
            path: string;
            type: "registry:page" | "registry:file";
            target: string;
            content?: string | undefined;
        } | {
            path: string;
            type: "registry:lib" | "registry:block" | "registry:component" | "registry:ui" | "registry:hook" | "registry:theme" | "registry:style" | "registry:item" | "registry:base" | "registry:font" | "registry:example" | "registry:internal";
            content?: string | undefined;
            target?: string | undefined;
        })[] | undefined;
        cssVars?: {
            theme?: Record<string, string> | undefined;
            light?: Record<string, string> | undefined;
            dark?: Record<string, string> | undefined;
        } | undefined;
        envVars?: Record<string, string> | undefined;
        meta?: Record<string, any> | undefined;
        docs?: string | undefined;
        categories?: string[] | undefined;
    }, {
        type: "registry:lib" | "registry:block" | "registry:component" | "registry:ui" | "registry:hook" | "registry:page" | "registry:file" | "registry:theme" | "registry:style" | "registry:item" | "registry:example" | "registry:internal";
        name: string;
        tailwind?: {
            config?: {
                content?: string[] | undefined;
                theme?: Record<string, any> | undefined;
                plugins?: string[] | undefined;
            } | undefined;
        } | undefined;
        $schema?: string | undefined;
        css?: Record<string, any> | undefined;
        extends?: string | undefined;
        title?: string | undefined;
        author?: string | undefined;
        description?: string | undefined;
        dependencies?: string[] | undefined;
        devDependencies?: string[] | undefined;
        registryDependencies?: string[] | undefined;
        files?: ({
            path: string;
            type: "registry:page" | "registry:file";
            target: string;
            content?: string | undefined;
        } | {
            path: string;
            type: "registry:lib" | "registry:block" | "registry:component" | "registry:ui" | "registry:hook" | "registry:theme" | "registry:style" | "registry:item" | "registry:base" | "registry:font" | "registry:example" | "registry:internal";
            content?: string | undefined;
            target?: string | undefined;
        })[] | undefined;
        cssVars?: {
            theme?: Record<string, string> | undefined;
            light?: Record<string, string> | undefined;
            dark?: Record<string, string> | undefined;
        } | undefined;
        envVars?: Record<string, string> | undefined;
        meta?: Record<string, any> | undefined;
        docs?: string | undefined;
        categories?: string[] | undefined;
    }>]>, "many">;
}, "strip", z.ZodTypeAny, {
    name: string;
    homepage: string;
    items: ({
        type: "registry:base";
        name: string;
        tailwind?: {
            config?: {
                content?: string[] | undefined;
                theme?: Record<string, any> | undefined;
                plugins?: string[] | undefined;
            } | undefined;
        } | undefined;
        $schema?: string | undefined;
        config?: {
            tailwind?: {
                config?: string | undefined;
                css?: string | undefined;
                baseColor?: string | undefined;
                cssVariables?: boolean | undefined;
                prefix?: string | undefined;
            } | undefined;
            $schema?: string | undefined;
            style?: string | undefined;
            rsc?: boolean | undefined;
            tsx?: boolean | undefined;
            iconLibrary?: string | undefined;
            rtl?: boolean | undefined;
            menuColor?: "default" | "inverted" | undefined;
            menuAccent?: "subtle" | "bold" | undefined;
            aliases?: {
                components?: string | undefined;
                ui?: string | undefined;
                utils?: string | undefined;
                lib?: string | undefined;
                hooks?: string | undefined;
            } | undefined;
            registries?: Record<string, string | {
                url: string;
                params?: Record<string, string> | undefined;
                headers?: Record<string, string> | undefined;
            }> | undefined;
        } | undefined;
        css?: Record<string, any> | undefined;
        extends?: string | undefined;
        title?: string | undefined;
        author?: string | undefined;
        description?: string | undefined;
        dependencies?: string[] | undefined;
        devDependencies?: string[] | undefined;
        registryDependencies?: string[] | undefined;
        files?: ({
            path: string;
            type: "registry:page" | "registry:file";
            target: string;
            content?: string | undefined;
        } | {
            path: string;
            type: "registry:lib" | "registry:block" | "registry:component" | "registry:ui" | "registry:hook" | "registry:theme" | "registry:style" | "registry:item" | "registry:base" | "registry:font" | "registry:example" | "registry:internal";
            content?: string | undefined;
            target?: string | undefined;
        })[] | undefined;
        cssVars?: {
            theme?: Record<string, string> | undefined;
            light?: Record<string, string> | undefined;
            dark?: Record<string, string> | undefined;
        } | undefined;
        envVars?: Record<string, string> | undefined;
        meta?: Record<string, any> | undefined;
        docs?: string | undefined;
        categories?: string[] | undefined;
    } | {
        type: "registry:font";
        name: string;
        font: {
            family: string;
            provider: "google";
            import: string;
            variable: string;
            weight?: string[] | undefined;
            subsets?: string[] | undefined;
        };
        tailwind?: {
            config?: {
                content?: string[] | undefined;
                theme?: Record<string, any> | undefined;
                plugins?: string[] | undefined;
            } | undefined;
        } | undefined;
        $schema?: string | undefined;
        css?: Record<string, any> | undefined;
        extends?: string | undefined;
        title?: string | undefined;
        author?: string | undefined;
        description?: string | undefined;
        dependencies?: string[] | undefined;
        devDependencies?: string[] | undefined;
        registryDependencies?: string[] | undefined;
        files?: ({
            path: string;
            type: "registry:page" | "registry:file";
            target: string;
            content?: string | undefined;
        } | {
            path: string;
            type: "registry:lib" | "registry:block" | "registry:component" | "registry:ui" | "registry:hook" | "registry:theme" | "registry:style" | "registry:item" | "registry:base" | "registry:font" | "registry:example" | "registry:internal";
            content?: string | undefined;
            target?: string | undefined;
        })[] | undefined;
        cssVars?: {
            theme?: Record<string, string> | undefined;
            light?: Record<string, string> | undefined;
            dark?: Record<string, string> | undefined;
        } | undefined;
        envVars?: Record<string, string> | undefined;
        meta?: Record<string, any> | undefined;
        docs?: string | undefined;
        categories?: string[] | undefined;
    } | {
        type: "registry:lib" | "registry:block" | "registry:component" | "registry:ui" | "registry:hook" | "registry:page" | "registry:file" | "registry:theme" | "registry:style" | "registry:item" | "registry:example" | "registry:internal";
        name: string;
        tailwind?: {
            config?: {
                content?: string[] | undefined;
                theme?: Record<string, any> | undefined;
                plugins?: string[] | undefined;
            } | undefined;
        } | undefined;
        $schema?: string | undefined;
        css?: Record<string, any> | undefined;
        extends?: string | undefined;
        title?: string | undefined;
        author?: string | undefined;
        description?: string | undefined;
        dependencies?: string[] | undefined;
        devDependencies?: string[] | undefined;
        registryDependencies?: string[] | undefined;
        files?: ({
            path: string;
            type: "registry:page" | "registry:file";
            target: string;
            content?: string | undefined;
        } | {
            path: string;
            type: "registry:lib" | "registry:block" | "registry:component" | "registry:ui" | "registry:hook" | "registry:theme" | "registry:style" | "registry:item" | "registry:base" | "registry:font" | "registry:example" | "registry:internal";
            content?: string | undefined;
            target?: string | undefined;
        })[] | undefined;
        cssVars?: {
            theme?: Record<string, string> | undefined;
            light?: Record<string, string> | undefined;
            dark?: Record<string, string> | undefined;
        } | undefined;
        envVars?: Record<string, string> | undefined;
        meta?: Record<string, any> | undefined;
        docs?: string | undefined;
        categories?: string[] | undefined;
    })[];
}, {
    name: string;
    homepage: string;
    items: ({
        type: "registry:base";
        name: string;
        tailwind?: {
            config?: {
                content?: string[] | undefined;
                theme?: Record<string, any> | undefined;
                plugins?: string[] | undefined;
            } | undefined;
        } | undefined;
        $schema?: string | undefined;
        config?: {
            tailwind?: {
                config?: string | undefined;
                css?: string | undefined;
                baseColor?: string | undefined;
                cssVariables?: boolean | undefined;
                prefix?: string | undefined;
            } | undefined;
            $schema?: string | undefined;
            style?: string | undefined;
            rsc?: boolean | undefined;
            tsx?: boolean | undefined;
            iconLibrary?: string | undefined;
            rtl?: boolean | undefined;
            menuColor?: "default" | "inverted" | undefined;
            menuAccent?: "subtle" | "bold" | undefined;
            aliases?: {
                components?: string | undefined;
                ui?: string | undefined;
                utils?: string | undefined;
                lib?: string | undefined;
                hooks?: string | undefined;
            } | undefined;
            registries?: Record<string, string | {
                url: string;
                params?: Record<string, string> | undefined;
                headers?: Record<string, string> | undefined;
            }> | undefined;
        } | undefined;
        css?: Record<string, any> | undefined;
        extends?: string | undefined;
        title?: string | undefined;
        author?: string | undefined;
        description?: string | undefined;
        dependencies?: string[] | undefined;
        devDependencies?: string[] | undefined;
        registryDependencies?: string[] | undefined;
        files?: ({
            path: string;
            type: "registry:page" | "registry:file";
            target: string;
            content?: string | undefined;
        } | {
            path: string;
            type: "registry:lib" | "registry:block" | "registry:component" | "registry:ui" | "registry:hook" | "registry:theme" | "registry:style" | "registry:item" | "registry:base" | "registry:font" | "registry:example" | "registry:internal";
            content?: string | undefined;
            target?: string | undefined;
        })[] | undefined;
        cssVars?: {
            theme?: Record<string, string> | undefined;
            light?: Record<string, string> | undefined;
            dark?: Record<string, string> | undefined;
        } | undefined;
        envVars?: Record<string, string> | undefined;
        meta?: Record<string, any> | undefined;
        docs?: string | undefined;
        categories?: string[] | undefined;
    } | {
        type: "registry:font";
        name: string;
        font: {
            family: string;
            provider: "google";
            import: string;
            variable: string;
            weight?: string[] | undefined;
            subsets?: string[] | undefined;
        };
        tailwind?: {
            config?: {
                content?: string[] | undefined;
                theme?: Record<string, any> | undefined;
                plugins?: string[] | undefined;
            } | undefined;
        } | undefined;
        $schema?: string | undefined;
        css?: Record<string, any> | undefined;
        extends?: string | undefined;
        title?: string | undefined;
        author?: string | undefined;
        description?: string | undefined;
        dependencies?: string[] | undefined;
        devDependencies?: string[] | undefined;
        registryDependencies?: string[] | undefined;
        files?: ({
            path: string;
            type: "registry:page" | "registry:file";
            target: string;
            content?: string | undefined;
        } | {
            path: string;
            type: "registry:lib" | "registry:block" | "registry:component" | "registry:ui" | "registry:hook" | "registry:theme" | "registry:style" | "registry:item" | "registry:base" | "registry:font" | "registry:example" | "registry:internal";
            content?: string | undefined;
            target?: string | undefined;
        })[] | undefined;
        cssVars?: {
            theme?: Record<string, string> | undefined;
            light?: Record<string, string> | undefined;
            dark?: Record<string, string> | undefined;
        } | undefined;
        envVars?: Record<string, string> | undefined;
        meta?: Record<string, any> | undefined;
        docs?: string | undefined;
        categories?: string[] | undefined;
    } | {
        type: "registry:lib" | "registry:block" | "registry:component" | "registry:ui" | "registry:hook" | "registry:page" | "registry:file" | "registry:theme" | "registry:style" | "registry:item" | "registry:example" | "registry:internal";
        name: string;
        tailwind?: {
            config?: {
                content?: string[] | undefined;
                theme?: Record<string, any> | undefined;
                plugins?: string[] | undefined;
            } | undefined;
        } | undefined;
        $schema?: string | undefined;
        css?: Record<string, any> | undefined;
        extends?: string | undefined;
        title?: string | undefined;
        author?: string | undefined;
        description?: string | undefined;
        dependencies?: string[] | undefined;
        devDependencies?: string[] | undefined;
        registryDependencies?: string[] | undefined;
        files?: ({
            path: string;
            type: "registry:page" | "registry:file";
            target: string;
            content?: string | undefined;
        } | {
            path: string;
            type: "registry:lib" | "registry:block" | "registry:component" | "registry:ui" | "registry:hook" | "registry:theme" | "registry:style" | "registry:item" | "registry:base" | "registry:font" | "registry:example" | "registry:internal";
            content?: string | undefined;
            target?: string | undefined;
        })[] | undefined;
        cssVars?: {
            theme?: Record<string, string> | undefined;
            light?: Record<string, string> | undefined;
            dark?: Record<string, string> | undefined;
        } | undefined;
        envVars?: Record<string, string> | undefined;
        meta?: Record<string, any> | undefined;
        docs?: string | undefined;
        categories?: string[] | undefined;
    })[];
}>;
type Registry = z.infer<typeof registrySchema>;
declare const registryIndexSchema: z.ZodArray<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
    $schema: z.ZodOptional<z.ZodString>;
    extends: z.ZodOptional<z.ZodString>;
    name: z.ZodString;
    title: z.ZodOptional<z.ZodString>;
    author: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    dependencies: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    devDependencies: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    registryDependencies: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    files: z.ZodOptional<z.ZodArray<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
        path: z.ZodString;
        content: z.ZodOptional<z.ZodString>;
        type: z.ZodEnum<["registry:file", "registry:page"]>;
        target: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        path: string;
        type: "registry:page" | "registry:file";
        target: string;
        content?: string | undefined;
    }, {
        path: string;
        type: "registry:page" | "registry:file";
        target: string;
        content?: string | undefined;
    }>, z.ZodObject<{
        path: z.ZodString;
        content: z.ZodOptional<z.ZodString>;
        type: z.ZodEnum<["registry:lib", "registry:block", "registry:component", "registry:ui", "registry:hook", "registry:theme", "registry:style", "registry:item", "registry:base", "registry:font", "registry:example", "registry:internal"]>;
        target: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        path: string;
        type: "registry:lib" | "registry:block" | "registry:component" | "registry:ui" | "registry:hook" | "registry:theme" | "registry:style" | "registry:item" | "registry:base" | "registry:font" | "registry:example" | "registry:internal";
        content?: string | undefined;
        target?: string | undefined;
    }, {
        path: string;
        type: "registry:lib" | "registry:block" | "registry:component" | "registry:ui" | "registry:hook" | "registry:theme" | "registry:style" | "registry:item" | "registry:base" | "registry:font" | "registry:example" | "registry:internal";
        content?: string | undefined;
        target?: string | undefined;
    }>]>, "many">>;
    tailwind: z.ZodOptional<z.ZodObject<{
        config: z.ZodOptional<z.ZodObject<{
            content: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            theme: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
            plugins: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            content?: string[] | undefined;
            theme?: Record<string, any> | undefined;
            plugins?: string[] | undefined;
        }, {
            content?: string[] | undefined;
            theme?: Record<string, any> | undefined;
            plugins?: string[] | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        config?: {
            content?: string[] | undefined;
            theme?: Record<string, any> | undefined;
            plugins?: string[] | undefined;
        } | undefined;
    }, {
        config?: {
            content?: string[] | undefined;
            theme?: Record<string, any> | undefined;
            plugins?: string[] | undefined;
        } | undefined;
    }>>;
    cssVars: z.ZodOptional<z.ZodObject<{
        theme: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        light: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        dark: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        theme?: Record<string, string> | undefined;
        light?: Record<string, string> | undefined;
        dark?: Record<string, string> | undefined;
    }, {
        theme?: Record<string, string> | undefined;
        light?: Record<string, string> | undefined;
        dark?: Record<string, string> | undefined;
    }>>;
    css: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodType<any, z.ZodTypeDef, any>>>;
    envVars: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    meta: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    docs: z.ZodOptional<z.ZodString>;
    categories: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
} & {
    type: z.ZodLiteral<"registry:base">;
    config: z.ZodOptional<z.ZodObject<{
        $schema: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        style: z.ZodOptional<z.ZodString>;
        rsc: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
        tsx: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
        tailwind: z.ZodOptional<z.ZodObject<{
            config: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            css: z.ZodOptional<z.ZodString>;
            baseColor: z.ZodOptional<z.ZodString>;
            cssVariables: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
            prefix: z.ZodOptional<z.ZodOptional<z.ZodDefault<z.ZodString>>>;
        }, "strip", z.ZodTypeAny, {
            config?: string | undefined;
            css?: string | undefined;
            baseColor?: string | undefined;
            cssVariables?: boolean | undefined;
            prefix?: string | undefined;
        }, {
            config?: string | undefined;
            css?: string | undefined;
            baseColor?: string | undefined;
            cssVariables?: boolean | undefined;
            prefix?: string | undefined;
        }>>;
        iconLibrary: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        rtl: z.ZodOptional<z.ZodOptional<z.ZodDefault<z.ZodBoolean>>>;
        menuColor: z.ZodOptional<z.ZodOptional<z.ZodDefault<z.ZodEnum<["default", "inverted"]>>>>;
        menuAccent: z.ZodOptional<z.ZodOptional<z.ZodDefault<z.ZodEnum<["subtle", "bold"]>>>>;
        aliases: z.ZodOptional<z.ZodObject<{
            components: z.ZodOptional<z.ZodString>;
            utils: z.ZodOptional<z.ZodString>;
            ui: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            lib: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            hooks: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            components?: string | undefined;
            ui?: string | undefined;
            utils?: string | undefined;
            lib?: string | undefined;
            hooks?: string | undefined;
        }, {
            components?: string | undefined;
            ui?: string | undefined;
            utils?: string | undefined;
            lib?: string | undefined;
            hooks?: string | undefined;
        }>>;
        registries: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodEffects<z.ZodString, string, string>, z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodObject<{
            url: z.ZodEffects<z.ZodString, string, string>;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
            headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            url: string;
            params?: Record<string, string> | undefined;
            headers?: Record<string, string> | undefined;
        }, {
            url: string;
            params?: Record<string, string> | undefined;
            headers?: Record<string, string> | undefined;
        }>]>>>>;
    }, "strict", z.ZodTypeAny, {
        tailwind?: {
            config?: string | undefined;
            css?: string | undefined;
            baseColor?: string | undefined;
            cssVariables?: boolean | undefined;
            prefix?: string | undefined;
        } | undefined;
        $schema?: string | undefined;
        style?: string | undefined;
        rsc?: boolean | undefined;
        tsx?: boolean | undefined;
        iconLibrary?: string | undefined;
        rtl?: boolean | undefined;
        menuColor?: "default" | "inverted" | undefined;
        menuAccent?: "subtle" | "bold" | undefined;
        aliases?: {
            components?: string | undefined;
            ui?: string | undefined;
            utils?: string | undefined;
            lib?: string | undefined;
            hooks?: string | undefined;
        } | undefined;
        registries?: Record<string, string | {
            url: string;
            params?: Record<string, string> | undefined;
            headers?: Record<string, string> | undefined;
        }> | undefined;
    }, {
        tailwind?: {
            config?: string | undefined;
            css?: string | undefined;
            baseColor?: string | undefined;
            cssVariables?: boolean | undefined;
            prefix?: string | undefined;
        } | undefined;
        $schema?: string | undefined;
        style?: string | undefined;
        rsc?: boolean | undefined;
        tsx?: boolean | undefined;
        iconLibrary?: string | undefined;
        rtl?: boolean | undefined;
        menuColor?: "default" | "inverted" | undefined;
        menuAccent?: "subtle" | "bold" | undefined;
        aliases?: {
            components?: string | undefined;
            ui?: string | undefined;
            utils?: string | undefined;
            lib?: string | undefined;
            hooks?: string | undefined;
        } | undefined;
        registries?: Record<string, string | {
            url: string;
            params?: Record<string, string> | undefined;
            headers?: Record<string, string> | undefined;
        }> | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    type: "registry:base";
    name: string;
    tailwind?: {
        config?: {
            content?: string[] | undefined;
            theme?: Record<string, any> | undefined;
            plugins?: string[] | undefined;
        } | undefined;
    } | undefined;
    $schema?: string | undefined;
    config?: {
        tailwind?: {
            config?: string | undefined;
            css?: string | undefined;
            baseColor?: string | undefined;
            cssVariables?: boolean | undefined;
            prefix?: string | undefined;
        } | undefined;
        $schema?: string | undefined;
        style?: string | undefined;
        rsc?: boolean | undefined;
        tsx?: boolean | undefined;
        iconLibrary?: string | undefined;
        rtl?: boolean | undefined;
        menuColor?: "default" | "inverted" | undefined;
        menuAccent?: "subtle" | "bold" | undefined;
        aliases?: {
            components?: string | undefined;
            ui?: string | undefined;
            utils?: string | undefined;
            lib?: string | undefined;
            hooks?: string | undefined;
        } | undefined;
        registries?: Record<string, string | {
            url: string;
            params?: Record<string, string> | undefined;
            headers?: Record<string, string> | undefined;
        }> | undefined;
    } | undefined;
    css?: Record<string, any> | undefined;
    extends?: string | undefined;
    title?: string | undefined;
    author?: string | undefined;
    description?: string | undefined;
    dependencies?: string[] | undefined;
    devDependencies?: string[] | undefined;
    registryDependencies?: string[] | undefined;
    files?: ({
        path: string;
        type: "registry:page" | "registry:file";
        target: string;
        content?: string | undefined;
    } | {
        path: string;
        type: "registry:lib" | "registry:block" | "registry:component" | "registry:ui" | "registry:hook" | "registry:theme" | "registry:style" | "registry:item" | "registry:base" | "registry:font" | "registry:example" | "registry:internal";
        content?: string | undefined;
        target?: string | undefined;
    })[] | undefined;
    cssVars?: {
        theme?: Record<string, string> | undefined;
        light?: Record<string, string> | undefined;
        dark?: Record<string, string> | undefined;
    } | undefined;
    envVars?: Record<string, string> | undefined;
    meta?: Record<string, any> | undefined;
    docs?: string | undefined;
    categories?: string[] | undefined;
}, {
    type: "registry:base";
    name: string;
    tailwind?: {
        config?: {
            content?: string[] | undefined;
            theme?: Record<string, any> | undefined;
            plugins?: string[] | undefined;
        } | undefined;
    } | undefined;
    $schema?: string | undefined;
    config?: {
        tailwind?: {
            config?: string | undefined;
            css?: string | undefined;
            baseColor?: string | undefined;
            cssVariables?: boolean | undefined;
            prefix?: string | undefined;
        } | undefined;
        $schema?: string | undefined;
        style?: string | undefined;
        rsc?: boolean | undefined;
        tsx?: boolean | undefined;
        iconLibrary?: string | undefined;
        rtl?: boolean | undefined;
        menuColor?: "default" | "inverted" | undefined;
        menuAccent?: "subtle" | "bold" | undefined;
        aliases?: {
            components?: string | undefined;
            ui?: string | undefined;
            utils?: string | undefined;
            lib?: string | undefined;
            hooks?: string | undefined;
        } | undefined;
        registries?: Record<string, string | {
            url: string;
            params?: Record<string, string> | undefined;
            headers?: Record<string, string> | undefined;
        }> | undefined;
    } | undefined;
    css?: Record<string, any> | undefined;
    extends?: string | undefined;
    title?: string | undefined;
    author?: string | undefined;
    description?: string | undefined;
    dependencies?: string[] | undefined;
    devDependencies?: string[] | undefined;
    registryDependencies?: string[] | undefined;
    files?: ({
        path: string;
        type: "registry:page" | "registry:file";
        target: string;
        content?: string | undefined;
    } | {
        path: string;
        type: "registry:lib" | "registry:block" | "registry:component" | "registry:ui" | "registry:hook" | "registry:theme" | "registry:style" | "registry:item" | "registry:base" | "registry:font" | "registry:example" | "registry:internal";
        content?: string | undefined;
        target?: string | undefined;
    })[] | undefined;
    cssVars?: {
        theme?: Record<string, string> | undefined;
        light?: Record<string, string> | undefined;
        dark?: Record<string, string> | undefined;
    } | undefined;
    envVars?: Record<string, string> | undefined;
    meta?: Record<string, any> | undefined;
    docs?: string | undefined;
    categories?: string[] | undefined;
}>, z.ZodObject<{
    $schema: z.ZodOptional<z.ZodString>;
    extends: z.ZodOptional<z.ZodString>;
    name: z.ZodString;
    title: z.ZodOptional<z.ZodString>;
    author: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    dependencies: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    devDependencies: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    registryDependencies: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    files: z.ZodOptional<z.ZodArray<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
        path: z.ZodString;
        content: z.ZodOptional<z.ZodString>;
        type: z.ZodEnum<["registry:file", "registry:page"]>;
        target: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        path: string;
        type: "registry:page" | "registry:file";
        target: string;
        content?: string | undefined;
    }, {
        path: string;
        type: "registry:page" | "registry:file";
        target: string;
        content?: string | undefined;
    }>, z.ZodObject<{
        path: z.ZodString;
        content: z.ZodOptional<z.ZodString>;
        type: z.ZodEnum<["registry:lib", "registry:block", "registry:component", "registry:ui", "registry:hook", "registry:theme", "registry:style", "registry:item", "registry:base", "registry:font", "registry:example", "registry:internal"]>;
        target: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        path: string;
        type: "registry:lib" | "registry:block" | "registry:component" | "registry:ui" | "registry:hook" | "registry:theme" | "registry:style" | "registry:item" | "registry:base" | "registry:font" | "registry:example" | "registry:internal";
        content?: string | undefined;
        target?: string | undefined;
    }, {
        path: string;
        type: "registry:lib" | "registry:block" | "registry:component" | "registry:ui" | "registry:hook" | "registry:theme" | "registry:style" | "registry:item" | "registry:base" | "registry:font" | "registry:example" | "registry:internal";
        content?: string | undefined;
        target?: string | undefined;
    }>]>, "many">>;
    tailwind: z.ZodOptional<z.ZodObject<{
        config: z.ZodOptional<z.ZodObject<{
            content: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            theme: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
            plugins: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            content?: string[] | undefined;
            theme?: Record<string, any> | undefined;
            plugins?: string[] | undefined;
        }, {
            content?: string[] | undefined;
            theme?: Record<string, any> | undefined;
            plugins?: string[] | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        config?: {
            content?: string[] | undefined;
            theme?: Record<string, any> | undefined;
            plugins?: string[] | undefined;
        } | undefined;
    }, {
        config?: {
            content?: string[] | undefined;
            theme?: Record<string, any> | undefined;
            plugins?: string[] | undefined;
        } | undefined;
    }>>;
    cssVars: z.ZodOptional<z.ZodObject<{
        theme: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        light: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        dark: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        theme?: Record<string, string> | undefined;
        light?: Record<string, string> | undefined;
        dark?: Record<string, string> | undefined;
    }, {
        theme?: Record<string, string> | undefined;
        light?: Record<string, string> | undefined;
        dark?: Record<string, string> | undefined;
    }>>;
    css: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodType<any, z.ZodTypeDef, any>>>;
    envVars: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    meta: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    docs: z.ZodOptional<z.ZodString>;
    categories: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
} & {
    type: z.ZodLiteral<"registry:font">;
    font: z.ZodObject<{
        family: z.ZodString;
        provider: z.ZodLiteral<"google">;
        import: z.ZodString;
        variable: z.ZodString;
        weight: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        subsets: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        family: string;
        provider: "google";
        import: string;
        variable: string;
        weight?: string[] | undefined;
        subsets?: string[] | undefined;
    }, {
        family: string;
        provider: "google";
        import: string;
        variable: string;
        weight?: string[] | undefined;
        subsets?: string[] | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    type: "registry:font";
    name: string;
    font: {
        family: string;
        provider: "google";
        import: string;
        variable: string;
        weight?: string[] | undefined;
        subsets?: string[] | undefined;
    };
    tailwind?: {
        config?: {
            content?: string[] | undefined;
            theme?: Record<string, any> | undefined;
            plugins?: string[] | undefined;
        } | undefined;
    } | undefined;
    $schema?: string | undefined;
    css?: Record<string, any> | undefined;
    extends?: string | undefined;
    title?: string | undefined;
    author?: string | undefined;
    description?: string | undefined;
    dependencies?: string[] | undefined;
    devDependencies?: string[] | undefined;
    registryDependencies?: string[] | undefined;
    files?: ({
        path: string;
        type: "registry:page" | "registry:file";
        target: string;
        content?: string | undefined;
    } | {
        path: string;
        type: "registry:lib" | "registry:block" | "registry:component" | "registry:ui" | "registry:hook" | "registry:theme" | "registry:style" | "registry:item" | "registry:base" | "registry:font" | "registry:example" | "registry:internal";
        content?: string | undefined;
        target?: string | undefined;
    })[] | undefined;
    cssVars?: {
        theme?: Record<string, string> | undefined;
        light?: Record<string, string> | undefined;
        dark?: Record<string, string> | undefined;
    } | undefined;
    envVars?: Record<string, string> | undefined;
    meta?: Record<string, any> | undefined;
    docs?: string | undefined;
    categories?: string[] | undefined;
}, {
    type: "registry:font";
    name: string;
    font: {
        family: string;
        provider: "google";
        import: string;
        variable: string;
        weight?: string[] | undefined;
        subsets?: string[] | undefined;
    };
    tailwind?: {
        config?: {
            content?: string[] | undefined;
            theme?: Record<string, any> | undefined;
            plugins?: string[] | undefined;
        } | undefined;
    } | undefined;
    $schema?: string | undefined;
    css?: Record<string, any> | undefined;
    extends?: string | undefined;
    title?: string | undefined;
    author?: string | undefined;
    description?: string | undefined;
    dependencies?: string[] | undefined;
    devDependencies?: string[] | undefined;
    registryDependencies?: string[] | undefined;
    files?: ({
        path: string;
        type: "registry:page" | "registry:file";
        target: string;
        content?: string | undefined;
    } | {
        path: string;
        type: "registry:lib" | "registry:block" | "registry:component" | "registry:ui" | "registry:hook" | "registry:theme" | "registry:style" | "registry:item" | "registry:base" | "registry:font" | "registry:example" | "registry:internal";
        content?: string | undefined;
        target?: string | undefined;
    })[] | undefined;
    cssVars?: {
        theme?: Record<string, string> | undefined;
        light?: Record<string, string> | undefined;
        dark?: Record<string, string> | undefined;
    } | undefined;
    envVars?: Record<string, string> | undefined;
    meta?: Record<string, any> | undefined;
    docs?: string | undefined;
    categories?: string[] | undefined;
}>, z.ZodObject<{
    $schema: z.ZodOptional<z.ZodString>;
    extends: z.ZodOptional<z.ZodString>;
    name: z.ZodString;
    title: z.ZodOptional<z.ZodString>;
    author: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    dependencies: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    devDependencies: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    registryDependencies: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    files: z.ZodOptional<z.ZodArray<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
        path: z.ZodString;
        content: z.ZodOptional<z.ZodString>;
        type: z.ZodEnum<["registry:file", "registry:page"]>;
        target: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        path: string;
        type: "registry:page" | "registry:file";
        target: string;
        content?: string | undefined;
    }, {
        path: string;
        type: "registry:page" | "registry:file";
        target: string;
        content?: string | undefined;
    }>, z.ZodObject<{
        path: z.ZodString;
        content: z.ZodOptional<z.ZodString>;
        type: z.ZodEnum<["registry:lib", "registry:block", "registry:component", "registry:ui", "registry:hook", "registry:theme", "registry:style", "registry:item", "registry:base", "registry:font", "registry:example", "registry:internal"]>;
        target: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        path: string;
        type: "registry:lib" | "registry:block" | "registry:component" | "registry:ui" | "registry:hook" | "registry:theme" | "registry:style" | "registry:item" | "registry:base" | "registry:font" | "registry:example" | "registry:internal";
        content?: string | undefined;
        target?: string | undefined;
    }, {
        path: string;
        type: "registry:lib" | "registry:block" | "registry:component" | "registry:ui" | "registry:hook" | "registry:theme" | "registry:style" | "registry:item" | "registry:base" | "registry:font" | "registry:example" | "registry:internal";
        content?: string | undefined;
        target?: string | undefined;
    }>]>, "many">>;
    tailwind: z.ZodOptional<z.ZodObject<{
        config: z.ZodOptional<z.ZodObject<{
            content: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            theme: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
            plugins: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            content?: string[] | undefined;
            theme?: Record<string, any> | undefined;
            plugins?: string[] | undefined;
        }, {
            content?: string[] | undefined;
            theme?: Record<string, any> | undefined;
            plugins?: string[] | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        config?: {
            content?: string[] | undefined;
            theme?: Record<string, any> | undefined;
            plugins?: string[] | undefined;
        } | undefined;
    }, {
        config?: {
            content?: string[] | undefined;
            theme?: Record<string, any> | undefined;
            plugins?: string[] | undefined;
        } | undefined;
    }>>;
    cssVars: z.ZodOptional<z.ZodObject<{
        theme: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        light: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        dark: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        theme?: Record<string, string> | undefined;
        light?: Record<string, string> | undefined;
        dark?: Record<string, string> | undefined;
    }, {
        theme?: Record<string, string> | undefined;
        light?: Record<string, string> | undefined;
        dark?: Record<string, string> | undefined;
    }>>;
    css: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodType<any, z.ZodTypeDef, any>>>;
    envVars: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    meta: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    docs: z.ZodOptional<z.ZodString>;
    categories: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
} & {
    type: z.ZodEnum<["registry:lib", "registry:block", "registry:component", "registry:ui", "registry:hook", "registry:page", "registry:file", "registry:theme", "registry:style", "registry:item", "registry:example", "registry:internal"]>;
}, "strip", z.ZodTypeAny, {
    type: "registry:lib" | "registry:block" | "registry:component" | "registry:ui" | "registry:hook" | "registry:page" | "registry:file" | "registry:theme" | "registry:style" | "registry:item" | "registry:example" | "registry:internal";
    name: string;
    tailwind?: {
        config?: {
            content?: string[] | undefined;
            theme?: Record<string, any> | undefined;
            plugins?: string[] | undefined;
        } | undefined;
    } | undefined;
    $schema?: string | undefined;
    css?: Record<string, any> | undefined;
    extends?: string | undefined;
    title?: string | undefined;
    author?: string | undefined;
    description?: string | undefined;
    dependencies?: string[] | undefined;
    devDependencies?: string[] | undefined;
    registryDependencies?: string[] | undefined;
    files?: ({
        path: string;
        type: "registry:page" | "registry:file";
        target: string;
        content?: string | undefined;
    } | {
        path: string;
        type: "registry:lib" | "registry:block" | "registry:component" | "registry:ui" | "registry:hook" | "registry:theme" | "registry:style" | "registry:item" | "registry:base" | "registry:font" | "registry:example" | "registry:internal";
        content?: string | undefined;
        target?: string | undefined;
    })[] | undefined;
    cssVars?: {
        theme?: Record<string, string> | undefined;
        light?: Record<string, string> | undefined;
        dark?: Record<string, string> | undefined;
    } | undefined;
    envVars?: Record<string, string> | undefined;
    meta?: Record<string, any> | undefined;
    docs?: string | undefined;
    categories?: string[] | undefined;
}, {
    type: "registry:lib" | "registry:block" | "registry:component" | "registry:ui" | "registry:hook" | "registry:page" | "registry:file" | "registry:theme" | "registry:style" | "registry:item" | "registry:example" | "registry:internal";
    name: string;
    tailwind?: {
        config?: {
            content?: string[] | undefined;
            theme?: Record<string, any> | undefined;
            plugins?: string[] | undefined;
        } | undefined;
    } | undefined;
    $schema?: string | undefined;
    css?: Record<string, any> | undefined;
    extends?: string | undefined;
    title?: string | undefined;
    author?: string | undefined;
    description?: string | undefined;
    dependencies?: string[] | undefined;
    devDependencies?: string[] | undefined;
    registryDependencies?: string[] | undefined;
    files?: ({
        path: string;
        type: "registry:page" | "registry:file";
        target: string;
        content?: string | undefined;
    } | {
        path: string;
        type: "registry:lib" | "registry:block" | "registry:component" | "registry:ui" | "registry:hook" | "registry:theme" | "registry:style" | "registry:item" | "registry:base" | "registry:font" | "registry:example" | "registry:internal";
        content?: string | undefined;
        target?: string | undefined;
    })[] | undefined;
    cssVars?: {
        theme?: Record<string, string> | undefined;
        light?: Record<string, string> | undefined;
        dark?: Record<string, string> | undefined;
    } | undefined;
    envVars?: Record<string, string> | undefined;
    meta?: Record<string, any> | undefined;
    docs?: string | undefined;
    categories?: string[] | undefined;
}>]>, "many">;
declare const stylesSchema: z.ZodArray<z.ZodObject<{
    name: z.ZodString;
    label: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    label: string;
}, {
    name: string;
    label: string;
}>, "many">;
declare const iconsSchema: z.ZodRecord<z.ZodString, z.ZodRecord<z.ZodString, z.ZodString>>;
declare const registryBaseColorSchema: z.ZodObject<{
    inlineColors: z.ZodObject<{
        light: z.ZodRecord<z.ZodString, z.ZodString>;
        dark: z.ZodRecord<z.ZodString, z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        light: Record<string, string>;
        dark: Record<string, string>;
    }, {
        light: Record<string, string>;
        dark: Record<string, string>;
    }>;
    cssVars: z.ZodObject<{
        theme: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        light: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        dark: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        theme?: Record<string, string> | undefined;
        light?: Record<string, string> | undefined;
        dark?: Record<string, string> | undefined;
    }, {
        theme?: Record<string, string> | undefined;
        light?: Record<string, string> | undefined;
        dark?: Record<string, string> | undefined;
    }>;
    cssVarsV4: z.ZodOptional<z.ZodObject<{
        theme: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        light: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        dark: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        theme?: Record<string, string> | undefined;
        light?: Record<string, string> | undefined;
        dark?: Record<string, string> | undefined;
    }, {
        theme?: Record<string, string> | undefined;
        light?: Record<string, string> | undefined;
        dark?: Record<string, string> | undefined;
    }>>;
    inlineColorsTemplate: z.ZodString;
    cssVarsTemplate: z.ZodString;
}, "strip", z.ZodTypeAny, {
    cssVars: {
        theme?: Record<string, string> | undefined;
        light?: Record<string, string> | undefined;
        dark?: Record<string, string> | undefined;
    };
    inlineColors: {
        light: Record<string, string>;
        dark: Record<string, string>;
    };
    inlineColorsTemplate: string;
    cssVarsTemplate: string;
    cssVarsV4?: {
        theme?: Record<string, string> | undefined;
        light?: Record<string, string> | undefined;
        dark?: Record<string, string> | undefined;
    } | undefined;
}, {
    cssVars: {
        theme?: Record<string, string> | undefined;
        light?: Record<string, string> | undefined;
        dark?: Record<string, string> | undefined;
    };
    inlineColors: {
        light: Record<string, string>;
        dark: Record<string, string>;
    };
    inlineColorsTemplate: string;
    cssVarsTemplate: string;
    cssVarsV4?: {
        theme?: Record<string, string> | undefined;
        light?: Record<string, string> | undefined;
        dark?: Record<string, string> | undefined;
    } | undefined;
}>;
declare const registryResolvedItemsTreeSchema: z.ZodObject<Pick<{
    $schema: z.ZodOptional<z.ZodString>;
    extends: z.ZodOptional<z.ZodString>;
    name: z.ZodString;
    title: z.ZodOptional<z.ZodString>;
    author: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    dependencies: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    devDependencies: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    registryDependencies: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    files: z.ZodOptional<z.ZodArray<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
        path: z.ZodString;
        content: z.ZodOptional<z.ZodString>;
        type: z.ZodEnum<["registry:file", "registry:page"]>;
        target: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        path: string;
        type: "registry:page" | "registry:file";
        target: string;
        content?: string | undefined;
    }, {
        path: string;
        type: "registry:page" | "registry:file";
        target: string;
        content?: string | undefined;
    }>, z.ZodObject<{
        path: z.ZodString;
        content: z.ZodOptional<z.ZodString>;
        type: z.ZodEnum<["registry:lib", "registry:block", "registry:component", "registry:ui", "registry:hook", "registry:theme", "registry:style", "registry:item", "registry:base", "registry:font", "registry:example", "registry:internal"]>;
        target: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        path: string;
        type: "registry:lib" | "registry:block" | "registry:component" | "registry:ui" | "registry:hook" | "registry:theme" | "registry:style" | "registry:item" | "registry:base" | "registry:font" | "registry:example" | "registry:internal";
        content?: string | undefined;
        target?: string | undefined;
    }, {
        path: string;
        type: "registry:lib" | "registry:block" | "registry:component" | "registry:ui" | "registry:hook" | "registry:theme" | "registry:style" | "registry:item" | "registry:base" | "registry:font" | "registry:example" | "registry:internal";
        content?: string | undefined;
        target?: string | undefined;
    }>]>, "many">>;
    tailwind: z.ZodOptional<z.ZodObject<{
        config: z.ZodOptional<z.ZodObject<{
            content: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            theme: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
            plugins: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            content?: string[] | undefined;
            theme?: Record<string, any> | undefined;
            plugins?: string[] | undefined;
        }, {
            content?: string[] | undefined;
            theme?: Record<string, any> | undefined;
            plugins?: string[] | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        config?: {
            content?: string[] | undefined;
            theme?: Record<string, any> | undefined;
            plugins?: string[] | undefined;
        } | undefined;
    }, {
        config?: {
            content?: string[] | undefined;
            theme?: Record<string, any> | undefined;
            plugins?: string[] | undefined;
        } | undefined;
    }>>;
    cssVars: z.ZodOptional<z.ZodObject<{
        theme: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        light: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        dark: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        theme?: Record<string, string> | undefined;
        light?: Record<string, string> | undefined;
        dark?: Record<string, string> | undefined;
    }, {
        theme?: Record<string, string> | undefined;
        light?: Record<string, string> | undefined;
        dark?: Record<string, string> | undefined;
    }>>;
    css: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodType<any, z.ZodTypeDef, any>>>;
    envVars: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    meta: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    docs: z.ZodOptional<z.ZodString>;
    categories: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "tailwind" | "css" | "dependencies" | "devDependencies" | "files" | "cssVars" | "envVars" | "docs"> & {
    fonts: z.ZodOptional<z.ZodArray<z.ZodObject<{
        $schema: z.ZodOptional<z.ZodString>;
        extends: z.ZodOptional<z.ZodString>;
        name: z.ZodString;
        title: z.ZodOptional<z.ZodString>;
        author: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodString>;
        dependencies: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        devDependencies: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        registryDependencies: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        files: z.ZodOptional<z.ZodArray<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
            path: z.ZodString;
            content: z.ZodOptional<z.ZodString>;
            type: z.ZodEnum<["registry:file", "registry:page"]>;
            target: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            path: string;
            type: "registry:page" | "registry:file";
            target: string;
            content?: string | undefined;
        }, {
            path: string;
            type: "registry:page" | "registry:file";
            target: string;
            content?: string | undefined;
        }>, z.ZodObject<{
            path: z.ZodString;
            content: z.ZodOptional<z.ZodString>;
            type: z.ZodEnum<["registry:lib", "registry:block", "registry:component", "registry:ui", "registry:hook", "registry:theme", "registry:style", "registry:item", "registry:base", "registry:font", "registry:example", "registry:internal"]>;
            target: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            path: string;
            type: "registry:lib" | "registry:block" | "registry:component" | "registry:ui" | "registry:hook" | "registry:theme" | "registry:style" | "registry:item" | "registry:base" | "registry:font" | "registry:example" | "registry:internal";
            content?: string | undefined;
            target?: string | undefined;
        }, {
            path: string;
            type: "registry:lib" | "registry:block" | "registry:component" | "registry:ui" | "registry:hook" | "registry:theme" | "registry:style" | "registry:item" | "registry:base" | "registry:font" | "registry:example" | "registry:internal";
            content?: string | undefined;
            target?: string | undefined;
        }>]>, "many">>;
        tailwind: z.ZodOptional<z.ZodObject<{
            config: z.ZodOptional<z.ZodObject<{
                content: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                theme: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
                plugins: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            }, "strip", z.ZodTypeAny, {
                content?: string[] | undefined;
                theme?: Record<string, any> | undefined;
                plugins?: string[] | undefined;
            }, {
                content?: string[] | undefined;
                theme?: Record<string, any> | undefined;
                plugins?: string[] | undefined;
            }>>;
        }, "strip", z.ZodTypeAny, {
            config?: {
                content?: string[] | undefined;
                theme?: Record<string, any> | undefined;
                plugins?: string[] | undefined;
            } | undefined;
        }, {
            config?: {
                content?: string[] | undefined;
                theme?: Record<string, any> | undefined;
                plugins?: string[] | undefined;
            } | undefined;
        }>>;
        cssVars: z.ZodOptional<z.ZodObject<{
            theme: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
            light: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
            dark: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            theme?: Record<string, string> | undefined;
            light?: Record<string, string> | undefined;
            dark?: Record<string, string> | undefined;
        }, {
            theme?: Record<string, string> | undefined;
            light?: Record<string, string> | undefined;
            dark?: Record<string, string> | undefined;
        }>>;
        css: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodType<any, z.ZodTypeDef, any>>>;
        envVars: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        meta: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        docs: z.ZodOptional<z.ZodString>;
        categories: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    } & {
        type: z.ZodLiteral<"registry:font">;
        font: z.ZodObject<{
            family: z.ZodString;
            provider: z.ZodLiteral<"google">;
            import: z.ZodString;
            variable: z.ZodString;
            weight: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            subsets: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            family: string;
            provider: "google";
            import: string;
            variable: string;
            weight?: string[] | undefined;
            subsets?: string[] | undefined;
        }, {
            family: string;
            provider: "google";
            import: string;
            variable: string;
            weight?: string[] | undefined;
            subsets?: string[] | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        type: "registry:font";
        name: string;
        font: {
            family: string;
            provider: "google";
            import: string;
            variable: string;
            weight?: string[] | undefined;
            subsets?: string[] | undefined;
        };
        tailwind?: {
            config?: {
                content?: string[] | undefined;
                theme?: Record<string, any> | undefined;
                plugins?: string[] | undefined;
            } | undefined;
        } | undefined;
        $schema?: string | undefined;
        css?: Record<string, any> | undefined;
        extends?: string | undefined;
        title?: string | undefined;
        author?: string | undefined;
        description?: string | undefined;
        dependencies?: string[] | undefined;
        devDependencies?: string[] | undefined;
        registryDependencies?: string[] | undefined;
        files?: ({
            path: string;
            type: "registry:page" | "registry:file";
            target: string;
            content?: string | undefined;
        } | {
            path: string;
            type: "registry:lib" | "registry:block" | "registry:component" | "registry:ui" | "registry:hook" | "registry:theme" | "registry:style" | "registry:item" | "registry:base" | "registry:font" | "registry:example" | "registry:internal";
            content?: string | undefined;
            target?: string | undefined;
        })[] | undefined;
        cssVars?: {
            theme?: Record<string, string> | undefined;
            light?: Record<string, string> | undefined;
            dark?: Record<string, string> | undefined;
        } | undefined;
        envVars?: Record<string, string> | undefined;
        meta?: Record<string, any> | undefined;
        docs?: string | undefined;
        categories?: string[] | undefined;
    }, {
        type: "registry:font";
        name: string;
        font: {
            family: string;
            provider: "google";
            import: string;
            variable: string;
            weight?: string[] | undefined;
            subsets?: string[] | undefined;
        };
        tailwind?: {
            config?: {
                content?: string[] | undefined;
                theme?: Record<string, any> | undefined;
                plugins?: string[] | undefined;
            } | undefined;
        } | undefined;
        $schema?: string | undefined;
        css?: Record<string, any> | undefined;
        extends?: string | undefined;
        title?: string | undefined;
        author?: string | undefined;
        description?: string | undefined;
        dependencies?: string[] | undefined;
        devDependencies?: string[] | undefined;
        registryDependencies?: string[] | undefined;
        files?: ({
            path: string;
            type: "registry:page" | "registry:file";
            target: string;
            content?: string | undefined;
        } | {
            path: string;
            type: "registry:lib" | "registry:block" | "registry:component" | "registry:ui" | "registry:hook" | "registry:theme" | "registry:style" | "registry:item" | "registry:base" | "registry:font" | "registry:example" | "registry:internal";
            content?: string | undefined;
            target?: string | undefined;
        })[] | undefined;
        cssVars?: {
            theme?: Record<string, string> | undefined;
            light?: Record<string, string> | undefined;
            dark?: Record<string, string> | undefined;
        } | undefined;
        envVars?: Record<string, string> | undefined;
        meta?: Record<string, any> | undefined;
        docs?: string | undefined;
        categories?: string[] | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    tailwind?: {
        config?: {
            content?: string[] | undefined;
            theme?: Record<string, any> | undefined;
            plugins?: string[] | undefined;
        } | undefined;
    } | undefined;
    css?: Record<string, any> | undefined;
    dependencies?: string[] | undefined;
    devDependencies?: string[] | undefined;
    files?: ({
        path: string;
        type: "registry:page" | "registry:file";
        target: string;
        content?: string | undefined;
    } | {
        path: string;
        type: "registry:lib" | "registry:block" | "registry:component" | "registry:ui" | "registry:hook" | "registry:theme" | "registry:style" | "registry:item" | "registry:base" | "registry:font" | "registry:example" | "registry:internal";
        content?: string | undefined;
        target?: string | undefined;
    })[] | undefined;
    cssVars?: {
        theme?: Record<string, string> | undefined;
        light?: Record<string, string> | undefined;
        dark?: Record<string, string> | undefined;
    } | undefined;
    envVars?: Record<string, string> | undefined;
    docs?: string | undefined;
    fonts?: {
        type: "registry:font";
        name: string;
        font: {
            family: string;
            provider: "google";
            import: string;
            variable: string;
            weight?: string[] | undefined;
            subsets?: string[] | undefined;
        };
        tailwind?: {
            config?: {
                content?: string[] | undefined;
                theme?: Record<string, any> | undefined;
                plugins?: string[] | undefined;
            } | undefined;
        } | undefined;
        $schema?: string | undefined;
        css?: Record<string, any> | undefined;
        extends?: string | undefined;
        title?: string | undefined;
        author?: string | undefined;
        description?: string | undefined;
        dependencies?: string[] | undefined;
        devDependencies?: string[] | undefined;
        registryDependencies?: string[] | undefined;
        files?: ({
            path: string;
            type: "registry:page" | "registry:file";
            target: string;
            content?: string | undefined;
        } | {
            path: string;
            type: "registry:lib" | "registry:block" | "registry:component" | "registry:ui" | "registry:hook" | "registry:theme" | "registry:style" | "registry:item" | "registry:base" | "registry:font" | "registry:example" | "registry:internal";
            content?: string | undefined;
            target?: string | undefined;
        })[] | undefined;
        cssVars?: {
            theme?: Record<string, string> | undefined;
            light?: Record<string, string> | undefined;
            dark?: Record<string, string> | undefined;
        } | undefined;
        envVars?: Record<string, string> | undefined;
        meta?: Record<string, any> | undefined;
        docs?: string | undefined;
        categories?: string[] | undefined;
    }[] | undefined;
}, {
    tailwind?: {
        config?: {
            content?: string[] | undefined;
            theme?: Record<string, any> | undefined;
            plugins?: string[] | undefined;
        } | undefined;
    } | undefined;
    css?: Record<string, any> | undefined;
    dependencies?: string[] | undefined;
    devDependencies?: string[] | undefined;
    files?: ({
        path: string;
        type: "registry:page" | "registry:file";
        target: string;
        content?: string | undefined;
    } | {
        path: string;
        type: "registry:lib" | "registry:block" | "registry:component" | "registry:ui" | "registry:hook" | "registry:theme" | "registry:style" | "registry:item" | "registry:base" | "registry:font" | "registry:example" | "registry:internal";
        content?: string | undefined;
        target?: string | undefined;
    })[] | undefined;
    cssVars?: {
        theme?: Record<string, string> | undefined;
        light?: Record<string, string> | undefined;
        dark?: Record<string, string> | undefined;
    } | undefined;
    envVars?: Record<string, string> | undefined;
    docs?: string | undefined;
    fonts?: {
        type: "registry:font";
        name: string;
        font: {
            family: string;
            provider: "google";
            import: string;
            variable: string;
            weight?: string[] | undefined;
            subsets?: string[] | undefined;
        };
        tailwind?: {
            config?: {
                content?: string[] | undefined;
                theme?: Record<string, any> | undefined;
                plugins?: string[] | undefined;
            } | undefined;
        } | undefined;
        $schema?: string | undefined;
        css?: Record<string, any> | undefined;
        extends?: string | undefined;
        title?: string | undefined;
        author?: string | undefined;
        description?: string | undefined;
        dependencies?: string[] | undefined;
        devDependencies?: string[] | undefined;
        registryDependencies?: string[] | undefined;
        files?: ({
            path: string;
            type: "registry:page" | "registry:file";
            target: string;
            content?: string | undefined;
        } | {
            path: string;
            type: "registry:lib" | "registry:block" | "registry:component" | "registry:ui" | "registry:hook" | "registry:theme" | "registry:style" | "registry:item" | "registry:base" | "registry:font" | "registry:example" | "registry:internal";
            content?: string | undefined;
            target?: string | undefined;
        })[] | undefined;
        cssVars?: {
            theme?: Record<string, string> | undefined;
            light?: Record<string, string> | undefined;
            dark?: Record<string, string> | undefined;
        } | undefined;
        envVars?: Record<string, string> | undefined;
        meta?: Record<string, any> | undefined;
        docs?: string | undefined;
        categories?: string[] | undefined;
    }[] | undefined;
}>;
declare const searchResultItemSchema: z.ZodObject<{
    name: z.ZodString;
    type: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    registry: z.ZodString;
    addCommandArgument: z.ZodString;
}, "strip", z.ZodTypeAny, {
    registry: string;
    name: string;
    addCommandArgument: string;
    type?: string | undefined;
    description?: string | undefined;
}, {
    registry: string;
    name: string;
    addCommandArgument: string;
    type?: string | undefined;
    description?: string | undefined;
}>;
declare const searchResultsSchema: z.ZodObject<{
    pagination: z.ZodObject<{
        total: z.ZodNumber;
        offset: z.ZodNumber;
        limit: z.ZodNumber;
        hasMore: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        total: number;
        offset: number;
        limit: number;
        hasMore: boolean;
    }, {
        total: number;
        offset: number;
        limit: number;
        hasMore: boolean;
    }>;
    items: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        type: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodString>;
        registry: z.ZodString;
        addCommandArgument: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        registry: string;
        name: string;
        addCommandArgument: string;
        type?: string | undefined;
        description?: string | undefined;
    }, {
        registry: string;
        name: string;
        addCommandArgument: string;
        type?: string | undefined;
        description?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    items: {
        registry: string;
        name: string;
        addCommandArgument: string;
        type?: string | undefined;
        description?: string | undefined;
    }[];
    pagination: {
        total: number;
        offset: number;
        limit: number;
        hasMore: boolean;
    };
}, {
    items: {
        registry: string;
        name: string;
        addCommandArgument: string;
        type?: string | undefined;
        description?: string | undefined;
    }[];
    pagination: {
        total: number;
        offset: number;
        limit: number;
        hasMore: boolean;
    };
}>;
declare const registriesIndexSchema: z.ZodRecord<z.ZodString, z.ZodString>;
declare const registriesSchema: z.ZodArray<z.ZodObject<{
    name: z.ZodString;
    homepage: z.ZodOptional<z.ZodString>;
    url: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    url: string;
    name: string;
    description?: string | undefined;
    homepage?: string | undefined;
}, {
    url: string;
    name: string;
    description?: string | undefined;
    homepage?: string | undefined;
}>, "many">;
declare const presetSchema: z.ZodObject<{
    name: z.ZodString;
    title: z.ZodString;
    description: z.ZodString;
    base: z.ZodString;
    style: z.ZodString;
    baseColor: z.ZodString;
    theme: z.ZodString;
    iconLibrary: z.ZodString;
    font: z.ZodString;
    rtl: z.ZodDefault<z.ZodBoolean>;
    menuAccent: z.ZodEnum<["subtle", "bold"]>;
    menuColor: z.ZodEnum<["default", "inverted"]>;
    radius: z.ZodString;
}, "strip", z.ZodTypeAny, {
    style: string;
    baseColor: string;
    iconLibrary: string;
    rtl: boolean;
    menuColor: "default" | "inverted";
    menuAccent: "subtle" | "bold";
    theme: string;
    name: string;
    title: string;
    description: string;
    font: string;
    base: string;
    radius: string;
}, {
    style: string;
    baseColor: string;
    iconLibrary: string;
    menuColor: "default" | "inverted";
    menuAccent: "subtle" | "bold";
    theme: string;
    name: string;
    title: string;
    description: string;
    font: string;
    base: string;
    radius: string;
    rtl?: boolean | undefined;
}>;
type Preset = z.infer<typeof presetSchema>;
declare const configJsonSchema: z.ZodObject<{
    presets: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        title: z.ZodString;
        description: z.ZodString;
        base: z.ZodString;
        style: z.ZodString;
        baseColor: z.ZodString;
        theme: z.ZodString;
        iconLibrary: z.ZodString;
        font: z.ZodString;
        rtl: z.ZodDefault<z.ZodBoolean>;
        menuAccent: z.ZodEnum<["subtle", "bold"]>;
        menuColor: z.ZodEnum<["default", "inverted"]>;
        radius: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        style: string;
        baseColor: string;
        iconLibrary: string;
        rtl: boolean;
        menuColor: "default" | "inverted";
        menuAccent: "subtle" | "bold";
        theme: string;
        name: string;
        title: string;
        description: string;
        font: string;
        base: string;
        radius: string;
    }, {
        style: string;
        baseColor: string;
        iconLibrary: string;
        menuColor: "default" | "inverted";
        menuAccent: "subtle" | "bold";
        theme: string;
        name: string;
        title: string;
        description: string;
        font: string;
        base: string;
        radius: string;
        rtl?: boolean | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    presets: {
        style: string;
        baseColor: string;
        iconLibrary: string;
        rtl: boolean;
        menuColor: "default" | "inverted";
        menuAccent: "subtle" | "bold";
        theme: string;
        name: string;
        title: string;
        description: string;
        font: string;
        base: string;
        radius: string;
    }[];
}, {
    presets: {
        style: string;
        baseColor: string;
        iconLibrary: string;
        menuColor: "default" | "inverted";
        menuAccent: "subtle" | "bold";
        theme: string;
        name: string;
        title: string;
        description: string;
        font: string;
        base: string;
        radius: string;
        rtl?: boolean | undefined;
    }[];
}>;
type ConfigJson = z.infer<typeof configJsonSchema>;

export { type ConfigJson, type Preset, type Registry, type RegistryBaseItem, type RegistryFontItem, type RegistryItem, configJsonSchema, configSchema, iconsSchema, presetSchema, rawConfigSchema, registriesIndexSchema, registriesSchema, registryBaseColorSchema, registryConfigItemSchema, registryConfigSchema, registryIndexSchema, registryItemCommonSchema, registryItemCssSchema, registryItemCssVarsSchema, registryItemEnvVarsSchema, registryItemFileSchema, registryItemFontSchema, registryItemSchema, registryItemTailwindSchema, registryItemTypeSchema, registryResolvedItemsTreeSchema, registrySchema, searchResultItemSchema, searchResultsSchema, stylesSchema, workspaceConfigSchema };
