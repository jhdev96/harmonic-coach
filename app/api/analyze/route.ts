import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

import type {
  AnalyzeLeadSheetRequest,
  SheetAnalysis,
} from "@/src/lib/types";

const MAX_MEASURES = 64;

// Structured-output schema: the API guarantees the response parses against
// this, so the client never has to defensively re-validate shape.
const SHEET_ANALYSIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["overview", "measures"],
  properties: {
    overview: {
      type: "string",
      description:
        "Two or three sentences describing the overall harmonic arc of the chart.",
    },
    measures: {
      type: "array",
      description: "Exactly one entry per measure, in order.",
      items: {
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
            description: "Zero-based index matching the input measure.",
          },
          chords: {
            type: "string",
            description: "The chord symbols exactly as given in the input.",
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
              "Two to four sentences a piano student can follow: function, voice leading, where the ear is being pulled.",
          },
          practiceTip: {
            type: "string",
            description:
              "One concrete at-the-piano exercise for this measure (voicing, isolated resolution, listening focus).",
          },
          alternativeInterpretation: {
            type: ["string", "null"],
            description:
              "A second legitimate hearing of the bar, or null when the analysis is unambiguous.",
          },
        },
      },
    },
  },
} as const;

const SYSTEM_PROMPT = `You are Harmonic Coach, a warm and precise piano instructor who explains lead-sheet harmony to intermediate students.

You will receive a chord chart: song title, key, time signature, and a numbered list of measures with chord symbols. Analyze the chart measure by measure, always interpreting each bar in the context of the surrounding progression and the stated key — not in isolation.

Guidelines:
- Speak like a teacher at the piano: name the function, then explain what the ear should notice, then how the voice leading moves into the next bar.
- Roman numerals are relative to the stated key. Use standard jazz notation (iim7, V7, IVmaj7, V7/iii, bVII, etc.).
- Show your uncertainty honestly. Reharmonizations and modal moments often support more than one hearing — use the confidence field and alternativeInterpretation rather than overclaiming.
- For a measure with no chords entered, return: title "Empty measure", romanNumeral "", harmonicFunction "other", confidence "Low", an explanation inviting the student to enter chords, and a practice tip about the surrounding bars.
- If a chord symbol looks malformed or unreadable, say so plainly in the explanation and mark confidence Low. Do not invent an analysis for symbols you cannot read.
- Practice tips must be physically actionable at the keyboard, referencing specific notes or voicings where possible.`;

function buildChartPrompt(request: AnalyzeLeadSheetRequest): string {
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

function parseRequestBody(body: unknown): AnalyzeLeadSheetRequest | null {
  if (typeof body !== "object" || body === null) return null;
  const candidate = body as Partial<AnalyzeLeadSheetRequest>;
  if (
    typeof candidate.title !== "string" ||
    typeof candidate.songKey !== "string" ||
    typeof candidate.timeSignature !== "string" ||
    !Array.isArray(candidate.measures) ||
    candidate.measures.length === 0 ||
    candidate.measures.length > MAX_MEASURES
  ) {
    return null;
  }
  const measuresValid = candidate.measures.every(
    (measure) =>
      typeof measure === "object" &&
      measure !== null &&
      typeof measure.index === "number" &&
      typeof measure.chords === "string",
  );
  return measuresValid ? (candidate as AnalyzeLeadSheetRequest) : null;
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error:
          "ANTHROPIC_API_KEY is not set. Add it to .env.local and restart the dev server.",
      },
      { status: 500 },
    );
  }

  const analyzeRequest = parseRequestBody(await request.json().catch(() => null));
  if (!analyzeRequest) {
    return NextResponse.json(
      { error: `Invalid request. Expected 1–${MAX_MEASURES} measures with chords.` },
      { status: 400 },
    );
  }

  const client = new Anthropic();

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system: SYSTEM_PROMPT,
      output_config: {
        format: {
          type: "json_schema",
          schema: SHEET_ANALYSIS_SCHEMA,
        },
      },
      messages: [{ role: "user", content: buildChartPrompt(analyzeRequest) }],
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json(
        { error: "The model declined to analyze this input." },
        { status: 502 },
      );
    }
    if (response.stop_reason === "max_tokens") {
      return NextResponse.json(
        { error: "Analysis was cut off. Try a shorter chart." },
        { status: 502 },
      );
    }

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock) {
      return NextResponse.json(
        { error: "The model returned no analysis." },
        { status: 502 },
      );
    }

    const analysis = JSON.parse(textBlock.text) as SheetAnalysis;

    // Normalize the wire format: the schema forces alternativeInterpretation
    // to be present-or-null; the app treats "absent" as the no-alternative case.
    const normalized: SheetAnalysis = {
      overview: analysis.overview,
      measures: analysis.measures.map((measure) => ({
        ...measure,
        alternativeInterpretation:
          measure.alternativeInterpretation ?? undefined,
      })),
    };

    return NextResponse.json(normalized);
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
        { error: "Anthropic API key was rejected. Check ANTHROPIC_API_KEY." },
        { status: 500 },
      );
    }
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: "Rate limited by the Anthropic API. Try again shortly." },
        { status: 429 },
      );
    }
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Anthropic API error: ${error.message}` },
        { status: 502 },
      );
    }
    throw error;
  }
}
