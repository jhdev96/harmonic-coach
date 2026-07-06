import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

import {
  buildChartPrompt,
  buildSingleMeasurePrompt,
  SCAN_EXTRACTION_PROMPT,
  SCAN_EXTRACTION_SCHEMA,
  SHEET_ANALYSIS_SCHEMA,
  SINGLE_MEASURE_SCHEMA,
  SYSTEM_PROMPT,
} from "@/src/lib/analysisPrompts";
import { errorResponse, streamingResponse } from "@/src/lib/anthropicStream";
import type {
  AnalyzeLeadSheetRequest,
  AnalyzeScanRequest,
} from "@/src/lib/types";
import { MAX_MEASURES, ANTHROPIC_MODEL } from "@/src/lib/constants";


const SCAN_MEDIA_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
] as const;

// Base64 of ~24MB of data — headroom under the API's 32MB request limit.
const MAX_SCAN_BASE64_LENGTH = 32_000_000;

// Sonnet 5 over Opus: near-Opus quality on structured analysis at a fraction
// of the cost and latency. Raise effort if analyses start feeling shallow.

function parseChartRequest(body: unknown): AnalyzeLeadSheetRequest | null {
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
  if (!measuresValid) return null;
  if (
    candidate.targetIndex !== undefined &&
    (typeof candidate.targetIndex !== "number" ||
      !candidate.measures.some((m) => m.index === candidate.targetIndex))
  ) {
    return null;
  }
  return candidate as AnalyzeLeadSheetRequest;
}

function parseScanRequest(body: unknown): AnalyzeScanRequest | null {
  if (typeof body !== "object" || body === null) return null;
  const candidate = body as Partial<AnalyzeScanRequest>;
  const scan = candidate.scan;
  if (
    typeof scan !== "object" ||
    scan === null ||
    typeof scan.mediaType !== "string" ||
    typeof scan.dataBase64 !== "string" ||
    !(SCAN_MEDIA_TYPES as readonly string[]).includes(scan.mediaType) ||
    scan.dataBase64.length === 0 ||
    scan.dataBase64.length > MAX_SCAN_BASE64_LENGTH
  ) {
    return null;
  }
  return { scan: { mediaType: scan.mediaType, dataBase64: scan.dataBase64 } };
}

function scanContentBlock(scan: AnalyzeScanRequest["scan"]) {
  if (scan.mediaType === "application/pdf") {
    return {
      type: "document" as const,
      source: {
        type: "base64" as const,
        media_type: "application/pdf" as const,
        data: scan.dataBase64,
      },
    };
  }
  return {
    type: "image" as const,
    source: {
      type: "base64" as const,
      media_type: scan.mediaType as "image/png" | "image/jpeg" | "image/webp",
      data: scan.dataBase64,
    },
  };
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

  const body = await request.json().catch(() => null);
  const scanRequest = parseScanRequest(body);
  const chartRequest = scanRequest ? null : parseChartRequest(body);

  if (!scanRequest && !chartRequest) {
    return NextResponse.json(
      {
        error: `Invalid request. Expected a scan upload or 1–${MAX_MEASURES} measures with chords.`,
      },
      { status: 400 },
    );
  }

  const client = new Anthropic();

  try {
    // Mode 1: scan upload — extraction only (chords + metadata, no analysis
    // prose), so bars reach the UI fast. The client kicks off the analysis
    // as a second call on the extracted chart. Higher effort than typed
    // mode: reading handwriting benefits from care, and the small output
    // leaves plenty of token headroom for thinking.
    if (scanRequest) {
      const stream = await client.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: 32000,
        stream: true,
        thinking: { type: "adaptive" },
        system: SCAN_EXTRACTION_PROMPT,
        output_config: {
          effort: "high",
          format: { type: "json_schema", schema: SCAN_EXTRACTION_SCHEMA },
        },
        messages: [
          {
            role: "user",
            content: [
              scanContentBlock(scanRequest.scan),
              {
                type: "text",
                text: "Transcribe this lead sheet.",
              },
            ],
          },
        ],
      });
      return streamingResponse(stream);
    }

    // Mode 2: re-analyze a single corrected bar. Small response, no stream.
    if (chartRequest!.targetIndex !== undefined) {
      const response = await client.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: 8000,
        thinking: { type: "adaptive" },
        system: SYSTEM_PROMPT,
        output_config: {
          effort: "medium",
          format: { type: "json_schema", schema: SINGLE_MEASURE_SCHEMA },
        },
        messages: [
          {
            role: "user",
            content: buildSingleMeasurePrompt(
              chartRequest!,
              chartRequest!.targetIndex,
            ),
          },
        ],
      });

      const textBlock = response.content.find((block) => block.type === "text");
      if (response.stop_reason !== "end_turn" || !textBlock) {
        return NextResponse.json(
          { error: "The model returned no analysis for this bar." },
          { status: 502 },
        );
      }
      return new Response(textBlock.text, {
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }

    // Mode 3: full chart analysis, streamed. 64K output headroom: thinking
    // tokens count against max_tokens, and a 32-bar chart plus adaptive
    // thinking can overrun a 16K ceiling (which surfaces as a cut-off).
    const stream = await client.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 64000,
      stream: true,
      thinking: { type: "adaptive" },
      system: SYSTEM_PROMPT,
      output_config: {
        effort: "medium",
        format: { type: "json_schema", schema: SHEET_ANALYSIS_SCHEMA },
      },
      messages: [{ role: "user", content: buildChartPrompt(chartRequest!) }],
    });
    return streamingResponse(stream);
  } catch (error) {
    return errorResponse(error);
  }
}
