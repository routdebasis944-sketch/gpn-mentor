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
