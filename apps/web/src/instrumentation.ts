import type { Instrumentation } from "next";

// Every request that fails on the server, a page render as well as an API route, gets one
// JSON line in the same log as the routes write, with the path, the route and the digest
// Next.js shows on the error page, so a report from the examiner finds its stack trace.

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  // pino writes to a Node stream, and the edge runtime has none.
  if (process.env.NEXT_RUNTIME === "edge") return;
  const { log } = await import("./lib/log");
  const digest = typeof error === "object" && error !== null && "digest" in error ? String(error.digest) : undefined;
  log.error({ err: error, method: request.method, path: request.path, route: context.routePath, routeType: context.routeType, digest }, "request failed");
};
