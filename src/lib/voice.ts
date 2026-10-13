/**
 * App-wide Debasis voice: always prefers a MALE voice.
 * Browsers don't expose voice gender, so we match known male voice names.
 * If the device has no male voice installed, we use a lowered pitch so the
 * fallback sounds as deep as possible.
 */
const MALE = /\b(male|madhur|hemant|prabhat|rishi|ravi|aarav|kunal|arjun|daniel|alex|fred|guy|david|mark|ryan|george|james|thomas|christopher|eric|brian|andrew|roger|aaron|tom|oliver|reed|rocko|grandpa|eddy)\b/i;
const FEMALE = /\b(female|swara|kalpana|heera|lekha|neerja|veena|zira|samantha|karen|moira|tessa|susan|hazel|aria|jenny|sonia|libby|catherine|fiona|victoria|google)\b/i;

export type VoiceLang = "hi" | "en";

export function pickMaleVoice(lang: VoiceLang): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const all = window.speechSynthesis.getVoices();
  const prefixes = lang === "hi" ? ["hi-in", "hi"] : ["en-in", "en-us", "en-gb", "en"];
  for (const p of prefixes) {
    const pool = all.filter((v) => v.lang?.toLowerCase().replace("_", "-").startsWith(p));
    const male = pool.find((v) => MALE.test(v.name) && !/female/i.test(v.name));
    if (male) return male;
  }
  // No named male voice: avoid known female voices if possible.
  for (const p of prefixes) {
    const v = all.find((x) => x.lang?.toLowerCase().startsWith(p) && !FEMALE.test(x.name));
    if (v) return v;
  }
  return null;
}

export function isMale(v: SpeechSynthesisVoice | null) {
  return !!v && MALE.test(v.name) && !/female/i.test(v.name);
}

/** Speak as Debasis. Resolves when finished (or immediately if unsupported). */
export function speakAsDebasis(text: string, lang: VoiceLang = "hi"): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || !text.trim()) return resolve();
    const go = () => {
      try {
        const u = new SpeechSynthesisUtterance(text);
        u.lang = lang === "hi" ? "hi-IN" : "en-IN";
        const v = pickMaleVoice(lang);
        if (v) { u.voice = v; u.lang = v.lang; }
        u.rate = 0.95;
        u.pitch = isMale(v) ? 0.9 : 0.6; // deepen non-male fallback
        u.onend = () => resolve();
        u.onerror = () => resolve();
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
      } catch { resolve(); }
    };
    if (window.speechSynthesis.getVoices().length) go();
    else {
      let done = false;
      const once = () => { if (done) return; done = true; go(); };
      window.speechSynthesis.addEventListener("voiceschanged", once, { once: true });
      setTimeout(once, 700);
    }
  });
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}
