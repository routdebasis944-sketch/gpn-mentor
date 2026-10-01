export type SimType = "ohms_law" | "series_parallel" | "wheatstone";

export const SP_R1 = 10;
export const SP_R2 = 15;
export const WB_P = 10;
export const WB_Q = 10;
export const WB_X = 27; // hidden unknown resistance
export const MAX_SAFE_CURRENT = 2;

export type Reading = {
  v: number;
  i: number;
  closed: boolean;
  arrangement: "series" | "parallel";
  s: number;
};

export type LabRun = {
  sim: SimType;
  closed: boolean;
  resistance: number;
  readings: Reading[];
  overloaded: boolean;
  answers: { r?: string | undefined; series?: string | undefined; parallel?: string | undefined; x?: string | undefined };
};

export type Check = { ok: boolean; mistake: string };

const near = (a: string | undefined, target: number, tol: number) => {
  const n = Number(a);
  return a !== undefined && a.trim() !== "" && Number.isFinite(n) && Math.abs(n - target) <= tol;
};

export const seriesR = SP_R1 + SP_R2;
export const parallelR = (SP_R1 * SP_R2) / (SP_R1 + SP_R2);

export function computeCurrent(
  sim: SimType,
  voltage: number,
  resistance: number,
  arrangement: "series" | "parallel",
  s: number,
) {
  if (sim === "ohms_law") return voltage / Math.max(resistance, 1);
  if (sim === "series_parallel") return voltage / (arrangement === "series" ? seriesR : parallelR);
  // Wheatstone: total current through the two arms
  const arm1 = WB_P + WB_Q;
  const arm2 = WB_X + s;
  return voltage / ((arm1 * arm2) / (arm1 + arm2));
}

export function wheatstoneDeflection(s: number) {
  return Math.max(-1, Math.min(1, (s - (WB_X * WB_Q) / WB_P) / 12));
}

export function evaluate(run: LabRun): { score: number; mistakes: string[] } {
  const checks: Check[] = [];
  const closedReadings = run.readings.filter((r) => r.closed);
  const openReadings = run.readings.filter((r) => !r.closed);

  checks.push({
    ok: run.readings.length > 0 && openReadings.length === 0,
    mistake:
      run.readings.length === 0
        ? "आपने एक भी रीडिंग नोट नहीं की। इसे ऐसा करना है — स्विच बंद करके 'रीडिंग नोट करें' बटन दबाएँ।"
        : "आपने यहाँ पे गलती किया — स्विच खुला रखकर रीडिंग ली। इसे ऐसा करना है: पहले स्विच बंद करें, फिर रीडिंग नोट करें।",
  });

  if (run.sim === "ohms_law") {
    const volts = new Set(closedReadings.map((r) => r.v));
    checks.push({
      ok: volts.size >= 3,
      mistake:
        "आपने यहाँ पे गलती किया — कम से कम 3 अलग-अलग वोल्टेज पर रीडिंग लेनी थी। इसे ऐसा करना है: वोल्टेज स्लाइडर बदलकर हर बार रीडिंग नोट करें।",
    });
    checks.push({
      ok: !run.overloaded,
      mistake: `करंट ${MAX_SAFE_CURRENT} A से ऊपर चला गया, जिससे उपकरण खराब हो सकता है। इसे ऐसा करना है — वोल्टेज कम रखें या रेज़िस्टेंस बढ़ाएँ।`,
    });
    checks.push({
      ok: near(run.answers.r, run.resistance, Math.max(0.5, run.resistance * 0.03)),
      mistake: "आपका निकाला गया रेज़िस्टेंस (R) गलत है। इसे ऐसा करना है — R = V ÷ I सूत्र से अपनी रीडिंग से गणना करें।",
    });
  }

  if (run.sim === "series_parallel") {
    checks.push({
      ok: closedReadings.some((r) => r.arrangement === "series"),
      mistake: "आपने सीरीज़ कनेक्शन की रीडिंग नहीं ली। इसे ऐसा करना है — 'Series' चुनें, स्विच बंद करें और रीडिंग नोट करें।",
    });
    checks.push({
      ok: closedReadings.some((r) => r.arrangement === "parallel"),
      mistake: "आपने पैरेलल कनेक्शन की रीडिंग नहीं ली। इसे ऐसा करना है — 'Parallel' चुनें, स्विच बंद करें और रीडिंग नोट करें।",
    });
    checks.push({
      ok: near(run.answers.series, seriesR, 0.5),
      mistake: `सीरीज़ का समतुल्य रेज़िस्टेंस गलत है। इसे ऐसा करना है — R = R1 + R2 = ${SP_R1} + ${SP_R2}।`,
    });
    checks.push({
      ok: near(run.answers.parallel, parallelR, 0.3),
      mistake: "पैरेलल का समतुल्य रेज़िस्टेंस गलत है। इसे ऐसा करना है — R = (R1 × R2) ÷ (R1 + R2) से गणना करें।",
    });
  }

  if (run.sim === "wheatstone") {
    const balanced = closedReadings.find((r) => Math.abs(wheatstoneDeflection(r.s)) < 0.05);
    checks.push({
      ok: !!balanced,
      mistake:
        "आपने ब्रिज को बैलेंस किए बिना रीडिंग ली। इसे ऐसा करना है — S को तब तक बदलें जब तक गैल्वेनोमीटर की सुई बीच (शून्य) पर न आ जाए।",
    });
    checks.push({
      ok: near(run.answers.x, WB_X, 0.6),
      mistake: "अज्ञात रेज़िस्टेंस X गलत निकाला। इसे ऐसा करना है — बैलेंस पर X = (P ÷ Q) × S सूत्र लगाएँ।",
    });
  }

  checks.push({
    ok: !run.closed,
    mistake: "प्रैक्टिकल खत्म होने पर स्विच खोलना भूल गए। इसे ऐसा करना है — सबमिट करने से पहले हमेशा सर्किट खोलें।",
  });

  const passed = checks.filter((c) => c.ok).length;
  return {
    score: Math.round((passed / checks.length) * 100),
    mistakes: checks.filter((c) => !c.ok).map((c) => c.mistake),
  };
}

