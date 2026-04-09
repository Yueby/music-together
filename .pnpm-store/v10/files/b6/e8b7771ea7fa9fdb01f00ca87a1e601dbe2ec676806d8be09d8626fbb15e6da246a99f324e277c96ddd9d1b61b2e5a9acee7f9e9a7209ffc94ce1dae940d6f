"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBase64UriForWasm = createBase64UriForWasm;
const fs_1 = __importDefault(require("fs"));
async function createBase64UriForWasm(filePath) {
    const base64 = await fs_1.default.promises.readFile(filePath, "base64");
    return "data:application/wasm;base64," + base64;
}
