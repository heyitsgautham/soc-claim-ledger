"use client";

import { Download, FileText } from "lucide-react";
import { useEffect, useState } from "react";
import type { Machine } from "./report-document";

interface Exported {
  file: string;
  pages: number;
  bytes: number;
  sha256: string;
  seconds: number;
  href: string;
}

// Export the report as PDF, rendered by the Chromium on this machine, and prove in the
// same panel that the page talked to no other host.
export function ExportPanel({ code, docId, machine }: { code: string; docId: string; machine: Machine }) {
  const [state, setState] = useState<"idle" | "working" | "done" | "error">("idle");
  const [result, setResult] = useState<Exported | null>(null);
  const [error, setError] = useState("");
  const [foreign, setForeign] = useState<number | null>(null);
  const [requests, setRequests] = useState(0);

  useEffect(() => {
    const count = () => {
      const entries = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
      setRequests(entries.length + 1);
      setForeign(entries.filter((e) => new URL(e.name, location.href).origin !== location.origin).length);
    };
    count();
    const t = setInterval(count, 1000);
    return () => clearInterval(t);
  }, []);

  async function run() {
    setState("working");
    setError("");
    try {
      const res = await fetch(`/api/report/${code}`, { method: "POST" });
      // A server that failed before answering in JSON still gets its status shown, not a parse error.
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? `Export failed, the server answered ${res.status} ${res.statusText}`.trim());
      setResult(json as Exported);
      setState("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState("error");
    }
  }

  return (
    <aside className="sticky top-[76px] flex flex-col gap-6 self-start" data-testid="export-panel">
      <div className="flex flex-col gap-3">
        <span className="label-caps">Export</span>
        <button
          type="button"
          onClick={run}
          disabled={state === "working"}
          data-testid="export-pdf"
          className="flex items-center justify-center gap-2 border border-ink bg-ink px-5 py-[12px] text-[14px] leading-none text-paper hover:bg-ink-2 disabled:opacity-60"
        >
          <FileText className="size-4" aria-hidden />
          {state === "working" ? "Rendering on this machine" : "Export PDF"}
        </button>
        {state === "done" && result && (
          <div className="anim-settle flex flex-col gap-2 border border-ink bg-paper-sheet p-4" data-testid="export-result">
            <span className="num text-[13px] text-ink">{result.file}</span>
            <span className="text-[12.5px] text-ink-2">
              <span className="num text-ink">{result.pages}</span> A4 pages · <span className="num text-ink">{Math.round(result.bytes / 1024)}</span> KB ·
              rendered in <span className="num text-ink">{result.seconds.toFixed(1)}</span> s
            </span>
            <span className="num text-[11px] break-all text-ink-3">SHA-256 {result.sha256}</span>
            <a
              href={result.href}
              download={result.file}
              className="mt-1 flex items-center gap-2 self-start text-[13px] text-evidence underline underline-offset-4"
            >
              <Download className="size-4" aria-hidden /> Save the PDF
            </a>
          </div>
        )}
        {state === "error" && <p className="text-[13px] text-gap">{error}</p>}
      </div>

      <div className="flex flex-col gap-2 border-t border-rule pt-5" data-testid="offline-badge">
        <span className="label-caps">Network</span>
        <p className="flex items-baseline gap-2">
          <span className="num text-[34px] leading-none font-semibold text-ink">{foreign ?? 0}</span>
          <span className="text-[13px] leading-snug text-ink-2">requests to any other host from this page</span>
        </p>
        <p className="text-[12px] leading-snug text-ink-3">
          Measured in this browser from its own resource timing, <span className="num">{requests}</span> requests in all, every one to this machine.
        </p>
      </div>

      <div className="flex flex-col gap-2 border-t border-rule pt-5">
        <span className="label-caps">This machine</span>
        <p className="text-[13px] leading-snug text-ink">
          {machine.platform} · <span className="num">{machine.cpus}</span> CPU cores · <span className="num">{machine.memoryGb}</span> GB · Node{" "}
          <span className="num">{machine.node}</span>
        </p>
        <p className="text-[12px] leading-snug text-ink-3">Target: 8 cores, 16 GB RAM, 20 GB free disk, no GPU and no hosted model.</p>
      </div>

      <div className="flex flex-col gap-2 border-t border-rule pt-5" data-testid="deploy-lines">
        <span className="label-caps">Install without a network</span>
        <p className="text-[12.5px] text-ink-2">One Docker image</p>
        <code className="num block bg-paper-deep px-3 py-2 text-[11.5px] leading-[1.5] text-ink">
          docker load -i soc-claim-ledger-0.1.tar
          <br />
          docker run -p 127.0.0.1:3157:3157 soc-claim-ledger:0.1
        </code>
        <p className="mt-1 text-[12.5px] text-ink-2">Or from a USB drive</p>
        <code className="num block bg-paper-deep px-3 py-2 text-[11.5px] leading-[1.5] text-ink">/Volumes/LEDGER/deploy/usb-install.sh</code>
      </div>
      <span className="num text-[11px] text-ink-4">{docId}</span>
    </aside>
  );
}
