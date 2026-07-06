import type {
  ExtractedMeasure,
  MeasureBreakdown,
  SheetAnalysis,
  SheetExtraction,
} from "@/src/lib/types";

// The schema forces alternativeInterpretation to be present-or-null on the
// wire; the app treats "absent" as the no-alternative case.
export function normalizeMeasureBreakdown(
  measure: MeasureBreakdown & { alternativeInterpretation: string | null },
): MeasureBreakdown {
  return {
    ...measure,
    alternativeInterpretation: measure.alternativeInterpretation ?? undefined,
  };
}

// Extracts whatever complete data exists in a prefix of the streamed
// SheetAnalysis JSON: the overview (even mid-string, so it can grow live),
// every measure object whose closing brace has arrived, and — for scan
// extractions — the song metadata fields once each is complete.
export function parsePartialSheetAnalysis(streamedJson: string): SheetAnalysis {
  return {
    overview: extractPartialOverview(streamedJson),
    measures: extractCompleteObjects(streamedJson).map((entry) =>
      normalizeMeasureBreakdown(
        entry as MeasureBreakdown & { alternativeInterpretation: string | null },
      ),
    ),
    title: extractCompleteString(streamedJson, "title"),
    songKey: extractCompleteString(streamedJson, "songKey"),
    timeSignature: extractCompleteString(streamedJson, "timeSignature"),
  };
}

// Same prefix-tolerant parsing for the extraction stream, whose measure
// objects are chords-only (no analysis fields).
export function parsePartialExtraction(streamedJson: string): SheetExtraction {
  return {
    measures: extractCompleteObjects(streamedJson) as ExtractedMeasure[],
    title: extractCompleteString(streamedJson, "title"),
    songKey: extractCompleteString(streamedJson, "songKey"),
    timeSignature: extractCompleteString(streamedJson, "timeSignature"),
  };
}

// Matches a top-level string field only once its closing quote has arrived.
// Searches only the region before "measures" — measure objects have their own
// "title" fields that must not be mistaken for song metadata.
function extractCompleteString(
  streamedJson: string,
  key: string,
): string | undefined {
  const measuresKey = streamedJson.indexOf('"measures"');
  const head =
    measuresKey === -1 ? streamedJson : streamedJson.slice(0, measuresKey);
  const match = head.match(
    new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`),
  );
  if (!match) return undefined;
  try {
    return JSON.parse(`"${match[1]}"`) as string;
  } catch {
    return undefined;
  }
}

function extractPartialOverview(streamedJson: string): string {
  const match = streamedJson.match(/"overview"\s*:\s*"((?:[^"\\]|\\.)*)/);
  if (!match) return "";
  const raw = match[1];
  // The prefix may end mid-escape-sequence (e.g. a lone `\` or `\u00`).
  // Trim up to the length of the longest escape until it parses.
  for (let trim = 0; trim <= 5 && trim < raw.length; trim++) {
    try {
      return JSON.parse(`"${raw.slice(0, raw.length - trim)}"`) as string;
    } catch {
      // keep trimming
    }
  }
  return "";
}

function extractCompleteObjects(streamedJson: string): unknown[] {
  const measuresKey = streamedJson.indexOf('"measures"');
  if (measuresKey === -1) return [];
  const arrayStart = streamedJson.indexOf("[", measuresKey);
  if (arrayStart === -1) return [];

  const measures: unknown[] = [];
  let depth = 0;
  let objectStart = -1;
  let inString = false;
  let escaped = false;

  for (let i = arrayStart + 1; i < streamedJson.length; i++) {
    const char = streamedJson[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
    } else if (char === "{") {
      if (depth === 0) objectStart = i;
      depth++;
    } else if (char === "}") {
      depth--;
      if (depth === 0 && objectStart !== -1) {
        try {
          measures.push(JSON.parse(streamedJson.slice(objectStart, i + 1)));
        } catch {
          // Skip an object that doesn't parse; the final full-parse validates.
        }
        objectStart = -1;
      }
    } else if (char === "]" && depth === 0) {
      break;
    }
  }
  return measures;
}
