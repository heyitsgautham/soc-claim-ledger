import assert from "node:assert/strict";
import { afterEach, test, vi } from "vitest";
import { onRequestError } from "@/instrumentation";
import { log } from "@/lib/log";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

const context = { routerKind: "App Router", routePath: "/calibration", routeType: "render", revalidateReason: undefined } as const;

test("a failed render is logged with its path, route and the digest the error page shows", async () => {
  const error = vi.spyOn(log, "error").mockImplementation(() => undefined);
  const err = Object.assign(new Error("portfolio.json is missing"), { digest: "2352814717" });
  await onRequestError(err, { path: "/calibration?x=1", method: "GET", headers: {} }, context);
  assert.equal(error.mock.calls.length, 1);
  const [fields, msg] = error.mock.calls[0]! as unknown as [Record<string, unknown>, string];
  assert.equal(msg, "request failed");
  assert.deepEqual(
    { ...fields, err: undefined },
    { err: undefined, method: "GET", path: "/calibration?x=1", route: "/calibration", routeType: "render", digest: "2352814717" },
  );
  assert.equal(fields.err, err);
});

test("an error without a digest, or a thrown string, is still logged", async () => {
  const error = vi.spyOn(log, "error").mockImplementation(() => undefined);
  await onRequestError("boom", { path: "/api/verdicts", method: "POST", headers: {} }, { ...context, routePath: "/api/verdicts", routeType: "route" });
  const [fields] = error.mock.calls[0]! as unknown as [Record<string, unknown>];
  assert.equal(fields.digest, undefined);
  assert.equal(fields.err, "boom");
});

test("on the edge runtime, which has no Node streams, nothing is logged", async () => {
  vi.stubEnv("NEXT_RUNTIME", "edge");
  const error = vi.spyOn(log, "error").mockImplementation(() => undefined);
  await onRequestError(new Error("x"), { path: "/", method: "GET", headers: {} }, context);
  assert.equal(error.mock.calls.length, 0);
});
