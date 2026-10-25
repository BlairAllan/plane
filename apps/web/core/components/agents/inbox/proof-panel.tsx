/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { boardFetch } from "@/lib/c-swarm-board";
import type { Artifact, Proof, Thread } from "@/lib/c-swarm-inbox";
import { proofUrl } from "@/lib/c-swarm-inbox";
import { renderMarkdown } from "./md";

/** Markdown from agents, in Plane's type scale. Rendered as elements, so no agent text becomes HTML. */
export function Md({ text, className = "" }: { text: string; className?: string }) {
  return (
    <div
      className={`[&_code]:font-mono text-13 leading-5 text-primary [&_a]:text-accent-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-subtle [&_blockquote]:pl-2 [&_blockquote]:text-secondary [&_code]:rounded [&_code]:bg-layer-2 [&_code]:px-1 [&_code]:text-12 [&_h1]:text-14 [&_h1]:font-semibold [&_h2]:mt-2 [&_h2]:text-13 [&_h2]:font-semibold [&_h3]:font-semibold [&_li]:ml-4 [&_ol]:list-decimal [&_p]:my-1 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-layer-2 [&_pre]:p-2 [&_ul]:list-disc ${className}`}
    >
      {renderMarkdown(text)}
    </div>
  );
}

/** A proof file fetched with the board token (an <img src> cannot send one), as an object URL. */
export function useBoardFile(path: string, as: "blob" | "text"): { url: string; text: string; failed: boolean } {
  const [state, setState] = useState({ url: "", text: "", failed: false });
  useEffect(() => {
    let url = "";
    let live = true;
    boardFetch(path)
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        if (as === "text") {
          const t = await r.text();
          if (live) setState({ url: "", text: t, failed: false });
        } else {
          url = URL.createObjectURL(await r.blob());
          if (live) setState({ url, text: "", failed: false });
        }
        return undefined;
      })
      .catch(() => live && setState({ url: "", text: "", failed: true }));
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [path, as]);
  return state;
}

function Tile({ thread, a, onOpen }: { thread: Thread; a: Artifact; onOpen: () => void }) {
  const img = useBoardFile(proofUrl(thread, a), a.kind === "text" ? "text" : "blob");
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-40 flex-col overflow-hidden rounded border border-subtle bg-layer-1 text-left hover:border-accent-strong"
      title={`${a.name} · ${a.role} · ${a.round}`}
    >
      <div className="flex h-24 items-center justify-center overflow-hidden bg-layer-2">
        {a.kind === "image" && img.url ? (
          <img src={img.url} alt={a.name} className="h-full w-full object-cover object-top" />
        ) : a.kind === "text" ? (
          <pre className="font-mono h-full w-full overflow-hidden p-1.5 text-[9px] leading-3 text-tertiary">
            {img.text.slice(0, 600)}
          </pre>
        ) : (
          <span className="text-11 text-tertiary">{img.failed ? "unavailable" : a.kind}</span>
        )}
      </div>
      <div className="truncate px-2 py-1 text-11 text-secondary">{a.name}</div>
      <div className="font-mono px-2 pb-1 text-[10px] text-tertiary">
        {a.role} · {a.round}
      </div>
    </button>
  );
}

function Viewer({ thread, a, onClose }: { thread: Thread; a: Artifact; onClose: () => void }) {
  const f = useBoardFile(proofUrl(thread, a), a.kind === "text" ? "text" : "blob");
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-8">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={a.name}
        className="relative flex max-h-full max-w-5xl flex-col overflow-hidden rounded-lg border border-subtle bg-surface-1"
      >
        <div className="flex items-center justify-between gap-4 border-b border-subtle px-3 py-2 text-12">
          <span className="font-mono text-secondary">
            {a.name}{" "}
            <span className="text-tertiary">
              · saved by the {a.role} in {a.round}
            </span>
          </span>
          <button type="button" className="text-tertiary hover:text-primary" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="overflow-auto">
          {a.kind === "image" && f.url && <img src={f.url} alt={a.name} className="max-w-full" />}
          {a.kind === "video" && f.url && (
            // a screen recording of the app under test: no speech to caption
            // oxlint-disable-next-line jsx_a11y/media-has-caption
            <video src={f.url} controls className="max-w-full" />
          )}
          {a.kind === "text" && <pre className="font-mono p-3 text-12 whitespace-pre-wrap text-primary">{f.text}</pre>}
          {f.failed && <div className="p-6 text-13 text-tertiary">The board could not serve this file.</div>}
        </div>
      </div>
    </div>
  );
}

