import type { EvidenceSection } from "@ledger/claims/model";
import { cn } from "@/lib/utils";

type NotesSection = Extract<EvidenceSection, { type: "notes" }>;

// A templated-notes cluster. Each note is set against the cluster's most central note,
// and the only words that differ are marked, which is usually just the hostname.

function differing(text: string, reference: string): Set<number> {
  const a = text.split(/\s+/);
  const b = reference.split(/\s+/);
  const out = new Set<number>();
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) out.add(i);
  return out;
}

export function NotesTable({ section }: { section: NotesSection }) {
  const { cluster } = section;
  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="notes-table">
      <p className="mb-3 text-[13px] leading-snug text-ink-2">
        <span className="num text-ink">{cluster.size}</span> of the <span className="num text-ink">{section.compared}</span> closure notes on these cases match
        at a cosine similarity of <span className="num text-ink">{section.threshold.toFixed(2)}</span> or more. Words that differ from the central note are
        marked.{" "}
        <span className="num text-ink-3">
          Detector {section.detector.id} {section.detector.version}
        </span>
      </p>
      <div className="grid grid-cols-[124px_minmax(0,1fr)_64px] gap-x-5 border-b border-ink pb-2">
        <span className="label-caps">Case, closed by</span>
        <span className="label-caps">Closure note, as submitted</span>
        <span className="label-caps text-right">Similar</span>
      </div>
      <ol className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {cluster.members.map((m) => {
          const diff = differing(m.text, cluster.medoidText);
          return (
            <li key={m.id} className="grid grid-cols-[124px_minmax(0,1fr)_64px] items-start gap-x-5 border-b border-rule-soft py-[8px]">
              <span className="flex flex-col gap-[4px]">
                <span className="num text-[12.5px] leading-none text-ink">{m.id}</span>
                <span className="num text-[11.5px] leading-none text-ink-3">{m.owner}</span>
              </span>
              <span className="line-clamp-2 font-serif text-[13.5px] leading-[1.4] text-ink-2">
                {m.text.split(/\s+/).map((w, i) => (
                  <span key={i} className={cn(diff.has(i) && "bg-gap-tint px-[2px] font-sans text-[12.5px] font-medium text-gap")}>
                    {w}{" "}
                  </span>
                ))}
              </span>
              <span className={cn("num text-right text-[13px] leading-none", m.id === cluster.medoidId ? "text-ink-3" : "font-semibold text-gap")}>
                {m.id === cluster.medoidId ? "centre" : m.similarity.toFixed(3)}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
