"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseWasm = parseWasm;
exports.generateGlueCode = generateGlueCode;
const fs_1 = __importDefault(require("fs"));
async function parseWasm(wasmFilePath) {
    try {
        const wasmBinary = await fs_1.default.promises.readFile(wasmFilePath);
        const wasmModule = await WebAssembly.compile(wasmBinary);
        const imports = Object.entries(WebAssembly.Module.imports(wasmModule).reduce((result, item) => ({
            ...result,
            [item.module]: [...(result[item.module] || []), item.name]
        }), {})).map(([from, names]) => ({ from, names }));
        const exports = WebAssembly.Module.exports(wasmModule).map(item => item.name);
        return { imports, exports };
    }
    catch (e) {
        throw new Error(`Failed to parse WASM file: ${e.message}`);
    }
}
async function generateGlueCode(wasmFilePath, names) {
    const { imports, exports } = await parseWasm(wasmFilePath);
    const importStatements = imports.map(({ from }, i) => {
        return `import * as __vite__wasmImport_${i} from ${JSON.stringify(from)};`;
    });
    const importObject = imports.map(({ from, names }, i) => {
        return {
            key: JSON.stringify(from),
            value: names.map(name => {
                return {
                    key: JSON.stringify(name),
                    value: `__vite__wasmImport_${i}[${JSON.stringify(name)}]`
                };
            })
        };
    });
    const initCode = `const __vite__wasmModule = await ${names.initWasm}(${codegenSimpleObject(importObject)}, ${names.wasmUrl});`;
    const exportsStatements = exports.map(name => {
        return `export ${name === "default" ? "default" : `const ${name} =`} __vite__wasmModule.${name};`;
    });
    return [...importStatements, initCode, ...exportsStatements].join("\n");
}
function codegenSimpleObject(obj) {
    return `{ ${codegenSimpleObjectKeyValue(obj)} }`;
}
function codegenSimpleObjectKeyValue(obj) {
    return obj
        .map(({ key, value }) => {
        return `${key}: ${typeof value === "string" ? value : codegenSimpleObject(value)}`;
    })
        .join(",\n");
}
