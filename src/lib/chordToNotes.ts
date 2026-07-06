// Convert a chord symbol like "Cmaj7", "F-7", "B7b9" into MIDI note numbers.
// Root sits in octave 4 (C4 = 60) and chord tones stack upward. Meant for
// quick playback preview, not voice-led jazz voicings.

const PITCH_CLASS: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

// Intervals in semitones from the root. Order matters: later entries can
// overwrite earlier ones so extensions and alterations can adjust the stack.
type Interval = { degree: number; semitones: number };

function baseTriad(quality: string): Interval[] {
  switch (quality) {
    case "min":
      return [
        { degree: 3, semitones: 3 },
        { degree: 5, semitones: 7 },
      ];
    case "dim":
      return [
        { degree: 3, semitones: 3 },
        { degree: 5, semitones: 6 },
      ];
    case "aug":
      return [
        { degree: 3, semitones: 4 },
        { degree: 5, semitones: 8 },
      ];
    case "sus2":
      return [
        { degree: 3, semitones: 2 },
        { degree: 5, semitones: 7 },
      ];
    case "sus4":
      return [
        { degree: 3, semitones: 5 },
        { degree: 5, semitones: 7 },
      ];
    default:
      return [
        { degree: 3, semitones: 4 },
        { degree: 5, semitones: 7 },
      ];
  }
}

type ChordParts = {
  root: number;
  quality: string;
  seventh: "maj7" | "min7" | "dim7" | "halfDim" | "mMaj7" | null;
  extensions: number[]; // 9, 11, 13
  alterations: { target: number; delta: number }[]; // e.g. b5 → {5, -1}
  bassPc: number | null;
};

