import type { Part } from "@/lib/format";
import { cn } from "@/lib/utils";

// Numerals in the numeric face at full size, units set smaller in the text face,
// so 2 h 10 m reads as one quantity rather than four tokens.

function spacing(unit: string): string {
  if (unit === "%") return "ml-[0.03em]";
  if (unit === "of") return "mx-[0.32em]";
  if (unit.length > 1) return "ml-[0.3em]";
  return "ml-[0.08em] mr-[0.3em] last:mr-0";
}

export function Quantity({ parts, className, unitClassName }: { parts: Part[]; className?: string; unitClassName?: string }) {
  return (
    <span className={cn("inline-flex items-baseline whitespace-nowrap", className)}>
      {parts.map((p, i) =>
        p.unit ? (
          <span key={i} className={cn("font-sans text-[0.54em] font-medium tracking-normal", spacing(p.text), unitClassName)}>
            {p.text}
          </span>
        ) : (
          <span key={i} className="num">
            {p.text}
          </span>
        ),
      )}
    </span>
  );
}
