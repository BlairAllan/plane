/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { boardEventSourceUrl, boardFetch } from "@/lib/c-swarm-board";

// Live view of what a factory agent is doing: its stdout/stderr, streamed from the board server.
const MAX_RECORDS = 5000;
const RESULT_LINES = 12;

type Stream = { file: string; stage: string; role: string; size: number; updated: number; state: "running" | "done" | "stale" };
type Rec = { t: number; s: "meta" | "out" | "err" | "end"; x: string; o?: number };
type Block =
  | { kind: "text"; text: string }
  | { kind: "thinking"; text: string }
  | { kind: "tool"; name: string; summary: string; input: string }
  | { kind: "result"; text: string; isError: boolean }
  | { kind: "summary"; text: string }
  | { kind: "info"; text: string }
  | { kind: "plain"; text: string }
  | { kind: "stderr"; text: string }
  | { kind: "meta"; text: string }
  | { kind: "end"; text: string };
type Row = { rec: Rec; blocks: Block[] };

const short = (s: string, n = 140) => (s.length > n ? `${s.slice(0, n)}…` : s);

function toolSummary(name: string, input: Record<string, unknown> | undefined): string {
  const i = input ?? {};
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = i[k];
      if (typeof v === "string" && v) return v;
    }
    return "";
  };
  switch (name) {
    case "Bash":
      return short(pick("command"));
    case "Read":
    case "Edit":
    case "Write":
    case "NotebookEdit":
      return short(pick("file_path", "notebook_path"));
    case "Grep":
      return short([pick("pattern"), pick("path")].filter(Boolean).join("  in  "));
    case "Glob":
      return short(pick("pattern"));
    case "Task":
    case "Agent":
      return short(pick("description", "prompt"));
    case "WebFetch":
      return short(pick("url"));
    case "WebSearch":
      return short(pick("query"));
    default:
      return short(JSON.stringify(i));
  }
}

function resultText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((c) => (c && typeof c === "object" && "text" in c ? String((c as { text: unknown }).text) : JSON.stringify(c)))
      .join("\n");
  }
  return content == null ? "" : JSON.stringify(content);
}

function blocksFor(rec: Rec): Block[] {
  if (rec.s === "meta") return [{ kind: "meta", text: rec.x }];
  if (rec.s === "end") return [{ kind: "end", text: rec.x }];
  if (rec.s === "err") return [{ kind: "stderr", text: rec.x }];
  const line = rec.x;
  if (!line.startsWith("{")) return [{ kind: "plain", text: line }];
  let ev: Record<string, unknown>;
  try {
    ev = JSON.parse(line) as Record<string, unknown>;
  } catch {
    return [{ kind: "plain", text: line }];
  }
  const type = ev.type;
  if (typeof type !== "string") return [{ kind: "plain", text: line }];
  const msg = ev.message as { content?: unknown } | undefined;
  const content = Array.isArray(msg?.content) ? (msg?.content as Record<string, unknown>[]) : [];
  if (type === "assistant") {
    const out: Block[] = [];
    for (const c of content) {
      if (c.type === "text" && typeof c.text === "string" && c.text.trim()) out.push({ kind: "text", text: c.text });
      else if (c.type === "thinking" && typeof c.thinking === "string" && c.thinking.trim())
        out.push({ kind: "thinking", text: c.thinking });
      else if (c.type === "tool_use") {
        const name = String(c.name ?? "tool");
        const input = c.input as Record<string, unknown> | undefined;
        out.push({ kind: "tool", name, summary: toolSummary(name, input), input: JSON.stringify(input ?? {}, null, 2) });
      }
    }
    return out;
  }
  if (type === "user") {
    return content
      .filter((c) => c.type === "tool_result")
      .map((c) => ({ kind: "result" as const, text: resultText(c.content), isError: c.is_error === true }));
  }
  if (type === "result") {
    const cost = typeof ev.total_cost_usd === "number" ? `$${ev.total_cost_usd.toFixed(2)}` : "";
    const turns = typeof ev.num_turns === "number" ? `${ev.num_turns} turns` : "";
    const sub = typeof ev.subtype === "string" ? ev.subtype : "";
    return [{ kind: "summary", text: [sub, turns, cost].filter(Boolean).join(" · ") }];
  }
  if (type === "system" && ev.subtype === "init") {
    return [{ kind: "info", text: `session started${typeof ev.model === "string" ? ` · ${ev.model}` : ""}` }];
  }
  return []; // hooks, rate-limit and token events: visible in Raw only
}

function ResultBlock({ text, isError }: { text: string; isError: boolean }) {
  const [more, setMore] = useState(false);
  const lines = text.split("\n");
  const long = lines.length > RESULT_LINES;
  const shown = more || !long ? text : lines.slice(0, RESULT_LINES).join("\n");
  return (
    <div className={`ml-4 rounded border-l-2 pl-2 ${isError ? "border-red-500" : "border-subtle"}`}>
      <pre className={`font-mono text-11 whitespace-pre-wrap ${isError ? "text-red-400" : "text-tertiary"}`}>{shown || "(empty)"}</pre>
      {long && (
        <button type="button" className="text-11 text-accent-primary hover:underline" onClick={() => setMore(!more)}>
          {more ? "show less" : `show ${lines.length - RESULT_LINES} more lines`}
        </button>
      )}
    </div>
  );
}

