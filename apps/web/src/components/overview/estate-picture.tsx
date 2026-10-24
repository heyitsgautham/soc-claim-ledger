"use client";

import type { Overview } from "@ledger/claims/model";
import type { AssetClass } from "@ledger/submission/constants";
import { type CSSProperties, useEffect, useState } from "react";
import { int } from "@/lib/format";

// The entity drawn as an examiner would sketch it: what it runs, one square per asset,
// critical ones in ink, and the SOC those assets report to. Alerts travel as dots from
// each part of the estate into the SOC, as many as that part raised, in proportion.
//
// "world" opens a submission: the SOC's analysts and the quarter's alert count.
// "silence" is negative space: each class labelled with what it raised in the window,
// and the OT sites that raised nothing outlined in red.

export const VB_W = 1180;
export const VB_H = 590;

const PITCH = 7;
const SQUARE = 5;
// IT blocks stand on one baseline and are as tall as their assets need.
const IT_BASE = 330;
const BUS_Y = 356;
const OT_TOP = 424;
const SITE_H = 140;
const SOC = { x: 930, y: 196, w: 250, h: 250 };

const IT: { k: AssetClass; label: string; x: number; w: number }[] = [
  { k: "datacentre", label: "Data centre", x: 0, w: 200 },
  { k: "dmz", label: "DMZ", x: 216, w: 180 },
  { k: "endpoint", label: "Endpoints", x: 412, w: 290 },
  { k: "cloud", label: "Cloud", x: 718, w: 142 },
];

// When each part arrives, in ms from the picture's first paint.
export const WORLD_TIMES = { blocks: 150, sites: 700, soc: 3000, flows: 4200, dots: 4500, exemplar: 7000 } as const;
const SILENCE_TIMES = { blocks: 100, sites: 350, soc: 500, flows: 700, dots: 900, exemplar: 0 } as const;

const DOT_MS = 2600;

const at = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });

