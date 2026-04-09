import process from 'node:process';
import { C as CLI_TEMP_DIR, w as writeFileSafe, r as runCli, q as limitText, u as prompts, e as parseNr } from './shared/ni.b-W1u-ew.mjs';
import { Fzf, byLengthAsc } from 'fzf';
import { g as getPackageJSON } from './shared/ni.C4mrCGPc.mjs';
import { existsSync, promises } from 'node:fs';
import { resolve } from 'node:path';
import 'readline';
import 'events';
import 'ansis';
import 'package-manager-detector';
import 'tinyexec';
import 'package-manager-detector/constants';
import 'os';
import 'tty';
import 'node:os';
import 'fs';
import 'fs/promises';
import 'path';
import 'package-manager-detector/commands';

const rawCompletionScript = `
###-begin-nr-completion-###

if type complete &>/dev/null; then
  _nr_completion() {
    local words
    local cur
    local cword
    _get_comp_words_by_ref -n =: cur words cword
    IFS=$'\\n'
    COMPREPLY=($(COMP_CWORD=$cword COMP_LINE=$cur nr --completion \${words[@]}))
  }
  complete -F _nr_completion nr
fi

###-end-nr-completion-###
`.trim();

let storage;
const storagePath = resolve(CLI_TEMP_DIR, "_storage.json");
async function load(fn) {
  if (!storage) {
    storage = existsSync(storagePath) ? JSON.parse(await promises.readFile(storagePath, "utf-8") || "{}") || {} : {};
  }
  return storage;
}
async function dump() {
  if (storage)
    await writeFileSafe(storagePath, JSON.stringify(storage));
}

function readPackageScripts(ctx) {
  const pkg = getPackageJSON(ctx);
  const rawScripts = pkg.scripts || {};
  const scriptsInfo = pkg["scripts-info"] || {};
  const scripts = Object.entries(rawScripts).filter((i) => !i[0].startsWith("?")).map(([key, cmd]) => ({
    key,
    cmd,
    description: scriptsInfo[key] || rawScripts[`?${key}`] || cmd
  }));
  if (scripts.length === 0 && !ctx?.programmatic) {
    console.warn("No scripts found in package.json");
  }
  return scripts;
}
runCli(async (agent, args, ctx) => {
  const storage = await load();
  if (args[0] === "--completion") {
    const compLine = process.env.COMP_LINE;
    const rawCompCword = process.env.COMP_CWORD;
    if (compLine !== void 0 && rawCompCword !== void 0) {
      const compCword = Number.parseInt(rawCompCword, 10);
      const compWords = args.slice(1);
      if (compCword === 1) {
        const raw = readPackageScripts(ctx);
        const fzf = new Fzf(raw, {
          selector: (item) => item.key,
          casing: "case-insensitive",
          tiebreakers: [byLengthAsc]
        });
        const results = fzf.find(compWords[1] || "");
        console.log(results.map((r) => r.item.key).join("\n"));
      }
    } else {
      console.log(rawCompletionScript);
    }
    return;
  }
  if (args[0] === "-") {
    if (!storage.lastRunCommand) {
      if (!ctx?.programmatic) {
        console.error("No last command found");
        process.exit(1);
      }
      throw new Error("No last command found");
    }
    args[0] = storage.lastRunCommand;
  }
  if (args.length === 0 && !ctx?.programmatic) {
    const raw = readPackageScripts(ctx);
    const terminalColumns = process.stdout?.columns || 80;
    const choices = raw.map(({ key, description }) => ({
      title: key,
      value: key,
      description: limitText(description, terminalColumns - 15)
    }));
    const fzf = new Fzf(raw, {
      selector: (item) => `${item.key} ${item.description}`,
      casing: "case-insensitive",
      tiebreakers: [byLengthAsc]
    });
    if (storage.lastRunCommand) {
      const last = choices.find((i) => i.value === storage.lastRunCommand);
      if (last)
        choices.unshift(last);
    }
    try {
      const { fn } = await prompts({
        name: "fn",
        message: "script to run",
        type: "autocomplete",
        choices,
        async suggest(input, choices2) {
          if (!input)
            return choices2;
          const results = fzf.find(input);
          return results.map((r) => choices2.find((c) => c.value === r.item.key));
        }
      });
      if (!fn)
        return;
      args.push(fn);
    } catch {
      process.exit(1);
    }
  }
  if (storage.lastRunCommand !== args[0]) {
    storage.lastRunCommand = args[0];
    dump();
  }
  return parseNr(agent, args);
});
