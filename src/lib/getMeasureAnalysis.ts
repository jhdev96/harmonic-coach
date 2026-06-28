import type { MeasureAnalysis } from "@/src/lib/types";

const ANALYSIS_BY_CHORDS: Record<string, MeasureAnalysis> = {
  C: {
    title: "Tonic home base",
    confidence: "High",
    explanation:
      "This is your I chord in C major — the harmonic home. Every tension in the chart eventually wants to land here. Listen for how stable and grounded it feels compared to the dominant and secondary-dominant moments later in the phrase.",
    practiceTip:
      "Voice it with the root in your left hand and a clean E–G–C triad in your right. Hold it long enough to really hear the resting point before moving on.",
  },
  "Gm7 C7": {
    title: "ii–V into IV",
    confidence: "High",
    explanation:
      "A secondary ii–V that tonicizes F. Gm7 acts as the ii of F major and C7 is its V7, so the ear is briefly pulled toward F before the next measure confirms it with Fmaj7. This is the reharmonization move that gives the phrase its motion.",
    practiceTip:
      "Track the voice leading across the bar: the F on top of Gm7 stays put, then E (the 3rd of C7) leans up a half step into F (the 5th of Fmaj7). Smooth half-step motion is the whole point.",
    alternativeInterpretation:
      "You can also hear C7 as a passing dominant inside the home key — the b7 (Bb) just colors the dominant function without fully leaving C major.",
  },
  Fmaj7: {
    title: "IVmaj7 arrival",
    confidence: "Medium",
    explanation:
      "The IVmaj7 — open and lush, the destination of the previous ii–V. The major 7th adds color without dissonance, which is why reharms love landing here. It feels like an arrival, but it isn't final; it leaves room to push back toward V or pivot somewhere new.",
    practiceTip:
      "Try voicing it without the 5th: F–A–E in the right hand. Dropping the 5th lets the major 7th breathe and stops the chord from sounding crowded.",
    alternativeInterpretation:
      "Some charts treat this bar as a Lydian moment. Lean on B natural in any fill or melody and the color shifts from warm IV to bright IV-Lydian.",
  },
  "B7b9 Em7": {
    title: "Secondary dominant to iii",
    confidence: "High",
    explanation:
      "B7b9 is V7/iii — a secondary dominant aiming straight at Em7, the iii of C major. The flat 9 (C natural) creates a strong half-step pull into B, and the leading tone D# resolves up to E. Together they make the resolution feel inevitable.",
    practiceTip:
      "Isolate the two tension notes in B7b9 — D# and C — and resolve them slowly into the Em7 (D# → E, C → B). Doing this without rhythm first trains your ear to hear why the chord wants to move.",
  },
};

const EMPTY_ANALYSIS: MeasureAnalysis = {
  title: "Empty measure",
  confidence: "Low",
  explanation:
    "Nothing to analyze yet. Type a chord symbol (or a short progression like \"Gm7 C7\") into this measure to see how Harmonic Coach interprets it.",
  practiceTip:
    "Start with the chords you already know from the song. Even a single chord per bar gives the coach enough to begin reasoning about function.",
};

const UNKNOWN_ANALYSIS: MeasureAnalysis = {
  title: "Analysis pending",
  confidence: "Low",
  explanation:
    "I don't have a stored interpretation for this chord yet. In the full version, the coach reasons about function from the surrounding key and progression. For this preview, try one of the demo measures (C, Gm7 C7, Fmaj7, or B7b9 Em7) to see a worked example.",
  practiceTip:
    "While you wait, play the chord slowly and name the root, third, and seventh out loud. Knowing the chord tones is the foundation that any harmonic analysis sits on top of.",
};

function normalize(chords: string): string {
  return chords.trim().replace(/\s+/g, " ");
}

export function getMeasureAnalysis(chords: string): MeasureAnalysis {
  const key = normalize(chords);
  if (key === "") return EMPTY_ANALYSIS;
  return ANALYSIS_BY_CHORDS[key] ?? UNKNOWN_ANALYSIS;
}
