/**
 * Windows-safe patch for Next.js static export:
 * replace rename(export/500.html → server/pages/500.html) with exists-check +
 * copyFile (and a stub if the export artifact is missing).
 *
 * Idempotent — safe to run before every build.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const targets = [
  path.join(root, "node_modules", "next", "dist", "build", "index.js"),
  path.join(root, "node_modules", "next", "dist", "esm", "build", "index.js"),
];

const MARKER = "ARMS_WIN_EXPORT_RENAME_FIX";

const OLD = `await _fs.promises.mkdir(_path.default.dirname(dest), {
                                    recursive: true
                                });
                                await _fs.promises.rename(orig, dest);`;

const NEW = `await _fs.promises.mkdir(_path.default.dirname(dest), {
                                    recursive: true
                                });
                                // ${MARKER}: Windows static-export can race/delete export/*.html
                                if (!(0, _fs.existsSync)(orig)) {
                                    const stub = '<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Error</title></head><body><h1>Error</h1></body></html>';
                                    await _fs.promises.writeFile(dest, stub, 'utf8');
                                } else {
                                    await _fs.promises.copyFile(orig, dest);
                                    try { await _fs.promises.unlink(orig); } catch {}
                                }`;

// ESM build uses `_path` differently — also handle bare path import variants
const OLD_ESM = `await fs.promises.mkdir(path.dirname(dest), {
                                    recursive: true
                                });
                                await fs.promises.rename(orig, dest);`;

const NEW_ESM = `await fs.promises.mkdir(path.dirname(dest), {
                                    recursive: true
                                });
                                // ${MARKER}: Windows static-export can race/delete export/*.html
                                if (!existsSync(orig)) {
                                    const stub = '<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Error</title></head><body><h1>Error</h1></body></html>';
                                    await fs.promises.writeFile(dest, stub, 'utf8');
                                } else {
                                    await fs.promises.copyFile(orig, dest);
                                    try { await fs.promises.unlink(orig); } catch {}
                                }`;

let patched = 0;
for (const file of targets) {
  if (!fs.existsSync(file)) continue;
  let src = fs.readFileSync(file, "utf8");
  if (src.includes(MARKER)) {
    console.log(`[patch] already patched: ${path.relative(root, file)}`);
    continue;
  }
  let next = src;
  if (next.includes(OLD)) {
    next = next.replace(OLD, NEW);
  } else if (next.includes(OLD_ESM)) {
    next = next.replace(OLD_ESM, NEW_ESM);
  } else {
    // Fallback: only the rename line inside move-exported-page flow
    const renameOnly = `await _fs.promises.rename(orig, dest);`;
    if (next.includes(renameOnly) && !next.includes(MARKER)) {
      next = next.replace(
        renameOnly,
        `// ${MARKER}\n                                if (!(0, _fs.existsSync)(orig)) {\n                                    const stub = '<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Error</title></head><body><h1>Error</h1></body></html>';\n                                    await _fs.promises.mkdir(_path.default.dirname(dest), { recursive: true });\n                                    await _fs.promises.writeFile(dest, stub, 'utf8');\n                                } else {\n                                    await _fs.promises.mkdir(_path.default.dirname(dest), { recursive: true });\n                                    await _fs.promises.copyFile(orig, dest);\n                                    try { await _fs.promises.unlink(orig); } catch {}\n                                }`,
      );
    }
  }
  if (next === src) {
    console.warn(`[patch] pattern not found: ${path.relative(root, file)}`);
    continue;
  }
  fs.writeFileSync(file, next, "utf8");
  patched += 1;
  console.log(`[patch] applied: ${path.relative(root, file)}`);
}

console.log(`[patch] done (${patched} file(s) updated)`);
