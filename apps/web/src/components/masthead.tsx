import Link from "next/link";
import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/brand";

export type Screen = "portfolio" | "ledger" | "negative-space" | "samples" | "calibration" | "report";

// The examiner's route through an assessment, in the order the work happens.
export function Masthead({ screen, entity, cycleLabel }: { screen: Screen | "method"; entity: string; cycleLabel: string }) {
  const tabs: { id: Screen; label: string; href: string }[] = [
    { id: "portfolio", label: "Portfolio", href: "/" },
    { id: "ledger", label: "Ledger", href: `/entities/${entity}` },
    { id: "negative-space", label: "Negative space", href: `/entities/${entity}/negative-space` },
    { id: "samples", label: "Sample sheet", href: `/entities/${entity}/samples` },
    { id: "calibration", label: "Calibration", href: "/calibration" },
    { id: "report", label: "Report", href: `/entities/${entity}/report` },
  ];
  return (
    <div className="sticky top-0 z-40 border-b border-ink bg-paper [view-transition-name:masthead]" data-testid="masthead">
      <div className="mx-auto flex h-[52px] max-w-[1920px] items-stretch justify-between px-8 min-[1680px]:px-12">
        <div className="flex items-center gap-4">
          <Link href="/" className="font-serif text-[20px] leading-none font-semibold tracking-[0.01em] text-ink">
            {BRAND.product}
          </Link>
          <span className="h-5 w-px bg-rule" aria-hidden />
          <span className="text-[13px] leading-none text-ink-2">
            {cycleLabel} assessment <span className="text-ink-4">·</span> <span className="num text-ink">{entity}</span>
          </span>
        </div>
        <nav aria-label="Screens" className="flex items-stretch gap-7">
          {tabs.map((t) => (
            <Link
              key={t.id}
              href={t.href}
              data-testid={`nav-${t.id}`}
              aria-current={t.id === screen ? "page" : undefined}
              className={cn(
                "-mb-px flex items-center border-b-2 text-[13.5px] leading-none transition-colors",
                t.id === screen ? "border-ink text-ink" : "border-transparent text-ink-2 hover:text-ink",
              )}
            >
              {t.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3 text-[12px] leading-none text-ink-2">
          <span>Examiner copy</span>
          <span className="flex items-center gap-[7px] border border-ink/60 px-2 py-[5px]">
            <span className="size-[6px] bg-ink" aria-hidden />
            Local only, no network
          </span>
        </div>
      </div>
    </div>
  );
}
