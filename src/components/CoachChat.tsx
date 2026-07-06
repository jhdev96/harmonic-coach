"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_QUESTION_LENGTH } from "@/src/lib/constants";
import { QaEntry } from "@/src/lib/types";
import { CHIP, FIELD, PRIMARY_BUTTON } from "@/src/lib/styles";
import clsx from "clsx";

interface CoachChatProps {
  thread: QaEntry[];
  summary?: string;
  isAsking: boolean;
  disabled: boolean;
  onAsk: (question: string) => void;
  onBarClick: (measureNumber: number) => void;
}

const SUGGESTION_CHIPS = [
  "Why does bar 4 work?",
  "What scale fits here?",
  "How would you play this?",
];

// Renders answer text with `[bar N]` matches turned into clickable bar links.
function renderAnswer(
  answer: string,
  onBarClick: (n: number) => void,
): React.ReactNode[] {
  const pattern = /\[bar (\d+)\]/g;
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;
  
  while ((match = pattern.exec(answer)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(
        <span key={`t-${key++}`}>{answer.slice(lastIndex, match.index)}</span>,
      );
    }
    const barNumber = Number.parseInt(match[1], 10);
    nodes.push(
      <button
        key={`b-${key++}`}
        type="button"
        onClick={() => onBarClick(barNumber)}
        className="font-mono text-[13px] text-[var(--accent-strong)] underline-offset-2 transition hover:underline"
      >
        bar {barNumber}
      </button>,
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < answer.length) {
    nodes.push(<span key={`t-${key++}`}>{answer.slice(lastIndex)}</span>);
  }
  return nodes;
}

export default function CoachChat({
  thread,
  summary,
  isAsking,
  disabled,
  onAsk,
  onBarClick,
}: CoachChatProps) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Newest exchange lives at the bottom; auto-scroll as streamed text lands.
    el.scrollTop = el.scrollHeight;
  }, [thread]);

  const canSubmit = !disabled && !isAsking && draft.trim().length > 0;

  function submit() {
    const question = draft.trim();
    if (!question || disabled || isAsking) return;
    onAsk(question);
    setDraft("");
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-1">
      <div
        ref={scrollRef}
        className="flex flex-1 flex-col gap-4 overflow-y-auto pr-1 pb-8 max-h-88"
      >
        {summary && (
          <div className="flex flex-col gap-2">
            <p className="font-semibold text-[11px] tracking-[0.18em] text-[var(--muted)]">
              Summary
            </p>
            <p className="text-[15px] leading-relaxed text-[var(--foreground)]/90">
              {summary}
            </p>
          </div>
        )}
        {thread.length > 0
          ? thread.map((entry, i) => {
              const isLast = i === thread.length - 1;
              const streaming = isAsking && isLast;
              return (
                <div key={i} className="flex flex-col gap-2">
                  <div className="flex flex-col items-end gap-1">
                    <p className="max-w-[85%] rounded-lg bg-[var(--accent)]/10 px-3 py-2 text-[14px] leading-relaxed text-[var(--foreground)]">
                      {entry.question}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1">
                    {entry.error ? (
                      <p
                        role="alert"
                        className="text-[14px] leading-relaxed text-[var(--danger)]"
                      >
                        {entry.error}
                      </p>
                    ) : entry.answer.length === 0 && streaming ? (
                      <div
                        aria-label="Coach is typing"
                        className="h-4 w-24 animate-pulse rounded bg-[var(--accent)]/25"
                      />
                    ) : (
                      <p className="text-[15px] leading-relaxed text-[var(--foreground)]/90">
                        {renderAnswer(entry.answer, onBarClick)}
                        {streaming && (
                          <span
                            aria-hidden
                            className="ml-1 inline-block h-[1em] w-[2px] animate-pulse bg-[var(--accent-strong)] align-[-0.15em]"
                          />
                        )}
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          : null}
      </div>

      {thread.length === 0 && (
        <div className="flex flex-wrap gap-2">
          {SUGGESTION_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => onAsk(chip)}
              disabled={disabled || isAsking}
              className={CHIP}
            >
              {chip}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <label htmlFor="coach-input" className="sr-only">
          Ask the coach a follow-up question
        </label>
        <textarea
          id="coach-input"
          value={draft}
          onChange={(event) =>
            setDraft(event.target.value.slice(0, MAX_QUESTION_LENGTH))
          }
          onKeyDown={handleKeyDown}
          disabled={disabled || isAsking}
          rows={1}
          placeholder="Ask a follow-up…"
          maxLength={MAX_QUESTION_LENGTH}
          className={FIELD}
        />
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className={clsx("flex-shrink-0", PRIMARY_BUTTON)}
        >
          {isAsking ? "…" : "Send"}
        </button>
      </div>
    </div>
  );
}
