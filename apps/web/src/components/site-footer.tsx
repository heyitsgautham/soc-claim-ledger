import Link from "next/link";
import { BRAND } from "@/lib/brand";

// On every screen, including under an open evidence drawer. It sits in the page flow,
// below the scrolling content, so nothing ever runs underneath it.
export function SiteFooter() {
  return (
    <footer
      data-testid="site-footer"
      className="relative z-[60] flex h-[var(--footer-height)] [view-transition-name:site-footer] shrink-0 items-center justify-between border-t border-rule bg-paper px-8 text-[12px] text-ink-3 min-[1680px]:px-12"
    >
      <span>
        Target product · working prototype · synthetic data ·{" "}
        <Link href="/method" className="underline decoration-rule underline-offset-2 hover:text-ink" data-testid="footer-method">
          Method and sources
        </Link>
      </span>
      <span className="num text-[11px] text-ink-4">{BRAND.product} 0.1 · runs on this machine only</span>
    </footer>
  );
}
