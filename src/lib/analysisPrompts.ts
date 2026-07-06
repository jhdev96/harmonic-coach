import type { AnalyzeLeadSheetRequest, AskCoachRequest } from "@/src/lib/types";

// Structured-output schemas and prompts for the analyze route. The API
// guarantees responses parse against these schemas, so the client never has
// to defensively re-validate shape.

const MEASURE_BREAKDOWN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "measureIndex",
    "chords",
    "title",
    "romanNumeral",
    "harmonicFunction",
    "confidence",
    "explanation",
    "practiceTip",
    "alternativeInterpretation",
  ],
  properties: {
    measureIndex: {
      type: "integer",
      description: "Zero-based index of the measure.",
    },
    chords: {
      type: "string",
      description:
        "The chord symbols for this measure, echoed character-for-character as they appear in the prompt. Do not respell (keep F-7 as F-7, not Fm7).",
    },
    title: {
      type: "string",
      description: "Short instructor-style headline, e.g. 'ii–V into IV'.",
    },
    romanNumeral: {
      type: "string",
      description:
        "Roman-numeral analysis relative to the song key, e.g. 'iim7–V7/IV'. Empty string for empty measures.",
    },
    harmonicFunction: {
      type: "string",
      enum: ["tonic", "subdominant", "dominant", "other"],
      description:
        "Dominant-function chords (incl. secondary dominants) are 'dominant'. Empty or unclassifiable bars are 'other'.",
    },
    confidence: {
      type: "string",
      enum: ["High", "Medium", "Low"],
      description:
        "How settled this interpretation is. Ambiguous reharmonizations should be Medium or Low.",
    },
    explanation: {
      type: "string",
      description:
        "One to three tight sentences a piano student can follow: the function, then the one thing the ear should notice.",
    },
    practiceTip: {
      type: "string",
      description:
        "One sentence with a concrete at-the-piano exercise (specific notes or voicings).",
    },
    alternativeInterpretation: {
      type: ["string", "null"],
      description:
        "A second legitimate hearing of the bar in one sentence, or null when the analysis is unambiguous.",
    },
  },
} as const;

// Extraction is chords-only (no analysis prose): a small, fast response so
// the timeline fills quickly. Analysis runs as a second call on the result.
const EXTRACTED_MEASURE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["measureIndex", "chords", "readConfidence", "alternateReadings"],
  properties: {
    measureIndex: {
      type: "integer",
      description: "Zero-based index of the measure, in reading order.",
    },
    chords: {
      type: "string",
      description:
        "The chord symbols read from this measure of the scan. Expand repeat signs (%) to the previous bar's chords.",
    },
    readConfidence: {
      type: "string",
      enum: ["High", "Medium", "Low"],
      description:
        "How surely the chord symbols were read off the page. Smudged, cramped, or ambiguous handwriting is Medium or Low.",
    },
    alternateReadings: {
      type: "array",
      items: { type: "string" },
      description:
        "For non-High readConfidence: up to two plausible alternate readings of this bar's chords. Empty when confident.",
    },
  },
} as const;

export const SHEET_ANALYSIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["overview", "measures"],
  properties: {
    overview: {
      type: "string",
      description:
        "One or two sentences describing the overall harmonic arc of the chart.",
    },
    measures: {
      type: "array",
      description: "Exactly one entry per measure, in order.",
      // Without minItems the constrained decoder may close the array empty —
      // a schema-valid response with an overview and no analysis.
      minItems: 1,
      items: MEASURE_BREAKDOWN_SCHEMA,
    },
    songKey: {
      type: "string",
      description:
        "The actual key detected from the chord progression, e.g. 'Ab major'. Infer from the harmonic center and any modal patterns.",
    },
    title: {
      type: "string",
      description:
        "Optional: corrected or confirmed song title if it was misidentified.",
    },
    timeSignature: {
      type: "string",
      description: "Optional: corrected time signature if the input was wrong.",
    },
  },
} as const;

export const SCAN_EXTRACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "songKey", "timeSignature", "measures"],
  properties: {
    title: {
      type: "string",
      description: "The song title as written on the chart.",
    },
    songKey: {
      type: "string",
      description:
        "The key implied by the key signature and harmony, e.g. 'Ab major'.",
    },
    timeSignature: {
      type: "string",
      description: "The time signature, e.g. '4/4'.",
    },
    measures: {
      type: "array",
      description:
        "Exactly one entry per measure of the chart, in reading order.",
      minItems: 1,
      items: EXTRACTED_MEASURE_SCHEMA,
    },
  },
} as const;

export const SINGLE_MEASURE_SCHEMA = MEASURE_BREAKDOWN_SCHEMA;

