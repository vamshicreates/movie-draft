import { cpSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "dist");

rmSync(output, { recursive: true, force: true });
mkdirSync(output);

cpSync(path.join(root, "index.html"), path.join(output, "index.html"));
cpSync(path.join(root, "admin.html"), path.join(output, "admin.html"));
cpSync(path.join(root, "legal.html"), path.join(output, "legal.html"));
cpSync(path.join(root, "src"), path.join(output, "src"), { recursive: true });

for (const asset of readdirSync(path.join(root, "public"))) {
  cpSync(path.join(root, "public", asset), path.join(output, asset), {
    recursive: true,
  });
}

await build({
  entryPoints: [path.join(root, "src", "admin.js")],
  outfile: path.join(output, "admin.bundle.js"),
  bundle: true,
  format: "esm",
  platform: "browser",
  minify: true,
});

console.log(`Static site ready in ${output}`);
