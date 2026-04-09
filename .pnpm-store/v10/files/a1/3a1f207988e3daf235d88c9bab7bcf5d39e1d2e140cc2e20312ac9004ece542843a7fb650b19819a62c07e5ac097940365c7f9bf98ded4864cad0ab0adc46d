"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = wasm;
const esbuild_plugin_1 = require("./esbuild-plugin");
const wasm_parser_1 = require("./wasm-parser");
const wasmHelper = __importStar(require("./wasm-helper"));
const util_1 = require("./util");
function wasm() {
    // Vitest reports { ssr: false } to plugins but execute the code in SSR
    // Detect Vitest with the existance of plugin with the name "vitest"
    let runningInVitest = false;
    return {
        name: "vite-plugin-wasm",
        enforce: "pre",
        configResolved(config) {
            runningInVitest = config.plugins.some(plugin => plugin.name === "vitest");
            if (config.optimizeDeps?.esbuildOptions) {
                // https://github.com/Menci/vite-plugin-wasm/pull/11
                if (!config.optimizeDeps.esbuildOptions.plugins) {
                    config.optimizeDeps.esbuildOptions.plugins = [];
                }
                config.optimizeDeps.esbuildOptions.plugins.push((0, esbuild_plugin_1.esbuildPlugin)());
                // Allow usage of top-level await during development build (not affacting the production build)
                config.optimizeDeps.esbuildOptions.target = "esnext";
            }
        },
        resolveId(id) {
            if (id === wasmHelper.id) {
                return id;
            }
        },
        async load(id, options) {
            if (id === wasmHelper.id) {
                return `export default ${wasmHelper.code}`;
            }
            if (!id.toLowerCase().endsWith(".wasm")) {
                return;
            }
            // Get WASM's download URL by Vite's ?url import
            const wasmUrlUrl = id + "?url";
            const wasmUrlDeclaration = options?.ssr || runningInVitest
                ? `const __vite__wasmUrl = ${JSON.stringify(await (0, util_1.createBase64UriForWasm)(id))}`
                : `import __vite__wasmUrl from ${JSON.stringify(wasmUrlUrl)}`;
            return `
URL = globalThis.URL
${wasmUrlDeclaration}
import __vite__initWasm from "${wasmHelper.id}"
${await (0, wasm_parser_1.generateGlueCode)(id, { initWasm: "__vite__initWasm", wasmUrl: "__vite__wasmUrl" })}
`;
        }
    };
}
