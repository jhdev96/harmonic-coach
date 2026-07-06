"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import AnalysisPanel from "@/src/components/AnalysisPanel";
import CoachChat from "@/src/components/CoachChat";
import Hero from "@/src/components/Hero";
import LeadSheetDropzone from "@/src/components/LeadSheetDropzone";
import LeadSheetEditor from "@/src/components/LeadSheetEditor";
import MeasureTimeline from "@/src/components/MeasureTimeline";
import PianoKeyboard from "@/src/components/PianoKeyboard";
import ScanPreview from "@/src/components/ScanPreview";
import SessionNav from "@/src/components/SessionNav";
import SongSettings from "@/src/components/SongSettings";
import { getMeasureAnalysis } from "@/src/lib/getMeasureAnalysis";
import {
  findMeasureBreakdown,
  normalizeChords,
  reanalyzeMeasure,
  streamLeadSheetAnalysis,
  streamScanExtraction,
} from "@/src/lib/leadSheetAnalysis";
import { streamCoachAnswer } from "@/src/lib/askCoach";
import {
  ACCEPTED_SCAN_TYPES,
  createCompactPreview,
  prepareScanForUpload,
  type PreparedScan,
} from "@/src/lib/scanUpload";
import {
  createSessionId,
  getSession,
  loadActiveSession,
  saveSession,
  setActiveSession,
  type StoredSession,
} from "@/src/lib/sessionPersistence";
import { MAX_HISTORY_ENTRIES } from "@/src/lib/constants";
import {
  disposePlayer,
  playChord,
  playNote,
  preloadPiano,
  stopChord,
} from "@/src/lib/playChord";
import { chordToNotes, splitChordSymbols } from "@/src/lib/chordToNotes";
import type {
  AskCoachRequest,
  Measure,
  SheetAnalysis,
  SheetExtraction,
} from "@/src/lib/types";

const DEFAULT_TITLE = "Amazing Grace reharm study";
const DEFAULT_KEY = "C major";
const DEFAULT_TIME_SIGNATURE = "3/4";
const INITIAL_MEASURES: Measure[] = [
  { id: "m-1", index: 0, chords: "C Gm7" },
  { id: "m-2", index: 1, chords: "C7" },
  { id: "m-3", index: 2, chords: "Fmaj7 B7b9" },
  { id: "m-4", index: 3, chords: "Em7" },
];

