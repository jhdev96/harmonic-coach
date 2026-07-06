"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { measureHasUnparsableChords } from "@/src/lib/chordGrammar";
import { findMeasureBreakdown } from "@/src/lib/leadSheetAnalysis";
import type {
  ExtractedMeasure,
  HarmonicFunction,
  Measure,
  SheetAnalysis,
  SheetExtraction,
} from "@/src/lib/types";

interface MeasureTimelineProps {
  measures: Measure[];
  timeSignature: string;
  selectedMeasureId: string | null;
  analysis: SheetAnalysis | null;
  // The scan extraction, when this chart came from an upload: drives the
  // read-confidence flags and alternate-reading chips.
  extraction?: SheetExtraction | null;
  // True while an extraction or full-sheet analysis request is in flight.
  isAnalyzing?: boolean;
  // Bar index currently being re-analyzed after a correction, if any.
  reanalyzingIndex?: number | null;
  // Scan sessions have no measure cards, so the timeline doubles as the
  // correction surface: clicking a bar opens a chord editor.
  editable?: boolean;
  // Bar index currently sounding, so it can pulse independently of selection.
  playingMeasureIndex?: number | null;
  onSaveChords?: (id: string, chords: string) => void;
  onSelect: (id: string) => void;
}

// Staff geometry: five lines, 6px apart, inside a 34px-tall SVG.
const STAFF_LINE_YS = [5, 11, 17, 23, 29];
const STAFF_TOP = STAFF_LINE_YS[0];
const STAFF_BOTTOM = STAFF_LINE_YS[STAFF_LINE_YS.length - 1];

const FUNCTION_LABELS: Record<HarmonicFunction, string> = {
  tonic: "Tonic function",
  subdominant: "Subdominant function",
  dominant: "Dominant function",
  other: "Unclassified",
};

function StaffLines({
  withBarline,
  showWholeRest,
}: {
  withBarline: boolean;
  showWholeRest?: boolean;
}) {
  return (
    <svg
      aria-hidden
      className="block h-[34px] w-full text-[var(--foreground)]/70"
      preserveAspectRatio="none"
    >
      {STAFF_LINE_YS.map((y) => (
        <line
          key={y}
          x1="0"
          y1={y}
          x2="100%"
          y2={y}
          stroke="currentColor"
          strokeWidth="1"
        />
      ))}
      {withBarline && (
        <line
          x1="99.5%"
          y1={STAFF_TOP}
          x2="99.5%"
          y2={STAFF_BOTTOM}
          stroke="currentColor"
          strokeWidth="1.5"
        />
      )}
      {/* A whole rest hanging from the second staff line marks an empty bar. */}
      {showWholeRest && (
        <rect x="47%" y={STAFF_LINE_YS[1]} width="10" height="4" fill="currentColor" />
      )}
    </svg>
  );
}

function ClefCell({ timeSignature }: { timeSignature: string }) {
  const [beats, unit] = timeSignature.split("/");
  const hasStackedSignature = Boolean(beats && unit);

  return (
    <div aria-hidden className="flex w-[60px] shrink-0 flex-col">
      <div className="h-5" />
      <div className="relative">
        <StaffLines withBarline={false} />
        <span className="absolute left-0 top-1/2 -translate-y-1/2 font-serif text-[34px] leading-none text-[var(--foreground)]/80">
          {"\u{1D11E}"}
        </span>
        {hasStackedSignature ? (
          <span className="absolute right-1 top-1/2 flex -translate-y-1/2 flex-col items-center font-serif text-[12px] font-semibold leading-[13px] text-[var(--foreground)]/80">
            <span>{beats}</span>
            <span>{unit}</span>
          </span>
        ) : (
          <span className="absolute right-1 top-1/2 -translate-y-1/2 font-serif text-[11px] text-[var(--foreground)]/80">
            {timeSignature}
          </span>
        )}
      </div>
      <div className="h-4" />
    </div>
  );
}

function findExtractedMeasure(
  extraction: SheetExtraction | null | undefined,
  measure: Measure,
): ExtractedMeasure | null {
  return (
    extraction?.measures.find(
      (entry) => entry.measureIndex === measure.index,
    ) ?? null
  );
}

