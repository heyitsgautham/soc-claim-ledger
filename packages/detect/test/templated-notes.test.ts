import assert from "node:assert/strict";
import { test } from "vitest";
import { noteSimilarity, templatedNotes } from "../src/index";

const pasted = (host: string) => `Alert reviewed on ${host}. No malicious activity observed. Closing as per SOP, no escalation required.`;
const note = (id: string, owner: string, text: string) => ({ id, owner, text });

test("similarity ignores case, punctuation at word edges and word order, and is zero for an empty note", () => {
  assert.ok(Math.abs(noteSimilarity("Host contained.", "host CONTAINED") - 1) < 1e-12);
  assert.ok(Math.abs(noteSimilarity("a b c", "c b a") - 1) < 1e-12);
  assert.equal(noteSimilarity("", "anything"), 0);
  assert.equal(noteSimilarity("...", "!!!"), 0);
});

test("a cluster smaller than the minimum is not reported", () => {
  const notes = ["H1", "H2", "H3", "H4"].map((h, i) => note(`c${i}`, "L1-01", pasted(h)));
  const r = templatedNotes(notes, 0.9, 5);
  assert.deepEqual(r.clusters, []);
  assert.equal(r.flagged, false);
  assert.equal(r.notesCompared, 4);
});

test("a cluster names its most central note, every owner and each member's similarity to it", () => {
  const notes = [
    ...["H1", "H2", "H3", "H4"].map((h, i) => note(`c${i}`, i % 2 ? "L1-02" : "L1-01", pasted(h))),
    note("c4", "L1-03", `${pasted("H5")} Ticket.`),
  ];
  const [c] = templatedNotes(notes, 0.9, 5).clusters;
  assert.equal(c!.size, 5);
  assert.notEqual(c!.medoidId, "c4");
  assert.deepEqual(c!.owners, ["L1-01", "L1-02", "L1-03"]);
  assert.equal(c!.members[0]!.id, c!.medoidId);
  assert.equal(c!.members[0]!.similarity, 1);
  assert.equal(c!.members.at(-1)!.id, "c4");
  assert.ok(c!.meanSimilarity > 0.9 && c!.meanSimilarity < 1);
});

test("clusters are joined through chains of similar notes and listed largest first", () => {
  const big = ["H1", "H2", "H3", "H4", "H5", "H6"].map((h, i) => note(`a${i}`, "L1-01", pasted(h)));
  const other = (h: string) => `Phishing mail from ${h} quarantined, sender blocked at the gateway, user told.`;
  const small = ["M1", "M2", "M3", "M4", "M5"].map((h, i) => note(`b${i}`, "L1-02", other(h)));
  const r = templatedNotes([...small, ...big], 0.9, 5);
  assert.deepEqual(
    r.clusters.map((c) => c.size),
    [6, 5],
  );
  assert.equal(r.flagged, true);
});

test("a higher threshold splits notes a lower one would have joined", () => {
  const notes = ["H1", "H2", "H3", "H4", "H5"].map((h, i) => note(`c${i}`, "L1-01", `Checked ${h} logs ok closed`));
  assert.equal(templatedNotes(notes, 0.7, 5).clusters.length, 1);
  assert.equal(templatedNotes(notes, 0.95, 5).clusters.length, 0);
});

test("a note with a long run of punctuation inside one word is read in linear time", () => {
  const run = (n: number) => `checked a${"-".repeat(n)}a host`;
  const started = performance.now();
  const s = noteSimilarity(run(200_000), "checked host");
  // The old trim regex backtracked quadratically here, about a minute for 200,000 characters.
  assert.ok(performance.now() - started < 1000, `${performance.now() - started} ms`);
  assert.ok(s > 0.8 && s < 1);
  assert.equal(noteSimilarity("--host--", "host"), 1);
  assert.equal(noteSimilarity("(DMZ-WEB-21).", "dmz-web-21"), 1);
});
