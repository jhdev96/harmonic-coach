"use client";

import type { Confidence, Measure, MeasureAnalysis } from "@/src/lib/types";

interface AnalysisPanelProps {
  measure: Measure | null;
  analysis: MeasureAnalysis | null;
  // Positioning is owned by the parent layout (sticky in the hero layout,
  // absolutely-filled cell in the session layout).
  className?: string;
}

const CONFIDENCE_STYLES: Record<Confidence, string> = {
  High: "bg-[#dde6c5] text-[#3f4a1f] border-[#c5d09f]",
  Medium: "bg-[#f0d9a8] text-[#6b4a13] border-[#dfc283]",
  Low: "bg-[#e8dccb] text-[#6b5e4f] border-[#d6c6ad]",
};

export default function AnalysisPanel({
  measure,
  analysis,
  className,
}: AnalysisPanelProps) {
  return (
    <aside
      aria-label="Measure analysis"
      className={`flex flex-col gap-5 rounded bg-[var(--card)] p-6 shadow-sm sm:p-7 ${className ?? ""}`}
    >
      {/* Pinned header: stays visible while the explanation below scrolls. */}
      <div className="flex shrink-0 flex-col gap-5">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-2xl tracking-tight text-[var(--foreground)]">
            Analysis
          </h2>
          {measure && (
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
              Bar {measure.index + 1}
            </span>
          )}
        </div>

        {measure && analysis && (
          <>
            <div className="flex flex-col gap-2">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
                Chords
              </p>
              <p className="font-serif text-3xl text-[var(--foreground)]">
                {measure.chords.trim() || "—"}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <h3 className="font-serif text-xl text-[var(--foreground)]">
                {analysis.title}
              </h3>
              <span
                className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] ${CONFIDENCE_STYLES[analysis.confidence]}`}
              >
                {analysis.confidence} confidence
              </span>
              {analysis.romanNumeral && (
                <span className="rounded-full border border-[var(--border)] bg-[var(--background)] px-2.5 py-0.5 font-mono text-[10px] tracking-[0.08em] text-[var(--muted)]">
                  {analysis.romanNumeral}
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {!measure || !analysis ? (
        <p className="text-base leading-relaxed text-[var(--muted)]">
          Select a measure to see how the coach reads it.
        </p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto">
          <section className="flex flex-col gap-2">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
              Why it works
            </p>
            <p className="text-[15px] leading-relaxed text-[var(--foreground)]/90">
              {analysis.explanation}
            </p>
          </section>

          <section className="flex shrink-0 flex-col gap-2 rounded-xl border border-[var(--accent)]/25 bg-[var(--accent)]/10 p-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--accent-strong)]">
              Practice tip
            </p>
            <p className="text-[15px] leading-relaxed text-[var(--foreground)]/90">
              {analysis.practiceTip}
            </p>
          </section>

          {analysis.alternativeInterpretation && (
            <section className="flex shrink-0 flex-col gap-2 border-t border-[var(--border)] pt-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
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
