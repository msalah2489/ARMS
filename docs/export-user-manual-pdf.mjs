/**
 * Export docs/USER_MANUAL.md → docs/ARMS-USER-MANUAL.pdf (Arabic RTL)
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const mdPath = path.join(__dirname, "USER_MANUAL.md");
const cssPath = path.join(__dirname, "user-manual-print.css");
const outName = process.env.ARMS_MANUAL_PDF || "ARMS-USER-MANUAL.pdf";
const outPath = path.join(__dirname, outName);

const require = createRequire(import.meta.url);

async function ensureMdToPdf() {
  try {
    return require("md-to-pdf");
  } catch {
    const { execSync } = await import("node:child_process");
    console.log("Installing md-to-pdf locally…");
    execSync("npm install md-to-pdf --no-save --no-fund --no-audit", {
      cwd: root,
      stdio: "inherit",
      env: process.env,
    });
    return require("md-to-pdf");
  }
}

const { mdToPdf } = await ensureMdToPdf();

if (!fs.existsSync(mdPath)) {
  console.error("Missing USER_MANUAL.md");
  process.exit(1);
}

const css = fs.readFileSync(cssPath, "utf8");

const pdf = await mdToPdf(
  { path: mdPath },
  {
    dest: outPath,
    stylesheet: [cssPath],
    css,
    pdf_options: {
      format: "A4",
      printBackground: true,
      margin: { top: "16mm", right: "14mm", bottom: "18mm", left: "14mm" },
      displayHeaderFooter: true,
      headerTemplate: `<div></div>`,
      footerTemplate: `
        <div style="width:100%;font-size:9px;color:#78716c;padding:0 14mm;display:flex;justify-content:space-between;direction:rtl;font-family:Tahoma,sans-serif;">
          <span>دليل مستخدم ARMS</span>
          <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
        </div>`,
    },
    body_class: ["arms-manual"],
    document_title: "دليل مستخدم ARMS",
  },
);

if (!pdf?.filename) {
  console.error("PDF export failed");
  process.exit(1);
}

console.log("PDF ready:", outPath);
