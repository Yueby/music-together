import process from 'node:process';
import { t as formatPackageWithUrl, r as runCli, u as prompts, n as exclude, p as parseNi } from './shared/ni.b-W1u-ew.mjs';
import c from 'ansis';
import { Fzf } from 'fzf';
import 'node:path';
import 'readline';
import 'events';
import 'package-manager-detector';
import 'tinyexec';
import 'node:fs';
import 'package-manager-detector/constants';
import 'os';
import 'tty';
import 'node:os';
import 'fs';
import 'fs/promises';
import 'path';
import 'package-manager-detector/commands';

async function fetchNpmPackages(pattern) {
  const registryLink = (pattern2) => `https://registry.npmjs.com/-/v1/search?text=${pattern2}&size=35`;
  const terminalColumns = process.stdout?.columns || 80;
  try {
    const result = await fetch(registryLink(pattern)).then((res) => res.json());
    return result.objects.map(({ package: pkg }) => ({
      title: formatPackageWithUrl(
        `${pkg.name.padEnd(30, " ")} ${c.blue`v${pkg.version}`}`,
        pkg.links.repository ?? pkg.links.npm,
        terminalColumns
      ),
      value: pkg
    }));
  } catch {
    console.error("Error when fetching npm registry");
    process.exit(1);
  }
}

runCli(async (agent, args, ctx) => {
  const isInteractive = args[0] === "-i";
  if (isInteractive) {
    let fetchPattern;
    if (args[1] && !args[1].startsWith("-")) {
      fetchPattern = args[1];
    } else {
      const { pattern } = await prompts({
        type: "text",
        name: "pattern",
        message: "search for package"
      });
      fetchPattern = pattern;
    }
    if (!fetchPattern) {
      process.exitCode = 1;
      return;
    }
    const packages = await fetchNpmPackages(fetchPattern);
    if (!packages.length) {
      console.error("No results found");
      process.exitCode = 1;
      return;
    }
    const fzf = new Fzf(packages, {
      selector: (item) => item.title,
      casing: "case-insensitive"
    });
    const { dependency } = await prompts({
      type: "autocomplete",
      name: "dependency",
      choices: packages,
      instructions: false,
      message: "choose a package to install",
      limit: 15,
      async suggest(input, choices) {
        const results = fzf.find(input);
        return results.map((r) => choices.find((c2) => c2.value === r.item.value));
      }
    });
    if (!dependency) {
      process.exitCode = 1;
      return;
    }
    args = exclude(args, "-d", "-p", "-i");
    const canInstallPeers = ["npm", "pnpm"].includes(agent);
    const { mode } = await prompts({
      type: "select",
      name: "mode",
      message: `install ${c.yellow(dependency.name)} as`,
      choices: [
        {
          title: "prod",
          value: "",
          selected: true
        },
        {
          title: "dev",
          value: "-D"
        },
        {
          title: `peer`,
          value: "--save-peer",
          disabled: !canInstallPeers
        }
      ]
    });
    args.push(dependency.name, mode);
  }
  return parseNi(agent, args, ctx);
});
