import assert from "node:assert/strict";
import { test } from "vitest";
import { DETECTOR_IDS, DETECTORS, versionFor } from "../src/index";

test("every detector id is registered under its own id with stakes between 0 and 1", () => {
  assert.deepEqual(Object.keys(DETECTORS).sort(), [...DETECTOR_IDS].sort());
  for (const id of DETECTOR_IDS) {
    assert.equal(DETECTORS[id].id, id);
    assert.ok(DETECTORS[id].stakes > 0 && DETECTORS[id].stakes <= 1, id);
    assert.ok(DETECTORS[id].question.endsWith("?"), id);
  }
});

test("versions run oldest first, each from a later cycle with a higher semver", () => {
  for (const id of DETECTOR_IDS) {
    const vs = DETECTORS[id].versions;
    assert.ok(vs.length >= 1, id);
    for (let i = 1; i < vs.length; i++) {
      assert.ok(vs[i]!.from > vs[i - 1]!.from, `${id} ${vs[i]!.version}`);
      const [a, b] = [vs[i - 1]!.version, vs[i]!.version].map((v) => v.split(".").map(Number));
      assert.ok(a![0]! < b![0]! || (a![0] === b![0] && a![1]! < b![1]!), `${id} ${vs[i]!.version}`);
    }
  }
});

test("a cycle gets the newest version released by then, and a cycle before the first release gets the first", () => {
  assert.equal(versionFor("negative-space", "FY26-Q2").params.minExpected, 1);
  assert.equal(versionFor("negative-space", "FY26-Q3").params.minExpected, 3);
  assert.equal(versionFor("negative-space", "FY27-Q1").version, "1.1.0");
  assert.equal(versionFor("templated-notes", "FY26-Q3").params.threshold, 0.9);
  assert.equal(versionFor("sla-bunching", "FY25-Q1").version, "1.0.0");
});
