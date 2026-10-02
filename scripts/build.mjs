import { cpSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "dist");

rmSync(output, { recursive: true, force: true });
mkdirSync(output);

cpSync(path.join(root, "index.html"), path.join(output, "index.html"));
cpSync(path.join(root, "src"), path.join(output, "src"), { recursive: true });

for (const asset of readdirSync(path.join(root, "public"))) {
  cpSync(path.join(root, "public", asset), path.join(output, asset), {
    recursive: true,
  });
}

console.log(`Static site ready in ${output}`);
