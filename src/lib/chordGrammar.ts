// Deterministic chord-symbol validation: a cheap, code-side check on
// extracted chords so misreads (e.g. "Cnaj7") get flagged regardless of what
// the extraction model claimed about its own confidence.

// Root, optional accidental, optional quality, optional extensions/alterations,
// optional slash bass. Accepts jazz shorthand: F-7, Bbø7, CΔ7, N.C., %.
const CHORD_TOKEN_PATTERN = new RegExp(
  "^(?:N\\.?C\\.?|%|" +
    "[A-G](?:b|#|♭|♯)?" +
    "(?:maj|min|dim|aug|sus|add|m|M|Δ|\\+|-|ø|o)?" +
    "(?:[0-9]{1,2})?" +
    "(?:(?:b|#|♭|♯)(?:5|9|11|13)|sus[24]|add[0-9]{1,2}|alt|6/9)*" +
    "(?:/[A-G](?:b|#|♭|♯)?)?" +
    ")$",
);

export function isParsableChordToken(token: string): boolean {
  return CHORD_TOKEN_PATTERN.test(token);
}

// True when a measure contains at least one token that doesn't parse as a
// chord symbol. Empty measures are fine (nothing to flag).
export function measureHasUnparsableChords(chords: string): boolean {
  const tokens = chords.trim().split(/\s+/).filter(Boolean);
  return tokens.some((token) => !isParsableChordToken(token));
}
