import assert from "node:assert/strict";
import { test } from "vitest";
import { Rng } from "../src/rng";

const draws = (r: Rng, n: number, f: (r: Rng) => number) => Array.from({ length: n }, () => f(r));
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

test("the same seed gives the same stream, and another seed a different one", () => {
  assert.deepEqual(
    draws(new Rng("P-04"), 5, (r) => r.next()),
    draws(new Rng("P-04"), 5, (r) => r.next()),
  );
  assert.notDeepEqual(
    draws(new Rng("P-04"), 5, (r) => r.next()),
    draws(new Rng("P-06"), 5, (r) => r.next()),
  );
});

test("a fork's numbers do not move when the parent draws more", () => {
  const a = new Rng("seed");
  const b = new Rng("seed");
  b.next();
  b.next();
  assert.deepEqual(
    draws(a.fork("alerts"), 3, (r) => r.next()),
    draws(b.fork("alerts"), 3, (r) => r.next()),
  );
  assert.notDeepEqual(
    draws(a.fork("alerts"), 3, (r) => r.next()),
    draws(a.fork("cases"), 3, (r) => r.next()),
  );
});

test("uniform draws stay in [0, 1) and integers stay inside their inclusive bounds", () => {
  const r = new Rng("bounds");
  for (const x of draws(r, 2000, (r) => r.next())) assert.ok(x >= 0 && x < 1);
  const ints = draws(r, 2000, (r) => r.int(3, 5));
  assert.deepEqual([...new Set(ints)].sort(), [3, 4, 5]);
  for (const x of draws(r, 500, (r) => r.uniform(-2, 2))) assert.ok(x >= -2 && x < 2);
  for (const x of draws(r, 500, (r) => r.triangular(1, 2, 10))) assert.ok(x >= 1 && x <= 10);
});

test("an empty pick and a weighted pick with no positive weight are refused", () => {
  const r = new Rng("refuse");
  assert.throws(() => r.pick([]), /pick from an empty list/);
  assert.throws(() => r.weighted(["a", "b"], () => 0), /no positive weight/);
});

test("a weighted pick follows its weights and never returns a zero-weight item", () => {
  const r = new Rng("weights");
  const picks = draws(r, 4000, (r) =>
    ["rare", "common", "never"].indexOf(r.weighted(["rare", "common", "never"], (x) => ({ rare: 1, common: 3, never: 0 })[x]!)),
  );
  const common = picks.filter((p) => p === 1).length / picks.length;
  assert.ok(Math.abs(common - 0.75) < 0.03, String(common));
  assert.ok(!picks.includes(2));
});

test("the distributions centre where their parameters say", () => {
  const r = new Rng("moments");
  assert.ok(Math.abs(mean(draws(r, 20000, (r) => r.normal(10, 2))) - 10) < 0.1);
  assert.ok(Math.abs(mean(draws(r, 20000, (r) => r.exponential(4))) - 4) < 0.15);
  assert.ok(Math.abs(mean(draws(r, 20000, (r) => r.poisson(3))) - 3) < 0.1);
  assert.ok(Math.abs(mean(draws(r, 5000, (r) => r.poisson(200))) - 200) < 1);
  const ln = draws(r, 20001, (r) => r.lognormal(30, 0.8)).sort((a, b) => a - b);
  assert.ok(Math.abs(ln[10000]! - 30) < 1.5, String(ln[10000]));
  assert.equal(r.poisson(0), 0);
  assert.equal(
    draws(r, 1000, (r) => (r.chance(0) ? 1 : 0)).reduce((a, b) => a + b),
    0,
  );
  assert.equal(
    draws(r, 1000, (r) => (r.chance(1) ? 1 : 0)).reduce((a, b) => a + b),
    1000,
  );
});
