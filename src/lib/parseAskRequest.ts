import type { AskCoachRequest } from "./types";

export const MAX_HISTORY_ENTRY_LENGTH = 2000;

export function parseAskRequest(
  body: unknown,
  maxQuestionLength: number,
  maxMeasures: number,
  maxHistoryEntries: number
): {
  error?: string;
  data?: AskCoachRequest;
} {
  if (typeof body !== "object" || body === null) {
    return { error: "Request body must be a JSON object." };
  }
  const candidate = body as Partial<AskCoachRequest>;

  if (
    typeof candidate.title !== "string" ||
    typeof candidate.songKey !== "string" ||
    typeof candidate.timeSignature !== "string"
  ) {
    return { error: "title, songKey, and timeSignature must be strings." };
  }

  if (
    !Array.isArray(candidate.measures) ||
    candidate.measures.length === 0 ||
    candidate.measures.length > maxMeasures
  ) {
    return {
      error: `Expected 1–${maxMeasures} measures.`,
    };
  }
  const measuresValid = candidate.measures.every(
    (measure) =>
      typeof measure === "object" &&
      measure !== null &&
      typeof (measure as { index?: unknown }).index === "number" &&
      typeof (measure as { chords?: unknown }).chords === "string",
  );
  if (!measuresValid) {
    return { error: "Each measure must have a numeric index and string chords." };
  }

  if (
    typeof candidate.question !== "string" ||
    candidate.question.trim().length === 0
  ) {
    return { error: "question is required." };
  }
  if (candidate.question.length > maxQuestionLength) {
    return {
      error: `question must be ${maxQuestionLength} characters or fewer.`,
    };
  }

  if (!Array.isArray(candidate.history)) {
    return { error: "history must be an array." };
  }
  const historyValid = candidate.history.every(
    (entry) =>
      typeof entry === "object" &&
      entry !== null &&
      typeof (entry as { question?: unknown }).question === "string" &&
      typeof (entry as { answer?: unknown }).answer === "string" &&
      (entry as { question: string }).question.length <=
        MAX_HISTORY_ENTRY_LENGTH &&
      (entry as { answer: string }).answer.length <=
        MAX_HISTORY_ENTRY_LENGTH,
  );
  if (!historyValid) {
    return {
      error: `Each history entry must have string question and answer (≤ ${MAX_HISTORY_ENTRY_LENGTH} chars each).`,
    };
  }

  if (candidate.overview !== undefined && typeof candidate.overview !== "string") {
    return { error: "overview must be a string when present." };
  }

  if (candidate.breakdowns !== undefined) {
    if (!Array.isArray(candidate.breakdowns)) {
      return { error: "breakdowns must be an array when present." };
    }
    const breakdownsValid = candidate.breakdowns.every(
      (entry) =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as { measureIndex?: unknown }).measureIndex === "number" &&
        typeof (entry as { chords?: unknown }).chords === "string" &&
        typeof (entry as { title?: unknown }).title === "string" &&
        typeof (entry as { romanNumeral?: unknown }).romanNumeral === "string" &&
        typeof (entry as { explanation?: unknown }).explanation === "string",
    );
    if (!breakdownsValid) {
      return { error: "breakdowns entries have the wrong shape." };
    }
  }

  if (
    candidate.selectedMeasureIndex !== undefined &&
    typeof candidate.selectedMeasureIndex !== "number"
  ) {
    return { error: "selectedMeasureIndex must be a number when present." };
  }

  // Cap history server-side regardless of what the client sends.
  const trimmedHistory = candidate.history.slice(-maxHistoryEntries);

  return {
    data: {
      title: candidate.title,
      songKey: candidate.songKey,
      timeSignature: candidate.timeSignature,
      measures: candidate.measures.map((m) => ({
        index: m.index,
        chords: m.chords,
      })),
      overview: candidate.overview,
      breakdowns: candidate.breakdowns?.map((b) => ({
        measureIndex: b.measureIndex,
        chords: b.chords,
        title: b.title,
        romanNumeral: b.romanNumeral,
        explanation: b.explanation,
      })),
      selectedMeasureIndex: candidate.selectedMeasureIndex,
      history: trimmedHistory,
      question: candidate.question.trim(),
    },
  };
}
