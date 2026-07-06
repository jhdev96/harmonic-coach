import * as Tone from "tone";
import { chordToNotes, midiToNoteName } from "@/src/lib/chordToNotes";

// Real piano via Tone.Sampler over the Salamander Grand Piano samples
// (Alexander Holm, CC-BY 3.0 — a Yamaha C5 recorded note by note). Samples
// are spaced a minor third apart; the Sampler repitches between them. Until
// they finish loading (or if loading fails), a PolySynth stands in so
// playback always works.
const SALAMANDER_BASE_URL = "https://tonejs.github.io/audio/salamander/";

const SAMPLE_URLS: Record<string, string> = {};
for (let octave = 1; octave <= 7; octave++) {
  SAMPLE_URLS[`C${octave}`] = `C${octave}.mp3`;
  SAMPLE_URLS[`D#${octave}`] = `Ds${octave}.mp3`;
  SAMPLE_URLS[`F#${octave}`] = `Fs${octave}.mp3`;
  SAMPLE_URLS[`A${octave}`] = `A${octave}.mp3`;
}

let sampler: Tone.Sampler | null = null;
let samplerLoaded = false;
let samplerFailed = false;

let synth: Tone.PolySynth | null = null;

function getSynth(): Tone.PolySynth {
  if (!synth) {
    synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: {
        attack: 0.02,
        decay: 0.25,
        sustain: 0.4,
        release: 0.6,
      },
    }).toDestination();
    synth.volume.value = -8;
  }
  return synth;
}

// Begin fetching the piano samples. Safe to call any time (idempotent);
// call it early — e.g. when a session starts — so the samples are usually
// ready before the first note plays.
export function preloadPiano(): void {
  if (sampler || samplerFailed) return;
  sampler = new Tone.Sampler({
    urls: SAMPLE_URLS,
    baseUrl: SALAMANDER_BASE_URL,
    release: 1.2,
    onload: () => {
      samplerLoaded = true;
    },
    onerror: () => {
      // Offline or the host is unreachable: stay on the synth for good
      // rather than re-fetching on every note.
      samplerFailed = true;
      sampler?.dispose();
      sampler = null;
    },
  }).toDestination();
  sampler.volume.value = -4;
}

function getInstrument(): Tone.Sampler | Tone.PolySynth {
  preloadPiano();
  return samplerLoaded && sampler ? sampler : getSynth();
}

// Play a chord for `duration` seconds. Resolves once the notes have been
// scheduled; the caller can await if they want to know playback started, but
// the actual sound continues asynchronously.
export async function playChord(symbol: string, duration = 1): Promise<void> {
  const notes = chordToNotes(symbol);
  if (notes.length === 0) return;

  // Browsers require a user gesture before audio can start. `start()` is a
  // no-op once the context is already running.
  await Tone.start();

  const noteNames = notes.map(midiToNoteName);
  const now = Tone.now();
  getInstrument().triggerAttackRelease(noteNames, duration, now);
}

// Play a single note (piano-key click). Same shared instrument as chords so
// a clicked key blends with anything already sounding.
export async function playNote(midi: number, duration = 0.5): Promise<void> {
  await Tone.start();
  getInstrument().triggerAttackRelease(midiToNoteName(midi), duration, Tone.now());
}

// Silence anything currently playing without tearing down the instruments.
export function stopChord(): void {
  synth?.releaseAll();
  if (samplerLoaded) sampler?.releaseAll();
}

// Release the shared instruments. Call from a cleanup effect when the whole
// player unmounts for good; individual play/stop cycles should use stopChord.
export function disposePlayer(): void {
  if (synth) {
    synth.dispose();
    synth = null;
  }
  if (sampler) {
    sampler.dispose();
    sampler = null;
    samplerLoaded = false;
  }
}
