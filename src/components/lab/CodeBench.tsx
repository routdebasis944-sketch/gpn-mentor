import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { Play, Terminal, Trash2 } from "lucide-react";
import { evaluateCode, type EvalResult } from "@/lib/lab-eval";
import { BenchCard } from "./ui";

type Task = { fn: string; title: string; starter: string; tests: { args: unknown[]; expected: unknown }[] };

const TASKS: Task[] = [
  { fn: "factorial", title: "Write factorial(n) that returns n! (factorial(0) = 1).",
    starter: "function factorial(n) {\n  // your code here\n}\n\nconsole.log(factorial(5));\n",
    tests: [{ args: [0], expected: 1 }, { args: [5], expected: 120 }, { args: [7], expected: 5040 }] },
  { fn: "isPrime", title: "Write isPrime(n) that returns true if n is a prime number, else false.",
    starter: "function isPrime(n) {\n  // your code here\n}\n\nconsole.log(isPrime(7));\n",
    tests: [{ args: [1], expected: false }, { args: [2], expected: true }, { args: [15], expected: false }, { args: [29], expected: true }] },
  { fn: "reverseString", title: "Write reverseString(s) that returns the string reversed.",
    starter: "function reverseString(s) {\n  // your code here\n}\n\nconsole.log(reverseString(\"polytechnic\"));\n",
    tests: [{ args: ["abc"], expected: "cba" }, { args: ["GPN"], expected: "NPG" }, { args: [""], expected: "" }] },
  { fn: "largest", title: "Write largest(arr) that returns the largest number in an array.",
    starter: "function largest(arr) {\n  // your code here\n}\n\nconsole.log(largest([4, 9, 2]));\n",
    tests: [{ args: [[4, 9, 2]], expected: 9 }, { args: [[-5, -2, -9]], expected: -2 }, { args: [[7]], expected: 7 }] },
];

type RunOut = { logs: string[]; error?: string; value?: string };

const WORKER_SRC = `self.onmessage=function(e){var logs=[];var f=function(a){return typeof a==='string'?a:JSON.stringify(a)};
var c={log:function(){logs.push([].slice.call(arguments).map(f).join(' '))},error:function(){logs.push('Error: '+[].slice.call(arguments).map(f).join(' '))}};
try{var r=(new Function('console',e.data.code+'\\n;return (function(){'+e.data.extra+'})();'))(c);postMessage({logs:logs,value:JSON.stringify(r===undefined?null:r)})}
catch(err){postMessage({logs:logs,error:String(err&&err.message||err)})}}`;

function runInWorker(code: string, extra = "return undefined;", timeout = 2000): Promise<RunOut> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(new Blob([WORKER_SRC], { type: "text/javascript" }));
    const w = new Worker(url);
    const done = (o: RunOut) => { clearTimeout(t); w.terminate(); URL.revokeObjectURL(url); resolve(o); };
    const t = setTimeout(() => done({ logs: [], error: "Time limit exceeded (infinite loop?)" }), timeout);
    w.onmessage = (e) => done(e.data as RunOut);
    w.onerror = (e) => { e.preventDefault(); done({ logs: [], error: e.message }); };
    w.postMessage({ code, extra });
  });
}

