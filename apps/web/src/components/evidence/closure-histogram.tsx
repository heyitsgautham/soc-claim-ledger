import type { ClosureHistogram as Histogram } from "@ledger/detect";
import { int } from "@/lib/format";

// Time to close in the detector's buckets, with the SLA drawn in and the bucket just
// under it lit red when the bunching detector flags it.

// Drawn at the width it is shown at, so text renders at its set size.
// Bars rise left to right, and the bunched bucket rises last, on its own beat.
const STAGGER_MS = 34;
// The bars rise once the tally above has sorted, so the spike lands on its own beat.
const FIRST_MS = 3700;
const M = { top: 76, right: 4, bottom: 28, left: 2 };

// Short spans read in minutes, long ones in hours.
function span(minutes: number): string {
  if (minutes <= 120) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} m` : ""}`;
}

export function ClosureHistogram({
  histogram: h,
  title,
  width: W = 380,
  height: H = 250,
}: {
  histogram: Histogram;
  title: string;
  width?: number;
  height?: number;
}) {
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;
  const n = h.buckets.length;
  const overflowGap = 0.9;
  const slot = plotW / (n + 1 + overflowGap);
  const barW = slot - 2;
  const peak = Math.max(1, h.overflow.count, ...h.buckets.map((b) => b.count));
  const y = (count: number) => (count / peak) * plotH;
  const x = (minutes: number) => M.left + (minutes / h.bucketMinutes) * slot;
  const base = M.top + plotH;
  const bunchIndex = h.bunching.bucket.start / h.bucketMinutes;
  const lit = h.bunching.flagged;
  const slaX = x(h.slaMinutes);
  const overflowX = M.left + (n + overflowGap) * slot;
  const share = Math.round(h.bunching.share * 100);
  // An axis tick every quarter of the SLA.
  const step = h.slaMinutes / 4;
  const ticks = Array.from({ length: Math.floor((n * h.bucketMinutes) / step) + 1 }, (_, i) => i * step);

  return (
    <figure className="flex flex-col gap-3" data-testid="closure-histogram">
      <figcaption className="flex items-baseline justify-between gap-4">
        <span className="font-serif text-[16px] leading-none text-ink">{title}</span>
        <span className="label-caps !text-[10px]">SLA bunching</span>
      </figcaption>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full"
        role="img"
        aria-label={`${share}% of closures fall in the ${h.bucketMinutes} minutes before the SLA`}
      >
        {/* annotation */}
        {lit && (
          <g className="anim-appear" style={{ animationDelay: `${FIRST_MS + (n + 1) * STAGGER_MS + 900}ms` }} data-testid="bunching-annotation">
            <text x={M.left} y={31} className="num" fontSize={34} fontWeight={600} fill="var(--gap)">
              {share}%
            </text>
            <text x={M.left + 76} y={15} fontSize={12.5} fill="var(--ink-2)">
              of closures land in the last {h.bucketMinutes} minutes
            </text>
            <text x={M.left + 76} y={31} fontSize={12.5} fill="var(--ink-2)">
              before the {span(h.slaMinutes)} SLA
            </text>
          </g>
        )}

        {/* bars */}
        {h.buckets.map((b, i) => {
          const hgt = y(b.count);
          const hot = lit && i === bunchIndex;
          return (
            <rect
              key={b.start}
              x={M.left + i * slot + 1}
              y={base - hgt}
              width={barW}
              height={hgt}
              fill={hot ? "var(--gap)" : "var(--evidence)"}
              fillOpacity={hot ? 1 : 0.78}
              className="anim-rise-y"
              style={{
                transformBox: "fill-box",
                animationDelay: `${hot ? FIRST_MS + (n + 1) * STAGGER_MS + 250 : FIRST_MS + i * STAGGER_MS}ms`,
                animationDuration: hot ? "700ms" : undefined,
              }}
            />
          );
        })}
        <rect
          x={overflowX + 1}
          y={base - y(h.overflow.count)}
          width={barW}
          height={y(h.overflow.count)}
          fill="var(--ink-3)"
          className="anim-rise-y"
          style={{ transformBox: "fill-box", animationDelay: `${FIRST_MS + n * STAGGER_MS}ms` }}
        />

        {/* count over the lit bar */}
        {lit && (
          <text
            style={{ animationDelay: `${FIRST_MS + (n + 1) * STAGGER_MS + 900}ms` }}
            x={M.left + bunchIndex * slot + 1 + barW / 2}
            y={base - y(h.bunching.bucket.count) - 6}
            textAnchor="middle"
            className="num anim-appear"
            fontSize={12}
            fontWeight={600}
            fill="var(--gap)"
          >
            {int(h.bunching.bucket.count)}
          </text>
        )}

        {/* SLA */}
        <line x1={slaX} x2={slaX} y1={M.top - 26} y2={base} stroke="var(--ink)" strokeWidth={1.25} />
        <text x={slaX + 5} y={M.top - 17} fontSize={11} fill="var(--ink)" className="num">
          SLA {span(h.slaMinutes)}
        </text>

        {/* axis */}
        <line x1={M.left} x2={W - M.right} y1={base + 0.5} y2={base + 0.5} stroke="var(--ink)" strokeWidth={1} />
        {ticks.map((m, i) => (
          <g key={m}>
            <line x1={x(m)} x2={x(m)} y1={base} y2={base + 4} stroke="var(--ink-3)" />
            {i < ticks.length - 1 && (
              <text x={x(m)} y={base + 17} textAnchor={m === 0 ? "start" : "middle"} fontSize={10.5} fill="var(--ink-3)" className="num">
                {m === 0 ? "0" : span(m).replace(" min", "")}
              </text>
            )}
          </g>
        ))}
        <text x={W - 1} y={base + 17} textAnchor="end" fontSize={10.5} fill="var(--ink-3)" className="num">
          {span(h.overflow.start)}+
        </text>
      </svg>

      <p className="text-[12.5px] leading-snug text-ink-2">
        {h.bunching.ratio !== null ? (
          <>
            That bucket holds <span className="num text-ink">{int(h.bunching.bucket.count)}</span> closures, against an average of{" "}
            <span className="num text-ink">{h.bunching.baselinePerBucket.toFixed(1)}</span> in each {h.bucketMinutes}-minute bucket before it, which is{" "}
            <span className="num font-semibold text-gap">{h.bunching.ratio.toFixed(1)}×</span> the rate.
          </>
        ) : (
          <>
            That bucket holds <span className="num text-ink">{int(h.bunching.bucket.count)}</span> closures, with none in the buckets before it.
          </>
        )}
      </p>
      <p className="num -mt-1 text-[11.5px] leading-none text-ink-3">
        Detector {h.detector.id} {h.detector.version}
      </p>
    </figure>
  );
}
