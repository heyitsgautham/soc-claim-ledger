import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { marked } from "marked";
import { chromium } from "playwright";

// pnpm docs:pdf
// Renders docs/architecture.md to docs/architecture.pdf in the product's own type, and
// fails if it runs past the two pages the problem statement allows.

const MAX_PAGES = 2;
const docs = path.dirname(new URL(import.meta.url).pathname);
const fonts = path.resolve(docs, "../apps/web/src/app/fonts");
const build = path.join(docs, ".build");
mkdirSync(build, { recursive: true });

const face = (family: string, file: string, weight: number, style = "normal") =>
  `@font-face{font-family:"${family}";src:url("file://${fonts}/${file}") format("woff2");font-weight:${weight};font-style:${style}}`;

const css = `
${face("Plex Serif", "ibm-plex-serif-latin-400-normal.woff2", 400)}
${face("Plex Serif", "ibm-plex-serif-latin-500-normal.woff2", 500)}
${face("Plex Sans", "ibm-plex-sans-latin-400-normal.woff2", 400)}
${face("Plex Sans", "ibm-plex-sans-latin-600-normal.woff2", 600)}
${face("Plex Mono", "ibm-plex-mono-latin-400-normal.woff2", 400)}
@page { size: A4; margin: 15mm 16mm 14mm; }
body { font: 9.6pt/1.45 "Plex Sans", sans-serif; color: #1b1b1b; }
h1 { font: 500 21pt/1.1 "Plex Serif", serif; margin: 0 0 4pt; padding-bottom: 7pt; border-bottom: 3px double #1b1b1b; }
h2 { font: 500 12.5pt/1.2 "Plex Serif", serif; margin: 11pt 0 3pt; }
p { margin: 0 0 3pt; }
h1 + p, h1 + p + p { color: #47443e; }
code { font: 8.4pt "Plex Mono", monospace; }
pre { background: #f7f5f0; border: 1px solid #d9d3c5; padding: 7pt 8pt; margin: 5pt 0 7pt; overflow: hidden; }
pre code { font-size: 7.3pt; line-height: 1.3; }
table { border-collapse: collapse; width: 100%; margin: 4pt 0 6pt; font-size: 8.7pt; }
th { text-align: left; font-weight: 600; border-bottom: 1px solid #1b1b1b; padding: 2pt 6pt 2pt 0; }
td { border-bottom: 1px solid #e7e2d7; padding: 2.5pt 6pt 2.5pt 0; vertical-align: top; }
td:first-child code { white-space: nowrap; }
`;

const md = readFileSync(path.join(docs, "architecture.md"), "utf8");
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${css}</style></head><body>${marked.parse(md)}</body></html>`;
const htmlFile = path.join(build, "architecture.html");
writeFileSync(htmlFile, html);

const browser = await chromium.launch();
const page = await browser.newPage();
await page.route("**/*", (r) => (r.request().url().startsWith("file://") ? r.continue() : r.abort()));
await page.goto(`file://${htmlFile}`, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
const pdf = await page.pdf({ format: "A4", preferCSSPageSize: true, printBackground: true });
await browser.close();

const out = path.join(docs, "architecture.pdf");
writeFileSync(out, pdf);
const pages = (pdf.toString("latin1").match(/\/Type\s*\/Page\b/g) ?? []).length;
let checked = pages;
try {
  checked = Number(/Pages:\s+(\d+)/.exec(execFileSync("pdfinfo", [out]).toString())?.[1] ?? pages);
} catch {
  // pdfinfo is optional. The count from the PDF's own page objects stands.
}
console.log(`wrote docs/architecture.pdf, ${checked} pages`);
if (checked > MAX_PAGES) {
  console.error(`architecture.pdf has ${checked} pages, the limit is ${MAX_PAGES}`);
  process.exit(1);
}