export const STEPS: Record<SimType, { en: string; hi: string }[]> = {
  ohms_law: [
    { en: "Check the apparatus: battery, switch, resistor and lamp.", hi: "पहले बेंच पर बैटरी, स्विच, रेज़िस्टर और बल्ब को देखें।" },
    { en: "Close the switch (click the orange lever in 3D).", hi: "3D में नारंगी लीवर पर क्लिक करके स्विच बंद करें।" },
    { en: "Record readings at 3 or more different voltages. Keep current under 2 A.", hi: "कम से कम तीन अलग वोल्टेज पर रीडिंग नोट करें, करंट दो एम्पियर से कम रखें।" },
    { en: "Calculate R = V / I and enter it.", hi: "R बराबर V भाग I से गणना करके उत्तर लिखें।" },
    { en: "Open the switch, then submit.", hi: "अंत में स्विच खोलें और सबमिट करें।" },
  ],
  series_parallel: [
    { en: `Two resistors: R1 = ${SP_R1} Ω and R2 = ${SP_R2} Ω.`, hi: "बेंच पर दो रेज़िस्टर हैं, R1 दस ओम और R2 पंद्रह ओम।" },
    { en: "Choose Series, close the switch and record a reading.", hi: "सीरीज़ चुनें, स्विच बंद करें और रीडिंग नोट करें।" },
    { en: "Choose Parallel and record another reading.", hi: "अब पैरेलल चुनें और फिर से रीडिंग नोट करें।" },
    { en: "Enter the equivalent resistance for both.", hi: "दोनों कनेक्शन का समतुल्य रेज़िस्टेंस लिखें।" },
    { en: "Open the switch, then submit.", hi: "अंत में स्विच खोलें और सबमिट करें।" },
  ],
  wheatstone: [
    { en: `P = ${WB_P} Ω, Q = ${WB_Q} Ω, X is unknown, S is variable.`, hi: "P और Q दस-दस ओम हैं, X अज्ञात है और S को बदल सकते हैं।" },
    { en: "Close the switch and watch the galvanometer needle.", hi: "स्विच बंद करें और गैल्वेनोमीटर की सुई देखें।" },
    { en: "Adjust S until the needle is at zero, then record.", hi: "S को तब तक बदलें जब तक सुई शून्य पर न आए, फिर रीडिंग नोट करें।" },
    { en: "Calculate X = (P / Q) × S and enter it.", hi: "X बराबर P भाग Q गुणा S से गणना करें।" },
    { en: "Open the switch, then submit.", hi: "अंत में स्विच खोलें और सबमिट करें।" },
  ],
};

