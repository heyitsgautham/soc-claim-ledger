import type { Status } from "@ledger/claims/model";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

// Status is carried by text and shape as well as colour, so it survives a greyscale
// print of the report and a colour-blind reader.

export const STATUS_TEXT: Record<Status, string> = {
  gap: "Gap",
  holds: "Holds",
  insufficient_evidence: "Insufficient evidence",
};

export function StatusMark({ status, className }: { status: Status; className?: string }) {
  if (status === "gap") {
    return (
      <span
        className={cn(
          "inline-flex items-center border-[1.5px] border-gap px-[9px] pt-[4px] pb-[3px] text-[11px] leading-none font-semibold tracking-[0.16em] text-gap uppercase",
          className,
        )}
      >
        Gap
      </span>
    );
  }
  if (status === "insufficient_evidence") {
    return (
      <span
        className={cn(
          "inline-flex items-center border border-dashed border-ink-3 px-[8px] py-[4px] text-[10.5px] leading-[1.25] font-medium tracking-[0.12em] text-ink-2 uppercase",
          className,
        )}
      >
        Insufficient evidence
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-[6px] text-[11px] leading-none font-medium tracking-[0.14em] text-ink-2 uppercase", className)}>
      <Check className="size-[13px] text-ink-3" strokeWidth={2.25} aria-hidden />
      Holds
    </span>
  );
}
