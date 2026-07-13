"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { OPEN_WIDGET_EVENT } from "@/components/OpenWidgetButton";
import { PlaneIcon } from "@/components/illustrations";

type TripInfo = {
  origin: string;
  destination: string;
  region_preference: string;
  travel_dates: string;
  trip_length: string;
  travelers: string;
  budget: string;
  interests: string;
  constraints: string;
};

type Question = {
  key: keyof TripInfo;
  prompt: string;
  defaultValue?: string;
  skip?: (info: TripInfo) => boolean;
};

// Same questions, same order, same skip logic as collect_trip_info() in agent-demo2.py
const QUESTIONS: Question[] = [
  { key: "origin", prompt: "Which city/airport will you be traveling from?" },
  {
    key: "destination",
    prompt: "Do you have a destination in mind? (leave blank for suggestions)",
  },
  {
    key: "region_preference",
    prompt:
      "Any preferred region or type of trip? (e.g. beach, Europe, mountains, anywhere warm)",
    skip: (info) => Boolean(info.destination.trim()),
  },
  { key: "travel_dates", prompt: "When do you want to travel? (specific dates or a month/season)" },
  { key: "trip_length", prompt: "How many days is the trip?" },
  { key: "travelers", prompt: "How many travelers (and any kids)?", defaultValue: "1 adult" },
  { key: "budget", prompt: "What's your approximate total budget (per person or total)?" },
  {
    key: "interests",
    prompt:
      "What do you enjoy on vacation? (e.g. relaxing on a beach, hiking, food & culture, nightlife, adventure sports)",
  },
  {
    key: "constraints",
    prompt: "Any constraints? (e.g. direct flights only, visa-free, pet-friendly, accessibility needs)",
  },
];

const BANNER =
  "============================================================\n" +
  "  Claude Travel Agent\n" +
  "============================================================\n" +
  "Answer a few questions and I'll put together a vacation plan.\n" +
  "(Press Enter to skip any question you're not sure about.)\n";

const EMPTY_INFO: TripInfo = {
  origin: "",
  destination: "",
  region_preference: "",
  travel_dates: "",
  trip_length: "",
  travelers: "",
  budget: "",
  interests: "",
  constraints: "",
};

type Line = { text: string; kind: "system" | "prompt" | "output" | "error" };
type Turn = { role: "user" | "assistant"; text: string };
type Phase = "asking" | "planning" | "chat" | "chat-working";

function nextQuestionIndex(info: TripInfo, fromIndex: number): number {
  let idx = fromIndex;
  while (idx < QUESTIONS.length && QUESTIONS[idx].skip?.(info)) idx++;
  return idx;
}

function summarizeTrip(info: TripInfo): string {
  const parts: string[] = [];
  parts.push(`from ${info.origin || "n/a"}`);
  parts.push(info.destination ? `to ${info.destination}` : "open to destination suggestions");
  if (info.region_preference) parts.push(`preferring ${info.region_preference}`);
  if (info.travel_dates) parts.push(`traveling ${info.travel_dates}`);
  if (info.trip_length) parts.push(`for ${info.trip_length} days`);
  if (info.travelers) parts.push(`with ${info.travelers}`);
  if (info.budget) parts.push(`budget ${info.budget}`);
  if (info.interests) parts.push(`interested in ${info.interests}`);
  if (info.constraints) parts.push(`constraints: ${info.constraints}`);
  return `Plan a vacation ${parts.join(", ")}.`;
}

async function streamToLastLine(
  res: Response,
  setLinesFn: React.Dispatch<React.SetStateAction<Line[]>>
): Promise<string> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let full = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    full += chunk;
    setLinesFn((prev) => {
      const copy = [...prev];
      const last = copy[copy.length - 1];
      copy[copy.length - 1] = { ...last, text: last.text + chunk };
      return copy;
    });
  }

  return full;
}