// ================= Multi-branch engine =================

export type AnySim = SimType | "vernier" | "slump" | "code";
export type EvalResult = { score: number; mistakes: string[] };

const ALL_SIMS: AnySim[] = ["ohms_law", "series_parallel", "wheatstone", "vernier", "slump", "code"];

export const SIM_TITLES: Record<AnySim, string> = {
  ohms_law: "Verification of Ohm's Law",
  series_parallel: "Series and Parallel Resistors",
  wheatstone: "Wheatstone Bridge — Unknown Resistance",
  vernier: "Measurement with Vernier Caliper (Workshop / Metrology)",
  slump: "Workability of Concrete — Slump Cone Test",
  code: "Programming Lab — Code Editor & Terminal",
};

/** Every module gets a working simulator: explicit sim_type wins, otherwise derived from branch/semester. */
export function resolveSim(branch: string, semester: number, simType: string | null): AnySim {
  if (simType && (ALL_SIMS as string[]).includes(simType)) return simType as AnySim;
  const b = branch.toLowerCase();
  if (/computer|information|\bit\b|cse/.test(b)) return "code";
  if (/mech/.test(b)) return "vernier";
  if (/civil/.test(b)) return "slump";
  if (/electrical/.test(b)) return (["series_parallel", "ohms_law", "wheatstone"] as const)[semester % 3]!;
  return "ohms_law";
}

const score = (checks: Check[]): EvalResult => ({
  score: Math.round((checks.filter((c) => c.ok).length / checks.length) * 100),
  mistakes: checks.filter((c) => !c.ok).map((c) => c.mistake),
});

// ---------- Vernier caliper (Mechanical) ----------
export const VERNIER_LC = 0.1;
export type VernierRun = {
  zeroChecked: boolean;
  zeroError: number;
  diameter: number;
  locked: boolean;
  objectPlaced: boolean;
  readings: { obs: number; touching: boolean; locked: boolean }[];
  answers: { ze?: string; msr?: string; vsc?: string; d?: string };
};

export function evaluateVernier(run: VernierRun): EvalResult {
  const obs = run.diameter + run.zeroError;
  const msr = Math.floor(obs + 1e-9);
  const vsc = Math.round((obs - msr) / VERNIER_LC);
  const good = run.readings.filter((r) => r.touching && r.locked);
  return score([
    { ok: run.zeroChecked, mistake: "आपने यहाँ पे गलती किया — ज़ीरो एरर चेक नहीं किया। इसे ऐसा करना है: पहले जबड़े (jaws) खाली बंद करके 'ज़ीरो एरर जाँचें' दबाएँ।" },
    { ok: near(run.answers.ze, run.zeroError, 0.05), mistake: `ज़ीरो एरर गलत लिखा। इसे ऐसा करना है — जबड़े बंद होने पर वर्नियर का 0 मेन स्केल के 0 से कितना आगे/पीछे है, वही ज़ीरो एरर है (LC = ${VERNIER_LC} mm)।` },
    { ok: good.length >= 2, mistake: "आपने यहाँ पे गलती किया — कम से कम 2 सही रीडिंग नहीं लीं। इसे ऐसा करना है: वस्तु रखें, जबड़ा वस्तु से सटाएँ, लॉक स्क्रू कसें, फिर 'रीडिंग नोट करें'।" },
    { ok: run.readings.every((r) => r.locked), mistake: "लॉक स्क्रू कसे बिना रीडिंग ली — जबड़ा खिसक सकता है। इसे ऐसा करना है: रीडिंग से पहले हमेशा लॉक स्क्रू कसें।" },
    { ok: run.readings.every((r) => r.touching), mistake: "जबड़ा वस्तु से सटा नहीं था फिर भी रीडिंग ली। इसे ऐसा करना है: स्लाइडर से जबड़ा तब तक बंद करें जब तक वह वस्तु को छू न ले।" },
    { ok: near(run.answers.msr, msr, 0.01), mistake: "मेन स्केल रीडिंग (MSR) गलत है। इसे ऐसा करना है — वर्नियर के 0 से ठीक पहले वाला मेन स्केल का mm निशान पढ़ें।" },
    { ok: near(run.answers.vsc, vsc, 0.01), mistake: "वर्नियर स्केल कोइंसिडेंस (VSC) गलत है। इसे ऐसा करना है — मैग्निफ़ायर में देखें कि वर्नियर का कौन-सा निशान मेन स्केल के किसी निशान से बिल्कुल मिल रहा है।" },
    { ok: near(run.answers.d, run.diameter, 0.05), mistake: "अंतिम व्यास (diameter) गलत है। इसे ऐसा करना है — D = MSR + (VSC × LC) − ज़ीरो एरर।" },
    { ok: !run.locked, mistake: "प्रैक्टिकल खत्म होने पर लॉक स्क्रू ढीला करना भूल गए। इसे ऐसा करना है — सबमिट से पहले लॉक खोलें।" },
  ]);
}

