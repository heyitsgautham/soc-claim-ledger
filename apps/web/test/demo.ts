import { readFileSync } from "node:fs";
import path from "node:path";
import type { Calibration, EntityAnalysis, Portfolio } from "@ledger/claims/model";
import { renderToStaticMarkup } from "react-dom/server";

// The analysis pnpm analyse writes to data/demo/derived, read straight from disk so a
// component renders with the same props its page hands it.

const derived = path.resolve(import.meta.dirname, "../../../data/demo/derived");
const read = <T>(file: string) => JSON.parse(readFileSync(path.join(derived, file), "utf8")) as T;

export const portfolio = () => read<Portfolio>("portfolio.json");
export const entity = (code: string) => read<EntityAnalysis>(`entities/${code}.json`);
export const calibration = () => read<Calibration>("calibration.json");

// Static markup, as the server sends it, and the same markup with the tags stripped.
export const html = (el: React.ReactElement) => renderToStaticMarkup(el);
export const text = (el: React.ReactElement) =>
  html(el)
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

// The opening tag of the element with this data-testid, whatever order React writes its attributes in.
export function tag(markup: string, testid: string): string {
  const m = new RegExp(`<[a-z]+[^>]*data-testid="${testid}"[^>]*>`).exec(markup);
  if (!m) throw new Error(`no element with data-testid="${testid}"`);
  return m[0];
}