export default function TravelAgentWidget() {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<Line[]>([{ text: BANNER, kind: "system" }]);
  const [info, setInfo] = useState<TripInfo>(EMPTY_INFO);
  const [qIndex, setQIndex] = useState(0);
  const [inputValue, setInputValue] = useState("");
  const [chatValue, setChatValue] = useState("");
  const [phase, setPhase] = useState<Phase>("asking");
  const [history, setHistory] = useState<Turn[]>([]);

  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
  }, [lines]);

  useEffect(() => {
    if (!open) return;
    if (phase === "asking") inputRef.current?.focus();
    if (phase === "chat") chatRef.current?.focus();
  }, [open, qIndex, phase]);

  useEffect(() => {
    const openFromOutside = () => setOpen(true);
    window.addEventListener(OPEN_WIDGET_EVENT, openFromOutside);
    return () => window.removeEventListener(OPEN_WIDGET_EVENT, openFromOutside);
  }, []);

  const question = qIndex < QUESTIONS.length ? QUESTIONS[qIndex] : null;

  function appendLine(line: Line) {
    setLines((prev) => [...prev, line]);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!question || phase !== "asking") return;

    const value = inputValue.trim() || question.defaultValue || "";
    const label = question.defaultValue
      ? `${question.prompt} [${question.defaultValue}]: `
      : `${question.prompt}: `;
    appendLine({ text: label + value, kind: "prompt" });

    const nextInfo: TripInfo = { ...info, [question.key]: value };
    setInfo(nextInfo);
    setInputValue("");

    const idx = nextQuestionIndex(nextInfo, qIndex + 1);

    if (idx >= QUESTIONS.length) {
      if (!nextInfo.origin.trim() && !nextInfo.destination.trim()) {
        appendLine({
          text: "\nI need at least a departure city or a destination to help. Refresh to try again.",
          kind: "error",
        });
        return;
      }
      setQIndex(idx);
      await runPlan(nextInfo);
    } else {
      setQIndex(idx);
    }
  }

  async function runPlan(finalInfo: TripInfo) {
    setPhase("planning");
    appendLine({
      text:
        "\nWorking on your vacation plan (this can take a bit while I check flights, " +
        "destinations, and policies)...\n",
      kind: "system",
    });

    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalInfo),
      });

      if (!res.ok || !res.body) {
        const text = await res.text();
        appendLine({ text: `Error: ${text}`, kind: "error" });
        setPhase("chat");
        return;
      }

      appendLine({ text: "", kind: "output" });
      const planText = await streamToLastLine(res, setLines);

      setHistory([
        { role: "user", text: summarizeTrip(finalInfo) },
        { role: "assistant", text: planText },
      ]);
      appendLine({
        text:
          "\n(You can now ask follow-up questions below — including about " +
          "cancellation, baggage, or insurance policy.)",
        kind: "system",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      appendLine({ text: `\n[Connection error: ${message}]`, kind: "error" });
    } finally {
      setPhase("chat");
    }
  }

  async function handleChatSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const question = chatValue.trim();
    if (!question || phase !== "chat") return;

    appendLine({ text: `\nAsk a follow-up question: ${question}`, kind: "prompt" });
    setChatValue("");
    setPhase("chat-working");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history, question }),
      });

      if (!res.ok || !res.body) {
        const text = await res.text();
        appendLine({ text: `Error: ${text}`, kind: "error" });
        return;
      }

      appendLine({ text: "", kind: "output" });
      const answerText = await streamToLastLine(res, setLines);

      setHistory((prev) => [
        ...prev,
        { role: "user", text: question },
        { role: "assistant", text: answerText },
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      appendLine({ text: `\n[Connection error: ${message}]`, kind: "error" });
    } finally {
      setPhase("chat");
    }
  }

  return (
    <>
      <button
        className="widget-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close travel agent" : "Open travel agent"}
      >
        {open ? "✕" : <PlaneIcon className="widget-toggle-icon" />}
      </button>

      {open && (
        <div className="widget-window">
          <div className="widget-header">
            <span>agent-demo2.py — Claude Travel Agent</span>
            <button onClick={() => setOpen(false)} aria-label="Minimize">
              &minus;
            </button>
          </div>
          <div className="widget-body" ref={bodyRef}>
            {lines.map((line, i) => (
              <pre key={i} className={`widget-line widget-line--${line.kind}`}>
                {line.text}
              </pre>
            ))}
            {phase === "asking" && question && (
              <form onSubmit={handleSubmit} className="widget-input-row">
                <span className="widget-prompt-label">
                  {question.prompt}
                  {question.defaultValue ? ` [${question.defaultValue}]` : ""}:
                </span>
                <input
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  className="widget-input"
                  autoComplete="off"
                  spellCheck={false}
                />
              </form>
            )}
            {(phase === "chat" || phase === "chat-working") && (
              <form onSubmit={handleChatSubmit} className="widget-input-row">
                <span className="widget-prompt-label">
                  {phase === "chat-working" ? "Thinking…" : "Ask a follow-up:"}
                </span>
                <input
                  ref={chatRef}
                  value={chatValue}
                  onChange={(e) => setChatValue(e.target.value)}
                  className="widget-input"
                  autoComplete="off"
                  spellCheck={false}
                  disabled={phase === "chat-working"}
                  placeholder="e.g. What's the baggage policy for a connecting flight?"
                />
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
