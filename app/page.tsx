"use client";

import { useMemo, useState } from "react";

import AnalysisPanel from "@/src/components/AnalysisPanel";
import Hero from "@/src/components/Hero";
import LeadSheetEditor from "@/src/components/LeadSheetEditor";
import SongSettings from "@/src/components/SongSettings";
import { getMeasureAnalysis } from "@/src/lib/getMeasureAnalysis";
import type { Measure } from "@/src/lib/types";

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

  const selectedMeasure = useMemo(
    () => measures.find((measure) => measure.id === selectedMeasureId) ?? null,
    [measures, selectedMeasureId],
  );

  const selectedAnalysis = useMemo(
    () => (selectedMeasure ? getMeasureAnalysis(selectedMeasure.chords) : null),
    [selectedMeasure],
  );

  function handleChordsChange(id: string, chords: string) {
    setMeasures((prev) =>
      prev.map((measure) =>
        measure.id === id ? { ...measure, chords } : measure,
      ),
    );
  }

  function handleAddMeasure() {
    const newId = createMeasureId();
    setMeasures((prev) => [
      ...prev,
      { id: newId, index: prev.length, chords: "" },
    ]);
    setSelectedMeasureId(newId);
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto w-full max-w-6xl px-6 pb-24 sm:px-10">
        <Hero />

        <main className="flex flex-col gap-10">
          <SongSettings
            title={title}
            songKey={songKey}
            timeSignature={timeSignature}
            onTitleChange={setTitle}
            onKeyChange={setSongKey}
            onTimeSignatureChange={setTimeSignature}
          />

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px]">
            <LeadSheetEditor
              measures={measures}
              selectedMeasureId={selectedMeasureId}
              onSelect={setSelectedMeasureId}
              onChordsChange={handleChordsChange}
              onAddMeasure={handleAddMeasure}
            />
            <AnalysisPanel
              measure={selectedMeasure}
              analysis={selectedAnalysis}
            />
          </div>
        </main>

        <footer className="mt-20 border-t border-[var(--border)] pt-6 font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--muted)]">
          Harmonic Coach
        </footer>
      </div>
    </div>
  );
}