function still(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Counts up to a figure once, so the quarter's alerts arrive while the dots do.
export function useCountUp(to: number, startMs: number, runMs: number): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (still()) {
      setN(to);
      return;
    }
    let raf = 0;
    const t0 = performance.now() + startMs;
    const step = (t: number) => {
      const k = Math.max(0, Math.min(1, (t - t0) / runMs));
      setN(Math.round(to * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, startMs, runMs]);
  return n;
}

function cols(w: number): number {
  return Math.floor((w - 28 + (PITCH - SQUARE)) / PITCH);
}

function blockTop(assets: number, w: number): number {
  return IT_BASE - (62 + Math.ceil(assets / cols(w)) * PITCH + 12);
}

// Down from the block, along the shared line, into the SOC's left side.
function itPath(cx: number): string {
  return `M ${cx} ${IT_BASE} L ${cx} ${BUS_Y - 10} Q ${cx} ${BUS_Y} ${cx + 10} ${BUS_Y} L ${SOC.x} ${BUS_Y}`;
}

// From the OT row's right edge, under the SOC, up into it.
const OT_PATH = `M 860 ${OT_TOP + SITE_H / 2} L ${SOC.x + SOC.w / 2 - 12} ${OT_TOP + SITE_H / 2} Q ${SOC.x + SOC.w / 2} ${OT_TOP + SITE_H / 2} ${SOC.x + SOC.w / 2} ${OT_TOP + SITE_H / 2 - 12} L ${SOC.x + SOC.w / 2} ${SOC.y + SOC.h}`;

export function EstatePicture({
  code,
  overview: o,
  mode,
  windowAlerts,
  expectedOt,
  testId,
}: {
  code: string;
  overview: Overview;
  mode: "world" | "silence";
  // Alerts per class across the negative-space window, for "silence".
  windowAlerts?: Partial<Record<AssetClass, number>>;
  expectedOt?: number;
  testId?: string;
}) {
  const T = mode === "world" ? WORLD_TIMES : SILENCE_TIMES;
  const silence = mode === "silence";
  const [moving, setMoving] = useState(false);
  useEffect(() => setMoving(!still()), []);
  const by = new Map(o.estate.map((e) => [e.assetClass, e]));
  const ot = by.get("ot");
  const raised = (k: AssetClass) => (silence ? (windowAlerts?.[k] ?? 0) : (by.get(k)?.alerts ?? 0));
  const itRaised = IT.reduce((s, b) => s + raised(b.k), 0);
  const count = useCountUp(o.alerts, T.dots, 6500);
  const analysts = new Map(o.analysts.map((a) => [a.level, a.count]));
  const exemplarFrom = o.exemplar ? IT.find((b) => b.k === o.exemplar!.assetClass) : undefined;
  const siteW = 98;
  const siteGap = (860 - o.otSites.length * siteW) / Math.max(1, o.otSites.length - 1);

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      className="block h-auto w-full"
      role="img"
      aria-label={`${code}'s estate and the SOC its alerts go to`}
      data-testid={testId}
    >
      {/* the lines alerts travel along, drawn first so blocks sit over them */}
      {IT.map((b, i) =>
        by.get(b.k) ? (
          <path
            key={b.k}
            d={itPath(b.x + b.w / 2)}
            fill="none"
            stroke="var(--evidence-soft)"
            strokeWidth={1.3}
            className="anim-appear"
            style={at(T.flows + i * 90)}
          />
        ) : null,
      )}
      {ot && (
        <path
          d={OT_PATH}
          fill="none"
          stroke={silence ? "var(--gap)" : "var(--ink-4)"}
          strokeWidth={silence ? 1.5 : 1.2}
          strokeDasharray="4 5"
          className="anim-appear"
          style={at(T.flows + 300)}
          data-testid="estate-ot-line"
        />
      )}

      {/* IT, one block per asset class */}
      {IT.map((b, i) => {
        const e = by.get(b.k);
        if (!e) return null;
        const top = blockTop(e.assets, b.w);
        return (
          <g key={b.k} className="anim-settle" style={at(T.blocks + i * 140)} data-testid={`estate-${b.k}`}>
            <rect
              x={b.x + 0.5}
              y={top + 0.5}
              width={b.w - 1}
              height={IT_BASE - top}
              fill="var(--paper-sheet)"
              stroke={silence ? "var(--evidence-soft)" : "var(--rule)"}
            />
            <text x={b.x + 14} y={top + 27} fontSize={17} fill="var(--ink)" className="font-serif">
              {b.label}
            </text>
            <text x={b.x + 14} y={top + 46} fontSize={12} fill={silence ? "var(--evidence)" : "var(--ink-3)"} className="num">
              {silence ? `${int(raised(b.k))} alerts` : `${int(e.assets)} assets${e.critical ? `, ${int(e.critical)} critical` : ""}`}
            </text>
            {Array.from({ length: e.assets }, (_, j) => (
              <rect
                key={j}
                x={b.x + 14 + (j % cols(b.w)) * PITCH}
                y={top + 62 + Math.floor(j / cols(b.w)) * PITCH}
                width={SQUARE}
                height={SQUARE}
                // Critical assets fill the first squares, the way a register lists them first.
                fill={j < e.critical ? (silence ? "var(--evidence)" : "var(--ink)") : silence ? "var(--evidence-soft)" : "var(--ink-4)"}
              />
            ))}
          </g>
        );
      })}

      {/* OT, grid control, one box per site. The frame is what an edit ring points at. */}
      {ot && <rect x={-6} y={OT_TOP - 52} width={872} height={SITE_H + 58} fill="none" data-testid="estate-ot-row" />}
      {ot && (
        <g className="anim-settle" style={at(T.sites)} data-testid="estate-ot">
          <text x={0} y={OT_TOP - 30} fontSize={17} fill={silence ? "var(--gap)" : "var(--ink)"} className="font-serif">
            Grid control systems, OT
          </text>
          <text x={0} y={OT_TOP - 11} fontSize={12} fill={silence ? "var(--gap)" : "var(--ink-3)"} className="num">
            {silence
              ? `0 alerts${expectedOt ? `, about ${int(expectedOt)} expected` : ""}`
              : `${int(ot.assets)} assets at ${o.otSites.length} sites, ${int(ot.critical)} critical`}
          </text>
        </g>
      )}
      {ot &&
        (() => {
          let placed = 0;
          return o.otSites.map((s, i) => {
            const x = i * (siteW + siteGap);
            // Critical assets spread across the sites in proportion, the first ones inked.
            const crit = Math.round((ot.critical * (placed + s.assets)) / ot.assets) - Math.round((ot.critical * placed) / ot.assets);
            placed += s.assets;
            const stroke = silence ? "var(--gap)" : "var(--ink-3)";
            return (
              <g key={s.site} className="anim-settle" style={at(T.sites + 120 + i * 80)} data-testid={`site-${s.site}`}>
                <rect
                  x={x + 0.5}
                  y={OT_TOP + 0.5}
                  width={siteW - 1}
                  height={SITE_H}
                  fill={silence ? "var(--gap-tint)" : "var(--paper-sheet)"}
                  fillOpacity={silence ? 0.5 : 1}
                  stroke={silence ? "var(--gap)" : "var(--rule)"}
                  strokeWidth={silence ? 1.5 : 1}
                />
                {/* a substation, drawn as a gable over a bus bar */}
                <path
                  d={`M ${x + 22} ${OT_TOP + 42} L ${x + siteW / 2} ${OT_TOP + 20} L ${x + siteW - 22} ${OT_TOP + 42} Z`}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={1.3}
                />
                <line x1={x + 22} x2={x + siteW - 22} y1={OT_TOP + 48} y2={OT_TOP + 48} stroke={stroke} strokeWidth={1.3} />
                {Array.from({ length: s.assets }, (_, j) => (
                  <rect
                    key={j}
                    x={x + 17 + (j % 5) * 13}
                    y={OT_TOP + 60 + Math.floor(j / 5) * 13}
                    width={9}
                    height={9}
                    fill={silence ? "none" : j < crit ? "var(--ink)" : "var(--ink-4)"}
                    stroke={silence ? "var(--gap)" : "none"}
                    strokeWidth={1.2}
                  />
                ))}
                <text
                  x={x + siteW / 2}
                  y={OT_TOP + SITE_H - 12}
                  textAnchor="middle"
                  fontSize={12}
                  fill={silence ? "var(--gap)" : "var(--ink-2)"}
                  className="num"
                >
                  {s.site}
                </text>
              </g>
            );
          });
        })()}

      {/* the SOC */}
      <g className="anim-settle" style={at(T.soc)} data-testid="estate-soc">
        <rect x={SOC.x + 0.5} y={SOC.y + 0.5} width={SOC.w - 1} height={SOC.h} fill="var(--paper-sheet)" stroke="var(--ink)" strokeWidth={1.4} />
        <text x={SOC.x + 18} y={SOC.y + 34} fontSize={24} fill="var(--ink)" className="font-serif">
          SOC
        </text>
        <text x={SOC.x + 18} y={SOC.y + 54} fontSize={12} fill="var(--ink-3)">
          Security operations centre
        </text>
        {!silence &&
          (["L1", "L2", "L3"] as const).map((level, row) => {
            const n = analysts.get(level) ?? 0;
            const y = SOC.y + 88 + row * 38 + (row > 0 ? 18 : 0);
            return (
              <g key={level}>
                <text x={SOC.x + 18} y={y + 4} fontSize={12} fill="var(--ink-2)" className="num">
                  {level}
                </text>
                {Array.from({ length: n }, (_, j) => {
                  const cx = SOC.x + 60 + (j % 6) * 29;
                  const cy = y - 4 + Math.floor(j / 6) * 24;
                  const fill = level === "L1" ? "var(--ink-3)" : "var(--ink)";
                  return (
                    <g key={j} className="anim-appear" style={at(T.soc + 250 + (row * 6 + j) * 35)}>
                      <circle cx={cx} cy={cy - 5} r={5} fill={fill} />
                      <path d={`M ${cx - 9} ${cy + 9} Q ${cx} ${cy - 2} ${cx + 9} ${cy + 9} Z`} fill={fill} />
                    </g>
                  );
                })}
              </g>
            );
          })}
        {!silence ? (
          <>
            <text x={SOC.x + 18} y={SOC.y + SOC.h - 18} fontSize={26} fontWeight={500} fill="var(--ink)" className="num" data-testid="estate-alert-count">
              {int(count)}
            </text>
            <text x={SOC.x + 28 + 15.6 * int(o.alerts).length} y={SOC.y + SOC.h - 19} fontSize={12} fill="var(--ink-3)">
              alerts this quarter
            </text>
          </>
        ) : (
          <>
            <text x={SOC.x + 18} y={SOC.y + 110} fontSize={30} fontWeight={500} fill="var(--evidence)" className="num">
              {int(itRaised)}
            </text>
            <text x={SOC.x + 18} y={SOC.y + 132} fontSize={12.5} fill="var(--ink-2)">
              alerts from IT
            </text>
            <text x={SOC.x + 18} y={SOC.y + 194} fontSize={30} fontWeight={500} fill="var(--gap)" className="num">
              0
            </text>
            <text x={SOC.x + 18} y={SOC.y + 216} fontSize={12.5} fill="var(--gap)">
              alerts from OT
            </text>
          </>
        )}
      </g>

      {/* alerts, in proportion to what each part raised */}
      {moving &&
        itRaised > 0 &&
        IT.map((b, i) => {
          if (!by.get(b.k)) return null;
          const n = Math.max(2, Math.min(16, Math.round((raised(b.k) / itRaised) * 34)));
          const d = itPath(b.x + b.w / 2);
          return Array.from({ length: n }, (_, j) => {
            const begin = `${(T.dots + (j / n) * DOT_MS + i * 70) / 1000}s`;
            return (
              <circle key={`${b.k}-${j}`} r={3.2} fill="var(--evidence)" opacity={0}>
                <set attributeName="opacity" to="0.9" begin={begin} />
                <animateMotion dur={`${DOT_MS / 1000}s`} begin={begin} repeatCount="indefinite" path={d} />
              </circle>
            );
          });
        })}

      {/* one critical alert, followed from its part of the estate into the SOC */}
      {moving && !silence && exemplarFrom && (
        <circle r={6} fill="var(--paper-sheet)" stroke="var(--gap)" strokeWidth={2.6} opacity={0} data-testid="estate-exemplar-dot">
          <set attributeName="opacity" to="1" begin={`${T.exemplar / 1000}s`} />
          <animateMotion dur="1.3s" begin={`${T.exemplar / 1000}s`} fill="freeze" path={itPath(exemplarFrom.x + exemplarFrom.w / 2)} />
          <set attributeName="opacity" to="0" begin={`${(T.exemplar + 1700) / 1000}s`} />
        </circle>
      )}
    </svg>
  );
}
