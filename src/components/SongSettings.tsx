"use client";

import CustomSelect from "@/src/components/CustomSelect";
import Tooltip from "@/src/components/Tooltip";

interface SongSettingsProps {
  title: string;
  songKey: string;
  timeSignature: string;
  onTitleChange: (value: string) => void;
  onKeyChange: (value: string) => void;
  onTimeSignatureChange: (value: string) => void;
  // Playback controls are optional so the same component can render on the
  // hero screen (no player) and in the workspace (with player).
  playingMeasureIndex?: number | null;
  isPlaying?: boolean;
  onPlayMeasure?: () => void;
  onRewind?: () => void;
  onForward?: () => void;
  onStop?: () => void;
  isPlayerDisabled?: boolean;
}

const FIELD_CLASSES =
  "w-full rounded-xl shadow-[var(--shadow-input)] bg-[var(--card)] px-4 py-3 text-base text-[var(--foreground)] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] outline-none transition placeholder:text-[var(--muted)]/60 focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/30";

const PLAYER_BUTTON_BASE =
  "flex h-[50px] w-[50px] items-center justify-center rounded-xl bg-[var(--card)] shadow-[var(--shadow-input)] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] text-[var(--accent-strong)] transition hover:bg-[var(--accent)]/10 hover:text-[var(--accent-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-[var(--card)]";

// Standalone class set (not layered on PLAYER_BUTTON_BASE) so its colors don't
// fight the base text/bg utilities. Icon green matches the confidence chip.
const PLAYER_BUTTON_PLAYING =
  "flex h-[50px] w-[50px] items-center justify-center rounded-xl bg-[var(--foreground)] shadow-[var(--shadow-input)] text-[#dde6c5] transition hover:bg-[var(--foreground)] hover:text-[#dde6c5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 disabled:cursor-not-allowed disabled:opacity-60";

const KEY_TONICS = [
  "C",
  "C#",
  "Db",
  "D",
  "D#",
  "Eb",
  "E",
  "F",
  "F#",
  "Gb",
  "G",
  "G#",
  "Ab",
  "A",
  "A#",
  "Bb",
  "B",
] as const;
const KEY_TYPES = [
  "major",
  "minor",
  "dorian",
  "phrygian",
  "lydian",
  "mixolydian",
  "locrian",
] as const;

const DEFAULT_TONIC: (typeof KEY_TONICS)[number] = "C";
const DEFAULT_TYPE: (typeof KEY_TYPES)[number] = "major";

function parseSongKey(value: string): {
  tonic: (typeof KEY_TONICS)[number];
  type: (typeof KEY_TYPES)[number];
} {
  const trimmed = value.trim();
  const [rawTonic, ...rest] = trimmed.split(/\s+/);
  const rawType = rest.join(" ").toLowerCase();
  const tonic = KEY_TONICS.find((t) => t.toLowerCase() === rawTonic?.toLowerCase()) ?? DEFAULT_TONIC;
  const type = KEY_TYPES.find((t) => t === rawType) ?? DEFAULT_TYPE;
  return { tonic, type };
}

function maskTimeSignature(raw: string, previous: string): string {
  const cleaned = raw.replace(/[^\d/]/g, "");
  const isDeleting = raw.length < previous.length;
  const firstSlash = cleaned.indexOf("/");

  if (firstSlash !== -1) {
    const numerator = cleaned.slice(0, firstSlash).replace(/\D/g, "").slice(0, 2);
    const denominator = cleaned.slice(firstSlash + 1).replace(/\D/g, "").slice(0, 2);
    if (!numerator) return "";
    return denominator ? `${numerator}/${denominator}` : `${numerator}/`;
  }

  const digits = cleaned.replace(/\D/g, "");
  if (!digits) return "";

  if (digits.length === 1) {
    return digits;
  }

  if (digits.length === 2) {
    // Auto-insert slash once two digits are entered, unless the user is
    // deleting (so backspace can clear characters cleanly).
    return isDeleting ? digits : `${digits}/`;
  }

  const numerator = digits.slice(0, 2);
  const denominator = digits.slice(2, 4);
  return `${numerator}/${denominator}`;
}

