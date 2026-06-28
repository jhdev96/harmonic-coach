"use client";

import MeasureCard from "@/src/components/MeasureCard";
import type { Measure } from "@/src/lib/types";

interface LeadSheetEditorProps {
  measures: Measure[];
  selectedMeasureId: string | null;
  onSelect: (id: string) => void;
  onChordsChange: (id: string, chords: string) => void;
  onAddMeasure: () => void;
}

export default function LeadSheetEditor({
  measures,
  selectedMeasureId,
  onSelect,
  onChordsChange,
  onAddMeasure,
}: LeadSheetEditorProps) {
  return (
    <section aria-label="Lead sheet" className="flex flex-col gap-5">
      <div className="flex items-baseline justify-between">
        <h2 className="font-serif text-2xl tracking-tight text-[var(--foreground)]">
          Lead sheet
        </h2>
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
          {measures.length} {measures.length === 1 ? "bar" : "bars"}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {measures.map((measure) => (
          <MeasureCard
            key={measure.id}
            measure={measure}
            isSelected={measure.id === selectedMeasureId}
            onSelect={onSelect}
            onChordsChange={onChordsChange}
          />
        ))}
        <button
          type="button"
          onClick={onAddMeasure}
          className="group flex min-h-[120px] items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--accent)]/40 bg-transparent p-4 text-[var(--accent-strong)] transition hover:border-[var(--accent)] hover:bg-[var(--accent)]/10"
        >
          <span aria-hidden className="text-xl leading-none">
            +
          </span>
          <span className="font-mono text-xs uppercase tracking-[0.2em]">
            Add measure
          </span>
        </button>
      </div>
    </section>
  );
}
