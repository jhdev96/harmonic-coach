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
  // Present only for scan-extracted charts: song metadata read off the page.
  title?: string;
  songKey?: string;
  timeSignature?: string;
};

// One measure as read off an uploaded scan, before any analysis.
export type ExtractedMeasure = {
  measureIndex: number;
  chords: string;
  readConfidence: Confidence;
  alternateReadings: string[];
};

export type SheetExtraction = {
  measures: ExtractedMeasure[];
  title?: string;
  songKey?: string;
  timeSignature?: string;
};

export type AnalyzeLeadSheetRequest = {
  title: string;
  songKey: string;
  timeSignature: string;
  measures: { index: number; chords: string }[];
  // When set, analyze only this bar and return a single MeasureBreakdown.
  targetIndex?: number;
};

export type AnalyzeScanRequest = {
  scan: {
    mediaType: string;
    dataBase64: string;
  };
};

export type AskCoachRequest = {
  title: string;
  songKey: string;
  timeSignature: string;
  measures: { index: number; chords: string }[];
  overview?: string;
  breakdowns?: {
    measureIndex: number;
    chords: string;
    title: string;
    romanNumeral: string;
    explanation: string;
  }[];
  selectedMeasureIndex?: number;
  history: { question: string; answer: string }[];
  question: string;
};

export type QaEntry = {
  question: string;
  answer: string;
  error?: string;
};
