"use client";

import { useEffect, useRef, useState } from "react";
import { FileMusic, Library, Trash2 } from "lucide-react";
import Tooltip from "@/src/components/Tooltip";
import {
  deleteSession,
  listSessions,
  type StoredSession,
} from "@/src/lib/sessionPersistence";

interface SessionNavProps {
  activeSessionId: string | null;
  onNewSession: () => void;
  onLoadSession: (id: string) => void;
}

const FAB_CLASSES =
  "flex h-12 w-12 items-center justify-center rounded-full bg-[var(--card)] shadow-[var(--shadow-arrow)] text-[var(--accent-strong)] transition hover:bg-[var(--accent)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40";

function formatUpdatedAt(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function SessionNav({
  activeSessionId,
  onNewSession,
  onLoadSession,
}: SessionNavProps) {
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  // The list is read from storage when the panel opens, then kept in state so
  // deletions update in place without re-reading mid-interaction.
  const [sessions, setSessions] = useState<StoredSession[]>([]);
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!isLibraryOpen) return;
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsLibraryOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsLibraryOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isLibraryOpen]);

  function toggleLibrary() {
    if (!isLibraryOpen) setSessions(listSessions());
    setIsLibraryOpen((open) => !open);
  }

  function handleSelect(id: string) {
    onLoadSession(id);
    setIsLibraryOpen(false);
  }

  function handleDelete(id: string) {
    deleteSession(id);
    setSessions((prev) => prev.filter((session) => session.id !== id));
  }

  return (
    <nav
      ref={containerRef}
      aria-label="Sessions"
      className="fixed left-5 top-6 z-40"
    >
      <div className="flex flex-col gap-3">
        <Tooltip label="New session" side="right">
          <button
            type="button"
            onClick={onNewSession}
            aria-label="New session"
            className={FAB_CLASSES}
          >
            <FileMusic aria-hidden className="h-5 w-5" />
          </button>
        </Tooltip>
        <Tooltip label="Saved sessions" side="right">
          <button
            type="button"
            onClick={toggleLibrary}
            aria-label="Saved sessions"
            aria-expanded={isLibraryOpen}
            className={`${FAB_CLASSES} ${
              isLibraryOpen ? "bg-[var(--accent)]/10" : ""
            }`}
          >
            <Library aria-hidden className="h-5 w-5" />
          </button>
        </Tooltip>
      </div>

      {isLibraryOpen && (
        <section
          aria-label="Saved sessions"
          className="absolute left-full top-0 ml-3 w-80 rounded-xl border border-[var(--border)] bg-[var(--card)] p-2 shadow-[0_12px_40px_-16px_rgba(42,37,32,0.5)]"
        >
          <p className="px-3 pb-1 pt-2 font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--muted)]">
            Saved sessions
          </p>
          {sessions.length === 0 ? (
            <p className="px-3 pb-3 pt-1 text-sm text-[var(--muted)]">
              Nothing saved yet. Sessions are saved automatically as you work.
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {sessions.map((session) => (
                <li key={session.id} className="group/session flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleSelect(session.id)}
                    className={`min-w-0 flex-1 rounded-lg px-3 py-2 text-left transition hover:bg-[var(--accent)]/10 ${
                      session.id === activeSessionId
                        ? "bg-[var(--accent)]/5"
                        : ""
                    }`}
                  >
                    <span className="block truncate text-sm font-medium text-[var(--foreground)]">
                      {session.title.trim() || "Untitled session"}
                    </span>
                    <span className="block text-xs text-[var(--muted)]">
                      {session.measures.length}{" "}
                      {session.measures.length === 1 ? "bar" : "bars"}
                      {session.scan ? " · scan" : ""} ·{" "}
                      {formatUpdatedAt(session.updatedAt)}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(session.id)}
                    aria-label={`Delete ${session.title.trim() || "untitled session"}`}
                    className="mr-1 rounded-lg p-2 text-[var(--muted)] opacity-0 transition hover:bg-[var(--danger)]/10 hover:text-[var(--danger)] focus-visible:opacity-100 group-hover/session:opacity-100"
                  >
                    <Trash2 aria-hidden className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </nav>
  );
}
