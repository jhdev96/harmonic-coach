"use client";

import { useRef, useState } from "react";
import clsx from "clsx";
import { ACCEPTED_SCAN_TYPES } from "@/src/lib/scanUpload";

interface LeadSheetDropzoneProps {
  onFileSelected: (file: File) => void;
}

export default function LeadSheetDropzone({
  onFileSelected,
}: LeadSheetDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (file) onFileSelected(file);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Upload a lead sheet"
      onClick={() => inputRef.current?.click()}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragOver(false);
        handleFiles(event.dataTransfer.files);
      }}
      className={clsx(
        "flex cursor-pointer flex-col items-center gap-2 rounded border border-dashed p-8 text-center transition",
        isDragOver
          ? "border-[var(--accent)] bg-[var(--accent)]/10"
          : "border-[var(--accent)]/40 bg-[var(--card)]/60 hover:border-[var(--accent)] hover:bg-[var(--accent)]/5"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_SCAN_TYPES.join(",")}
        className="hidden"
        onChange={(event) => {
          handleFiles(event.target.files);
          event.target.value = "";
        }}
      />
      <p className="font-serif text-xl text-[var(--foreground)]">
        Upload a lead sheet
      </p>
      <p className="text-sm text-[var(--muted)]">
        Drop a PNG, JPG, or PDF here — the coach reads the chart and analyzes
        it bar by bar. No typing required.
      </p>
    </div>
  );
}