function isFlagged(
  extraction: SheetExtraction | null | undefined,
  measure: Measure,
): boolean {
  const extracted = findExtractedMeasure(extraction, measure);
  const uncertainRead =
    extracted !== null && extracted.readConfidence !== "High";
  return uncertainRead || measureHasUnparsableChords(measure.chords);
}

export default function MeasureTimeline({
  measures,
  timeSignature,
  selectedMeasureId,
  analysis,
  extraction = null,
  isAnalyzing = false,
  reanalyzingIndex = null,
  editable = false,
  playingMeasureIndex = null,
  onSaveChords,
  onSelect,
}: MeasureTimelineProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftChords, setDraftChords] = useState("");

  const updateScrollState = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    setCanScrollLeft(scroller.scrollLeft > 1);
    setCanScrollRight(
      scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 1,
    );
  }, []);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    updateScrollState();
    scroller.addEventListener("scroll", updateScrollState, { passive: true });
    const observer = new ResizeObserver(updateScrollState);
    observer.observe(scroller);
    for (const child of Array.from(scroller.children)) {
      observer.observe(child);
    }
    return () => {
      scroller.removeEventListener("scroll", updateScrollState);
      observer.disconnect();
    };
    // Re-observe when bars are added or removed so overflow state stays fresh.
  }, [updateScrollState, measures.length]);

  function scrollByPage(direction: 1 | -1) {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.scrollBy({
      left: direction * scroller.clientWidth * 0.8,
      behavior: "smooth",
    });
  }

  function openEditor(measure: Measure) {
    setEditingId(measure.id);
    setDraftChords(measure.chords);
  }

  function closeEditor() {
    setEditingId(null);
  }

  function saveEditor() {
    if (editingId && onSaveChords) {
      onSaveChords(editingId, draftChords);
    }
    closeEditor();
  }

  const editingMeasure = editingId
    ? (measures.find((measure) => measure.id === editingId) ?? null)
    : null;
  const editingExtracted = editingMeasure
    ? findExtractedMeasure(extraction, editingMeasure)
    : null;

  const arrowClasses =
    "absolute top-1/2 z-20 cursor-pointer flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--card)] text-[var(--accent-strong)] transition hover:border-[var(--accent)] shadow-lg disabled:cursor-default disabled:opacity-30 disabled:hover:border-[var(--border)]";

  return (
    <section
      aria-label="Measure timeline"
      className="sticky bottom-4 z-10 rounded bg-[var(--card)]/95 px-3 py-2.5 backdrop-blur"
    >
      <div className="relative">
        {editingMeasure && (
          <div className="absolute bottom-[calc(100%+10px)] left-1/2 z-30 w-[380px] max-w-[90vw] -translate-x-1/2">
            <div className="flex flex-col gap-3 rounded border border-[var(--border)] bg-[var(--card)] p-4 shadow-[0_12px_40px_-16px_rgba(42,37,32,0.5)]">
              <div className="flex items-center justify-between">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
                  Bar {editingMeasure.index + 1}
                  {isFlagged(extraction, editingMeasure) && (
                    <span className="ml-2 normal-case tracking-normal text-[#BA7517]">
                      check this read
                    </span>
                  )}
                </p>
                <button
                  type="button"
                  onClick={closeEditor}
                  aria-label="Close editor"
                  className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted)] transition hover:text-[var(--foreground)]"
                >
                  Esc
                </button>
              </div>
              <input
                type="text"
                autoFocus
                value={draftChords}
                onChange={(event) => setDraftChords(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") saveEditor();
                  if (event.key === "Escape") closeEditor();
                }}
                aria-label={`Chords for bar ${editingMeasure.index + 1}`}
                className="w-full rounded border border-[var(--border)] bg-[var(--background)]/70 px-3 py-2 font-serif text-xl text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
              />
              {editingExtracted &&
                editingExtracted.alternateReadings.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-[var(--muted)]">
                      Could also be
                    </span>
                    {editingExtracted.alternateReadings.map((reading) => (
                      <button
                        key={reading}
                        type="button"
                        onClick={() => setDraftChords(reading)}
                        className="rounded border border-[var(--border)] bg-[var(--background)] px-2.5 py-0.5 font-serif text-sm text-[var(--foreground)] transition hover:border-[var(--accent)]"
                      >
                        {reading}
                      </button>
                    ))}
                  </div>
                )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeEditor}
                  className="rounded px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted)] transition hover:text-[var(--foreground)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveEditor}
                  className="rounded bg-[var(--accent-strong)] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--card)] transition hover:bg-[var(--accent)]"
                >
                  Save &amp; re-analyze
                </button>
              </div>
            </div>
          </div>
        )}

        {canScrollLeft && (
          <button
            type="button"
            aria-label="Scroll timeline left"
            disabled={!canScrollLeft}
            onClick={() => scrollByPage(-1)}
            className={`${arrowClasses} left-0`}
          >
            <svg aria-hidden viewBox="0 0 16 16" className="h-4 w-4">
              <path
                d="M10 3 5 8l5 5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
        {canScrollRight && (
          <button
            type="button"
            aria-label="Scroll timeline right"
            disabled={!canScrollRight}
            onClick={() => scrollByPage(1)}
            className={`${arrowClasses} right-0`}
          >
            <svg aria-hidden viewBox="0 0 16 16" className="h-4 w-4">
              <path
                d="M6 3l5 5-5 5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}

        {/* Soft fades over the carousel edges, shown only when scrollable. */}
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-y-0 left-0 z-10 w-16 rounded-l bg-gradient-to-r from-[var(--card)] to-transparent transition-opacity ${canScrollLeft ? "opacity-100" : "opacity-0"}`}
        />
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-y-0 right-0 z-10 w-16 rounded-r bg-gradient-to-l from-[var(--card)] to-transparent transition-opacity ${canScrollRight ? "opacity-100" : "opacity-0"}`}
        />

        <div
          ref={scrollerRef}
          className="flex overflow-x-auto px-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <ClefCell timeSignature={timeSignature} />

          {measures.map((measure) => {
            const breakdown = analysis
              ? findMeasureBreakdown(analysis, measure)
              : null;
            const isSelected = measure.id === selectedMeasureId;
            const isPlayingBar = measure.index === playingMeasureIndex;
            const chords = measure.chords.trim();
            const flagged = editable && isFlagged(extraction, measure);
            const isPending =
              (isAnalyzing && !breakdown) || measure.index === reanalyzingIndex;

            return (
              <button
                key={measure.id}
                type="button"
                onClick={() => {
                  onSelect(measure.id);
                  if (editable) openEditor(measure);
                }}
                aria-pressed={isSelected}
                aria-label={`${editable ? "Edit" : "Select"} measure ${measure.index + 1}${flagged ? " (check this read)" : ""}`}
                title={
                  flagged
                    ? "The coach wasn't sure it read this bar correctly — click to check"
                    : breakdown
                      ? FUNCTION_LABELS[breakdown.harmonicFunction]
                      : undefined
                }
                className={`flex min-w-[132px] flex-1 shrink-0 flex-col rounded text-left transition ${
                  isSelected
                    ? "ring-2 ring-[var(--accent)]/60"
                    : "hover:bg-[var(--accent)]/5"
                } ${isPlayingBar ? "bg-[var(--accent)]/10" : ""}`}
              >
                <span
                  className={`flex h-5 items-end justify-between px-2 font-serif text-base leading-none ${
                    isSelected
                      ? "text-[var(--accent-strong)]"
                      : "text-[var(--foreground)]"
                  }`}
                >
                  {chords}
                  {flagged && (
                    <span
                      aria-hidden
                      className="mb-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#BA7517]"
                    />
                  )}
                </span>
                <StaffLines withBarline showWholeRest={!chords} />
                <span className="flex h-4 items-center px-2 font-mono text-[10px] tracking-[0.08em] text-[var(--muted)]">
                  {isPending ? (
                    <span className="h-2 w-10 animate-pulse rounded bg-[var(--accent)]/25" />
                  ) : (
                    (breakdown?.romanNumeral ?? "")
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