export default function SongSettings({
  title,
  songKey,
  timeSignature,
  onTitleChange,
  onKeyChange,
  onTimeSignatureChange,
  playingMeasureIndex,
  isPlaying = false,
  onPlayMeasure,
  onRewind,
  onForward,
  onStop,
  isPlayerDisabled = false,
}: SongSettingsProps) {
  const { tonic, type } = parseSongKey(songKey);

  const handleTonicChange = (nextTonic: string) => {
    onKeyChange(`${nextTonic} ${type}`);
  };

  const handleTypeChange = (nextType: string) => {
    onKeyChange(`${tonic} ${nextType}`);
  };

  const handleTimeSignatureChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onTimeSignatureChange(maskTimeSignature(event.target.value, timeSignature));
  };

  const handlePlayClick = () => {
    if (isPlaying) onStop?.();
    else onPlayMeasure?.();
  };

  // Rewind sits at the leftmost position; disable it when we're already at
  // bar 0 (or nothing has played yet) so the button reflects the timeline.
  const atStart =
    playingMeasureIndex === null ||
    playingMeasureIndex === undefined ||
    playingMeasureIndex <= 0;

  return (
    <div className="flex gap-3 items-center">
      <div className="flex-1 min-w-0">
        <Tooltip label="Song title" className="w-full">
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Song title"
            aria-label="Song title"
            className={`${FIELD_CLASSES} min-w-0`}
          />
        </Tooltip>
      </div>

      {onPlayMeasure && (
        <div
          role="group"
          aria-label="Measure playback"
          className="flex flex-1 justify-center gap-1"
        >
          <Tooltip label="Previous measure">
            <button
              type="button"
              onClick={onRewind}
              disabled={isPlayerDisabled || atStart}
              aria-label="Previous measure"
              className={PLAYER_BUTTON_BASE}
            >
              <svg
                aria-hidden
                viewBox="0 0 20 20"
                className="h-4 w-4"
                fill="currentColor"
              >
                <path d="M5 4h1.5v12H5V4zm3 6l8-5v10l-8-5z" />
              </svg>
            </button>
          </Tooltip>
          <Tooltip label={isPlaying ? "Stop" : "Play measure"}>
            <button
              type="button"
              onClick={handlePlayClick}
              disabled={isPlayerDisabled}
              aria-label={isPlaying ? "Stop" : "Play measure"}
              aria-pressed={isPlaying}
              className={isPlaying ? PLAYER_BUTTON_PLAYING : PLAYER_BUTTON_BASE}
            >
              <svg
                aria-hidden
                viewBox="0 0 20 20"
                className="h-4 w-4"
                fill="currentColor"
              >
                {isPlaying ? (
                  <rect x="4.5" y="4.5" width="11" height="11" rx="1" />
                ) : (
                  <path d="M5 3.5v13l11-6.5-11-6.5z" />
                )}
              </svg>
            </button>
          </Tooltip>
          <Tooltip label="Next measure">
            <button
              type="button"
              onClick={onForward}
              disabled={isPlayerDisabled}
              aria-label="Next measure"
              className={PLAYER_BUTTON_BASE}
            >
              <svg
                aria-hidden
                viewBox="0 0 20 20"
                className="h-4 w-4"
                fill="currentColor"
              >
                <path d="M13.5 4H15v12h-1.5V4zM4 5l8 5-8 5V5z" />
              </svg>
            </button>
          </Tooltip>
        </div>
      )}

      <div className="flex gap-1 items-center">
        <div className="flex gap-1">
          <Tooltip label="Key tonic">
            <CustomSelect
              id="key-tonic"
              ariaLabel="Key tonic"
              value={tonic}
              options={KEY_TONICS}
              onChange={handleTonicChange}
              className={`${FIELD_CLASSES}`}
            />
          </Tooltip>
          <Tooltip label="Key mode">
            <CustomSelect
              id="key-type"
              ariaLabel="Key type"
              value={type}
              options={KEY_TYPES}
              onChange={handleTypeChange}
              formatOption={(option) => option.charAt(0).toUpperCase() + option.slice(1)}
              className={`${FIELD_CLASSES} min-w-[8rem]`}
            />
          </Tooltip>
        </div>
        <Tooltip label="Time signature">
          <input
            id="time-sig"
            type="text"
            inputMode="numeric"
            value={timeSignature}
            onChange={handleTimeSignatureChange}
            placeholder="4/4"
            aria-label="Time signature"
            className={`${FIELD_CLASSES} max-w-[4rem] text-center`}
          />
        </Tooltip>
      </div>
    </div>
  );
}

