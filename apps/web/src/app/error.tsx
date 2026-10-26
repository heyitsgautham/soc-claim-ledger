"use client";

import { useRouter } from "next/navigation";
import { startTransition } from "react";

// A screen that fails on the server lands here instead of the framework's blank page. The
// usual cause on a fresh machine is an analysis that has not run, so the page says how to
// run it, and gives the digest the server logged the stack trace under.
export default function ScreenError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  // The failure was on the server, so the screen is fetched again before it re-renders.
  const retry = () =>
    startTransition(() => {
      router.refresh();
      reset();
    });
  return (
    <main className="mx-auto flex h-full max-w-[1100px] flex-col justify-center gap-6 px-8" data-testid="screen-error">
      <span className="label-caps">Screen not drawn</span>
      <h1 className="font-serif text-[34px] leading-[1.2] text-ink">This screen could not be drawn from the analysis on this machine.</h1>
      <p className="max-w-[720px] text-[15px] leading-[1.55] text-ink-2">
        If the analysis has not run here yet, run <code className="num text-ink">pnpm simulate</code> and <code className="num text-ink">pnpm analyse</code>,
        then reload. Otherwise the server log holds the cause.
      </p>
      {error.digest && (
        <p className="text-[13px] text-ink-3" data-testid="screen-error-digest">
          Look for digest <span className="num text-ink">{error.digest}</span> in the server log.
        </p>
      )}
      <button
        type="button"
        onClick={retry}
        data-testid="screen-error-retry"
        className="self-start border border-ink bg-ink px-5 py-[11px] text-[14px] leading-none text-paper hover:bg-ink-2"
      >
        Try again
      </button>
    </main>
  );
}