// ---------- Slump cone test (Civil) ----------
export type SlumpAction = "oil" | "place" | "fill" | "tamp" | "strike" | "lift" | "twist" | "measure";
export type SlumpRun = {
  log: SlumpAction[];
  tamps: number[]; // per layer
  wc: number;
  answers: { slump?: string; cls?: string };
};
export const slumpValue = (wc: number) => Math.max(0, Math.round((wc - 0.35) * 500));
export const slumpClass = (s: number) => (s < 25 ? "very low" : s < 50 ? "low" : s <= 100 ? "medium" : "high");

export function evaluateSlump(run: SlumpRun): EvalResult {
  const idx = (a: SlumpAction) => run.log.indexOf(a);
  const firstFill = idx("fill");
  const lift = run.log.findIndex((a) => a === "lift" || a === "twist");
  const s = slumpValue(run.wc);
  return score([
    { ok: idx("oil") >= 0 && (firstFill < 0 || idx("oil") < firstFill), mistake: "आपने यहाँ पे गलती किया — कोन के अंदर तेल नहीं लगाया। इसे ऐसा करना है: कंक्रीट भरने से पहले मोल्ड पर तेल लगाएँ ताकि कंक्रीट न चिपके।" },
    { ok: idx("place") >= 0 && (firstFill < 0 || idx("place") < firstFill), mistake: "कोन को बेस प्लेट पर रखे बिना भराई शुरू की। इसे ऐसा करना है — पहले कोन को समतल बेस प्लेट पर रखें।" },
    { ok: run.tamps.length === 3, mistake: `कंक्रीट ${run.tamps.length} परतों में भरा गया। इसे ऐसा करना है — कोन को बराबर 3 परतों में भरें।` },
    { ok: run.tamps.length > 0 && run.tamps.every((t) => t === 25), mistake: `हर परत पर ठीक 25 बार टैम्पिंग नहीं हुई (आपकी गिनती: ${run.tamps.join(", ") || "0"})। इसे ऐसा करना है — टैम्पिंग रॉड से हर परत पर 25 बार ठोकें।` },
    { ok: idx("strike") >= 0 && (lift < 0 || idx("strike") < lift), mistake: "ऊपर की सतह बराबर (strike off) नहीं की। इसे ऐसा करना है — कोन उठाने से पहले ऊपर का अतिरिक्त कंक्रीट हटाएँ।" },
    { ok: run.log.includes("lift") && !run.log.includes("twist"), mistake: "कोन को घुमाते हुए उठाया या उठाया ही नहीं। इसे ऐसा करना है — कोन को धीरे-धीरे सीधा ऊपर (vertically) उठाएँ।" },
    { ok: lift >= 0 && run.log.lastIndexOf("measure") > lift, mistake: "कोन उठाने के बाद स्लंप नापा नहीं। इसे ऐसा करना है — 'स्लंप नापें' दबाकर स्केल की रीडिंग देखें।" },
    { ok: near(run.answers.slump, s, 5), mistake: "स्लंप का मान गलत है। इसे ऐसा करना है — स्लंप = कोन की ऊँचाई (300 mm) − ढेर की ऊँचाई की रीडिंग।" },
    { ok: run.answers.cls === slumpClass(s), mistake: "वर्केबिलिटी की श्रेणी गलत चुनी। इसे ऐसा करना है — 25 mm से कम: very low, 25–50: low, 50–100: medium, 100 से ऊपर: high।" },
  ]);
}

