"use client";

import { useEffect, useState } from "react";

interface ScanPreviewProps {
  previewUrl: string;
  fileName: string;
  // True while the scan is being read and no measures have arrived yet.
  isReading: boolean;
}

// Compact thumbnail of the uploaded scan, shown inline with the analyze
// controls to keep the layout stable. Clicking it opens the scan full-size
// in a dialog overlay.
export default function ScanPreview({
  previewUrl,
  fileName,
  isReading,
}: ScanPreviewProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        title={`${fileName} — click to view full size`}
        aria-label={`View uploaded lead sheet ${fileName} full size`}
        className={`group relative h-[42px] w-[64px] shrink-0 overflow-hidden rounded border bg-white shadow-sm transition ${
          isReading
            ? "animate-pulse border-[var(--accent)]"
            : "border-[var(--border)] hover:border-[var(--accent)]"
        }`}
      >
        {previewUrl ? (
          // Local data URL, not a remotely-optimizable asset — next/image
          // buys nothing here.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt=""
            className="h-full w-full object-cover object-top"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)]">
            Scan
          </span>
        )}
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Lead sheet: ${fileName}`}
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="flex max-h-full flex-col gap-2"
          >
            <div className="flex items-center justify-between gap-4">
              <span className="truncate font-mono text-[11px] tracking-[0.08em] text-white/80">
                {fileName}
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded px-2 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-white/80 transition hover:text-white"
              >
                Close (Esc)
              </button>
            </div>
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="Uploaded lead sheet, full size"
                className="min-h-0 rounded bg-white object-contain shadow-2xl"
                style={{ maxHeight: "88vh", maxWidth: "90vw" }}
              />
            ) : (
              <p className="rounded bg-[var(--card)] p-6 text-sm text-[var(--muted)]">
                No preview available for this file.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
