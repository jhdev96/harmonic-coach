import type {
  AnalyzeLeadSheetRequest,
  Measure,
  MeasureBreakdown,
  SheetAnalysis,
} from "@/src/lib/types";

export function normalizeChords(chords: string): string {
  return chords.trim().replace(/\s+/g, " ");
}

export async function requestLeadSheetAnalysis(
  request: AnalyzeLeadSheetRequest,
): Promise<SheetAnalysis> {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(
      body?.error ?? `Analysis request failed (HTTP ${response.status}).`,
    );
  }

  return (await response.json()) as SheetAnalysis;
}

// An AI breakdown only applies to the chords it was generated from. If the
// user has edited the bar since analysis ran, treat the result as stale.
export function findMeasureBreakdown(
  analysis: SheetAnalysis,
  measure: Measure,
): MeasureBreakdown | null {
  const breakdown = analysis.measures.find(
    (entry) => entry.measureIndex === measure.index,
  );
  if (!breakdown) return null;
  if (normalizeChords(breakdown.chords) !== normalizeChords(measure.chords)) {
    return null;
  }
  return breakdown;
}
