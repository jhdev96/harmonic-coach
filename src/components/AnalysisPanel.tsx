"use client";

import { abbreviateChord } from "@/src/lib/abbreviateChord";
import type { Confidence, Measure, MeasureAnalysis } from "@/src/lib/types";

interface AnalysisPanelProps {
  measure: Measure | null;
  analysis: MeasureAnalysis | null;
  // True while an AI analysis request is in flight; shows a loading skeleton
  // instead of stale demo content.
  isLoading?: boolean;
  // Positioning is owned by the parent layout (sticky in the hero layout,
  // absolutely-filled cell in the session layout).
  className?: string;
}

function LoadingSkeleton() {
  return (
    <div aria-label="Analysis in progress" className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <div className="h-3 w-16 animate-pulse rounded bg-[var(--border)]" />
        <div className="h-8 w-32 animate-pulse rounded bg-[var(--border)]" />
      </div>
      <div className="h-6 w-48 animate-pulse rounded bg-[var(--border)]" />
      <div className="flex flex-col gap-2">
        <div className="h-3 w-full animate-pulse rounded bg-[var(--border)]/70" />
        <div className="h-3 w-full animate-pulse rounded bg-[var(--border)]/70" />
        <div className="h-3 w-3/4 animate-pulse rounded bg-[var(--border)]/70" />
      </div>
      <p className="font-serif text-[15px] italic leading-relaxed text-[var(--muted)]">
        The coach is listening through the changes…
      </p>
    </div>
  );
}

const CONFIDENCE_STYLES: Record<Confidence, string> = {
  High: "bg-[#dde6c5] text-[#3f4a1f] border-[#c5d09f]",
  Medium: "bg-[#f0d9a8] text-[#6b4a13] border-[#dfc283]",
  Low: "bg-[#e8dccb] text-[#6b5e4f] border-[#d6c6ad]",
};

export default function AnalysisPanel({
  measure,
  analysis,
  isLoading = false,
  className,
}: AnalysisPanelProps) {
  const abbreviatedChords = measure
    ? measure.chords
        .split(/\s+/)
        .filter((c) => c.length > 0)
        .map(abbreviateChord)
        .join(" ")
    : "";

  return (
    <aside
      aria-label="Measure analysis"
      className={`flex flex-col gap-5 rounded bg-[var(--card)] p-6 sm:p-7 ${className ?? ""}`}
    >
      {/* Pinned header: stays visible while the explanation below scrolls. */}
      <div className="flex shrink-0 flex-col gap-5">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-2xl tracking-tight text-[var(--foreground)]">
            Breakdown
          </h2>
          {measure && (
            <span className="font-mono text-[11px] tracking-[0.18em] text-[var(--muted)]">
              Bar {measure.index + 1}
            </span>
          )}
        </div>

        {!isLoading && measure && analysis && (
          <>
            <div className="flex flex-col gap-2">
              <p className="font-mono text-[11px] tracking-[0.18em] text-[var(--muted)]">
                Chords
              </p>
              <p className="font-serif text-3xl text-[var(--foreground)]">
                {abbreviatedChords || "—"}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <h3 className="font-serif text-xl text-[var(--foreground)]">
                {analysis.title}
              </h3>
              <span
                className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] ${CONFIDENCE_STYLES[analysis.confidence]}`}
              >
                {analysis.confidence} confidence
              </span>
              {analysis.romanNumeral && (
                <span className="rounded-full bg-[var(--background)] px-2.5 py-0.5 font-mono text-[10px] tracking-[0.08em] text-[var(--muted)]">
                  {analysis.romanNumeral}
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : !measure || !analysis ? (
        <p className="text-base leading-relaxed text-[var(--muted)]">
          Select a measure to see how the coach reads it.
        </p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto">
          <section className="flex flex-col gap-2">
            <p className="font-mono text-[11px] tracking-[0.18em] text-[var(--muted)]">
              Why it works
            </p>
            <p className="text-[15px] leading-relaxed text-[var(--foreground)]/90">
              {analysis.explanation}
            </p>
          </section>

          <section className="flex shrink-0 flex-col gap-2 rounded-xl bg-[var(--accent)]/10 p-4">
            <p className="font-mono text-[11px] tracking-[0.18em] text-[var(--accent-strong)]">
              Practice tip
            </p>
            <p className="text-[15px] leading-relaxed text-[var(--foreground)]/90">
              {analysis.practiceTip}
            </p>
          </section>

          {analysis.alternativeInterpretation && (
            <section className="flex shrink-0 flex-col gap-2 border-t border-[var(--border)] pt-4">
              <p className="font-mono text-[11px] tracking-[0.18em] text-[var(--muted)]">
                Another way to hear it
              </p>
              <p className="text-[15px] leading-relaxed text-[var(--muted)]">
                {analysis.alternativeInterpretation}
              </p>
            </section>
          )}
        </div>
      )}
    </aside>
  );
}
