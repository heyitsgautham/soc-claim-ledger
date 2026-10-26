import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "vitest";

// Every npm dependency is pinned to the exact version the lockfile holds, so a fresh
// install and Dependabot's pull requests are the only ways a version changes.
// The API's Python dependencies are pinned the same way in apps/api/pyproject.toml.

const ROOT = path.resolve(import.meta.dirname, "..");
const EXACT = /^(\d+\.\d+\.\d+(-[\w.]+)?|workspace:\*)$/;

const manifests = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "package.json", "*/package.json"], {
  cwd: ROOT,
  encoding: "utf8",
})
  .split("\n")
  .filter(Boolean);

test("every package.json pins each dependency to one version", () => {
  assert.ok(manifests.length >= 7);
  const loose: string[] = [];
  for (const file of manifests) {
    const p = JSON.parse(readFileSync(path.join(ROOT, file), "utf8"));
    for (const field of ["dependencies", "devDependencies"]) {
      for (const [name, range] of Object.entries<string>(p[field] ?? {})) if (!EXACT.test(range)) loose.push(`${file} ${name}@${range}`);
    }
  }
  assert.deepEqual(loose, []);
});

test("the API pins each Python dependency with ==", () => {
  const toml = readFileSync(path.join(ROOT, "apps/api/pyproject.toml"), "utf8");
  const specs = [...toml.matchAll(/^\s*"([A-Za-z0-9_.-]+[^"]*)",?$/gm)].map((m) => m[1]!).filter((s) => /^[A-Za-z]/.test(s) && !s.includes("/"));
  assert.ok(specs.length >= 4, specs.join(", "));
  for (const s of specs) assert.match(s, /^[A-Za-z0-9_.-]+==\d/, s);
  const dev = /dev = \[([^\]]*)\]/.exec(toml)?.[1] ?? "";
  for (const s of dev
    .split(",")
    .map((x) => x.trim().replace(/"/g, ""))
    .filter(Boolean))
    assert.match(s, /^[A-Za-z0-9_.-]+==\d/, s);
});
