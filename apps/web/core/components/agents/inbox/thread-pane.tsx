/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { useProjectState } from "@/hooks/store/use-project-state";
import { IssueCommentService, IssueService } from "@/services/issue";
import type { Annotation, BoardPost, Draft, Question, Thread } from "@/lib/c-swarm-inbox";
import { composeReply, emptyDraft, openCount, replyHtml } from "@/lib/c-swarm-inbox";
import { Md, ProofPanel } from "./proof-panel";

const SHOWN = 3;
const LONG = 700;

const when = (iso: string): string => {
  const t = Date.parse(iso);
  if (!t) return "";
  return new Date(t).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
};

/** Select words in an agent's message or the spec and comment on them; the comment rides the next Send. */
function Commentable({
  children,
  onComment,
  label,
}: {
  children: React.ReactNode;
  onComment: (a: Annotation) => void;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pick, setPick] = useState<{ quote: string; x: number; y: number } | null>(null);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");

  const onMouseUp = () => {
    if (editing) return;
    const sel = window.getSelection();
    const quote = sel?.toString().trim() ?? "";
    if (!sel || !quote || quote.length < 3 || !ref.current?.contains(sel.anchorNode)) return setPick(null);
    const r = sel.getRangeAt(0).getBoundingClientRect();
    const box = ref.current.getBoundingClientRect();
    setPick({ quote, x: Math.min(r.left - box.left, box.width - 220), y: r.bottom - box.top + 4 });
  };
  const save = () => {
    if (pick && text.trim()) onComment({ quote: pick.quote, comment: text.trim() });
    setPick(null);
    setEditing(false);
    setText("");
    window.getSelection()?.removeAllRanges();
  };

  return (
    // selecting text is what opens the comment box; the passage itself stays plain text
    // oxlint-disable-next-line jsx_a11y/no-static-element-interactions
    <div ref={ref} className="relative" onMouseUp={onMouseUp} aria-label={label}>
      {children}
      {pick && (
        <div
          className="shadow-lg absolute z-20 w-[260px] rounded border border-subtle bg-surface-1 p-2"
          style={{ left: Math.max(0, pick.x), top: pick.y }}
        >
          {!editing ? (
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded bg-layer-2 px-2 py-1 text-12 text-primary hover:bg-layer-1"
                onClick={() => setEditing(true)}
              >
                💬 Comment
              </button>
              <button
                type="button"
                className="rounded bg-layer-2 px-2 py-1 text-12 text-primary hover:bg-layer-1"
                onClick={() => {
                  onComment({ quote: pick.quote, comment: "👍 Looks good." });
                  setPick(null);
                }}
              >
                👍
              </button>
              <button type="button" className="ml-auto text-12 text-tertiary" onClick={() => setPick(null)}>
                ✕
              </button>
            </div>
          ) : (
            <>
              <div className="mb-1 line-clamp-2 border-l-2 border-subtle pl-2 text-11 text-tertiary">{pick.quote}</div>
              <textarea
                ref={(el) => el?.focus()}
                rows={3}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
                  if (e.key === "Escape") setPick(null);
                }}
                placeholder="Your comment on this…"
                className="w-full rounded border border-subtle bg-layer-1 p-1.5 text-12 text-primary outline-none focus:border-accent-strong"
              />
              <div className="mt-1 flex justify-end gap-2">
                <button type="button" className="text-12 text-tertiary" onClick={() => setPick(null)}>
                  Cancel
                </button>
                <Button size="sm" variant="primary" disabled={!text.trim()} onClick={save}>
                  Add comment
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function QuestionCard({
  q,
  n,
  draft,
  setDraft,
}: {
  q: Question;
  n: number;
  draft: Draft;
  setDraft: (f: (d: Draft) => Draft) => void;
}) {
  const picked = draft.picks[q.id] ?? "";
  const answer = draft.answers[q.id] ?? "";
  const done = Boolean(picked || answer.trim());
  return (
    <div
      className={`rounded border p-3 ${done ? "border-success-subtle bg-success-subtle" : "border-subtle bg-layer-1"}`}
      role="group"
      aria-label={`Question ${n}`}
    >
      <div className="mb-2 flex items-start gap-2 text-13">
        <span className="font-mono text-11 text-tertiary">Q{n}</span>
        <span className="flex-1 font-medium text-primary">{q.text}</span>
        {done && <span className="text-11 text-success-primary">Picked · in your draft</span>}
      </div>
      {q.options.length > 0 && (
        <div className="flex flex-col gap-1">
          {q.options.map((o) => {
            const active = picked === o;
            return (
              <button
                key={o}
                type="button"
                aria-pressed={active}
                onClick={() => setDraft((d) => ({ ...d, picks: { ...d.picks, [q.id]: active ? "" : o } }))}
                className={`flex items-center gap-2 rounded border px-2.5 py-1.5 text-left text-13 ${
                  active
                    ? "border-accent-strong bg-accent-primary/10 text-primary"
                    : "border-subtle text-secondary hover:bg-layer-2"
                }`}
              >
                <span
                  className={`size-3 shrink-0 rounded-full border ${active ? "border-accent-strong bg-accent-primary" : "border-strong"}`}
                />
                <span className="flex-1">{o}</span>
                {q.recommended && (q.recommended === o || q.recommended.startsWith(o)) && (
                  <span className="rounded bg-layer-2 px-1.5 text-11 text-tertiary">recommended</span>
                )}
              </button>
            );
          })}
          {q.recommended && !q.options.some((o) => q.recommended === o || q.recommended.startsWith(o)) && (
            <div className="text-12 text-tertiary">Recommended: {q.recommended}</div>
          )}
        </div>
      )}
      <input
        value={answer}
        onChange={(e) => setDraft((d) => ({ ...d, answers: { ...d.answers, [q.id]: e.target.value } }))}
        placeholder={q.options.length ? "Or write your own answer…" : "Your answer…"}
        className="mt-2 w-full rounded border border-subtle bg-surface-1 px-2 py-1.5 text-13 text-primary outline-none focus:border-accent-strong"
      />
    </div>
  );
}

export function ThreadPane({
  thread,
  workspaceSlug,
  identifier,
  board,
  aside,
  onSent,
  onAside,
  onClose,
}: {
  thread: Thread;
  workspaceSlug: string;
  identifier: string;
  board: BoardPost[];
  aside: boolean;
  onSent: (patch: Partial<Thread>) => void;
  onAside: (on: boolean) => void;
  onClose: () => void;
}) {
  const { fetchProjectStates } = useProjectState();
  const DRAFT_KEY = `cswarm.inbox.draft.${thread.id}`;
  const [draft, setDraftState] = useState<Draft>(() => {
    try {
      return { ...emptyDraft(), ...JSON.parse(window.localStorage.getItem(DRAFT_KEY) || "{}") };
    } catch {
      return emptyDraft();
    }
  });
  const setDraft = useCallback(
    (f: (d: Draft) => Draft) =>
      setDraftState((d) => {
        const next = f(d);
        try {
          window.localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
        } catch {
          /* drafts just do not persist */
        }
        return next;
      }),
    [DRAFT_KEY]
  );
  const [busy, setBusy] = useState(false);
  const [guidance, setGuidance] = useState("");

  const stopped = thread.section === "stopped" || thread.section === "sent";
  const canReply = thread.plane_state === "Needs Direction";
  const reply = composeReply(thread, draft);
  const left = openCount(thread, draft);
  const mentions = board.filter((p) => p.ref === thread.ref).slice(-6);
  const workItemHref = identifier ? `/${workspaceSlug}/browse/${identifier}-${thread.seq}/` : "";

  const move = async (stateName: string, comment: string) => {
    const states = await fetchProjectStates(workspaceSlug, thread.project_id);
    const target = states?.find((s) => s.name.toLowerCase() === stateName.toLowerCase());
    if (!target) throw new Error(`no ${stateName} state`);
    if (comment.trim()) {
      await new IssueCommentService().createIssueComment(workspaceSlug, thread.project_id, thread.id, {
        comment_html: replyHtml(comment),
      });
    }
    await new IssueService().patchIssue(workspaceSlug, thread.project_id, thread.id, { state_id: target.id });
  };

  const act = async (what: () => Promise<void>, ok: string, patch: Partial<Thread>, message?: string) => {
    setBusy(true);
    try {
      await what();
      setToast({ type: TOAST_TYPE.SUCCESS, title: ok, message });
      onSent(patch);
    } catch {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "That did not go through",
        message: "Plane rejected the change. Nothing was sent.",
      });
    } finally {
      setBusy(false);
    }
  };

  const send = () =>
    act(
      async () => {
        await move("Todo", reply);
        setDraft(() => emptyDraft());
      },
      reply === "approve" ? `${thread.ref} spec approved` : `Reply sent to ${thread.ref}`,
      { section: "sent", plane_state: "Todo", reason: "You answered; the factory picks it up on its next poll." },
      "The factory picks it up on its next poll."
    );

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canReply && reply && !busy) {
        e.preventDefault();
        void send();
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  // The factory's message that asked is folded when its questions are already cards below it.
  const lastFactory = thread.messages.map((m) => m.who).lastIndexOf("factory");
  const asked = canReply && thread.questions.length > 0 && thread.kind !== "spec" ? lastFactory : -1;
  const [showAsked, setShowAsked] = useState(false);
  // The proof comment says what the Proof of work panel below already shows in full.
  const proofMsg = thread.proof
    ? thread.messages.findIndex((m) => m.who === "factory" && m.text.includes("Proof of work"))
    : -1;
  // Like an email thread: the last few messages, the rest one click away; long ones folded.
  const [allMessages, setAllMessages] = useState(false);
  const [opened, setOpened] = useState<Record<number, boolean>>({});
  const hidden = allMessages ? 0 : Math.max(0, thread.messages.length - SHOWN);

  const addNote = (a: Annotation) => setDraft((d) => ({ ...d, notes: [...d.notes, a] }));

  return (
    <section
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface-1"
      aria-label={`Thread ${thread.ref}`}
    >
      <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 border-b border-subtle px-5 py-3">
        <div className="min-w-0 flex-1 basis-72">
          <div className="font-mono text-12 text-tertiary">
            {thread.project} · {thread.ref} · {thread.plane_state}
            {thread.cost > 0 && ` · $${thread.cost.toFixed(2)}`}
            {thread.rounds > 0 && ` · ${thread.rounds} round${thread.rounds === 1 ? "" : "s"}`}
          </div>
          <h2 className="mt-0.5 line-clamp-2 text-16 font-semibold text-primary" title={thread.name}>
            {thread.name}
          </h2>
          <div className="mt-1 text-13 text-secondary">{thread.reason}</div>
          {thread.holds.length > 0 && (
            <div className="mt-1 text-12 text-warning-primary">
              Holds up {thread.holds.join(", ")}: they start once this is settled.
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {thread.pr_url && (
            <a
              href={thread.pr_url}
              target="_blank"
              rel="noreferrer"
              className="text-12 text-accent-primary hover:underline"
            >
              PR #{thread.pr_number}
            </a>
          )}
          {workItemHref && (
            <Link to={workItemHref} className="text-12 text-accent-primary hover:underline">
              Open in Plane
            </Link>
          )}
          <Button variant="secondary" size="sm" onClick={() => onAside(!aside)}>
            {aside ? "Put back" : "Set aside"}
          </Button>
          <button
            type="button"
            onClick={onClose}
            className="text-tertiary hover:text-primary"
            aria-label="Close thread"
          >
            ✕
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {thread.messages.length > 0 && (
            <ol className="flex flex-col gap-3" aria-label="Conversation">
              {hidden > 0 && (
                <li>
                  <button type="button" className="text-12 text-accent-primary" onClick={() => setAllMessages(true)}>
                    Show {hidden} earlier message{hidden === 1 ? "" : "s"}
                  </button>
                </li>
              )}
              {thread.messages.map((m, i) =>
                i < hidden ? null : (
                  <li
                    key={`${m.at}-${m.who}`}
                    className={`rounded-lg border p-3 ${m.who === "human" ? "ml-10 border-accent-strong/30 bg-accent-primary/5" : "border-subtle bg-layer-1"}`}
                  >
                    <div className="mb-1 flex justify-between text-11 text-tertiary">
                      <span className="font-medium">{m.who === "human" ? "A person" : "Factory"}</span>
                      <span>{when(m.at)}</span>
                    </div>
                    {i === proofMsg ? (
                      <div className="text-13 text-secondary">📋 Proof of work: in full below.</div>
                    ) : m.who === "factory" && canReply ? (
                      <Commentable onComment={addNote} label="Factory message">
                        <Md text={m.text} className={i === asked && !showAsked ? "line-clamp-4" : ""} />
                      </Commentable>
                    ) : (
                      <Md text={m.text} className={m.text.length > LONG && !opened[i] ? "line-clamp-6" : ""} />
                    )}
                    {m.text.length > LONG && i !== asked && i !== proofMsg && (
                      <button
                        type="button"
                        className="mt-1 text-12 text-accent-primary"
                        onClick={() => setOpened((o) => ({ ...o, [i]: !o[i] }))}
                      >
                        {opened[i] ? "Show less" : "Show more"}
                      </button>
                    )}
                    {i === asked && (
                      <button
                        type="button"
                        className="mt-1 text-12 text-accent-primary"
                        onClick={() => setShowAsked((v) => !v)}
                      >
                        {showAsked ? "Fold it: the questions are below" : "Show the whole message"}
                      </button>
                    )}
                  </li>
                )
              )}
            </ol>
          )}

          {thread.spec && (
            <section className="rounded border border-subtle" aria-label="Spec for review">
              <h4 className="flex items-center justify-between border-b border-subtle px-3 py-2 text-12 font-semibold text-tertiary uppercase">
                Spec for review
                <span className="font-normal normal-case">Select any words to comment on them</span>
              </h4>
              <div className="max-h-[28rem] overflow-y-auto p-3">
                <Commentable onComment={addNote} label="Spec">
                  <Md text={thread.spec} />
                </Commentable>
              </div>
            </section>
          )}

          {thread.questions.length > 0 && canReply && (
            <section className="flex flex-col gap-2" aria-label="Questions">
              <h4 className="text-12 font-semibold text-tertiary uppercase">
                {thread.kind === "spec" ? "Design questions only you can settle" : "Questions"}
              </h4>
              {thread.questions.map((q, n) => (
                <QuestionCard key={q.id} q={q} n={n + 1} draft={draft} setDraft={setDraft} />
              ))}
            </section>
          )}

          {thread.actions.map((a) => (
            <section
              key={a.id}
              className="rounded border border-warning-subtle bg-warning-subtle p-3"
              aria-label="Action item"
            >
              <div className="text-11 font-semibold text-warning-primary uppercase">Action item</div>
              <div className="mt-1 text-14 font-medium text-primary">{a.title}</div>
              <div className="text-13 text-secondary">{a.why}</div>
              {thread.error && a.kind === "retry" && (
                <pre className="font-mono mt-2 max-h-40 overflow-auto rounded bg-layer-1 p-2 text-11 whitespace-pre-wrap text-warning-primary">
                  {thread.error}
                </pre>
              )}
              {a.kind === "retry" && (
                <textarea
                  value={guidance}
                  onChange={(e) => setGuidance(e.target.value)}
                  rows={2}
                  placeholder="Optional guidance for the next try…"
                  className="mt-2 w-full rounded border border-subtle bg-surface-1 p-2 text-13 text-primary outline-none focus:border-accent-strong"
                />
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                {a.url && (
                  <a href={a.url} target="_blank" rel="noreferrer">
                    <Button variant="primary" size="sm">
                      Open the pull request
                    </Button>
                  </a>
                )}
                {a.kind === "merge" && (
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      act(
                        () => move("Done", "Merged by a person from the Agent inbox."),
                        `${thread.ref} marked merged`,
                        { section: "done", plane_state: "Done" }
                      )
                    }
                  >
                    Done, I merged it
                  </Button>
                )}
                {a.kind === "retry" && (
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      act(
                        () => move("Todo", guidance.trim() ? `Retry: ${guidance.trim()}` : ""),
                        `${thread.ref} sent back to the factory`,
                        {
                          section: "sent",
                          plane_state: "Todo",
                          reason: "Queued for another try.",
                        }
                      )
                    }
                  >
                    Retry
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    act(() => move("Cancelled", "Cancelled from the Agent inbox."), `${thread.ref} cancelled`, {
                      plane_state: "Cancelled",
                    })
                  }
                >
                  {a.kind === "merge" ? "Can't merge: cancel it" : "Cancel the ticket"}
                </Button>
              </div>
            </section>
          ))}

          {thread.proof && <ProofPanel thread={thread} proof={thread.proof} />}

          {mentions.length > 0 && (
            <section aria-label="Message board posts about this item">
              <h4 className="mb-1 text-12 font-semibold text-tertiary uppercase">
                Agents on the message board about {thread.ref}
              </h4>
              <ul className="flex flex-col gap-1">
                {mentions.map((p) => (
                  <li key={`${p.ts}-${p.role}`} className="rounded bg-layer-1 p-2 text-13">
                    <span className="font-mono text-11 text-tertiary">{p.role}</span>
                    <div className="whitespace-pre-wrap text-primary">{p.text}</div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>

      {canReply && (
        <footer className="border-t border-subtle px-5 py-3" aria-label="Reply">
          <div className="mx-auto max-w-3xl">
            {draft.notes.length > 0 && (
              <ul className="mb-2 flex flex-wrap gap-1" aria-label="Your comments">
                {draft.notes.map((a, i) => (
                  <li
                    key={`${a.quote}-${a.comment}`}
                    className="flex max-w-xs items-center gap-1 rounded bg-layer-1 px-2 py-1 text-12"
                  >
                    <span className="truncate text-tertiary">“{a.quote}”</span>
                    <span className="truncate text-primary">{a.comment}</span>
                    <button
                      type="button"
                      className="text-tertiary hover:text-primary"
                      aria-label="Remove comment"
                      onClick={() => setDraft((d) => ({ ...d, notes: d.notes.filter((_, j) => j !== i) }))}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <textarea
              value={draft.text}
              onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))}
              rows={3}
              placeholder={
                thread.kind === "spec"
                  ? "Anything else the spec should change (leave empty to approve)…"
                  : "Anything else the agent should know…"
              }
              className="w-full rounded border border-subtle bg-layer-1 p-2 text-13 text-primary outline-none focus:border-accent-strong"
              aria-label="Reply text"
            />
            <div className="mt-2 flex items-center gap-3">
              <span className="flex-1 text-12 text-tertiary">
                {thread.kind === "spec"
                  ? reply === "approve"
                    ? "Sending approves the spec and every recommendation."
                    : `Goes back to the spec agent as final decisions${left ? `; ${left} unpicked question${left === 1 ? " takes its" : "s take their"} recommendation` : ""}.`
                  : left
                    ? `${left} question${left === 1 ? "" : "s"} still open.`
                    : "Every question answered."}{" "}
                ⌘↵ sends.
              </span>
              {stopped && (
                <Button variant="primary" size="sm" disabled={busy || !reply} onClick={send}>
                  {busy ? "Sending…" : reply === "approve" ? "Approve spec" : "Send reply"}
                </Button>
              )}
            </div>
          </div>
        </footer>
      )}
    </section>
  );
}
