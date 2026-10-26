import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, test } from "vitest";
import { DURATION, scenes } from "./storyboard";
import { LEAD_IN, lineFile, sayNumber, spoken, spokenWords, writeSrt, writeVoiceover } from "./voiceover";

const dir = mkdtempSync(path.join(tmpdir(), "ledger-vo-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

test("numbers are said the way a reader says them, up to millions", () => {
  assert.equal(sayNumber(0), "zero");
  assert.equal(sayNumber(19), "nineteen");
  assert.equal(sayNumber(40), "forty");
  assert.equal(sayNumber(61), "sixty one");
  assert.equal(sayNumber(305), "three hundred five");
  assert.equal(sayNumber(3483), "three thousand four hundred eighty three");
  assert.equal(sayNumber(1_208_268), "one million two hundred eight thousand two hundred sixty eight");
  assert.equal(sayNumber(2_000_000), "two million");
});

test("a line is spoken with names spelled out, grouped digits read whole and decimals digit by digit", () => {
  assert.equal(spoken("P-04 told NCIIPC its SOC covers OT."), "P zero four told N C I I P C its sock covers O T.");
  assert.equal(spoken("3,483 alerts"), "three thousand four hundred eighty three alerts");
  assert.equal(spoken("12,34,567 rows"), "one million two hundred thirty four thousand five hundred sixty seven rows");
  assert.equal(spoken("0.98 similar"), "zero point nine eight similar");
  assert.equal(spokenWords("P1 alerts, 61 percent."), 6);
});

test("every scene's line fits its window at 120 words a minute or less, and gets its own file", () => {
  const all = scenes();
  assert.equal(all.at(-1)!.end, DURATION);
  for (const [i, s] of all.entries()) {
    assert.ok(spokenWords(s.line) / ((s.end - s.start) / 60) <= 120, s.id);
    assert.match(lineFile(s, i), new RegExp(`^${String(i + 1).padStart(2, "0")}-${s.id}$`));
  }
  const file = path.join(dir, "voiceover.md");
  writeVoiceover(file);
  const md = readFileSync(file, "utf8");
  for (const s of all) assert.ok(md.includes(`\`${lineFile(s, all.indexOf(s))}\``), s.id);
  assert.match(md, /Edit the storyboard, not this file\./);
});

test("captions run one cue per sentence, in order, each inside its scene after the lead-in", () => {
  const file = path.join(dir, "demo.srt");
  writeSrt(file);
  const cues = readFileSync(file, "utf8").trim().split("\n\n");
  const toS = (t: string) => {
    const [h, m, rest] = t.split(":");
    const [s, ms] = rest!.split(",");
    return Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms) / 1000;
  };
  const times = cues.map((c) => c.split("\n")[1]!.split(" --> ").map(toS) as [number, number]);
  assert.equal(cues[0]!.split("\n")[0], "1");
  assert.ok(Math.abs(times[0]![0] - (scenes()[0]!.start + LEAD_IN)) < 0.002);
  for (let i = 1; i < times.length; i++) assert.ok(times[i]![0] >= times[i - 1]![1] - 0.002, `cue ${i + 1}`);
  const sentences = scenes().reduce((n, s) => n + (s.line.match(/[^.!?]+[.!?]+/g)?.length ?? 1), 0);
  assert.equal(cues.length, sentences);
});
