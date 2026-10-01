import { useState, type MutableRefObject } from "react";
import { Droplet, Layers, Hammer, Minus, ArrowUp, RotateCw, Ruler, CircleDot } from "lucide-react";
import { evaluateSlump, slumpValue, type EvalResult, type SlumpAction } from "@/lib/lab-eval";
import { AnswerInput, BenchCard, RangeInput, ReadingBox, ToolButton } from "./ui";

const K = 0.55; // px per mm

export default function SlumpBench({ evalRef }: { evalRef: MutableRefObject<(() => EvalResult | Promise<EvalResult>) | null> }) {
  const [wc, setWc] = useState(0.5);
  const [log, setLog] = useState<SlumpAction[]>([]);
  const [tamps, setTamps] = useState<number[]>([]);
  const [answers, setAnswers] = useState<{ slump?: string; cls?: string }>({});
  const act = (a: SlumpAction) => setLog((l) => [...l, a]);

  evalRef.current = () => evaluateSlump({ log, tamps, wc, answers });

  const placedCone = log.includes("place");
  const lifted = log.includes("lift") || log.includes("twist");
  const measured = lifted && log.lastIndexOf("measure") > log.findIndex((a) => a === "lift" || a === "twist");
  const layers = tamps.length;
  const s = slumpValue(wc);
  const heap = 300 - s;

  const fill = () => { act("fill"); setTamps((t) => [...t, 0]); };
  const tamp = (n: number) => {
    if (!layers) return;
    act("tamp");
    setTamps((t) => t.map((v, i) => (i === t.length - 1 ? v + n : v)));
  };

  const baseY = 200;
  const cx = 150;
  return (
    <BenchCard title="Slump Cone Test Bench" hint="Click tools in the correct order">
      <div className="bg-primary p-3">
        <svg viewBox="0 0 300 220" className="mx-auto w-full max-w-md" role="img" aria-label="Slump cone">
          <rect x={20} y={baseY} width={260} height={10} fill="#8a919c" />
          {/* concrete */}
          {!lifted && layers > 0 && (() => {
            const h = Math.min(3, layers) * 100 * K;
            const top = baseY - h;
            const wTop = 100 + (200 - 100) * (1 - h / (300 * K));
            return <polygon points={`${cx - 100 * K},${baseY} ${cx + 100 * K},${baseY} ${cx + (wTop / 2) * K},${top} ${cx - (wTop / 2) * K},${top}`} fill="#9b8f80" />;
          })()}
          {lifted && (
            <path d={`M ${cx - 130 * K} ${baseY} Q ${cx} ${baseY - heap * K * 1.9} ${cx + 130 * K} ${baseY} Z`} fill="#9b8f80" />
          )}
          {/* cone */}
          {placedCone && (
            <polygon
              points={`${cx - 100 * K},${lifted ? 40 : baseY} ${cx + 100 * K},${lifted ? 40 : baseY} ${cx + 50 * K},${(lifted ? 40 : baseY) - 300 * K} ${cx - 50 * K},${(lifted ? 40 : baseY) - 300 * K}`}
              fill="none" stroke={log.includes("oil") ? "#e8912d" : "#c9ced6"} strokeWidth={3}
              transform={lifted ? `translate(90 ${-20})` : undefined}
            />
          )}
          {measured && (
            <g>
              <line x1={250} x2={250} y1={baseY} y2={baseY - 300 * K} stroke="#f3ead8" strokeWidth={2} />
              {[0, 50, 100, 150, 200, 250, 300].map((m) => (
                <g key={m}>
                  <line x1={244} x2={256} y1={baseY - m * K} y2={baseY - m * K} stroke="#f3ead8" />
                  <text x={262} y={baseY - m * K + 3} fontSize={8} fill="#f3ead8">{m}</text>
                </g>
              ))}
              <line x1={cx} x2={250} y1={baseY - heap * K} y2={baseY - heap * K} stroke="#e8912d" strokeDasharray="3 2" />
            </g>
          )}
        </svg>
      </div>
      <div className="space-y-3 p-4">
        <div className="grid grid-cols-3 gap-3">
          <ReadingBox label="Layers" value={`${layers} / 3`} />
          <ReadingBox label="Tamps (this layer)" value={`${tamps[layers - 1] ?? 0}`} highlight={tamps[layers - 1] === 25} warn={(tamps[layers - 1] ?? 0) > 25} />
          <ReadingBox label="Heap top" value={measured ? `${heap} mm` : "—"} />
        </div>
        <RangeInput label="Water–cement ratio" min={0.4} max={0.65} step={0.01} value={wc} onChange={setWc} disabled={layers > 0} />
        <div className="flex flex-wrap gap-2">
          <ToolButton onClick={() => act("oil")} active={log.includes("oil")} disabled={lifted}><Droplet className="h-4 w-4" /> Oil mould</ToolButton>
          <ToolButton onClick={() => act("place")} active={placedCone} disabled={lifted}><CircleDot className="h-4 w-4" /> Place cone</ToolButton>
          <ToolButton onClick={fill} disabled={lifted || !placedCone}><Layers className="h-4 w-4" /> Add layer</ToolButton>
          <ToolButton onClick={() => tamp(1)} disabled={lifted || !layers}><Hammer className="h-4 w-4" /> Tamp ×1</ToolButton>
          <ToolButton onClick={() => tamp(5)} disabled={lifted || !layers}><Hammer className="h-4 w-4" /> Tamp ×5</ToolButton>
          <ToolButton onClick={() => act("strike")} active={log.includes("strike")} disabled={lifted || !layers}><Minus className="h-4 w-4" /> Strike off</ToolButton>
          <ToolButton onClick={() => act("lift")} disabled={lifted || !placedCone}><ArrowUp className="h-4 w-4" /> Lift vertically</ToolButton>
          <ToolButton onClick={() => act("twist")} disabled={lifted || !placedCone}><RotateCw className="h-4 w-4" /> Lift with twist</ToolButton>
          <ToolButton onClick={() => act("measure")} disabled={!lifted} active={measured}><Ruler className="h-4 w-4" /> स्लंप नापें</ToolButton>
        </div>
        {measured && <p className="text-xs text-muted-foreground">Scale reading at top of the slumped heap: <b>{heap} mm</b> (cone height 300 mm)</p>}
        <div className="grid grid-cols-2 gap-2">
          <AnswerInput label="Slump (mm)" value={answers.slump} onChange={(v) => setAnswers({ ...answers, slump: v })} />
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Workability</span>
            <select value={answers.cls ?? ""} onChange={(e) => setAnswers({ ...answers, cls: e.target.value })}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm">
              <option value="">Choose…</option>
              {["very low", "low", "medium", "high"].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        </div>
      </div>
    </BenchCard>
  );
}