function ToolBlock({ b }: { b: Extract<Block, { kind: "tool" }> }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded bg-layer-1 px-2 py-1">
      <button type="button" className="flex w-full items-baseline gap-2 text-left" onClick={() => setOpen(!open)}>
        <span className="shrink-0 font-mono text-11 font-semibold text-accent-primary">{b.name}</span>
        <span className="min-w-0 flex-1 truncate font-mono text-12 text-secondary">{b.summary}</span>
        <span className="text-11 text-tertiary">{open ? "▾" : "▸"}</span>
      </button>
      {open && <pre className="mt-1 font-mono text-11 whitespace-pre-wrap text-tertiary">{b.input}</pre>}
    </div>
  );
}

function BlockView({ b }: { b: Block }) {
  switch (b.kind) {
    case "text":
      return <div className="text-13 whitespace-pre-wrap text-primary">{b.text}</div>;
    case "thinking":
      return (
        <details className="text-12 text-tertiary">
          <summary className="cursor-pointer">thinking…</summary>
          <div className="mt-1 whitespace-pre-wrap italic">{b.text}</div>
        </details>
      );
    case "tool":
      return <ToolBlock b={b} />;
    case "result":
      return <ResultBlock text={b.text} isError={b.isError} />;
    case "summary":
      return <div className="rounded bg-green-500/10 px-2 py-1 font-mono text-12 text-green-400">finished · {b.text}</div>;
    case "info":
      return <div className="font-mono text-11 text-tertiary">{b.text}</div>;
    case "stderr":
      return <pre className="font-mono text-12 whitespace-pre-wrap text-red-400">{b.text}</pre>;
    case "meta":
      return <pre className="font-mono text-11 whitespace-pre-wrap text-tertiary">{b.text}</pre>;
    case "end":
      return <div className="border-t border-subtle pt-1 font-mono text-11 text-tertiary">— {b.text}</div>;
    default:
      return <pre className="font-mono text-12 whitespace-pre-wrap text-secondary">{b.text}</pre>;
  }
}

const label = (s: Stream) => (s.stage ? `${s.stage.replace("round-", "round ")} · ${s.role}` : s.role);

function StateMark({ s }: { s: Stream["state"] }) {
  if (s === "running") return <span className="inline-block size-1.5 animate-pulse rounded-full bg-green-500" />;
  if (s === "done") return <span className="text-11 text-green-500">✓</span>;
  return <span className="text-11 text-tertiary">·</span>;
}

