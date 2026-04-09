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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.esbuildPlugin = esbuildPlugin;
const path_1 = __importDefault(require("path"));
const module_1 = require("module");
const wasmHelper = __importStar(require("./wasm-helper"));
const wasm_parser_1 = require("./wasm-parser");
const util_1 = require("./util");
function esbuildPlugin() {
    return {
        name: "vite-plugin-wasm",
        setup(build) {
            const NAMESPACE = "vite-plugin-wasm-namespace";
            build.onResolve({ filter: /\.wasm$/ }, args => ({
                path: (0, module_1.createRequire)(args.importer).resolve(args.path),
                namespace: NAMESPACE
            }));
            build.onLoad({ filter: /.*/, namespace: NAMESPACE }, async (args) => {
                const dataUri = await (0, util_1.createBase64UriForWasm)(args.path);
                return {
                    contents: `
const wasmUrl = "${dataUri}";
const initWasm = ${wasmHelper.code};
${await (0, wasm_parser_1.generateGlueCode)(args.path, { initWasm: "initWasm", wasmUrl: "wasmUrl" })}
`,
                    loader: "js",
                    resolveDir: path_1.default.dirname(args.path)
                };
            });
        }
    };
}
