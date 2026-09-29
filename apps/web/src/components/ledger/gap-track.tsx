import type { ClaimEvaluation } from "@ledger/claims/model";
import { Quantity } from "@/components/quantity";
import { measure, recomputed, variance, varianceParts } from "@/lib/format";
import { pct, track } from "@/lib/scale";
import { cn } from "@/lib/utils";

// The variance column. The claim is an ink tick, the evidence a blue dot, both on the
// claim's own number line, and a red bar spans the distance when the claim fails.

export function GapTrack({ evaluation: e, major, delayMs }: { evaluation: ClaimEvaluation; major: boolean; delayMs: number }) {
  if (e.status === "insufficient_evidence") return <UntestableTrack evaluation={e} major={major} />;

  const t = track(e);
  const a = pct(t.attested, t.max);
  const r = t.recomputed === null ? a : pct(t.recomputed, t.max);
  const lo = Math.min(a, r);
  const hi = Math.max(a, r);
  const isGap = e.status === "gap";
  const drawFromRight = a > r;
  const barDuration = 760;
  const label = variance(e);
  const narrow = hi - lo < 14;

  return (
    <div
      className={cn("group/track relative w-full", major ? "h-[64px]" : "h-[34px]")}
      data-testid={`gap-track-${e.claim.ref}`}
      aria-hidden
    >
      {/* baseline and end ticks */}
      <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-rule" />
      <div className="absolute top-1/2 left-0 h-[7px] w-px -translate-y-1/2 bg-ink-4" />
      <div className="absolute top-1/2 right-0 h-[7px] w-px -translate-y-1/2 bg-ink-4" />
      <div
        className={cn(
          "num absolute inset-x-0 flex justify-between text-[10.5px] leading-none text-ink-3",
          major ? "top-[calc(50%+10px)]" : "top-[calc(50%+7px)] opacity-0 transition-opacity group-hover/row:opacity-100",
        )}
      >
        <span className="-translate-x-[1px]">{t.startLabel}</span>
        <span className="translate-x-[1px]">{t.endLabel}</span>
      </div>

      {t.reference && (
        <div className="absolute top-0 bottom-0" style={{ left: `${pct(t.reference.at, t.max)}%` }}>
          <div className={cn("absolute top-1/2 w-px -translate-y-1/2 bg-ink-3", major ? "h-[26px]" : "h-[16px]")} />
          {major && (
            <span className="num absolute top-[calc(50%+10px)] -translate-x-1/2 text-[10.5px] leading-none whitespace-nowrap text-ink-2">
              {t.reference.label}
            </span>
          )}
        </div>
      )}

      {/* the span between claim and evidence */}
      {hi > lo && (
        <div
          className={cn("absolute top-1/2 -translate-y-1/2", isGap ? (major ? "h-[8px]" : "h-[5px]") : "h-[2px]")}
          style={{ left: `${lo}%`, width: `${hi - lo}%` }}
        >
          <div
            className={cn("h-full w-full", isGap ? "anim-draw-x bg-gap" : "bg-ink-4")}
            style={isGap ? { transformOrigin: drawFromRight ? "right" : "left", animationDelay: `${delayMs}ms` } : undefined}
          />
        </div>
      )}

      {isGap && major && label && (
        <div
          className="anim-appear absolute bottom-[calc(50%+9px)] text-[14px] leading-none font-semibold whitespace-nowrap text-gap"
          style={{
            left: narrow ? `${hi}%` : `${(lo + hi) / 2}%`,
            transform: narrow ? "translateX(8px)" : "translateX(-50%)",
            animationDelay: `${delayMs + barDuration - 200}ms`,
          }}
        >
          <Quantity parts={varianceParts(e)} unitClassName="text-[0.82em]" />
        </div>
      )}

      {/* attested mark */}
      <div
        className={cn("absolute top-1/2 w-[2px] -translate-x-1/2 -translate-y-1/2 bg-ink", major ? "h-[24px]" : "h-[14px]")}
        style={{ left: `${a}%` }}
        title={`Attested ${measure(e.claim.attested)}`}
      />

      {/* evidence mark */}
      {t.recomputed !== null && (
        <div
          className={cn(
            "absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-evidence ring-2 ring-paper",
            major ? "size-[12px]" : "size-[8px]",
            isGap && "anim-appear",
          )}
          style={{ left: `${r}%`, animationDelay: isGap ? `${delayMs + barDuration - 120}ms` : undefined }}
          title={`Recomputed ${recomputed(e)}`}
        />
      )}
    </div>
  );
}

function UntestableTrack({ evaluation: e, major }: { evaluation: ClaimEvaluation; major: boolean }) {
  const reason = e.reason;
  const text =
    reason?.kind === "missing_export"
      ? `No ${reason.exports.map((x) => x.replace("_", " ")).join(", ")} export in the submission`
      : reason?.kind === "partial_export"
        ? `${reason.exports.map((x) => x.replace("_", " ")).join(", ")} export declared incomplete`
        : reason?.kind === "short_window"
          ? `Needs ${reason.needed} quarters, ${reason.available} submitted`
          : reason?.kind === "empty_population"
            ? `No ${reason.noun} in the submission`
            : "Cannot be recomputed";
  return (
    <div className={cn("relative flex w-full items-center", major ? "h-[64px]" : "h-[34px]")} data-testid={`gap-track-${e.claim.ref}`}>
      <div className="hatch absolute inset-x-0 top-1/2 h-[14px] -translate-y-1/2 border-y border-rule" />
      <span className="relative mx-auto bg-paper px-2 text-[12px] leading-none text-ink-2 group-hover/row:bg-paper-deep">{text}</span>
    </div>
  );
}