// ---------- Programming lab (CSE / IT) ----------
export type CodeRun = {
  runs: number;
  lastError: string | null;
  missingFn: boolean;
  fnName: string;
  tests: { label: string; ok: boolean }[];
};

export function evaluateCode(run: CodeRun): EvalResult {
  return score([
    { ok: run.runs > 0, mistake: "आपने कोड एक बार भी रन नहीं किया। इसे ऐसा करना है — 'Run' बटन दबाएँ या टर्मिनल में run लिखें और आउटपुट जाँचें।" },
    { ok: !run.lastError, mistake: `आपके कोड में एरर है: "${run.lastError ?? ""}"। इसे ऐसा करना है — टर्मिनल में दिखी लाइन देखें और ब्रैकेट/स्पेलिंग ठीक करें।` },
    { ok: !run.missingFn, mistake: `फ़ंक्शन "${run.fnName}" नहीं मिला। इसे ऐसा करना है — ठीक इसी नाम से function ${run.fnName}(...) बनाएँ।` },
    ...run.tests.map((t) => ({ ok: t.ok, mistake: `टेस्ट फेल हुआ: ${t.label}। इसे ऐसा करना है — अपने लॉजिक को इस इनपुट पर हाथ से चलाकर देखें और return वैल्यू ठीक करें।` })),
  ]);
}

export const EXTRA_STEPS: Record<"vernier" | "slump" | "code", { en: string; hi: string }[]> = {
  vernier: [
    { en: `Least count = ${VERNIER_LC} mm. Close the empty jaws and check zero error.`, hi: "लीस्ट काउंट शून्य दशमलव एक मिलीमीटर है। पहले खाली जबड़े बंद करके ज़ीरो एरर जाँचें।" },
    { en: "Place the cylinder between the jaws.", hi: "अब बेलन को जबड़ों के बीच रखें।" },
    { en: "Slide the jaw until it touches, tighten the lock screw, record 2+ readings.", hi: "जबड़ा सटाएँ, लॉक स्क्रू कसें और कम से कम दो रीडिंग नोट करें।" },
    { en: "Enter zero error, MSR, VSC and corrected diameter.", hi: "ज़ीरो एरर, मेन स्केल रीडिंग, वर्नियर कोइंसिडेंस और सही व्यास लिखें।" },
    { en: "Loosen the lock screw, then submit.", hi: "अंत में लॉक स्क्रू ढीला करें और सबमिट करें।" },
  ],
  slump: [
    { en: "Set the water-cement ratio, then oil the mould and place it on the base plate.", hi: "वॉटर सीमेंट रेशियो चुनें, मोल्ड पर तेल लगाएँ और बेस प्लेट पर रखें।" },
    { en: "Fill concrete in 3 layers; tamp each layer exactly 25 times.", hi: "कंक्रीट तीन परतों में भरें और हर परत पर पच्चीस बार टैम्पिंग करें।" },
    { en: "Strike off the top surface.", hi: "ऊपर की सतह को बराबर करें।" },
    { en: "Lift the cone vertically and measure the slump.", hi: "कोन को सीधा ऊपर उठाएँ और स्लंप नापें।" },
    { en: "Enter slump (mm) and workability class, then submit.", hi: "स्लंप और वर्केबिलिटी श्रेणी लिखें, फिर सबमिट करें।" },
  ],
  code: [
    { en: "Read the task and the required function name.", hi: "पहले टास्क और फ़ंक्शन का नाम ध्यान से पढ़ें।" },
    { en: "Write your JavaScript solution in the editor.", hi: "एडिटर में अपना कोड लिखें।" },
    { en: "Click Run (or type run in the terminal) and check the output.", hi: "रन दबाएँ और टर्मिनल में आउटपुट देखें।" },
    { en: "Try your function in the terminal, e.g. factorial(5).", hi: "टर्मिनल में अपना फ़ंक्शन अलग इनपुट से चलाकर देखें।" },
    { en: "Submit — hidden test cases will check your code.", hi: "सबमिट करें, छिपे हुए टेस्ट आपके कोड की जाँच करेंगे।" },
  ],
};

export const stepsFor = (sim: AnySim) =>
  sim === "vernier" || sim === "slump" || sim === "code" ? EXTRA_STEPS[sim] : STEPS[sim];
