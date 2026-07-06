import type { AskCoachRequest } from "@/src/lib/types";

// Streams the coach's plain-text answer from /api/ask, invoking onProgress
// with the accumulated text after each chunk. Resolves with the full text.
// Aborting via `signal` throws an AbortError; the caller decides whether to
// keep the partial answer that landed before the abort.
export async function streamCoachAnswer(
  request: AskCoachRequest,
  onProgress: (partialAnswer: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const response = await fetch("/api/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(
      body?.error ?? `Coach request failed (HTTP ${response.status}).`,
    );
  }
  if (!response.body) {
    throw new Error("The coach response had no body.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
    onProgress(text);
  }
  text += decoder.decode();
  onProgress(text);
  return text;
}
