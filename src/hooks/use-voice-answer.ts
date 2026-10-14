import { useCallback, useEffect, useRef, useState } from "react";
import { scoreDelivery, type Delivery } from "@/lib/delivery";

type RecResult = ArrayLike<{ transcript: string; confidence: number }> & { isFinal: boolean };
type Rec = {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number;
  onresult: ((e: { resultIndex: number; results: ArrayLike<RecResult> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void; stop: () => void; abort: () => void;
};

export type VoiceResult = { text: string; delivery: Delivery };

const SILENCE = 0.012;      // RMS threshold for "voice present"
const FRAME_MS = 50;
const AUTO_STOP_S = 1.5;    // stop after this much silence once the student has spoken
const FINAL_WAIT_MS = 1200; // wait for the recogniser to flush its last words

export function useVoiceAnswer(lang: "hi-IN" | "en-IN", onAutoStop?: (r: VoiceResult) => void) {
  const [supported, setSupported] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const autoRef = useRef(onAutoStop);
  autoRef.current = onAutoStop;

  const s = useRef({
    active: false, rec: null as Rec | null, stream: null as MediaStream | null, ctx: null as AudioContext | null,
    timer: undefined as ReturnType<typeof setInterval> | undefined,
    t0: 0, firstVoice: -1, lastVoice: -1, silentSince: -1, lastText: 0,
    pauses: [] as number[], volumes: [] as number[], confs: [] as number[],
    finals: [] as string[], interim: "", ended: null as (() => void) | null, stopping: null as Promise<VoiceResult | null> | null,
  });

  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    setSupported(!!(w["SpeechRecognition"] || w["webkitSpeechRecognition"]));
  }, []);

  const text = () => (s.current.finals.join(" ") + " " + s.current.interim).replace(/\s+/g, " ").trim();

  const releaseAudio = useCallback(() => {
    const r = s.current;
    if (r.timer) clearInterval(r.timer);
    r.timer = undefined;
    r.stream?.getTracks().forEach((t) => t.stop());
    void r.ctx?.close().catch(() => undefined);
    r.stream = null; r.ctx = null;
  }, []);

  const stop = useCallback((): Promise<VoiceResult | null> => {
    const r = s.current;
    if (r.stopping) return r.stopping;
    if (!r.active) return Promise.resolve(null);
    r.active = false;
    const end = (performance.now() - r.t0) / 1000;
    releaseAudio();
    setRecording(false); setLevel(0);
    const rec = r.rec;
    r.stopping = new Promise<VoiceResult | null>((resolve) => {
      const finish = () => {
        r.ended = null; r.rec = null;
        const t = text();
        setTranscript(t);
        const hasAudio = r.firstVoice >= 0;
        const lastVoice = hasAudio ? r.lastVoice : r.lastText;
        const delivery = scoreDelivery({
          transcript: t,
          pauses: r.pauses,
          startDelay: hasAudio ? r.firstVoice : Math.min(end, 2),
          speakingTime: hasAudio ? Math.max(1, lastVoice - r.firstVoice) : Math.max(1, end),
          volumes: r.volumes.length ? r.volumes : [0.05],
          recognitionConfidence: r.confs.length ? r.confs.reduce((a, b) => a + b, 0) / r.confs.length : 0,
        });
        r.stopping = null;
        resolve({ text: t, delivery });
      };
      if (!rec) return finish();
      const timeout = setTimeout(finish, FINAL_WAIT_MS);
      r.ended = () => { clearTimeout(timeout); finish(); };
      try { rec.stop(); } catch { clearTimeout(timeout); finish(); }
    });
    return r.stopping;
  }, [releaseAudio]);

  useEffect(() => () => { s.current.active = false; s.current.rec?.abort(); releaseAudio(); }, [releaseAudio]);

  const autoStop = useCallback(() => {
    void stop().then((res) => { if (res) autoRef.current?.(res); });
  }, [stop]);

  const start = useCallback(async () => {
    setError(null); setTranscript("");
    const w = window as unknown as Record<string, new () => Rec>;
    const Ctor = w["SpeechRecognition"] ?? w["webkitSpeechRecognition"];
    if (!Ctor) { setError("Voice input is not supported in this browser. Try Chrome or Edge."); return; }
    const r = s.current;
    Object.assign(r, { active: true, t0: performance.now(), firstVoice: -1, lastVoice: -1, silentSince: -1, lastText: 0, pauses: [], volumes: [], confs: [], finals: [], interim: "", stopping: null });

    // 1) Speech recognition — writes text live into the input.
    const makeRec = () => {
      const rec = new Ctor();
      rec.lang = lang; rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 1;
      const sessionFinals: string[] = [];
      const base = r.finals.length;
      rec.onresult = (e) => {
        let interim = "";
        for (let i = 0; i < e.results.length; i++) {
          const res = e.results[i]!; const alt = res[0]!;
          if (res.isFinal) {
            if (sessionFinals[i] === undefined && alt.confidence > 0) r.confs.push(alt.confidence);
            sessionFinals[i] = alt.transcript.trim();
          } else interim += alt.transcript;
        }
        // Android repeats earlier finals in later results — keep only the latest set for this session.
        r.finals.length = base;
        r.finals.push(...sessionFinals.filter(Boolean));
        r.interim = interim;
        r.lastText = (performance.now() - r.t0) / 1000;
        if (r.firstVoice < 0 && !r.stream) r.firstVoice = r.lastText;
        setTranscript(text());
      };
      rec.onerror = (e) => {
        if (e.error === "not-allowed" || e.error === "service-not-allowed") setError("Please allow microphone access to answer by voice.");
        else if (e.error !== "no-speech" && e.error !== "aborted") setError(`Microphone error: ${e.error}`);
      };
      rec.onend = () => {
        if (r.interim) { r.finals.push(r.interim.trim()); r.interim = ""; }
        if (r.ended) return r.ended();
        if (r.active && r.rec === rec) { // mobile ends sessions early — restart seamlessly
          try { const next = makeRec(); r.rec = next; next.start(); } catch { /* ignore */ }
        }
      };
      return rec;
    };
    try {
      const rec = makeRec(); r.rec = rec; rec.start();
      setRecording(true);
    } catch {
      r.active = false; setError("Could not start the microphone."); return;
    }

    // 2) Web Audio analytics — runs alongside; if the phone refuses a second mic
    //    stream, metrics fall back to recognition timing.
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("no gum");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      if (!r.active) { stream.getTracks().forEach((t) => t.stop()); return; }
      const ctx = new AudioContext();
      void ctx.resume().catch(() => undefined);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const buf = new Float32Array(analyser.fftSize);
      r.stream = stream; r.ctx = ctx;
      r.timer = setInterval(() => {
        analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i]! * buf[i]!;
        const rms = Math.sqrt(sum / buf.length);
        setLevel(Math.min(1, rms * 8));
        const t = (performance.now() - r.t0) / 1000;
        if (rms > SILENCE) {
          if (r.firstVoice < 0) r.firstVoice = t;
          if (r.silentSince >= 0 && r.lastVoice >= 0) {
            const gap = t - r.silentSince;
            if (gap >= 0.6) r.pauses.push(gap);
          }
          r.silentSince = -1; r.lastVoice = t; r.volumes.push(rms);
        } else {
          if (r.silentSince < 0 && r.lastVoice >= 0) r.silentSince = t;
          if (r.silentSince >= 0 && t - r.silentSince >= AUTO_STOP_S && t - r.lastText >= AUTO_STOP_S) autoStop();
        }
      }, FRAME_MS);
    } catch {
      // No audio stream: silence detection from recognition text timing instead.
      r.timer = setInterval(() => {
        const t = (performance.now() - r.t0) / 1000;
        setLevel(r.interim ? 0.5 : 0.1);
        if (r.lastText > 0 && t - r.lastText >= AUTO_STOP_S + 0.5) autoStop();
      }, 200);
    }
  }, [lang, autoStop]);

  return { supported, recording, transcript, level, error, start, stop };
}
