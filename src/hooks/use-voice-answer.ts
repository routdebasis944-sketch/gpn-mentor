import { useCallback, useEffect, useRef, useState } from "react";
import { scoreDelivery, type Delivery } from "@/lib/delivery";

type Rec = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string; confidence: number }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void; stop: () => void; abort: () => void;
};

const SILENCE = 0.015; // RMS threshold for "voice present"
const FRAME_MS = 50;

export function useVoiceAnswer(lang: "hi-IN" | "en-IN") {
  const [supported, setSupported] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const s = useRef({
    rec: null as Rec | null, stream: null as MediaStream | null, ctx: null as AudioContext | null,
    timer: 0 as unknown as ReturnType<typeof setInterval>, t0: 0, firstVoice: -1, lastVoice: -1, silentSince: -1,
    pauses: [] as number[], volumes: [] as number[], finals: "", confs: [] as number[],
  });

  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    setSupported(!!(w["SpeechRecognition"] || w["webkitSpeechRecognition"]) && !!navigator.mediaDevices?.getUserMedia);
  }, []);

  const cleanup = useCallback(() => {
    const r = s.current;
    clearInterval(r.timer);
    r.stream?.getTracks().forEach((t) => t.stop());
    void r.ctx?.close().catch(() => undefined);
    r.stream = null; r.ctx = null;
  }, []);

  useEffect(() => () => { s.current.rec?.abort(); cleanup(); }, [cleanup]);

  const start = useCallback(async () => {
    setError(null); setTranscript("");
    const w = window as unknown as Record<string, new () => Rec>;
    const Ctor = w["SpeechRecognition"] ?? w["webkitSpeechRecognition"];
    if (!Ctor) { setError("Voice input is not supported in this browser. Try Chrome or Edge."); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const buf = new Float32Array(analyser.fftSize);
      const r = s.current;
      Object.assign(r, { stream, ctx, t0: performance.now(), firstVoice: -1, lastVoice: -1, silentSince: -1, pauses: [], volumes: [], finals: "", confs: [] });
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
        } else if (r.silentSince < 0 && r.lastVoice >= 0) {
          r.silentSince = t;
        }
      }, FRAME_MS);

      const rec = new Ctor();
      rec.lang = lang; rec.continuous = true; rec.interimResults = true;
      rec.onresult = (e) => {
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i]!;
          const alt = res[0]!;
          if (res.isFinal) { r.finals += alt.transcript + " "; if (alt.confidence > 0) r.confs.push(alt.confidence); }
          else interim += alt.transcript;
        }
        setTranscript((r.finals + interim).trim());
      };
      rec.onerror = (e) => { if (e.error !== "no-speech" && e.error !== "aborted") setError(`Microphone error: ${e.error}`); };
      rec.onend = () => { if (r.rec === rec && r.stream) { try { rec.start(); } catch { /* already restarting */ } } };
      r.rec = rec;
      rec.start();
      setRecording(true);
    } catch {
      setError("Please allow microphone access to answer by voice.");
      cleanup();
    }
  }, [lang, cleanup]);

  const stop = useCallback((): { text: string; delivery: Delivery } | null => {
    const r = s.current;
    if (!r.stream) return null;
    const rec = r.rec; r.rec = null; rec?.stop();
    const end = (performance.now() - r.t0) / 1000;
    cleanup();
    setRecording(false); setLevel(0);
    const text = transcriptRef.current.trim();
    const confAvg = r.confs.length ? r.confs.reduce((a, b) => a + b, 0) / r.confs.length : 0;
    const delivery = scoreDelivery({
      transcript: text,
      pauses: r.pauses,
      startDelay: r.firstVoice >= 0 ? r.firstVoice : end,
      speakingTime: r.firstVoice >= 0 ? Math.max(1, r.lastVoice - r.firstVoice) : 1,
      volumes: r.volumes,
      recognitionConfidence: confAvg,
    });
    return { text, delivery };
  }, [cleanup]);

  const transcriptRef = useRef("");
  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);

  return { supported, recording, transcript, level, error, start, stop };
}
