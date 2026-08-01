import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

mkdirSync(join(root, "src"), { recursive: true });
console.log("Generating client types from openapi.yaml…");
execSync(
  "pnpm exec openapi-typescript openapi.yaml -o src/client.d.ts",
  { cwd: root, stdio: "inherit" },
);
console.log("Done.");
