import assert from "node:assert/strict";
import { test } from "vitest";
import { closureHistogram, noteSimilarity, templatedNotes, versionFor } from "../src/index";

test("closures piled under the SLA are flagged, an unhurried spread is not", () => {
  const spread = Array.from({ length: 120 }, (_, i) => 10 + i * 0.4);
  assert.equal(closureHistogram(spread, 60).bunching.flagged, false);
  const bunched = [...spread, ...Array.from({ length: 40 }, (_, i) => 55.2 + (i % 9) * 0.5)];
  const h = closureHistogram(bunched, 60);
  assert.equal(h.bunching.flagged, true);
  assert.equal(h.bunching.bucket.start, 55);
  assert.ok((h.bunching.ratio ?? 0) > 3);
});

test("one paragraph with the hostname changed scores above 0.95, natural notes do not", () => {
  const t = (host: string) =>
    `Alert reviewed on ${host}. No malicious activity observed after initial triage. Host checked against EDR telemetry and no further ` +
    "indicators of compromise were found. User activity appears consistent with normal business operations. Closing as per SOP, no escalation required.";
  assert.ok(noteSimilarity(t("EP-OPS-0141"), t("DMZ-WEB-21")) > 0.95);
  assert.ok(
    noteSimilarity(
      "Pulled EDR telemetry, powershell spawned from winword, host contained.",
      "Reviewed firewall sessions for 3 days, scanner traffic, closed as benign.",
    ) < 0.5,
  );
});

test("the cluster keeps every pasted note and nothing else", () => {
  const notes = [
    ...["A-1", "A-2", "A-3", "A-4", "A-5", "A-6"].map((h, i) => ({
      id: `c${i}`,
      owner: "L1-01",
      text: `Alert reviewed on ${h}. No malicious activity observed. Closing as per SOP, no escalation required.`,
    })),
    { id: "x", owner: "L1-02", text: "Credential material accessed by lsass reader, account reset and host reimaged after review." },
  ];
  const r = templatedNotes(notes, 0.9, 5);
  assert.equal(r.clusters.length, 1);
  assert.equal(r.clusters[0]!.size, 6);
  assert.ok(!r.clusters[0]!.members.some((m) => m.id === "x"));
});

test("a cycle runs the detector version that was current then", () => {
  assert.equal(versionFor("templated-notes", "FY26-Q2").version, "1.0.0");
  assert.equal(versionFor("templated-notes", "FY27-Q1").version, "1.1.0");
});
