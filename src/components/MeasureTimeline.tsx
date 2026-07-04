"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { findMeasureBreakdown } from "@/src/lib/leadSheetAnalysis";
import type {
  HarmonicFunction,
  Measure,
  SheetAnalysis,
} from "@/src/lib/types";

interface MeasureTimelineProps {
  measures: Measure[];
  timeSignature: string;
  selectedMeasureId: string | null;
  analysis: SheetAnalysis | null;
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

// Cell tints are kept subtle so chord text stays legible on the warm
// background. Colors resolve to `--function-*` tokens in `globals.css`.
const FUNCTION_CELL_TINTS: Record<HarmonicFunction, string> = {
  tonic: "bg-[var(--function-tonic)]/15",
  subdominant: "bg-[var(--function-subdominant)]/15",
  dominant: "bg-[var(--function-dominant)]/15",
  other: "bg-[var(--function-other)]/10",
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

export default function MeasureTimeline({
  measures,
  timeSignature,
  selectedMeasureId,
  analysis,
  onSelect,
}: MeasureTimelineProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

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

  const arrowClasses =
    "absolute top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--card)] text-[var(--accent-strong)] shadow-sm transition hover:border-[var(--accent)] disabled:cursor-default disabled:opacity-30 disabled:hover:border-[var(--border)]";

  return (
    <section
      aria-label="Measure timeline"
      className="sticky bottom-4 z-10 rounded bg-[var(--card)]/95 px-3 py-2.5 shadow-[var(--shadow-timeline)] backdrop-blur"
    >
      <div className="relative">
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
            const chords = measure.chords.trim();
            const functionTint = breakdown
              ? FUNCTION_CELL_TINTS[breakdown.harmonicFunction]
              : "";

            return (
              <button
                key={measure.id}
                type="button"
                onClick={() => onSelect(measure.id)}
                aria-pressed={isSelected}
                aria-label={`Select measure ${measure.index + 1}`}
                title={breakdown ? FUNCTION_LABELS[breakdown.harmonicFunction] : undefined}
                className={`flex min-w-[132px] flex-1 shrink-0 flex-col rounded text-left transition ${functionTint} ${
                  isSelected
                    ? "ring-2 ring-[var(--accent)]/60"
                    : "hover:bg-[var(--accent)]/5"
                }`}
              >
                <span
                  className={`flex h-5 items-end px-2 font-serif text-base leading-none ${
                    isSelected
                      ? "text-[var(--accent-strong)]"
                      : "text-[var(--foreground)]"
                  }`}
                >
                  {chords}
                </span>
                <StaffLines withBarline showWholeRest={!chords} />
                <span className="flex h-4 items-center px-2 font-mono text-[10px] tracking-[0.08em] text-[var(--muted)]">
                  {breakdown?.romanNumeral ?? ""}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
