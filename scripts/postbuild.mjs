// Next's `output: "standalone"` produces a minimal server bundle but does NOT
// copy the static assets or /public into it — we must do that so the packaged
// server can serve them. Runs after `next build` in the `package` script.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const standalone = path.join(root, ".next", "standalone");

if (!existsSync(standalone)) {
  console.error(
    "✗ .next/standalone not found — did `next build` run with output:'standalone'?",
  );
  process.exit(1);
}

// .next/static -> .next/standalone/.next/static
const staticSrc = path.join(root, ".next", "static");
const staticDest = path.join(standalone, ".next", "static");
if (existsSync(staticSrc)) {
  mkdirSync(path.dirname(staticDest), { recursive: true });
  cpSync(staticSrc, staticDest, { recursive: true });
  console.log("✓ copied .next/static → standalone");
}

// public -> .next/standalone/public
const publicSrc = path.join(root, "public");
const publicDest = path.join(standalone, "public");
if (existsSync(publicSrc)) {
  cpSync(publicSrc, publicDest, { recursive: true });
  console.log("✓ copied public → standalone");
}

console.log("✓ standalone bundle ready to package");
