import type { Finding } from "@ledger/claims/model";
import { int } from "@/lib/format";
import { cn } from "@/lib/utils";

// A finding sentence from the claims layer, with its numbers set in the numeric face.
export function FindingText({ finding, numberClassName }: { finding: Finding; numberClassName?: string }) {
  return (
    <>
      {finding.map((part, i) =>
        typeof part === "number" ? (
          <span key={i} className={cn("num font-medium", numberClassName)}>
            {Number.isInteger(part) ? int(part) : part.toFixed(part < 1 ? 2 : 1)}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}