export function LiveOutput({ project, seq, polling }: { project: string; seq: string; polling: boolean }) {
  const [open, setOpen] = useState(polling);
  const [streams, setStreams] = useState<Stream[] | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [file, setFile] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [dropped, setDropped] = useState(0);
  const [ended, setEnded] = useState(false);
  const [following, setFollowing] = useState(true);
  const [raw, setRaw] = useState(false);
  const picked = useRef(false);
  const box = useRef<HTMLDivElement | null>(null);

  const path = `/runs/${encodeURIComponent(project)}/${encodeURIComponent(seq)}`;

  // The pane is reused when another run is selected: start clean.
  useEffect(() => {
    picked.current = false;
    setFile(null);
    setStreams(null);
    setRows([]);
    setDropped(0);
    setEnded(false);
    setUnavailable(false);
    setFollowing(true);
    setOpen(polling);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, seq]);

  // Which streams exist: once on open, and every few seconds while the run is live.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    const load = async () => {
      try {
        const r = await boardFetch(`${path}/streams.json`, { cache: "no-store" });
        if (!r.ok) throw new Error(String(r.status));
        const j = (await r.json()) as { streams: Stream[] };
        if (!alive) return;
        setUnavailable(false);
        setStreams(j.streams);
      } catch {
        if (alive) setUnavailable(true);
      }
    };
    void load();
    if (!polling) return () => void (alive = false);
    const id = setInterval(() => void load(), 5000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [open, polling, path]);

  const ordered = useMemo(() => {
    const rank = (s: Stream) => (s.state === "running" ? 0 : 1);
    return [...(streams ?? [])].sort((a, b) => rank(a) - rank(b) || b.updated - a.updated);
  }, [streams]);

  // Follow the newest running stream until the user picks one themselves.
  useEffect(() => {
    if (!ordered.length || picked.current) return;
    const next = ordered[0].file;
    if (next !== file) setFile(next);
  }, [ordered, file]);

  // One EventSource per selected stream, resumed by byte offset so a reconnect never repeats a line.
  useEffect(() => {
    if (!open || !file) return;
    setRows([]);
    setDropped(0);
    setEnded(false);
    let offset = 0;
    let es: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let closed = false;
    let buffer: Row[] = [];
    const flush = setInterval(() => {
      if (!buffer.length) return;
      const batch = buffer;
      buffer = [];
      setRows((prev) => {
        const all = prev.concat(batch);
        if (all.length <= MAX_RECORDS) return all;
        setDropped((d) => d + all.length - MAX_RECORDS);
        return all.slice(all.length - MAX_RECORDS);
      });
    }, 150);
    const connect = () => {
      if (closed) return;
      es = new EventSource(boardEventSourceUrl(`${path}/stream?file=${encodeURIComponent(file)}&offset=${offset}`));
      es.onmessage = (m) => {
        try {
          const rec = JSON.parse(m.data as string) as Rec;
          if (typeof rec.o === "number") offset = rec.o;
          buffer.push({ rec, blocks: blocksFor(rec) });
        } catch {
          /* ignore a malformed event */
        }
      };
      es.addEventListener("done", () => {
        closed = true;
        es?.close();
        setEnded(true);
      });
      es.onerror = () => {
        es?.close();
        if (!closed) retry = setTimeout(connect, 2000); // reconnect from the last offset
      };
    };
    connect();
    return () => {
      closed = true;
      es?.close();
      if (retry) clearTimeout(retry);
      clearInterval(flush);
    };
  }, [open, file, path]);

  // Stick to the tail while following.
  useEffect(() => {
    const el = box.current;
    if (following && el) el.scrollTop = el.scrollHeight;
  }, [rows, following, raw]);

  const onScroll = useCallback(() => {
    const el = box.current;
    if (!el) return;
    setFollowing(el.scrollHeight - el.scrollTop - el.clientHeight < 40);
  }, []);

  const jump = () => {
    setFollowing(true);
    const el = box.current;
    if (el) el.scrollTop = el.scrollHeight;
  };

  const copy = () => {
    const text = rows.map((r) => r.rec.x).join("\n");
    void navigator.clipboard?.writeText(text);
  };

  const current = ordered.find((s) => s.file === file);
  const none = streams !== null && streams.length === 0;

  return (
    <section>
      <button
        type="button"
        className="mb-1 flex w-full items-center gap-2 text-left text-12 font-semibold text-tertiary uppercase"
        onClick={() => setOpen(!open)}
      >
        <span>{open ? "▾" : "▸"}</span>
        Live output
        {ordered.some((s) => s.state === "running") && (
          <span className="inline-block size-1.5 animate-pulse rounded-full bg-green-500" title="running now" />
        )}
      </button>
      {open && (
        <div className="flex flex-col gap-2">
          {unavailable && <div className="text-tertiary">Stream unavailable (board server not reachable).</div>}
          {!unavailable && streams === null && <div className="text-tertiary">Loading…</div>}
          {none && (
            <div className="text-tertiary">
              {polling ? "Not started: no output yet." : "No live output recorded for this run (older run)."}
            </div>
          )}
          {ordered.length > 0 && (
            <>
              <div className="flex flex-wrap gap-1">
                {ordered.map((s) => (
                  <button
                    key={s.file}
                    type="button"
                    onClick={() => {
                      picked.current = true;
                      setFile(s.file);
                      setFollowing(true);
                    }}
                    className={`flex items-center gap-1 rounded border px-2 py-0.5 text-11 ${
                      s.file === file ? "border-accent-primary text-primary" : "border-subtle text-tertiary hover:text-primary"
                    }`}
                  >
                    <StateMark s={s.state} />
                    {label(s)}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3 text-11 text-tertiary">
                <span>{current ? (ended || current.state === "done" ? "Finished" : current.state === "stale" ? "Stopped without finishing" : "Streaming") : ""}</span>
                <span className="flex-1" />
                <button type="button" className="hover:text-primary" onClick={() => setRaw(!raw)}>
                  {raw ? "Formatted" : "Raw"}
                </button>
                <button type="button" className="hover:text-primary" onClick={copy}>
                  Copy
                </button>
                <button
                  type="button"
                  className={following ? "text-green-500" : "text-amber-400"}
                  onClick={() => (following ? setFollowing(false) : jump())}
                >
                  {following ? "Following" : "Paused · jump to latest"}
                </button>
              </div>
              <div
                ref={box}
                onScroll={onScroll}
                className="relative max-h-[28rem] min-h-24 overflow-y-auto rounded border border-subtle bg-layer-1/40 p-2"
              >
                {dropped > 0 && <div className="mb-1 text-11 text-tertiary">… {dropped} earlier lines not shown</div>}
                {rows.length === 0 && <div className="text-tertiary">No output yet.</div>}
                <div className="flex flex-col gap-1.5">
                  {raw
                    ? rows.map((r, i) => (
                        <pre
                          key={i}
                          className={`font-mono text-11 whitespace-pre-wrap ${r.rec.s === "err" ? "text-red-400" : "text-secondary"}`}
                        >
                          {r.rec.x}
                        </pre>
                      ))
                    : rows.flatMap((r, i) => r.blocks.map((b, j) => <BlockView key={`${i}-${j}`} b={b} />))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
