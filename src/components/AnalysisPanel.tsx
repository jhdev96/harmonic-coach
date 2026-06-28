"use client";

import type { Confidence, Measure, MeasureAnalysis } from "@/src/lib/types";

interface AnalysisPanelProps {
  measure: Measure | null;
  analysis: MeasureAnalysis | null;
}

const CONFIDENCE_STYLES: Record<Confidence, string> = {
  High: "bg-[#dde6c5] text-[#3f4a1f] border-[#c5d09f]",
  Medium: "bg-[#f0d9a8] text-[#6b4a13] border-[#dfc283]",
  Low: "bg-[#e8dccb] text-[#6b5e4f] border-[#d6c6ad]",
};

export default function AnalysisPanel({
  measure,
  analysis,
}: AnalysisPanelProps) {
  return (
    <aside
      aria-label="Measure analysis"
      className="lg:sticky lg:top-8 flex flex-col gap-5 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm sm:p-7"
    >
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

      {!measure || !analysis ? (
        <p className="text-base leading-relaxed text-[var(--muted)]">
          Select a measure to see how the coach reads it.
        </p>
      ) : (
        <div className="flex flex-col gap-5">
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
          </div>

          <section className="flex flex-col gap-2">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
              Why it works
            </p>
            <p className="text-[15px] leading-relaxed text-[var(--foreground)]/90">
              {analysis.explanation}
            </p>
          </section>

          <section className="flex flex-col gap-2 rounded-xl border border-[var(--accent)]/25 bg-[var(--accent)]/10 p-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--accent-strong)]">
              Practice tip
            </p>
            <p className="text-[15px] leading-relaxed text-[var(--foreground)]/90">
              {analysis.practiceTip}
            </p>
          </section>

          {analysis.alternativeInterpretation && (
            <section className="flex flex-col gap-2 border-t border-[var(--border)] pt-4">
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
