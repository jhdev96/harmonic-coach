export type Confidence = "High" | "Medium" | "Low";

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
};
