// SLA bunching. When closures pile into the last few minutes before an SLA,
// the process is being steered by the metric rather than by the work.
// The detector bins time-to-close in five-minute buckets and compares the bucket just
// under the SLA with the hour before it. An unhurried process has no reason to spike there.

export const BUNCHING_DETECTOR = { id: "sla-bunching", version: "1.0.0" } as const;

export interface HistogramBucket {
  start: number; // minutes, inclusive
  end: number; // minutes, exclusive
  count: number;
}

export interface Bunching {
  bucket: HistogramBucket;
  share: number; // of all closures
  baselinePerBucket: number; // mean count per bucket over the preceding hour
  ratio: number | null; // bucket count over that baseline, null when the hour before is empty
  flagged: boolean;
}

export interface ClosureHistogram {
  detector: typeof BUNCHING_DETECTOR;
  bucketMinutes: number;
  slaMinutes: number;
  total: number;
  buckets: HistogramBucket[];
  overflow: { start: number; count: number };
  bunching: Bunching;
}

export interface BunchingOptions {
  bucketMinutes?: number;
  // How far past the SLA the chart runs before everything else goes into one overflow bar.
  tailMinutes?: number;
  // Flag when the last bucket runs at this multiple of the hour before, with at least minCount closures.
  minRatio?: number;
  minCount?: number;
}

export function closureHistogram(closeMinutes: readonly number[], slaMinutes: number, options: BunchingOptions = {}): ClosureHistogram {
  const bucketMinutes = options.bucketMinutes ?? 5;
  const tailMinutes = options.tailMinutes ?? slaMinutes;
  const minRatio = options.minRatio ?? 3;
  const minCount = options.minCount ?? 8;
  if (slaMinutes % bucketMinutes !== 0) throw new Error("the SLA must fall on a bucket edge");

  const limit = slaMinutes + tailMinutes;
  const buckets: HistogramBucket[] = [];
  for (let s = 0; s < limit; s += bucketMinutes) buckets.push({ start: s, end: s + bucketMinutes, count: 0 });
  let overflow = 0;
  for (const m of closeMinutes) {
    if (m >= limit) overflow++;
    else buckets[Math.floor(Math.max(0, m) / bucketMinutes)]!.count++;
  }

  const lastIndex = slaMinutes / bucketMinutes - 1;
  const last = buckets[lastIndex]!;
  const perHour = 60 / bucketMinutes;
  const before = buckets.slice(Math.max(0, lastIndex - perHour), lastIndex);
  const baselinePerBucket = before.length ? before.reduce((sum, b) => sum + b.count, 0) / before.length : 0;
  const ratio = baselinePerBucket > 0 ? last.count / baselinePerBucket : null;
  const total = closeMinutes.length;

  return {
    detector: BUNCHING_DETECTOR,
    bucketMinutes,
    slaMinutes,
    total,
    buckets,
    overflow: { start: limit, count: overflow },
    bunching: {
      bucket: last,
      share: total ? last.count / total : 0,
      baselinePerBucket,
      ratio,
      flagged: last.count >= minCount && (ratio === null || ratio >= minRatio),
    },
  };
}