export const COACH_GUIDELINES = `Guidelines:
- Speak like a teacher at the piano: name the function, then the one thing the ear should notice. Be warm but economical — every sentence must earn its place.
- Roman numerals are relative to the stated key. Use standard jazz notation (iim7, V7, IVmaj7, V7/iii, bVII, etc.).
- Show your uncertainty honestly. Reharmonizations and modal moments often support more than one hearing — use the confidence field and alternativeInterpretation rather than overclaiming.
- For a measure with no chords entered, return: title "Empty measure", romanNumeral "", harmonicFunction "other", confidence "Low", an explanation inviting the student to enter chords, and a practice tip about the surrounding bars.
- If a chord symbol looks malformed or unreadable, say so plainly in the explanation and mark confidence Low. Do not invent an analysis for symbols you cannot read.
- Practice tips must be physically actionable at the keyboard, referencing specific notes or voicings where possible.`;

export const SYSTEM_PROMPT = `You are Harmonic Coach, a warm and precise piano instructor who explains lead-sheet harmony to intermediate students.

You will receive a chord chart: song title, key, time signature, and a numbered list of measures with chord symbols. Analyze the chart measure by measure, always interpreting each bar in the context of the surrounding progression and the stated key — not in isolation.

Before analyzing, determine the actual key of the piece from the chord progression itself — the harmonic center, the cadences, and any modal patterns. If it clearly disagrees with the stated key (a common student mistake), return your detected key in the top-level songKey field (e.g. 'Ab major') and use it as the reference for every Roman-numeral analysis. When the stated key is correct, you may still confirm it by returning it in songKey, or omit the field. Only override the title or timeSignature when the chart makes the correct value unambiguous.

${COACH_GUIDELINES}`;

export const SCAN_EXTRACTION_PROMPT = `You are a careful music copyist. You will receive a scanned or photographed lead sheet. Read the chart and transcribe it — do not analyze it.

Rules:
- Read the title, key, time signature, and the chord symbols above each measure, in reading order across each staff line.
- Produce exactly one measures entry per bar of the chart, in reading order.
- A repeat sign (%) means "same as the previous bar" — write out the previous bar's chords for that measure.
- Report readConfidence honestly per bar: smudged, cramped, or ambiguous handwriting is Medium or Low, and for those bars list up to two plausible alternateReadings.
- Normalize chord spellings to plain text (Bb not B♭, Fm7 or F-7 as written, maj7 not Δ7 unless written that way).
- A bar with no chord symbol continues the previous harmony; write the previous bar's chords.`;

export function buildChartPrompt(request: AnalyzeLeadSheetRequest): string {
  const measureLines = request.measures
    .map(
      (measure) =>
        `Bar ${measure.index + 1}: ${measure.chords.trim() || "(empty)"}`,
    )
    .join("\n");

  return `Analyze this lead sheet.

Title: ${request.title || "Untitled"}
Key: ${request.songKey}
Time signature: ${request.timeSignature}

Measures (measureIndex is the bar number minus 1):
${measureLines}`;
}

export function buildSingleMeasurePrompt(
  request: AnalyzeLeadSheetRequest,
  targetIndex: number,
): string {
  return `${buildChartPrompt(request)}

The student just corrected bar ${targetIndex + 1}. Analyze ONLY bar ${targetIndex + 1} (measureIndex ${targetIndex}) in the context of the whole chart above, and return the single measure object.`;
}

export const ASK_COACH_PROMPT = `You are Harmonic Coach, a warm and precise piano instructor answering a student's follow-up question about the chart they are studying.

Answer the student's question about the chart below. Keep answers to 2–5 sentences unless the question genuinely needs more.

When you reference a measure, use the exact form [bar N] (1-based), e.g. "the ii–V in [bar 4] resolves to [bar 5]". The bracketed form is required — the UI turns it into a clickable link.

If the question is unrelated to this chart or to harmony, gently redirect to the chart.

${COACH_GUIDELINES}`;

export function buildAskPrompt(request: AskCoachRequest): string {
  const chart = buildChartPrompt({
    title: request.title,
    songKey: request.songKey,
    timeSignature: request.timeSignature,
    measures: request.measures,
  });

  const contextLines: string[] = [];
  if (request.overview) {
    contextLines.push(`Overview: ${request.overview}`);
  }
  if (request.breakdowns && request.breakdowns.length > 0) {
    contextLines.push("Per-measure analysis so far:");
    for (const b of request.breakdowns) {
      const chords = b.chords.trim() || "(empty)";
      contextLines.push(
        `- Bar ${b.measureIndex + 1} (${chords}) — ${b.title} [${b.romanNumeral || "—"}]: ${b.explanation}`,
      );
    }
  }
  if (typeof request.selectedMeasureIndex === "number") {
    contextLines.push(
      `The student is currently selected: bar ${request.selectedMeasureIndex + 1}.`,
    );
  }

  const historyLines: string[] = [];
  if (request.history.length > 0) {
    historyLines.push("Prior exchange(s):");
    for (const entry of request.history) {
      historyLines.push(`Student: ${entry.question}`);
      historyLines.push(`Coach: ${entry.answer}`);
    }
  }

  const sections = [chart];
  if (contextLines.length > 0) sections.push(contextLines.join("\n"));
  if (historyLines.length > 0) sections.push(historyLines.join("\n"));
  sections.push(`New question from the student:\n${request.question}`);

  return sections.join("\n\n");
}
