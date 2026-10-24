import assert from "node:assert/strict";
import { test } from "node:test";
import { parseVerdictRequest } from "../src/lib/verdict-request";

test("a well-formed verdict passes through unchanged", () => {
  const body = { entity: "P-04", itemKey: "case:P04-27Q1-C0001", verdict: "issue_confirmed" };
  assert.deepEqual(parseVerdictRequest(body), body);
});

test("fields beyond record and verdict are dropped, so the browser cannot set the examiner", () => {
  const got = parseVerdictRequest({ entity: "P-04", itemKey: "k", verdict: "no_issue", examiner: "EX-99", blind: false });
  assert.deepEqual(got, { entity: "P-04", itemKey: "k", verdict: "no_issue" });
});

test("an entity that is not a code is refused before any file is read", () => {
  for (const entity of ["../portfolio", "p-04", "P-4", "P-04/../../x", ""]) {
    assert.equal(parseVerdictRequest({ entity, itemKey: "k", verdict: "no_issue" }), null, entity);
  }
});

test("a missing field, an unknown verdict or a body that is not an object is refused", () => {
  assert.equal(parseVerdictRequest({ entity: "P-04", verdict: "no_issue" }), null);
  assert.equal(parseVerdictRequest({ entity: "P-04", itemKey: "", verdict: "no_issue" }), null);
  assert.equal(parseVerdictRequest({ entity: "P-04", itemKey: "k", verdict: "maybe" }), null);
  assert.equal(parseVerdictRequest({ entity: "P-04", itemKey: "x".repeat(201), verdict: "no_issue" }), null);
  assert.equal(parseVerdictRequest([1, 2]), null);
  assert.equal(parseVerdictRequest(null), null);
});
