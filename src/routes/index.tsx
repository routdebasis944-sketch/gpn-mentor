import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Send, GraduationCap, PlayCircle, Briefcase, BookOpen } from "lucide-react";
import gpnLogo from "@/assets/gpn-logo.png";
import { GPN_SYSTEM_PROMPT, GPN_WELCOME, GPN_WELCOME_HI } from "@/lib/gpn-prompt";

// Extracts a YouTube video ID from watch / youtu.be / shorts / embed URLs.
function getYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = u.pathname.slice(1).split("/")[0];
      return id || null;
    }
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const m = u.pathname.match(/^\/(shorts|embed|live)\/([^/?#]+)/);
      if (m) return m[2] ?? null;
    }
  } catch {
    // not a URL
  }
  return null;
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Gpn AI — Your Government Polytechnic Assistant" },
      {
        name: "description",
        content:
          "Gpn AI (Debasis) is a chat assistant for Government Polytechnic students, alumni and faculty — course details & notes, video lectures, and diploma-holder job alerts.",
      },
      { property: "og:title", content: "Gpn AI — Your Government Polytechnic Assistant" },
      {
        property: "og:description",
        content:
          "Course details & notes, video lectures, and Government/Private job alerts for diploma holders — powered by Debasis.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GpnChat,
});

type Message = { role: "user" | "assistant"; content: string; streaming?: boolean };

const SUGGESTIONS = [
  { icon: BookOpen, label: "Course details & notes", prompt: "Give me the syllabus and key subjects for the Computer Science diploma, 3rd semester." },
  { icon: PlayCircle, label: "Video lectures", prompt: "I want to watch a video lecture on Engineering Mechanics. Show me the video player." },
  { icon: Briefcase, label: "Job alerts", prompt: "Show me the latest Government and Private job vacancies suitable for diploma holders." },
];

