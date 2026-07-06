// Saves sessions to localStorage so a page refresh doesn't throw away an
// expensive analysis. Multiple sessions are kept in a single store with a
// pointer to the active one. Scan bytes are included when they fit; on quota
// failure the scan is dropped first, then the oldest inactive sessions are
// evicted — the analysis text is the expensive part worth keeping.

import type { PreparedScan } from "./scanUpload";
import type { Measure, SheetAnalysis, SheetExtraction, QaEntry } from "./types";

const STORE_KEY = "harmonic-coach-sessions-v1";
const LEGACY_SINGLE_SESSION_KEY = "harmonic-coach-session-v1";

export type PersistedSession = {
  title: string;
  songKey: string;
  timeSignature: string;
  measures: Measure[];
  selectedMeasureId: string | null;
  sheetAnalysis: SheetAnalysis | null;
  extraction: SheetExtraction | null;
  scan: PreparedScan | null;
  qaThread?: QaEntry[];
};

export type StoredSession = PersistedSession & {
  id: string;
  updatedAt: number;
};

type SessionStore = {
  activeId: string | null;
  sessions: StoredSession[];
};

export function createSessionId(): string {
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadStore(): SessionStore {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SessionStore;
      if (Array.isArray(parsed.sessions)) return parsed;
    }
    // Migrate the earlier single-session format into a one-entry store.
    const legacy = window.localStorage.getItem(LEGACY_SINGLE_SESSION_KEY);
    if (legacy) {
      const session = JSON.parse(legacy) as PersistedSession;
      window.localStorage.removeItem(LEGACY_SINGLE_SESSION_KEY);
      if (Array.isArray(session.measures)) {
        const migrated: StoredSession = {
          ...session,
          id: createSessionId(),
          updatedAt: Date.now(),
        };
        const store = { activeId: migrated.id, sessions: [migrated] };
        persistStore(store);
        return store;
      }
    }
  } catch {
    // Fall through to an empty store on any parse/storage failure.
  }
  return { activeId: null, sessions: [] };
}

function persistStore(store: SessionStore): boolean {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}

// Legacy entries (saved before scan bytes were stripped) may have a blanked
// blob previewUrl; rebuild it from the stored bytes when they exist. (When
// the original preview was a blob URL the media type is always an image, so
// a data URL renders fine.)
function withRestoredPreview(session: StoredSession): StoredSession {
  if (
    !session.scan ||
    !session.scan.dataBase64 ||
    session.scan.previewUrl.startsWith("data:")
  ) {
    return session;
  }
  return {
    ...session,
    scan: {
      ...session.scan,
      previewUrl: `data:${session.scan.mediaType};base64,${session.scan.dataBase64}`,
    },
  };
}

export function loadActiveSession(): StoredSession | null {
  const store = loadStore();
  const active = store.sessions.find((s) => s.id === store.activeId);
  return active ? withRestoredPreview(active) : null;
}

export function getSession(id: string): StoredSession | null {
  const store = loadStore();
  const session = store.sessions.find((s) => s.id === id);
  return session ? withRestoredPreview(session) : null;
}

export function listSessions(): StoredSession[] {
  return loadStore()
    .sessions.slice()
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function saveSession(id: string, snapshot: PersistedSession): void {
  // Blob URLs are meaningless after reload — store empty and rebuild on load.
  const scan =
    snapshot.scan && snapshot.scan.previewUrl.startsWith("blob:")
      ? { ...snapshot.scan, previewUrl: "" }
      : snapshot.scan;
  const entry: StoredSession = { ...snapshot, scan, id, updatedAt: Date.now() };

  const store = loadStore();
  const upsert = (session: StoredSession): SessionStore => ({
    activeId: id,
    sessions: [...store.sessions.filter((s) => s.id !== id), session],
  });

  if (persistStore(upsert(entry))) return;
  // Over quota: drop this session's scan bytes.
  if (persistStore(upsert({ ...entry, scan: null }))) return;
  // Still over: evict the oldest inactive sessions one at a time.
  const survivors = store.sessions
    .filter((s) => s.id !== id)
    .sort((a, b) => b.updatedAt - a.updatedAt);
  while (survivors.length > 0) {
    survivors.pop();
    const trimmed: SessionStore = {
      activeId: id,
      sessions: [...survivors, { ...entry, scan: null }],
    };
    if (persistStore(trimmed)) return;
  }
  // Give up: a single oversized session — persisting is best-effort.
}

export function setActiveSession(id: string | null): void {
  const store = loadStore();
  persistStore({ ...store, activeId: id });
}

export function deleteSession(id: string): void {
  const store = loadStore();
  persistStore({
    activeId: store.activeId === id ? null : store.activeId,
    sessions: store.sessions.filter((s) => s.id !== id),
  });
}