let nextMeasureCounter = INITIAL_MEASURES.length;
function createMeasureId(): string {
  nextMeasureCounter += 1;
  return `m-${nextMeasureCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function Home() {
  const [title, setTitle] = useState(DEFAULT_TITLE);
  const [songKey, setSongKey] = useState(DEFAULT_KEY);
  const [timeSignature, setTimeSignature] = useState(DEFAULT_TIME_SIGNATURE);
  const [measures, setMeasures] = useState<Measure[]>(INITIAL_MEASURES);
  const [selectedMeasureId, setSelectedMeasureId] = useState<string | null>(
    INITIAL_MEASURES[0].id,
  );
  const [sheetAnalysis, setSheetAnalysis] = useState<SheetAnalysis | null>(
    null,
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Scan sessions: the uploaded lead sheet replaces the measure-card editor,
  // and the timeline becomes the correction surface. Extraction and analysis
  // are two automatic calls: chords arrive fast, prose follows.
  const [scan, setScan] = useState<PreparedScan | null>(null);
  const [extraction, setExtraction] = useState<SheetExtraction | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [reanalyzingIndex, setReanalyzingIndex] = useState<number | null>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);

  // Coach chat — a rolling thread of follow-up questions and streamed answers.
  // Entries are `{question, answer}` on the wire; a transient `error` field
  // renders inline without touching global analysisError state.
  type QaEntry = { question: string; answer: string; error?: string };
  const [qaThread, setQaThread] = useState<QaEntry[]>([]);
  const [isAsking, setIsAsking] = useState(false);
  const askAbortRef = useRef<AbortController | null>(null);

  // A session starts on the first meaningful edit (chords, metadata, new bar)
  // or analysis run. Once active, the hero yields to a full-width workspace.
  const [isSessionActive, setIsSessionActive] = useState(false);

  // Sessions survive refreshes via localStorage. `sessionId` names the store
  // entry the debounced save writes to; `isHydrated` gates saving so the
  // initial (default) state can't clobber a stored session before restore.
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  function applyStoredSession(saved: StoredSession) {
    setTitle(saved.title);
    setSongKey(saved.songKey);
    setTimeSignature(saved.timeSignature);
    setMeasures(saved.measures);
    setSelectedMeasureId(saved.selectedMeasureId);
    setSheetAnalysis(saved.sheetAnalysis);
    setExtraction(saved.extraction);
    setScan(saved.scan);
    setQaThread(saved.qaThread ?? []);
    setAnalysisError(null);
    setCurrentMeasureIndex(null);
    setSessionId(saved.id);
    setIsSessionActive(true);
  }

  useEffect(() => {
    // One-time restore from localStorage. This can't be a lazy useState
    // initializer: the first render must match the server HTML, so the
    // stored session is applied after mount.
    /* eslint-disable react-hooks/set-state-in-effect */
    const saved = loadActiveSession();
    if (saved) applyStoredSession(saved);
    setIsHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!isHydrated || !isSessionActive || !sessionId) return;
    // Debounced: streaming analysis updates land many times per second.
    const timer = setTimeout(() => {
      void (async () => {
        // The full scan bytes are only needed for the extraction API call —
        // never persist them (they'd blow the localStorage quota). A compact
        // preview keeps the thumbnail across reloads. Cached, so this is
        // only expensive the first time.
        const persistedScan = scan
          ? {
              ...scan,
              dataBase64: "",
              previewUrl: await createCompactPreview(scan.previewUrl).catch(
                () => "",
              ),
            }
          : null;
        saveSession(sessionId, {
          title,
          songKey,
          timeSignature,
          measures,
          selectedMeasureId,
          sheetAnalysis,
          extraction,
          scan: persistedScan,
          qaThread: qaThread.map(({ question, answer }) => ({
            question,
            answer,
          })),
        });
      })();
    }, 500);
    return () => clearTimeout(timer);
  }, [
    isHydrated,
    isSessionActive,
    sessionId,
    title,
    songKey,
    timeSignature,
    measures,
    selectedMeasureId,
    sheetAnalysis,
    extraction,
    scan,
    qaThread,
  ]);

  const [analysisPanelWidth, setAnalysisPanelWidth] = useState(400);

  // Playback: `currentMeasureIndex` tracks the bar the player last acted on,
  // `isPlaying` reflects whether audio is currently sounding. Both drive the
  // timeline highlight and player button state.
  const [currentMeasureIndex, setCurrentMeasureIndex] = useState<number | null>(
    null,
  );
  const [isPlaying, setIsPlaying] = useState(false);
  // MIDI notes currently sounding — drives the piano keyboard highlight.
  const [activeNotes, setActiveNotes] = useState<number[]>([]);
  const playTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chordTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const MEASURE_DURATION_SECONDS = 1;

  function clearChordTimeouts() {
    chordTimeoutsRef.current.forEach((timer) => clearTimeout(timer));
    chordTimeoutsRef.current = [];
  }

  useEffect(() => {
    return () => {
      if (playTimeoutRef.current) clearTimeout(playTimeoutRef.current);
      clearChordTimeouts();
      stopChord();
      disposePlayer();
      askAbortRef.current?.abort();
      askAbortRef.current = null;
    };
  }, []);

  // Fetch the piano samples as soon as a session opens so they're loaded
  // before the first play; until then playback falls back to the synth.
  useEffect(() => {
    if (isSessionActive) preloadPiano();
  }, [isSessionActive]);

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

  const selectedBreakdown = useMemo(() => {
    if (!selectedMeasure || !sheetAnalysis) return null;
    return findMeasureBreakdown(sheetAnalysis, selectedMeasure);
  }, [selectedMeasure, sheetAnalysis]);

  // Prefer the breakdown when it exists and still matches the bar's
  // current chords; otherwise fall back to the hardcoded demo analysis.
  const selectedAnalysis = useMemo(() => {
    if (!selectedMeasure) return null;
    return selectedBreakdown ?? getMeasureAnalysis(selectedMeasure.chords);
  }, [selectedMeasure, selectedBreakdown]);

  function beginSession() {
    setIsSessionActive(true);
    // First meaningful edit claims a store slot; restores keep their own id.
    setSessionId((prev) => prev ?? createSessionId());
  }

  // The current session is already auto-saved, so starting fresh is not
  // destructive: it just returns to the hero with the demo chart.
  function handleNewSession() {
    handleStop();
    setActiveNotes([]);
    setActiveSession(null);
    askAbortRef.current?.abort();
    askAbortRef.current = null;
    setIsAsking(false);
    setTitle(DEFAULT_TITLE);
    setSongKey(DEFAULT_KEY);
    setTimeSignature(DEFAULT_TIME_SIGNATURE);
    setMeasures(INITIAL_MEASURES);
    setSelectedMeasureId(INITIAL_MEASURES[0].id);
    setSheetAnalysis(null);
    setAnalysisError(null);
    setScan(null);
    setExtraction(null);
    setQaThread([]);
    setCurrentMeasureIndex(null);
    setSessionId(null);
    setIsSessionActive(false);
  }

  function handleLoadSession(id: string) {
    if (id === sessionId) return;
    const saved = getSession(id);
    if (!saved) return;
    handleStop();
    setActiveNotes([]);
    askAbortRef.current?.abort();
    askAbortRef.current = null;
    setIsAsking(false);
    setActiveSession(id);
    applyStoredSession(saved);
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

  function applyExtractionProgress(partial: SheetExtraction) {
    setExtraction(partial);
    if (partial.title) setTitle(partial.title);
    if (partial.songKey) setSongKey(partial.songKey);
    if (partial.timeSignature) setTimeSignature(partial.timeSignature);
    // Materialize measures as bars are read off the page, preserving any the
    // user has already edited mid-stream.
    setMeasures((prev) =>
      partial.measures.map(
        (entry) =>
          prev.find((measure) => measure.index === entry.measureIndex) ?? {
            id: `scan-${entry.measureIndex}`,
            index: entry.measureIndex,
            chords: entry.chords,
          },
      ),
    );
    setSelectedMeasureId(
      (prev) =>
        prev ??
        (partial.measures.length > 0
          ? `scan-${partial.measures[0].measureIndex}`
          : null),
    );
  }

  async function handleScanFile(file: File) {
    beginSession();
    setAnalysisError(null);
    let prepared: PreparedScan;
    try {
      prepared = await prepareScanForUpload(file);
    } catch (error) {
      setAnalysisError(
        error instanceof Error ? error.message : "Couldn't read that file.",
      );
      return;
    }
    setScan(prepared);
    setMeasures([]);
    setSelectedMeasureId(null);
    setSheetAnalysis(null);
    setExtraction(null);

    // Phase 1: extraction — small and fast, fills the timeline with chords.
    setIsExtracting(true);
    let extracted: SheetExtraction;
    try {
      extracted = await streamScanExtraction(
        {
          scan: {
            mediaType: prepared.mediaType,
            dataBase64: prepared.dataBase64,
          },
        },
        applyExtractionProgress,
      );
      applyExtractionProgress(extracted);
    } catch (error) {
      setAnalysisError(
        error instanceof Error ? error.message : "Reading the scan failed.",
      );
      return;
    } finally {
      setIsExtracting(false);
    }

    // Phase 2: analysis of the extracted chart, kicked off automatically.
    // Uses the extraction result directly — state updates land asynchronously.
    await runSheetAnalysis(
      extracted.measures.map((entry) => ({
        index: entry.measureIndex,
        chords: entry.chords,
      })),
      {
        title: extracted.title ?? title,
        songKey: extracted.songKey ?? songKey,
        timeSignature: extracted.timeSignature ?? timeSignature,
      },
    );
  }

  function handleSaveChords(id: string, chords: string) {
    beginSession();
    const updated = measures.map((measure) =>
      measure.id === id ? { ...measure, chords } : measure,
    );
    setMeasures(updated);
    // A saved correction is user-confirmed: clear the read flag for the bar.
    const editedIndex = updated.find((measure) => measure.id === id)?.index;
    if (editedIndex !== undefined) {
      setExtraction((prev) =>
        prev
          ? {
              ...prev,
              measures: prev.measures.map((entry) =>
                entry.measureIndex === editedIndex
                  ? { ...entry, chords, readConfidence: "High" as const }
                  : entry,
              ),
            }
          : prev,
      );
    }
    // While a full-sheet analysis is streaming, just record the edit; the
    // staleness guard hides the outdated breakdown until the next run.
    if (isAnalyzing || isExtracting) return;
    const target = updated.find((measure) => measure.id === id);
    if (!target) return;
    const existing = sheetAnalysis?.measures.find(
      (entry) => entry.measureIndex === target.index,
    );
    if (existing && normalizeChords(existing.chords) === normalizeChords(chords)) {
      return;
    }
    void reanalyzeBar(updated, target.index);
  }

  async function reanalyzeBar(currentMeasures: Measure[], barIndex: number) {
    setReanalyzingIndex(barIndex);
    setAnalysisError(null);
    try {
      const breakdown = await reanalyzeMeasure(
        {
          title,
          songKey,
          timeSignature,
          measures: currentMeasures.map((measure) => ({
            index: measure.index,
            chords: measure.chords,
          })),
        },
        barIndex,
      );
      setSheetAnalysis((prev) =>
        prev
          ? {
              ...prev,
              measures: [
                ...prev.measures.filter(
                  (entry) => entry.measureIndex !== barIndex,
                ),
                breakdown,
              ].sort((a, b) => a.measureIndex - b.measureIndex),
            }
          : { overview: "", measures: [breakdown] },
      );
    } catch (error) {
      setAnalysisError(
        error instanceof Error ? error.message : "Re-analysis failed.",
      );
    } finally {
      setReanalyzingIndex(null);
    }
  }

  async function runSheetAnalysis(
    chartMeasures: { index: number; chords: string }[],
    meta: { title: string; songKey: string; timeSignature: string },
  ) {
    setIsAnalyzing(true);
    setAnalysisError(null);
    // Clear the previous run so the UI shows loading states, then fills in
    // progressively as measures stream back.
    setSheetAnalysis(null);
    try {
      const analysis = await streamLeadSheetAnalysis(
        { ...meta, measures: chartMeasures },
        setSheetAnalysis,
      );
      setSheetAnalysis(analysis);
      if (analysis.songKey) setSongKey(analysis.songKey);
      if (analysis.title) setTitle(analysis.title);
      if (analysis.timeSignature) setTimeSignature(analysis.timeSignature);
    } catch (error) {
      setAnalysisError(
        error instanceof Error ? error.message : "Analysis failed.",
      );
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleAnalyze() {
    beginSession();
    await runSheetAnalysis(
      measures.map(({ index, chords }) => ({ index, chords })),
      { title, songKey, timeSignature },
    );
  }

  async function handleAsk(question: string) {
    const trimmed = question.trim();
    if (!trimmed || measures.length === 0) return;
    // A prior in-flight ask should be cancelled — the new one takes over.
    askAbortRef.current?.abort();

    const historyForRequest = qaThread
      .filter((entry) => entry.answer.length > 0 && !entry.error)
      .slice(-MAX_HISTORY_ENTRIES)
      .map(({ question: q, answer }) => ({ question: q, answer }));

    const selectedIndex = measures.find(
      (measure) => measure.id === selectedMeasureId,
    )?.index;

    const request: AskCoachRequest = {
      title,
      songKey,
      timeSignature,
      measures: measures.map(({ index, chords }) => ({ index, chords })),
      overview: sheetAnalysis?.overview || undefined,
      breakdowns: sheetAnalysis?.measures.map((b) => ({
        measureIndex: b.measureIndex,
        chords: b.chords,
        title: b.title,
        romanNumeral: b.romanNumeral,
        explanation: b.explanation,
      })),
      selectedMeasureIndex: selectedIndex,
      history: historyForRequest,
      question: trimmed,
    };

    setQaThread((prev) => [...prev, { question: trimmed, answer: "" }]);
    setIsAsking(true);
    const controller = new AbortController();
    askAbortRef.current = controller;

    try {
      await streamCoachAnswer(
        request,
        (partial) =>
          setQaThread((prev) => [
            ...prev.slice(0, -1),
            { question: trimmed, answer: partial },
          ]),
        controller.signal,
      );
    } catch (error) {
      const aborted =
        controller.signal.aborted ||
        (error instanceof DOMException && error.name === "AbortError") ||
        (error instanceof Error && error.name === "AbortError");
      if (aborted) {
        // Silently keep whatever text arrived before the cancel.
      } else {
        const message =
          error instanceof Error ? error.message : "Coach request failed.";
        setQaThread((prev) => {
          const last = prev[prev.length - 1];
          return [
            ...prev.slice(0, -1),
            {
              question: trimmed,
              answer: last?.answer ?? "",
              error: message,
            },
          ];
        });
      }
    } finally {
      if (askAbortRef.current === controller) askAbortRef.current = null;
      setIsAsking(false);
    }
  }

  function handleBarClick(measureNumber: number) {
    const target = measures.find(
      (measure) => measure.index === measureNumber - 1,
    );
    if (target) setSelectedMeasureId(target.id);
  }

  function measureIndexToId(index: number): string | null {
    return measures.find((measure) => measure.index === index)?.id ?? null;
  }

  function playMeasureAt(index: number, continuous = false) {
    if (index < 0 || index >= measures.length) {
      setIsPlaying(false);
      return;
    }
    const measure = measures[index];
    const chords = splitChordSymbols(measure.chords);

    setCurrentMeasureIndex(index);
    const id = measureIndexToId(index);
    if (id) setSelectedMeasureId(id);

    if (playTimeoutRef.current) {
      clearTimeout(playTimeoutRef.current);
      playTimeoutRef.current = null;
    }
    clearChordTimeouts();
    stopChord();
    setActiveNotes([]);

    // Single-step navigation across an empty bar shouldn't flash "playing".
    if (chords.length === 0 && !continuous) {
      setIsPlaying(false);
      return;
    }

    setIsPlaying(true);
    if (chords.length > 0) {
      // Allocate beats per chord based on the time signature so a "Gm7 C7"
      // bar in 3/4 plays 2 beats + 1 beat instead of splitting the measure
      // evenly and rushing the harmony.
      const parsedBeats = Number.parseInt(timeSignature.split("/")[0] ?? "", 10);
      const beatsPerMeasure =
        Number.isFinite(parsedBeats) && parsedBeats > 0 ? parsedBeats : 4;
      const beatSeconds = MEASURE_DURATION_SECONDS / beatsPerMeasure;

      let beatsPerChord: number[];
      if (chords.length >= beatsPerMeasure) {
        // Degenerate case (more chords than beats): fall back to even split.
        beatsPerChord = chords.map(
          () => beatsPerMeasure / chords.length,
        );
      } else {
        const base = Math.floor(beatsPerMeasure / chords.length);
        const remainder = beatsPerMeasure % chords.length;
        beatsPerChord = chords.map((_, i) => (i < remainder ? base + 1 : base));
      }

      let offsetSeconds = 0;
      chords.forEach((chord, chordIndex) => {
        const chordSeconds = beatsPerChord[chordIndex] * beatSeconds;
        if (chordIndex === 0) {
          void playChord(chord, chordSeconds);
          setActiveNotes(chordToNotes(chord));
        } else {
          const startMs = offsetSeconds * 1000;
          const timer = setTimeout(() => {
            void playChord(chord, chordSeconds);
            setActiveNotes(chordToNotes(chord));
          }, startMs);
          chordTimeoutsRef.current.push(timer);
        }
        offsetSeconds += chordSeconds;
      });
    }
    playTimeoutRef.current = setTimeout(() => {
      playTimeoutRef.current = null;
      clearChordTimeouts();
      // Highlights are left in place when playback ends or stops so the
      // student can study the last voicing; the next play repaints them.
      if (!continuous) {
        setIsPlaying(false);
        return;
      }
      const nextIndex = index + 1;
      if (nextIndex >= measures.length) {
        setIsPlaying(false);
        return;
      }
      playMeasureAt(nextIndex, true);
    }, MEASURE_DURATION_SECONDS * 1000);
  }

  function handlePlayMeasure() {
    if (measures.length === 0) return;
    if (isPlaying) {
      handleStop();
      return;
    }
    // If nothing has played yet, prefer the selected bar over a hard-coded 0
    // so the play button feels like it agrees with the timeline highlight.
    const selectedIndex = measures.find(
      (measure) => measure.id === selectedMeasureId,
    )?.index;
    const startIndex =
      currentMeasureIndex ?? selectedIndex ?? measures[0].index;
    // Restart from the top if the last-played bar was the final one.
    const resumeIndex =
      startIndex >= measures.length - 1 ? measures[0].index : startIndex;
    playMeasureAt(resumeIndex, true);
  }

  function handleStop() {
    if (playTimeoutRef.current) {
      clearTimeout(playTimeoutRef.current);
      playTimeoutRef.current = null;
    }
    clearChordTimeouts();
    stopChord();
    setIsPlaying(false);
  }

  function handleRewind() {
    if (measures.length === 0) return;
    const current = currentMeasureIndex ?? 0;
    const next = Math.max(0, current - 1);
    playMeasureAt(next);
  }

  function handleForward() {
    if (measures.length === 0) return;
    const current = currentMeasureIndex ?? -1;
    const next = Math.min(measures.length - 1, current + 1);
    playMeasureAt(next);
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

  const sessionSongSettings = (
    <SongSettings
      title={title}
      songKey={songKey}
      timeSignature={timeSignature}
      onTitleChange={handleTitleChange}
      onKeyChange={handleKeyChange}
      onTimeSignatureChange={handleTimeSignatureChange}
      playingMeasureIndex={currentMeasureIndex}
      isPlaying={isPlaying}
      onPlayMeasure={handlePlayMeasure}
      onRewind={handleRewind}
      onForward={handleForward}
      onStop={handleStop}
      isPlayerDisabled={isAnalyzing || isExtracting}
    />
  );

  const analyzeControls = (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleAnalyze}
          disabled={isAnalyzing || isExtracting}
          className="rounded-xl bg-[var(--accent-strong)] px-6 py-2.5 font-mono text-xs tracking-[0.2em] text-[var(--card)] shadow-sm transition hover:bg-[var(--accent)] disabled:cursor-wait disabled:opacity-60"
        >
          {isExtracting
            ? "Reading scan…"
            : isAnalyzing
              ? "Analyzing…"
              : "Analyze"}
        </button>
        {isSessionActive && (
          <button
            type="button"
            onClick={() => scanInputRef.current?.click()}
            disabled={isAnalyzing || isExtracting}
            className="rounded-xl border border-[var(--accent)]/40 px-4 py-2.5 font-mono text-xs tracking-[0.2em] text-[var(--accent-strong)] transition hover:border-[var(--accent)] hover:bg-[var(--accent)]/5 disabled:opacity-60"
          >
            Upload scan
          </button>
        )}
        {scan && (
          <ScanPreview
            previewUrl={scan.previewUrl}
            fileName={scan.fileName}
            isReading={isExtracting}
          />
        )}
      </div>
      {analysisError && (
        <p role="alert" className="text-sm text-[var(--danger)]">
          {analysisError}
        </p>
      )}
      {(isSessionActive || (sheetAnalysis?.overview && !analysisError)) && (
        <section
          aria-label="Sheet summary"
          className="mt-4 flex flex-1 flex-col gap-4 rounded bg-[var(--card)] p-4 sm:p-5"
        >
          <CoachChat
            thread={qaThread}
            summary={sheetAnalysis?.overview && !analysisError ? sheetAnalysis.overview : undefined}
            isAsking={isAsking}
            disabled={isAnalyzing || isExtracting || measures.length === 0}
            onAsk={handleAsk}
            onBarClick={handleBarClick}
          />
        </section>
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
      isLoading={
        ((isAnalyzing || isExtracting) && !selectedBreakdown) ||
        (selectedMeasure !== null && reanalyzingIndex === selectedMeasure.index)
      }
      className="lg:absolute lg:inset-0"
    />
  );


  const measureTimeline = (
    <MeasureTimeline
      measures={measures}
      timeSignature={timeSignature}
      selectedMeasureId={selectedMeasureId}
      analysis={sheetAnalysis}
      extraction={extraction}
      isAnalyzing={isAnalyzing || isExtracting}
      reanalyzingIndex={reanalyzingIndex}
      editable={scan !== null}
      playingMeasureIndex={isPlaying ? currentMeasureIndex : null}
      onSaveChords={handleSaveChords}
      onSelect={setSelectedMeasureId}
    />
  );

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <input
        ref={scanInputRef}
        type="file"
        accept={ACCEPTED_SCAN_TYPES.join(",")}
        className="hidden"
        aria-hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleScanFile(file);
          event.target.value = "";
        }}
      />
      <SessionNav
        activeSessionId={sessionId}
        onNewSession={handleNewSession}
        onLoadSession={handleLoadSession}
      />
      <div
        className={`mx-auto flex min-h-screen w-full flex-col pb-6 pl-24 pr-6 sm:pl-24 sm:pr-10 ${
          isSessionActive ? "max-w-none" : "max-w-6xl"
        }`}
      >
        {isSessionActive ? (
          <main
            style={
              { "--analysis-width": `${analysisPanelWidth}px` } as React.CSSProperties
            }
            className="grid flex-1 gap-2 pt-6 lg:grid-cols-[minmax(0,1fr)_var(--analysis-width)] lg:grid-rows-[1fr_auto] lg:gap-x-2"
          >
            <div className="flex flex-1 flex-col gap-3">
              {sessionSongSettings}
              <div className="flex flex-1 flex-col gap-3">
                {analyzeControls}
              </div>
              {!scan && leadSheetEditor}
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

            <div className="flex flex-col gap-2">
              <PianoKeyboard
                activeNotes={activeNotes}
                onKeyPlay={(midi) => void playNote(midi)}
              />
              {measureTimeline}
            </div>
          </main>
        ) : (
          <>
            <Hero />
            <main className="flex flex-col gap-10">
              <div className="flex flex-col gap-3">
                <LeadSheetDropzone
                  onFileSelected={(file) => void handleScanFile(file)}
                />
                <button
                  type="button"
                  onClick={beginSession}
                  className="self-center font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--accent-strong)] underline-offset-4 transition hover:underline"
                >
                  No scan handy? Start with the demo chart
                </button>
              </div>
              {songSettings}
              {analyzeControls}
            </main>
          </>
        )}

        <footer
          className={`border-t border-[var(--border)] pt-3 font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--muted)] ${
            isSessionActive ? "" : "mt-20"
          }`}
        >
          Harmonic Coach
        </footer>
      </div>
    </div>
  );
}
