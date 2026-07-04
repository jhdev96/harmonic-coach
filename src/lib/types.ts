export type Confidence = "High" | "Medium" | "Low";

// Broad functional categories used to color the timeline. "other" covers
// empty bars, chromatic passing chords, and anything that resists a clean label.
export type HarmonicFunction = "tonic" | "subdominant" | "dominant" | "other";

export type Measure = {
  id: string;
  index: number;
  chords: string;
};

export type MeasureAnalysis = {
  title: string;
  confidence: Confidence;
  explanation: string;
  practiceTip: string;
  alternativeInterpretation?: string;
  romanNumeral?: string;
  harmonicFunction?: HarmonicFunction;
};

// One measure of an AI-generated breakdown. Echoes the chords it analyzed
// so stale results can be detected after the user edits a bar.
export type MeasureBreakdown = MeasureAnalysis & {
  measureIndex: number;
  chords: string;
  romanNumeral: string;
  harmonicFunction: HarmonicFunction;
};

export type SheetAnalysis = {
  overview: string;
  measures: MeasureBreakdown[];
};

export type AnalyzeLeadSheetRequest = {
  title: string;
  songKey: string;
  timeSignature: string;
  measures: { index: number; chords: string }[];
};
