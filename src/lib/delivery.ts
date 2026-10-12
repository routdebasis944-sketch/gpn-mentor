// Speech-delivery analytics for the Mock Interview (pure scoring, no browser APIs).
export type Delivery = {
  words: number;
  wpm: number;
  fillers: number;
  fillerWords: string[];
  longPauses: number;
  longestPause: number; // seconds
  startDelay: number; // seconds before first sound
  speakingTime: number; // seconds between first and last voiced sample
  volumeSteadiness: number; // 0..1, higher = steadier voice
  recognitionConfidence: number; // 0..1 from the speech recogniser (0 when unknown)
  confidence: number; // %
  clarity: number; // %
  hesitation: boolean;
};

const FILLER_RE = /(^|\s)(uh+|um+|umm+|uhh+|er+m?|hmm+|ah+|अह+|अम्म+|उम्म?|अं+|हम्म+|मतलब|वो+)(?=\s|$|[.,!?।])/giu;

export function countFillers(text: string) {
  const found = [...text.matchAll(FILLER_RE)].map((m) => (m[2] ?? "").toLowerCase());
  return found;
}

export function scoreDelivery(input: {
  transcript: string;
  pauses: number[]; // silent gaps (s) between speech segments
  startDelay: number;
  speakingTime: number;
  volumes: number[]; // RMS of voiced frames
  recognitionConfidence: number;
}): Delivery {
  const words = input.transcript.trim() ? input.transcript.trim().split(/\s+/).length : 0;
  const minutes = Math.max(input.speakingTime, 1) / 60;
  const wpm = Math.round(words / minutes);
  const fillerWords = countFillers(input.transcript);
  const longPauses = input.pauses.filter((p) => p >= 1.5).length;
  const longestPause = input.pauses.length ? Math.max(...input.pauses) : 0;
  const mean = input.volumes.reduce((a, b) => a + b, 0) / Math.max(input.volumes.length, 1);
  const sd = Math.sqrt(input.volumes.reduce((a, v) => a + (v - mean) ** 2, 0) / Math.max(input.volumes.length, 1));
  const volumeSteadiness = mean > 0 ? Math.max(0, Math.min(1, 1 - sd / mean / 1.2)) : 0;

  let confidence = 100;
  confidence -= Math.min(30, fillerWords.length * 6);
  confidence -= Math.min(30, longPauses * 8);
  if (input.startDelay > 3) confidence -= Math.min(15, (input.startDelay - 3) * 4);
  if (wpm < 90) confidence -= Math.min(20, (90 - wpm) / 3);
  if (wpm > 180) confidence -= Math.min(15, (wpm - 180) / 4);
  confidence -= (1 - volumeSteadiness) * 15;
  if (words < 5) confidence -= 25;

  const rc = input.recognitionConfidence;
  let clarity = rc > 0 ? rc * 100 : 75;
  if (wpm > 180) clarity -= Math.min(20, (wpm - 180) / 3);
  if (mean > 0 && mean < 0.02) clarity -= 15; // very soft voice
  if (words < 5) clarity -= 20;

  const clamp = (n: number) => Math.round(Math.max(0, Math.min(100, n)));
  return {
    words, wpm, fillers: fillerWords.length, fillerWords, longPauses,
    longestPause: Math.round(longestPause * 10) / 10,
    startDelay: Math.round(input.startDelay * 10) / 10,
    speakingTime: Math.round(input.speakingTime),
    volumeSteadiness: Math.round(volumeSteadiness * 100) / 100,
    recognitionConfidence: rc,
    confidence: clamp(confidence),
    clarity: clamp(clarity),
    hesitation: fillerWords.length >= 2 || longPauses >= 1 || input.startDelay > 4,
  };
}

export const clarityLabel = (c: number) => (c >= 80 ? "High" : c >= 60 ? "Medium" : "Low");
