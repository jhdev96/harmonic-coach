"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { midiToNoteName } from "@/src/lib/chordToNotes";

interface PianoKeyboardProps {
  // MIDI numbers currently sounding from measure playback.
  activeNotes: number[];
  onKeyPlay: (midi: number) => void;
}

// C2–B6. Playback voicings are folded into C3–C5 by chordToNotes, so
// highlights land mid-keyboard; the outer octaves are there for register
// context and free exploration by clicking.
const START_MIDI = 36;
const END_MIDI = 95;

const WHITE_PITCH_CLASSES = new Set([0, 2, 4, 5, 7, 9, 11]);

function isWhite(midi: number): boolean {
  return WHITE_PITCH_CLASSES.has(midi % 12);
}

type Key = { midi: number; noteName: string };

const WHITE_KEYS: Key[] = [];
// Black keys carry the index of the white key they sit after, for placement.
const BLACK_KEYS: (Key & { afterWhiteIndex: number })[] = [];
for (let midi = START_MIDI; midi <= END_MIDI; midi++) {
  if (isWhite(midi)) {
    WHITE_KEYS.push({ midi, noteName: midiToNoteName(midi) });
  } else {
    BLACK_KEYS.push({
      midi,
      noteName: midiToNoteName(midi),
      afterWhiteIndex: WHITE_KEYS.length - 1,
    });
  }
}

const WHITE_WIDTH_PCT = 100 / WHITE_KEYS.length;
const BLACK_WIDTH_PCT = WHITE_WIDTH_PCT * 0.6;

// How long a clicked key stays visually pressed.
const PRESS_FLASH_MS = 220;

export default function PianoKeyboard({
  activeNotes,
  onKeyPlay,
}: PianoKeyboardProps) {
  const active = new Set(activeNotes);
  const [pressedMidi, setPressedMidi] = useState<number | null>(null);
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
    };
  }, []);

  function press(midi: number) {
    onKeyPlay(midi);
    setPressedMidi(midi);
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
    pressTimerRef.current = setTimeout(() => setPressedMidi(null), PRESS_FLASH_MS);
  }

  // Pointer presses play on pointerdown for instrument-like response; the
  // click handler only fires for keyboard activation (detail === 0), so a
  // physical click doesn't sound twice.
  function keyHandlers(midi: number) {
    return {
      onPointerDown: () => press(midi),
      onClick: (event: React.MouseEvent) => {
        if (event.detail === 0) press(midi);
      },
    };
  }

  return (
    <div
      role="group"
      aria-label="Piano keyboard — click a key to hear its note"
      className="select-none overflow-hidden rounded bg-[#16120e] p-3 pt-1.5 shadow-[var(--shadow-input)]"
    >
      {/* Red felt strip along the back rail, as on a grand piano. */}
      <div className="h-1.5 bg-gradient-to-b from-[#96151c] to-[#bb2027]" />
      <div className="relative flex h-36">
        {WHITE_KEYS.map(({ midi, noteName }) => {
          const isActive = active.has(midi);
          const isPressed = pressedMidi === midi;
          const isC = midi % 12 === 0;
          return (
            <button
              key={midi}
              type="button"
              aria-label={`Play ${noteName}`}
              {...keyHandlers(midi)}
              className={clsx(
                "relative flex flex-1 items-end justify-center rounded-b-[4px] border-x border-b border-[#16120e] pb-1.5 transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)]/50",
                isActive
                  ? "bg-gradient-to-b from-[#f3e6cf] to-[color-mix(in_oklab,var(--accent)_30%,#fdfaf1)]"
                  : isPressed
                    ? "bg-gradient-to-b from-[#f1ead9] to-[#e9dfc8]"
                    : "bg-gradient-to-b from-[#fdfaf1] to-[#f7f0df] hover:to-[#f0e7d2]"
              )}
            >
              {isActive ? (
                <span
                  aria-hidden
                  className="mb-0.5 h-2 w-2 rounded-full bg-[var(--accent-strong)] shadow-[0_1px_2px_rgba(42,37,32,0.35)]"
                />
              ) : (
                isC && (
                  <span
                    aria-hidden
                    className="font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--muted)]/70"
                  >
                    {noteName}
                  </span>
                )
              )}
            </button>
          );
        })}

        {BLACK_KEYS.map(({ midi, noteName, afterWhiteIndex }) => {
          const isActive = active.has(midi);
          const isPressed = pressedMidi === midi;
          const leftPct =
            (afterWhiteIndex + 1) * WHITE_WIDTH_PCT - BLACK_WIDTH_PCT / 2;
          return (
            <button
              key={midi}
              type="button"
              aria-label={`Play ${noteName}`}
              {...keyHandlers(midi)}
              style={{ left: `${leftPct}%`, width: `${BLACK_WIDTH_PCT}%` }}
              className={clsx(
                "absolute top-0 z-10 flex h-[58%] items-end justify-center rounded-b-[3px] pb-1 shadow-[0_2px_3px_rgba(22,18,14,0.28)] transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60",
                isActive
                  ? "bg-gradient-to-b from-[#3a332c] to-[var(--accent-strong)]"
                  : isPressed
                    ? "bg-gradient-to-b from-[#1d1915] to-[#2e2823]"
                    : "bg-gradient-to-b from-[#332d26] to-[#211d18] hover:to-[#38312a]"
              )}
            >
              {isActive && (
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 rounded-full bg-[#f3e6cf] shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
