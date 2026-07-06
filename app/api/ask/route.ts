import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

import { ASK_COACH_PROMPT, buildAskPrompt } from "@/src/lib/analysisPrompts";
import { errorResponse, streamingResponse } from "@/src/lib/anthropicStream";

import { MAX_QUESTION_LENGTH, MAX_MEASURES, MAX_HISTORY_ENTRIES, ANTHROPIC_MODEL } from "@/src/lib/constants";
import { parseAskRequest } from "@/src/lib/parseAskRequest";

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
  const parsed = parseAskRequest(body, MAX_QUESTION_LENGTH, MAX_MEASURES, MAX_HISTORY_ENTRIES);
  if (!parsed.data) {
    return NextResponse.json(
      { error: parsed.error ?? "Invalid request." },
      { status: 400 },
    );
  }

  const client = new Anthropic();

  try {
    const stream = await client.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 2000,
      stream: true,
      thinking: { type: "adaptive" },
      system: ASK_COACH_PROMPT,
      messages: [
        { role: "user", content: buildAskPrompt(parsed.data) },
      ],
    });
    return streamingResponse(stream, "text/plain; charset=utf-8");
  } catch (error) {
    return errorResponse(error);
  }
}
