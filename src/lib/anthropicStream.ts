import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

// Forwards text deltas from an Anthropic streaming response to the client
// as they generate. Content-Type defaults to JSON for the analyze route;
// pass "text/plain; charset=utf-8" for prose endpoints like /api/ask.
export function streamingResponse(
  stream: AsyncIterable<Anthropic.RawMessageStreamEvent>,
  contentType: string = "application/json; charset=utf-8",
): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
    },
  });
}

export function errorResponse(error: unknown): NextResponse {
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
