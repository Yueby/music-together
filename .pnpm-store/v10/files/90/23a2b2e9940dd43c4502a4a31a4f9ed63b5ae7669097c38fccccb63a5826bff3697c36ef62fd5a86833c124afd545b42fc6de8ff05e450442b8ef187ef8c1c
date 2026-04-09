import fs from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

function getPackageJSON(ctx) {
  const cwd = ctx?.cwd ?? process.cwd();
  const path = resolve(cwd, "package.json");
  if (fs.existsSync(path)) {
    try {
      const raw = fs.readFileSync(path, "utf-8");
      const data = JSON.parse(raw);
      return data;
    } catch (e) {
      if (!ctx?.programmatic) {
        console.warn("Failed to parse package.json");
        process.exit(1);
      }
      throw e;
    }
  }
}

export { getPackageJSON as g };
