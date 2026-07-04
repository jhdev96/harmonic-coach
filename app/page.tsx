"use client";

import { useMemo, useState } from "react";

import AnalysisPanel from "@/src/components/AnalysisPanel";
import Hero from "@/src/components/Hero";
import LeadSheetEditor from "@/src/components/LeadSheetEditor";
import MeasureTimeline from "@/src/components/MeasureTimeline";
import SongSettings from "@/src/components/SongSettings";
import { getMeasureAnalysis } from "@/src/lib/getMeasureAnalysis";
import {
  findMeasureBreakdown,
  requestLeadSheetAnalysis,
} from "@/src/lib/leadSheetAnalysis";
import type { Measure, SheetAnalysis } from "@/src/lib/types";

const INITIAL_MEASURES: Measure[] = [
  { id: "m-1", index: 0, chords: "C" },
  { id: "m-2", index: 1, chords: "Gm7 C7" },
  { id: "m-3", index: 2, chords: "Fmaj7" },
  { id: "m-4", index: 3, chords: "B7b9 Em7" },
];

let nextMeasureCounter = INITIAL_MEASURES.length;
function createMeasureId(): string {
  nextMeasureCounter += 1;
  return `m-${nextMeasureCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function Home() {
  const [title, setTitle] = useState("Amazing Grace reharm study");
  const [songKey, setSongKey] = useState("C major");
  const [timeSignature, setTimeSignature] = useState("4/4");
  const [measures, setMeasures] = useState<Measure[]>(INITIAL_MEASURES);
  const [selectedMeasureId, setSelectedMeasureId] = useState<string | null>(
    INITIAL_MEASURES[0].id,
  );
  const [sheetAnalysis, setSheetAnalysis] = useState<SheetAnalysis | null>(
    null,
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // A session starts on the first meaningful edit (chords, metadata, new bar)
  // or analysis run. Once active, the hero yields to a full-width workspace.
  const [isSessionActive, setIsSessionActive] = useState(false);

  const [analysisPanelWidth, setAnalysisPanelWidth] = useState(400);

  function clampPanelWidth(width: number): number {
    return Math.min(640, Math.max(300, width));
  }

  function handleResizeStart(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const handle = event.currentTarget;
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startWidth = analysisPanelWidth;
    handle.setPointerCapture(pointerId);

    function onPointerMove(moveEvent: PointerEvent) {
      setAnalysisPanelWidth(
        clampPanelWidth(startWidth + (startX - moveEvent.clientX)),
      );
    }
    function cleanup() {
      handle.removeEventListener("pointermove", onPointerMove);
      handle.removeEventListener("pointerup", cleanup);
      handle.removeEventListener("pointercancel", cleanup);
      if (handle.hasPointerCapture(pointerId)) {
        handle.releasePointerCapture(pointerId);
      }
    }

    handle.addEventListener("pointermove", onPointerMove);
    handle.addEventListener("pointerup", cleanup, { once: true });
    handle.addEventListener("pointercancel", cleanup, { once: true });
  }

  function handleResizeKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const delta = event.key === "ArrowLeft" ? 16 : -16;
    setAnalysisPanelWidth((width) => clampPanelWidth(width + delta));
  }

  const selectedMeasure = useMemo(
    () => measures.find((measure) => measure.id === selectedMeasureId) ?? null,
    [measures, selectedMeasureId],
  );

  // Prefer the breakdown when it exists and still matches the bar's
  // current chords; otherwise fall back to the hardcoded demo analysis.
  const selectedAnalysis = useMemo(() => {
    if (!selectedMeasure) return null;
    if (sheetAnalysis) {
      const breakdown = findMeasureBreakdown(sheetAnalysis, selectedMeasure);
      if (breakdown) return breakdown;
    }
    return getMeasureAnalysis(selectedMeasure.chords);
  }, [selectedMeasure, sheetAnalysis]);

  function beginSession() {
    setIsSessionActive(true);
  }

  function handleTitleChange(value: string) {
    beginSession();
    setTitle(value);
  }

  function handleKeyChange(value: string) {
    beginSession();
    setSongKey(value);
  }

  function handleTimeSignatureChange(value: string) {
    beginSession();
    setTimeSignature(value);
  }

  function handleChordsChange(id: string, chords: string) {
    beginSession();
    setMeasures((prev) =>
      prev.map((measure) =>
        measure.id === id ? { ...measure, chords } : measure,
      ),
    );
  }

  function handleAddMeasure() {
    beginSession();
    const newId = createMeasureId();
    setMeasures((prev) => [
      ...prev,
      { id: newId, index: prev.length, chords: "" },
    ]);
    setSelectedMeasureId(newId);
  }

  async function handleAnalyze() {
    beginSession();
    setIsAnalyzing(true);
    setAnalysisError(null);
    try {
      const analysis = await requestLeadSheetAnalysis({
        title,
        songKey,
        timeSignature,
        measures: measures.map(({ index, chords }) => ({ index, chords })),
      });
      setSheetAnalysis(analysis);
    } catch (error) {
      setAnalysisError(
        error instanceof Error ? error.message : "Analysis failed.",
      );
    } finally {
      setIsAnalyzing(false);
    }
  }

  const songSettings = (
    <SongSettings
      title={title}
      songKey={songKey}
      timeSignature={timeSignature}
      onTitleChange={handleTitleChange}
      onKeyChange={handleKeyChange}
      onTimeSignatureChange={handleTimeSignatureChange}
    />
  );

  const analyzeControls = (
    <div className="flex flex-wrap items-center gap-4">
      <button
        type="button"
        onClick={handleAnalyze}
        disabled={isAnalyzing}
        className="rounded-full bg-[var(--accent-strong)] px-6 py-2.5 font-mono text-xs uppercase tracking-[0.2em] text-[var(--card)] shadow-sm transition hover:bg-[var(--accent)] disabled:cursor-wait disabled:opacity-60"
      >
        {isAnalyzing ? "Analyzing…" : "Analyze"}
      </button>
      {analysisError && (
        <p role="alert" className="text-sm text-[var(--danger)]">
          {analysisError}
        </p>
      )}
      {sheetAnalysis && !isAnalyzing && !analysisError && (
        <p className="max-w-xl font-serif text-[15px] italic leading-snug text-[var(--muted)]">
          {sheetAnalysis.overview}
        </p>
      )}
    </div>
  );

  const leadSheetEditor = (
    <LeadSheetEditor
      measures={measures}
      selectedMeasureId={selectedMeasureId}
      onSelect={setSelectedMeasureId}
      onChordsChange={handleChordsChange}
      onAddMeasure={handleAddMeasure}
    />
  );

  const sessionAnalysisPanel = (
    <AnalysisPanel
      measure={selectedMeasure}
      analysis={selectedAnalysis}
      className="lg:absolute lg:inset-0"
    />
  );

  const measureTimeline = (
    <MeasureTimeline
      measures={measures}
      timeSignature={timeSignature}
      selectedMeasureId={selectedMeasureId}
      analysis={sheetAnalysis}
      onSelect={setSelectedMeasureId}
    />
  );

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div
        className={`mx-auto w-full px-6 pb-24 sm:px-10 ${
          isSessionActive ? "max-w-none" : "max-w-6xl"
        }`}
      >
        {isSessionActive ? (
          <main
            style={
              { "--analysis-width": `${analysisPanelWidth}px` } as React.CSSProperties
            }
            className="grid gap-8 pt-6 lg:grid-cols-[minmax(0,1fr)_var(--analysis-width)] lg:gap-x-2"
          >
            <div className="flex flex-col gap-8">
              <header>
                <p className="font-serif text-2xl tracking-tight text-[var(--foreground)]">
                  Harmonic Coach
                </p>
              </header>
              {songSettings}
              {analyzeControls}
              {leadSheetEditor}
            </div>
            <div className="relative lg:row-span-2">
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize analysis panel"
                aria-valuenow={analysisPanelWidth}
                aria-valuemin={300}
                aria-valuemax={640}
                tabIndex={0}
                onPointerDown={handleResizeStart}
                onKeyDown={handleResizeKeyDown}
                className="group absolute inset-y-0 -left-2 z-20 hidden w-3 cursor-col-resize touch-none lg:block"
              >
                <div className="mx-auto h-full w-[3px] rounded-full bg-transparent transition group-hover:bg-[var(--accent)]/50 group-focus-visible:bg-[var(--accent)]/70 group-active:bg-[var(--accent)]" />
              </div>
              {sessionAnalysisPanel}
            </div>

            {measureTimeline}
          </main>
        ) : (
          <>
            <Hero />
            <main className="flex flex-col gap-10">
              {songSettings}
              {analyzeControls}
            </main>
          </>
        )}

        <footer className="mt-20 border-t border-[var(--border)] pt-6 font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--muted)]">
          Harmonic Coach
        </footer>
      </div>
    </div>
  );
}