export default function CodeBench({ semester, evalRef }: { semester: number; evalRef: MutableRefObject<(() => EvalResult | Promise<EvalResult>) | null> }) {
  const task = TASKS[semester % TASKS.length]!;
  const [code, setCode] = useState(task.starter);
  const [lines, setLines] = useState<{ t: string; kind: "in" | "out" | "err" | "sys" }[]>([
    { t: `GPN terminal — JavaScript runtime. Type "help".`, kind: "sys" },
  ]);
  const [cmd, setCmd] = useState("");
  const [runs, setRuns] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => endRef.current?.scrollIntoView({ block: "nearest" }), [lines]);

  const print = (t: string, kind: "in" | "out" | "err" | "sys" = "out") => setLines((l) => [...l, { t, kind }]);

  const run = async () => {
    print("$ run", "in");
    const o = await runInWorker(code);
    setRuns((r) => r + 1);
    setLastError(o.error ?? null);
    o.logs.forEach((x) => print(x));
    if (o.error) print(o.error, "err");
    else print("✓ Program finished", "sys");
  };

  const exec = async (raw: string) => {
    const c = raw.trim();
    if (!c) return;
    if (c === "clear") return setLines([]);
    if (c === "help") { print(`$ ${c}`, "in"); return print("Commands: run · clear · help · or any JS expression e.g. " + task.fn + "(5)", "sys"); }
    if (c === "run") return run();
    print(`$ ${c}`, "in");
    const o = await runInWorker(code.replace(/console\.log\([^\n]*\);?/g, ""), `return (${c});`);
    o.logs.forEach((x) => print(x));
    print(o.error ? o.error : (o.value ?? "undefined"), o.error ? "err" : "out");
  };

  evalRef.current = async () => {
    const tests = JSON.stringify(task.tests);
    const o = await runInWorker(code, `if(typeof ${task.fn}!=='function')return {missing:true};var T=${tests};return T.map(function(t){try{return JSON.stringify(${task.fn}.apply(null,t.args))===JSON.stringify(t.expected)}catch(e){return false}});`);
    const val = o.value ? JSON.parse(o.value) : null;
    const missing = !!(val && !Array.isArray(val) && val.missing) || !!o.error;
    const results: boolean[] = Array.isArray(val) ? val : task.tests.map(() => false);
    return evaluateCode({
      runs, lastError: lastError ?? o.error ?? null, missingFn: missing, fnName: task.fn,
      tests: task.tests.map((t, i) => ({ label: `${task.fn}(${t.args.map((a) => JSON.stringify(a)).join(", ")}) का उत्तर ${JSON.stringify(t.expected)} होना चाहिए`, ok: !!results[i] })),
    });
  };

  return (
    <BenchCard title="Code Editor & Terminal" hint="JavaScript · runs safely in your browser">
      <div className="border-b border-border bg-brand-soft/60 px-4 py-2.5 text-sm"><b>Task:</b> {task.title}</div>
      <div className="flex bg-foreground font-mono text-[13px] text-background">
        <div aria-hidden className="select-none px-2 py-3 text-right leading-6 text-background/40">
          {code.split("\n").map((_, i) => <div key={i}>{i + 1}</div>)}
        </div>
        <textarea value={code} onChange={(e) => setCode(e.target.value)} spellCheck={false} aria-label="Code editor"
          onKeyDown={(e) => {
            if (e.key === "Tab") {
              e.preventDefault();
              const el = e.currentTarget; const s = el.selectionStart;
              setCode(code.slice(0, s) + "  " + code.slice(el.selectionEnd));
              requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = s + 2; });
            }
          }}
          rows={Math.max(12, code.split("\n").length)}
          className="min-w-0 flex-1 resize-none bg-transparent py-3 pr-3 leading-6 outline-none" />
      </div>
      <div className="flex gap-2 border-y border-border p-2">
        <button type="button" onClick={run} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><Play className="h-4 w-4" /> Run</button>
        <button type="button" onClick={() => setLines([])} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm"><Trash2 className="h-4 w-4" /> Clear</button>
        <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground"><Terminal className="h-3.5 w-3.5" /> Runs: {runs}</span>
      </div>
      <div className="h-48 overflow-auto bg-foreground p-3 font-mono text-xs leading-5">
        {lines.map((l, i) => (
          <div key={i} className={l.kind === "err" ? "text-destructive" : l.kind === "in" ? "text-saffron" : l.kind === "sys" ? "text-background/50" : "text-background"}>{l.t}</div>
        ))}
        <form onSubmit={(e) => { e.preventDefault(); const c = cmd; setCmd(""); void exec(c); }} className="flex items-center gap-1 text-saffron">
          <span>$</span>
          <input value={cmd} onChange={(e) => setCmd(e.target.value)} aria-label="Terminal input" placeholder="type a command…"
            className="flex-1 bg-transparent text-background outline-none placeholder:text-background/30" />
        </form>
        <div ref={endRef} />
      </div>
    </BenchCard>
  );
}
