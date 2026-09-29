// Risk across the last four submissions, on a fixed 0 to 100 scale so rows compare.
export function Sparkline({ values, width = 112, height = 30, tone = "ink" }: { values: number[]; width?: number; height?: number; tone?: "ink" | "gap" }) {
  if (!values.length) return null;
  const pad = 3;
  const x = (i: number) => pad + (i * (width - 2 * pad)) / Math.max(1, values.length - 1);
  const y = (v: number) => pad + (1 - v / 100) * (height - 2 * pad);
  const d = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const last = values.length - 1;
  const color = tone === "gap" ? "var(--gap)" : "var(--ink)";
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="block overflow-visible">
      <line x1={pad} x2={width - pad} y1={y(0)} y2={y(0)} stroke="var(--rule)" />
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
      {values.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r={i === last ? 3 : 1.6} fill={i === last ? color : "var(--paper)"} stroke={color} strokeWidth={1.2} />
      ))}
    </svg>
  );
}
