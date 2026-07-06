"use client";

import { abbreviateChord } from "@/src/lib/abbreviateChord";
import type { Measure } from "@/src/lib/types";

interface MeasureCardProps {
  measure: Measure;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onChordsChange: (id: string, chords: string) => void;
}

export default function MeasureCard({
  measure,
  isSelected,
  onSelect,
  onChordsChange,
}: MeasureCardProps) {
  const baseClasses =
    "group relative flex h-full flex-col gap-3 rounded-2xl border bg-[var(--card)] p-4 text-left shadow-sm transition focus-within:-translate-y-0.5 hover:-translate-y-0.5";
  const stateClasses = isSelected
    ? "border-[var(--accent)] shadow-[0_6px_24px_-12px_rgba(125,90,58,0.55)] ring-2 ring-[var(--accent)]/40"
    : "border-[var(--border)] hover:border-[var(--accent)]/60";

  const abbreviatedChords = measure.chords
    .split(/\s+/)
    .filter((c) => c.length > 0)
    .map(abbreviateChord)
    .join(" ");

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      aria-label={`Measure ${measure.index + 1}`}
      onClick={() => onSelect(measure.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          // Don't hijack space inside the input.
          if (event.target === event.currentTarget) {
            event.preventDefault();
            onSelect(measure.id);
          }
        }
      }}
      className={`${baseClasses} ${stateClasses}`}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] tracking-[0.18em] text-[var(--muted)]">
          Bar {measure.index + 1}
        </span>
        {isSelected && (
          <span className="rounded-full bg-[var(--accent)]/15 px-2 py-0.5 font-mono text-[10px] tracking-[0.16em] text-[var(--accent-strong)]">
            Active
          </span>
        )}
      </div>
      <div className="relative">
        <div className="pointer-events-none absolute inset-0 flex items-center rounded-lg px-1 py-1 font-serif text-2xl text-[var(--foreground)]">
          {abbreviatedChords || "—"}
        </div>
        <input
          type="text"
          value={measure.chords}
          onChange={(event) => onChordsChange(measure.id, event.target.value)}
          onFocus={() => onSelect(measure.id)}
          onClick={(event) => event.stopPropagation()}
          placeholder="e.g. Cmaj7 Gm7"
          aria-label={`Chords for bar ${measure.index + 1}`}
          className="relative z-10 w-full rounded-lg border border-transparent bg-transparent px-1 py-1 font-serif text-2xl text-transparent caret-[var(--foreground)] outline-none placeholder:text-[var(--muted)]/50 focus:border-[var(--accent)]/60 focus:bg-[var(--background)]/70 focus:text-[var(--foreground)]"
        />
      </div>
    </div>
  );
}
