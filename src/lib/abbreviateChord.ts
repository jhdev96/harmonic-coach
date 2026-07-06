/**
 * Converts chord symbols to compact unicode notation.
 * Examples:
 * - Cmaj7 → C△7
 * - Gm7 → Gm7 (unchanged, already short)
 * - B7b9 → B7♭9
 * - Ebmaj7 → E♭△7
 */
export function abbreviateChord(chord: string): string {
  if (!chord || !chord.trim()) return chord;

  let abbreviated = chord.trim();

  // Replace flats with unicode ♭
  abbreviated = abbreviated.replace(/b/g, "♭");

  // Replace sharps with unicode ♯
  abbreviated = abbreviated.replace(/#/g, "♯");

  // Replace maj with unicode triangle
  abbreviated = abbreviated.replace(/maj/gi, "△");

  // Clean up any double spaces
  abbreviated = abbreviated.replace(/\s+/g, " ");

  return abbreviated;
}

/**
 * Get abbreviated chords from a multi-chord string.
 * Example: "Gm7 C7" → ["Gm7", "C7"]
 */
export function getAbbreviatedChords(chordString: string): string[] {
  return chordString
    .split(/\s+/)
    .filter((c) => c.length > 0)
    .map(abbreviateChord);
}