function GpnChat() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: GPN_WELCOME },
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Auto-scroll to the newest message.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Speak the Hindi welcome greeting via Text-to-Speech when the app loads.
  // Browsers may block autoplay with sound; if so, play on the first tap/click.
  useEffect(() => {
    let cancelled = false;
    let cleanupGesture: (() => void) | undefined;

    (async () => {
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: GPN_WELCOME_HI }),
        });
        if (!res.ok || cancelled) return;
        const blob = await res.blob();
        if (cancelled) return;
        const audio = new Audio(URL.createObjectURL(blob));
        try {
          await audio.play();
        } catch {
          // Autoplay blocked — wait for the first user gesture.
          const playOnGesture = () => {
            audio.play().catch(() => {});
          };
          window.addEventListener("pointerdown", playOnGesture, { once: true });
          cleanupGesture = () => window.removeEventListener("pointerdown", playOnGesture);
        }
      } catch {
        // TTS is a nice-to-have; ignore failures silently.
      }
    })();

    return () => {
      cancelled = true;
      cleanupGesture?.();
    };
  }, []);

  const sendPrompt = useCallback(async (promptText: string) => {
    const text = promptText.trim();
    if (!text || isStreaming) return;

    setInput("");
    setIsStreaming(true);

    const userMsg: Message = { role: "user", content: text };
    const assistantMsg: Message = { role: "assistant", content: "", streaming: true };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    // Build the payload sent upstream: persona as a system message, then the
    // full prior conversation, then the new user turn.
    const payloadMessages = [
      { role: "system", content: GPN_SYSTEM_PROMPT },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: text },
    ];

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: payloadMessages }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => "Something went wrong.");
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.streaming) {
            last.content = `⚠️ ${errText || "Could not reach Gpn AI. Please try again."}`;
            last.streaming = false;
          }
          return next;
        });
        setIsStreaming(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const raw of lines) {
          const line = raw.trim();
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (data === "[DONE]") continue;
          try {
            const json = JSON.parse(data);
            const delta: string | undefined = json?.choices?.[0]?.delta?.content;
            if (delta) {
              accumulated += delta;
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last && last.streaming) last.content = accumulated;
                return next;
              });
            }
          } catch {
            // ignore malformed keep-alive chunks
          }
        }
      }

      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.streaming) {
          last.content = accumulated || "_(No response received — please try again.)_";
          last.streaming = false;
        }
        return next;
      });
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.streaming) {
          last.content = "⚠️ Network error — please check your connection and try again.";
          last.streaming = false;
        }
        return next;
      });
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [isStreaming, messages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendPrompt(input);
    }
  };

  const showSuggestions = messages.length === 1;

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      {/* Header */}
      <header className="gpn-header-gradient text-primary-foreground shadow-lg">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/10 ring-1 ring-white/20 backdrop-blur">
            <img
              src={gpnLogo}
              alt="Gpn AI logo"
              width={40}
              height={40}
              className="h-9 w-9 object-contain"
            />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold leading-tight tracking-tight">
              Gpn AI
            </h1>
            <p className="truncate text-xs text-white/70">
              Your Government Polytechnic assistant · Debasis
            </p>
          </div>
          <span className="hidden items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/90 ring-1 ring-white/20 sm:inline-flex">
            <GraduationCap className="h-3.5 w-3.5" />
            Diploma-first
          </span>
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 py-5">
          {messages.map((msg, i) => (
            <MessageBubble key={i} message={msg} />
          ))}

          {showSuggestions && (
            <div className="mt-6 gpn-fade-in">
              <p className="mb-3 text-center text-sm font-medium text-muted-foreground">
                Try one of these to get started
              </p>
              <div className="grid gap-2.5 sm:grid-cols-3">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => sendPrompt(s.prompt)}
                    disabled={isStreaming}
                    className="group flex flex-col gap-2 rounded-2xl border border-border bg-card p-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-saffron hover:shadow-md disabled:opacity-50"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-primary transition-colors group-hover:bg-saffron group-hover:text-accent-foreground">
                      <s.icon className="h-5 w-5" />
                    </span>
                    <span className="text-sm font-semibold leading-tight">{s.label}</span>
                    <span className="line-clamp-2 text-xs text-muted-foreground">
                      {s.prompt}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="h-2" />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-border bg-card/80 backdrop-blur">
        <div className="mx-auto w-full max-w-3xl px-4 py-3">
          <div className="flex items-end gap-2 rounded-2xl border border-border bg-background p-1.5 focus-within:border-saffron focus-within:ring-2 focus-within:ring-saffron/30 transition-all">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder="Ask about courses, video lectures, or job alerts…"
              className="max-h-36 min-h-[2.5rem] flex-1 resize-none bg-transparent px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
              disabled={isStreaming}
            />
            <button
              type="button"
              onClick={() => sendPrompt(input)}
              disabled={!input.trim() || isStreaming}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Send message"
            >
              <Send className="h-4.5 w-4.5" />
            </button>
          </div>
          <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
            Gpn AI focuses only on Government Polytechnic education. Verify job
            dates on official portals.
          </p>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  const showTyping = !isUser && message.streaming && !message.content;

  return (
    <div className={`mb-5 flex gpn-fade-in ${isUser ? "justify-end" : "justify-start"}`}>
      <div className="flex max-w-[85%] gap-2.5 sm:max-w-[80%]">
        {!isUser && (
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-brand-soft ring-1 ring-border">
            <img src={gpnLogo} alt="" width={32} height={32} className="h-7 w-7 object-contain" />
          </div>
        )}
        <div
          className={`rounded-2xl px-4 py-3 text-sm ${
            isUser ? "gpn-bubble-user" : "gpn-bubble-ai"
          }`}
        >
          {showTyping ? (
            <div className="flex items-center gap-1.5 py-1">
              <span className="gpn-dot h-2 w-2 rounded-full bg-saffron" />
              <span className="gpn-dot h-2 w-2 rounded-full bg-saffron" />
              <span className="gpn-dot h-2 w-2 rounded-full bg-saffron" />
            </div>
          ) : isUser ? (
            <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
          ) : (
            <div className="gpn-prose">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({ href, children, ...props }) => {
                    const videoId = href ? getYouTubeId(href) : null;
                    if (videoId) {
                      return (
                        <span className="my-3 block overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                          <span className="relative block aspect-video w-full">
                            <iframe
                              src={`https://www.youtube-nocookie.com/embed/${videoId}`}
                              title={typeof children === "string" ? children : "YouTube video lecture"}
                              className="absolute inset-0 h-full w-full"
                              loading="lazy"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                              allowFullScreen
                            />
                          </span>
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
                            {...props}
                          >
                            {children}
                          </a>
                        </span>
                      );
                    }
                    return (
                      <a href={href} {...props} target="_blank" rel="noopener noreferrer">
                        {children}
                      </a>
                    );
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