/** What shows the work is done: the factory's own test run, each judge, the files, and the agents' evidence. */
export function ProofPanel({ thread, proof }: { thread: Thread; proof: Proof }) {
  const [open, setOpen] = useState<Artifact | null>(null);
  const [showOutput, setShowOutput] = useState(false);
  const [judgeOpen, setJudgeOpen] = useState<Record<string, boolean>>({});
  const s = proof.suite;
  return (
    <section className="rounded border border-subtle" aria-label="Proof of work">
      <h4 className="border-b border-subtle px-3 py-2 text-12 font-semibold text-tertiary uppercase">Proof of work</h4>
      <div className="flex flex-col gap-3 p-3 text-13">
        {s.command && (
          <div className="flex items-start gap-2">
            <span className={s.passed ? "text-success-primary" : "text-danger-primary"}>{s.passed ? "✓" : "✕"}</span>
            <div className="min-w-0 flex-1">
              <div>
                <span className="font-mono text-12">{s.command}</span> {s.passed ? "passed" : "failed"}
                {s.result && <span className="text-secondary"> · {s.result}</span>}
              </div>
              <div className="text-12 text-tertiary">
                Run by the factory itself on the branch, not reported by an agent.
              </div>
              {s.output && (
                <button type="button" className="text-12 text-accent-primary" onClick={() => setShowOutput((v) => !v)}>
                  {showOutput ? "Hide output" : "Show output"}
                </button>
              )}
              {showOutput && (
                <pre className="font-mono mt-1 max-h-64 overflow-auto rounded bg-layer-2 p-2 text-11 whitespace-pre-wrap text-secondary">
                  {s.output}
                </pre>
              )}
            </div>
          </div>
        )}
        {proof.base_tests && (
          <div className="flex items-start gap-2">
            <span className="text-success-primary">✓</span>
            <div className="text-secondary">{proof.base_tests}</div>
          </div>
        )}
        {proof.judges.map((j) => (
          <div key={j.role} className="flex items-start gap-2">
            <span className={j.passed ? "text-success-primary" : "text-danger-primary"}>{j.passed ? "✓" : "✕"}</span>
            <div className="min-w-0 flex-1">
              <span className="font-medium capitalize">{j.role}</span>{" "}
              <span className="text-secondary">{j.summary}</span>
              {j.evidence.length > 0 && (
                <>
                  <button
                    type="button"
                    className="ml-1 text-12 text-accent-primary"
                    onClick={() => setJudgeOpen((o) => ({ ...o, [j.role]: !o[j.role] }))}
                  >
                    {judgeOpen[j.role] ? "Hide what it checked" : `What it checked (${j.evidence.length})`}
                  </button>
                  {judgeOpen[j.role] && (
                    <ul className="mt-1 flex flex-col gap-1">
                      {j.evidence.map((e) => (
                        <li
                          key={e}
                          className="font-mono rounded bg-layer-1 p-2 text-11 whitespace-pre-wrap text-secondary"
                        >
                          {e}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
        {proof.deviations.length > 0 && (
          <div className="rounded bg-warning-subtle p-2">
            <div className="text-12 font-semibold text-warning-primary">Departs from the approved spec</div>
            <ul className="mt-1 list-disc pl-4 text-secondary">
              {proof.deviations.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </div>
        )}
        {proof.changed.length > 0 && (
          <details>
            <summary className="cursor-pointer text-12 text-tertiary">{proof.changed.length} files changed</summary>
            <ul className="mt-1 flex flex-wrap gap-1">
              {proof.changed.map((c) => (
                <li key={c} className="font-mono rounded bg-layer-1 px-1.5 py-0.5 text-11 text-secondary">
                  {c}
                </li>
              ))}
            </ul>
          </details>
        )}
        <div>
          <div className="mb-1 text-12 text-tertiary">
            {proof.artifacts.length
              ? "Evidence the agents saved"
              : "The agents saved no screenshots or output for this one."}
          </div>
          <div className="flex flex-wrap gap-2">
            {proof.artifacts.map((a) => (
              <Tile key={a.path} thread={thread} a={a} onOpen={() => setOpen(a)} />
            ))}
          </div>
        </div>
      </div>
      {open && <Viewer thread={thread} a={open} onClose={() => setOpen(null)} />}
    </section>
  );
}