function parseRoot(input: string): { pc: number; rest: string } | null {
  const match = input.match(/^([A-G])([#b♯♭]?)(.*)$/);
  if (!match) return null;
  const letter = match[1];
  const accidental = match[2];
  let pc = PITCH_CLASS[letter];
  if (accidental === "#" || accidental === "♯") pc = (pc + 1) % 12;
  else if (accidental === "b" || accidental === "♭") pc = (pc + 11) % 12;
  return { pc, rest: match[3] };
}

function parseChord(symbol: string): ChordParts | null {
  const trimmed = symbol.trim();
  if (!trimmed) return null;

  // Split off slash bass first so it doesn't confuse quality parsing.
  const slashIndex = trimmed.indexOf("/");
  const main = slashIndex === -1 ? trimmed : trimmed.slice(0, slashIndex);
  const bassPart = slashIndex === -1 ? null : trimmed.slice(slashIndex + 1);

  const rootParsed = parseRoot(main);
  if (!rootParsed) return null;

  let bassPc: number | null = null;
  if (bassPart) {
    const bassParsed = parseRoot(bassPart);
    bassPc = bassParsed?.pc ?? null;
  }

  let rest = rootParsed.rest;
  let quality = "maj";
  let seventh: ChordParts["seventh"] = null;
  const extensions: number[] = [];
  const alterations: ChordParts["alterations"] = [];

  // Quality prefixes. Longer tokens first so "maj7" beats "m" + "aj7".
  const qualityMatchers: [RegExp, string][] = [
    [/^maj(?!\d)/i, "maj"],
    [/^min/i, "min"],
    [/^dim(?!7)/i, "dim"],
    [/^aug/i, "aug"],
    [/^sus2/i, "sus2"],
    [/^sus4/i, "sus4"],
    [/^sus/i, "sus4"],
    [/^Δ(?!\d)/, "maj"],
    [/^\+/, "aug"],
    [/^°(?!7)/, "dim"],
    [/^ø/, "halfDim-marker"],
    [/^-/, "min"],
    [/^m(?!aj)/, "min"],
    [/^M(?!\d)/, "maj"],
  ];

  for (const [pattern, name] of qualityMatchers) {
    const match = rest.match(pattern);
    if (match) {
      if (name === "halfDim-marker") {
        quality = "dim";
        seventh = "halfDim";
      } else {
        quality = name;
      }
      rest = rest.slice(match[0].length);
      break;
    }
  }

  // Explicit seventh markers like "maj7", "M7", "Δ7", "dim7", "mMaj7".
  const majSeventh = rest.match(/^(maj7|M7|Δ7)/);
  if (majSeventh) {
    seventh = quality === "min" ? "mMaj7" : "maj7";
    rest = rest.slice(majSeventh[0].length);
  } else if (/^dim7/i.test(rest)) {
    quality = "dim";
    seventh = "dim7";
    rest = rest.slice(4);
  }

  // Bare number after quality: 7, 9, 11, 13, 6. A number without a maj prefix
  // implies a dominant (minor) seventh, except after "maj" it's a major seventh.
  const numberMatch = rest.match(/^(\d{1,2})/);
  if (numberMatch) {
    const n = parseInt(numberMatch[1], 10);
    rest = rest.slice(numberMatch[0].length);
    if (n === 6) {
      extensions.push(6);
    } else if (n === 7) {
      if (!seventh) {
        seventh = quality === "maj" ? "min7" : quality === "min" ? "min7" : "min7";
      }
    } else if (n === 9 || n === 11 || n === 13) {
      if (!seventh) seventh = quality === "min" ? "min7" : "min7";
      // Extensions imply lower ones (13 implies 9 and 11 in theory, but we
      // keep it minimal: just add the named tension).
      extensions.push(9);
      if (n >= 11) extensions.push(11);
      if (n >= 13) extensions.push(13);
    }
  }

  // Trailing alterations and add tones, in any order.
  while (rest.length > 0) {
    const addMatch = rest.match(/^add(\d{1,2})/i);
    if (addMatch) {
      extensions.push(parseInt(addMatch[1], 10));
      rest = rest.slice(addMatch[0].length);
      continue;
    }
    const altMatch = rest.match(/^([#b♯♭])(\d{1,2})/);
    if (altMatch) {
      const sign = altMatch[1];
      const target = parseInt(altMatch[2], 10);
      const delta = sign === "#" || sign === "♯" ? 1 : -1;
      alterations.push({ target, delta });
      rest = rest.slice(altMatch[0].length);
      continue;
    }
    // Unknown token: bail out and use what we have.
    break;
  }

  return {
    root: rootParsed.pc,
    quality,
    seventh,
    extensions,
    alterations,
    bassPc,
  };
}

function seventhInterval(kind: NonNullable<ChordParts["seventh"]>): number {
  switch (kind) {
    case "maj7":
      return 11;
    case "mMaj7":
      return 11;
    case "dim7":
      return 9;
    case "halfDim":
      return 10;
    case "min7":
    default:
      return 10;
  }
}

// Intervals (in semitones) above the root for a single chord token.
function chordIntervals(parts: ChordParts): number[] {
  const intervalMap = new Map<number, number>();
  for (const interval of baseTriad(parts.quality)) {
    intervalMap.set(interval.degree, interval.semitones);
  }

  if (parts.seventh) {
    intervalMap.set(7, seventhInterval(parts.seventh));
  }

  for (const ext of parts.extensions) {
    switch (ext) {
      case 6:
        intervalMap.set(6, 9);
        break;
      case 9:
        intervalMap.set(9, 14);
        break;
      case 11:
        intervalMap.set(11, 17);
        break;
      case 13:
        intervalMap.set(13, 21);
        break;
    }
  }

  for (const { target, delta } of parts.alterations) {
    const current = intervalMap.get(target);
    if (current !== undefined) {
      intervalMap.set(target, current + delta);
    } else {
      // Altered tension we haven't seen yet (e.g. b9 on a dominant that only
      // specified "7"). Insert it based on its natural degree.
      const natural =
        target === 5
          ? 7
          : target === 9
            ? 14
            : target === 11
              ? 17
              : target === 13
                ? 21
                : null;
      if (natural !== null) intervalMap.set(target, natural + delta);
    }
  }

  return Array.from(intervalMap.values()).sort((a, b) => a - b);
}

// Split a measure's chord field ("Gm7 C7") into individual chord symbols.
export function splitChordSymbols(chords: string): string[] {
  return chords
    .trim()
    .split(/\s+/)
    .filter((token) => token && token !== "%" && !/^N\.?C\.?$/i.test(token));
}

// Keep voicings in a pianist's comfortable register: anything above C5 folds
// down an octave (repeatedly if needed). Roots live in octave 4 and are never
// above B4, so folding only reseats sevenths/extensions on tall chords —
// producing close voicings instead of a stack that climbs toward G#6.
const VOICING_CEILING = 72; // C5

function foldIntoRange(notes: number[]): number[] {
  const folded = notes.map((note) => {
    let midi = note;
    while (midi > VOICING_CEILING) midi -= 12;
    return midi;
  });
  // Folding can land on a pitch the chord already contains.
  return Array.from(new Set(folded)).sort((a, b) => a - b);
}

// Convert a single chord symbol to MIDI note numbers. Returns [] if the
// symbol can't be parsed (unknown roots, empty strings, N.C., etc.).
export function chordToNotes(symbol: string): number[] {
  const parts = parseChord(symbol);
  if (!parts) return [];

  const rootMidi = 60 + ((parts.root - PITCH_CLASS.C + 12) % 12);
  const intervals = chordIntervals(parts);
  const notes = [rootMidi, ...intervals.map((semi) => rootMidi + semi)];

  if (parts.bassPc !== null) {
    // Bass note sits an octave below the root so the slash reading is audible.
    const bassMidi = 48 + parts.bassPc;
    return foldIntoRange([bassMidi, ...notes]);
  }

  return foldIntoRange(notes);
}

// Convert a whole measure ("Gm7 C7") to the MIDI notes for its first chord,
// which is what the preview player uses for a one-second-per-bar cadence.
export function measureToNotes(chords: string): number[] {
  const symbols = splitChordSymbols(chords);
  if (symbols.length === 0) return [];
  return chordToNotes(symbols[0]);
}

// Convert a MIDI note number to a scientific pitch string Tone.js accepts.
export function midiToNoteName(midi: number): string {
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const octave = Math.floor(midi / 12) - 1;
  const name = names[midi % 12];
  return `${name}${octave}`;
}
