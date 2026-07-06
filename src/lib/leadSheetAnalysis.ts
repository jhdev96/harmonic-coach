import {
  normalizeMeasureBreakdown,
  parsePartialExtraction,
  parsePartialSheetAnalysis,
} from "@/src/lib/partialSheetAnalysis";
import type {
  AnalyzeLeadSheetRequest,
  AnalyzeScanRequest,
  Measure,
  MeasureBreakdown,
  SheetAnalysis,
  SheetExtraction,
} from "@/src/lib/types";

// Canonicalize one chord token so equivalent jazz spellings compare equal:
// F-7 ≡ Fm7 ≡ Fmin7, C△7 ≡ CM7 ≡ Cmaj7, B♭ ≡ Bb. Used for staleness checks,
// not display — the as-written spelling stays in state.
function canonicalizeChordToken(token: string): string {
  return token
    .replace(/♭/g, "b")
    .replace(/♯/g, "#")
    .replace(/[Δ△]/g, "maj")
    .replace(/^([A-G](?:b|#)?)(?:-|min)/, "$1m")
    .replace(/^([A-G](?:b|#)?)M(?=[0-9])/, "$1maj");
}

export function normalizeChords(chords: string): string {
  return chords
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(canonicalizeChordToken)
    .join(" ");
}

// Streams the raw JSON text of a response from the analyze route, invoking
// onChunk with the accumulated text after each chunk. Resolves with the
// complete text.
async function streamAnalyzeRoute(
  request: AnalyzeLeadSheetRequest | AnalyzeScanRequest,
  onChunk: (streamedJson: string) => void,
): Promise<string> {
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
  if (!response.body) {
    throw new Error("The analysis response had no body.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let streamedJson = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    streamedJson += decoder.decode(value, { stream: true });
    onChunk(streamedJson);
  }
  return streamedJson + decoder.decode();
}

// A response that streamed fine but came back unusable: truncated JSON or an
// empty measures array. Worth one automatic retry — unlike HTTP errors,
// which are either permanent (bad key) or made worse by retrying (429).
class DegenerateResponseError extends Error {}

// Streams the analysis JSON from the API route, invoking onProgress with the
// (possibly partial) analysis after each chunk so the UI can fill in live.
// Resolves with the fully parsed and validated analysis. Degenerate model
// outputs get one automatic retry before surfacing an error.
export async function streamLeadSheetAnalysis(
  request: AnalyzeLeadSheetRequest,
  onProgress: (partial: SheetAnalysis) => void,
): Promise<SheetAnalysis> {
  try {
    return await streamLeadSheetAnalysisAttempt(request, onProgress);
  } catch (error) {
    if (!(error instanceof DegenerateResponseError)) throw error;
    return await streamLeadSheetAnalysisAttempt(request, onProgress);
  }
}

async function streamLeadSheetAnalysisAttempt(
  request: AnalyzeLeadSheetRequest,
  onProgress: (partial: SheetAnalysis) => void,
): Promise<SheetAnalysis> {
  const streamedJson = await streamAnalyzeRoute(request, (text) =>
    onProgress(parsePartialSheetAnalysis(text)),
  );

  let parsed: SheetAnalysis & {
    measures: (MeasureBreakdown & {
      alternativeInterpretation: string | null;
    })[];
  };
  try {
    parsed = JSON.parse(streamedJson) as typeof parsed;
  } catch {
    throw new DegenerateResponseError(
      "The analysis was cut off before completing. Try again, or analyze a shorter chart.",
    );
  }
  // A schema-valid response can still be degenerate (empty measures array);
  // surface it as a failure rather than silently blanking every breakdown.
  if (parsed.measures.length === 0) {
    throw new DegenerateResponseError(
      "The analysis came back without per-measure breakdowns. Run it again.",
    );
  }
  return {
    overview: parsed.overview,
    measures: parsed.measures.map(normalizeMeasureBreakdown),
    title: parsed.title,
    songKey: parsed.songKey,
    timeSignature: parsed.timeSignature,
  };
}

// Streams a scan extraction (chords + metadata, no analysis) from the API
// route, invoking onProgress as bars are read off the page.
export async function streamScanExtraction(
  request: AnalyzeScanRequest,
  onProgress: (partial: SheetExtraction) => void,
): Promise<SheetExtraction> {
  const streamedJson = await streamAnalyzeRoute(request, (text) =>
    onProgress(parsePartialExtraction(text)),
  );

  try {
    return JSON.parse(streamedJson) as SheetExtraction;
  } catch {
    throw new Error(
      "Reading the scan was cut off before completing. Try uploading it again.",
    );
  }
}

// Re-analyzes a single corrected bar in the context of the whole chart.
export async function reanalyzeMeasure(
  request: AnalyzeLeadSheetRequest,
  targetIndex: number,
): Promise<MeasureBreakdown> {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...request, targetIndex }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(
      body?.error ?? `Re-analysis failed (HTTP ${response.status}).`,
    );
  }

  const breakdown = (await response.json()) as MeasureBreakdown & {
    alternativeInterpretation: string | null;
  };
  return normalizeMeasureBreakdown(breakdown);
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
