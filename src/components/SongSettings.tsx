"use client";

interface SongSettingsProps {
  title: string;
  songKey: string;
  timeSignature: string;
  onTitleChange: (value: string) => void;
  onKeyChange: (value: string) => void;
  onTimeSignatureChange: (value: string) => void;
}

const FIELD_CLASSES =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-base text-[var(--foreground)] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] outline-none transition placeholder:text-[var(--muted)]/60 focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/30";

export default function SongSettings({
  title,
  songKey,
  timeSignature,
  onTitleChange,
  onKeyChange,
  onTimeSignatureChange,
}: SongSettingsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div>
        <label htmlFor="title" className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Song Title
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="e.g., Amazing Grace"
          className={FIELD_CLASSES}
        />
      </div>
      <div>
        <label htmlFor="key" className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Key
        </label>
        <input
          id="key"
          type="text"
          value={songKey}
          onChange={(e) => onKeyChange(e.target.value)}
          placeholder="e.g., C major"
          className={FIELD_CLASSES}
        />
      </div>
      <div>
        <label htmlFor="time-sig" className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Time Signature
        </label>
        <input
          id="time-sig"
          type="text"
          value={timeSignature}
          onChange={(e) => onTimeSignatureChange(e.target.value)}
          placeholder="e.g., 4/4"
          className={FIELD_CLASSES}
        />
      </div>
    </div>
  );
}
