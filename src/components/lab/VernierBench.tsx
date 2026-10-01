import { useState, type MutableRefObject } from "react";
import { Lock, Unlock, Ruler, ClipboardList, CircleDot } from "lucide-react";
import { evaluateVernier, VERNIER_LC, type EvalResult } from "@/lib/lab-eval";
import { AnswerInput, BenchCard, RangeInput, ReadingBox, ToolButton } from "./ui";

const PX = 9; // px per mm on the full caliper
const X0 = 30;
const MAX_MM = 50;

export default function VernierBench({ evalRef }: { evalRef: MutableRefObject<(() => EvalResult | Promise<EvalResult>) | null> }) {
  const [diameter] = useState(() => Math.round((15 + Math.random() * 20) * 10) / 10);
  const [zeroError] = useState(() => [0, 0.2, -0.1, 0.3, 0.1][Math.floor(Math.random() * 5)]!);
  const [pos, setPos] = useState(12);
  const [placed, setPlaced] = useState(false);
  const [locked, setLocked] = useState(false);
  const [zeroChecked, setZeroChecked] = useState(false);
  const [readings, setReadings] = useState<{ obs: number; touching: boolean; locked: boolean }[]>([]);
  const [answers, setAnswers] = useState<{ ze?: string; msr?: string; vsc?: string; d?: string }>({});

  const effPos = placed ? Math.max(pos, diameter) : pos;
  const touching = placed && Math.abs(effPos - diameter) < 0.05;
  const shown = effPos + zeroError; // where the vernier zero sits on the main scale

  evalRef.current = () => evaluateVernier({ zeroChecked, zeroError, diameter, locked, objectPlaced: placed, readings, answers });

  const checkZero = () => {
    if (placed) return;
    setPos(0);
    setZeroChecked(true);
  };

  const jawX = X0 + effPos * PX;
  const vx = X0 + shown * PX;

  return (
    <BenchCard title="Vernier Caliper Bench" hint="Use the tools below · read the magnifier">
      <div className="space-y-3 bg-primary p-3">
        <svg viewBox="0 0 520 170" className="w-full" role="img" aria-label="Vernier caliper">
          {/* fixed jaw + beam */}
          <rect x={X0 - 18} y={20} width={18} height={120} rx={3} fill="#c9ced6" />
          <rect x={X0 - 18} y={20} width={MAX_MM * PX + 40} height={30} fill="#e4e7ec" stroke="#8a919c" />
          {Array.from({ length: MAX_MM + 1 }, (_, i) => (
            <g key={i}>
              <line x1={X0 + i * PX} x2={X0 + i * PX} y1={50} y2={i % 10 === 0 ? 34 : i % 5 === 0 ? 40 : 44} stroke="#1b2a4a" strokeWidth={1} />
              {i % 10 === 0 && <text x={X0 + i * PX} y={31} fontSize={9} textAnchor="middle" fill="#1b2a4a">{i / 10}</text>}
            </g>
          ))}
          {/* object */}
          {placed && <circle cx={X0 + (diameter * PX) / 2} cy={100} r={(diameter * PX) / 2} fill="#b88a4a" stroke="#6b4b22" />}
          {/* sliding vernier + moving jaw */}
          <g>
            <rect x={jawX} y={50} width={18} height={90} rx={3} fill={touching ? "#e8912d" : "#c9ced6"} />
            <rect x={vx - 4} y={50} width={10 * 0.9 * PX + 12} height={20} fill="#f3ead8" stroke="#8a919c" />
            {Array.from({ length: 11 }, (_, k) => (
              <line key={k} x1={vx + k * 0.9 * PX} x2={vx + k * 0.9 * PX} y1={50} y2={k % 5 === 0 ? 64 : 59} stroke="#c8452b" />
            ))}
            <rect x={vx + 40} y={72} width={22} height={14} rx={3} fill={locked ? "#c8452b" : "#4a5568"} />
          </g>
        </svg>

        {/* magnifier */}
        <div className="rounded-xl bg-background p-2">
          <p className="mb-1 text-[11px] font-medium text-muted-foreground">Magnifier (main scale above, vernier below)</p>
          <Magnifier shown={shown} />
        </div>
      </div>

      <div className="space-y-3 p-4">
        <div className="grid grid-cols-3 gap-3">
          <ReadingBox label="Least count" value={`${VERNIER_LC} mm`} />
          <ReadingBox label="Object" value={placed ? "placed" : "none"} />
          <ReadingBox label="Jaw" value={touching ? "touching" : locked ? "locked" : "free"} highlight={touching} />
        </div>
        <RangeInput label="Slide moving jaw (mm)" min={0} max={MAX_MM - 5} step={0.1} value={Number(effPos.toFixed(1))} onChange={setPos} disabled={locked} />
        <div className="flex flex-wrap gap-2">
          <ToolButton onClick={checkZero} disabled={placed || locked} active={zeroChecked}><CircleDot className="h-4 w-4" /> ज़ीरो एरर जाँचें</ToolButton>
          <ToolButton onClick={() => setPlaced((p) => !p)} disabled={locked} active={placed}><Ruler className="h-4 w-4" /> {placed ? "Remove cylinder" : "Place cylinder"}</ToolButton>
          <ToolButton onClick={() => setLocked((l) => !l)} active={locked}>{locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />} {locked ? "Loosen lock" : "Tighten lock"}</ToolButton>
          <ToolButton onClick={() => setReadings((r) => [...r, { obs: Number(shown.toFixed(2)), touching, locked }])} disabled={!placed}>
            <ClipboardList className="h-4 w-4" /> रीडिंग नोट करें
          </ToolButton>
        </div>
        {readings.length > 0 && (
          <p className="text-xs text-muted-foreground">Readings taken: {readings.length} ({readings.filter((r) => r.touching && r.locked).length} valid)</p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <AnswerInput label="Zero error (mm)" value={answers.ze} onChange={(v) => setAnswers({ ...answers, ze: v })} />
          <AnswerInput label="MSR (mm)" value={answers.msr} onChange={(v) => setAnswers({ ...answers, msr: v })} />
          <AnswerInput label="VSC (division)" value={answers.vsc} onChange={(v) => setAnswers({ ...answers, vsc: v })} />
          <AnswerInput label="Corrected diameter D (mm)" value={answers.d} onChange={(v) => setAnswers({ ...answers, d: v })} />
        </div>
      </div>
    </BenchCard>
  );
}

function Magnifier({ shown }: { shown: number }) {
  const S = 34; // px per mm
  const start = Math.floor(shown) - 1;
  const W = 480;
  const x = (mm: number) => 10 + (mm - start) * S;
  return (
    <svg viewBox={`0 0 ${W} 80`} className="w-full">
      <rect x={0} y={0} width={W} height={40} fill="#e4e7ec" />
      {Array.from({ length: 15 }, (_, i) => start + i).map((mm) => (
        <g key={mm}>
          <line x1={x(mm)} x2={x(mm)} y1={40} y2={mm % 5 === 0 ? 18 : 26} stroke="#1b2a4a" strokeWidth={1.4} />
          <text x={x(mm)} y={13} fontSize={10} textAnchor="middle" fill="#1b2a4a">{mm}</text>
        </g>
      ))}
      <rect x={0} y={40} width={W} height={40} fill="#f3ead8" />
      {Array.from({ length: 11 }, (_, k) => (
        <g key={k}>
          <line x1={x(shown + k * 0.9)} x2={x(shown + k * 0.9)} y1={40} y2={k % 5 === 0 ? 62 : 54} stroke="#c8452b" strokeWidth={1.4} />
          {k % 5 === 0 && <text x={x(shown + k * 0.9)} y={75} fontSize={10} textAnchor="middle" fill="#c8452b">{k}</text>}
        </g>
      ))}
    </svg>
  );
}
