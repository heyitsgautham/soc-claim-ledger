import type { Metric } from "./schema";
import { COVERAGE_METRICS } from "./metrics/coverage";
import { OPERATIONS_METRICS } from "./metrics/operations";
import { RESPONSE_METRICS } from "./metrics/response";
import type { MetricDefinition } from "./metrics/shared";

export type { Computed, MetricDefinition, QueryContext } from "./metrics/shared";

// The claim-to-query mapping, one entry per questionnaire metric, in questionnaire order.
// The definitions live in metrics/, grouped by what they measure. The type below fails
// the build if a metric in the schema has no definition.
export const CATALOGUE: Record<Metric, MetricDefinition> = {
  ...RESPONSE_METRICS,
  ...COVERAGE_METRICS,
  ...OPERATIONS_METRICS,
};
