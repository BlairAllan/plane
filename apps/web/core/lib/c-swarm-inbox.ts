/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

/**
 * The c-swarm Agent inbox: what the factory's agents need from a person, one thread per work item.
 *
 * The board server builds the threads (GET /inbox.json). Answers go back through Plane itself, as a
 * comment plus a move to Todo, which is how the factory has always been steered; the board only
 * takes message-board posts. What this viewer has looked at is kept in localStorage, per browser,
 * the way an email client keeps read state.
 */

import { boardFetch } from "@/lib/c-swarm-board";

export type Question = {
  id: string;
  text: string;
  options: string[];
  recommended: string;
  source: "design" | "triage" | "agent";
};
export type Action = { id: string; kind: "merge" | "retry"; title: string; why: string; url: string };
export type Message = { who: "factory" | "human"; at: string; text: string };
export type Artifact = {
  path: string;
  name: string;
  role: string;
  round: string;
  kind: "image" | "video" | "text";
  bytes: number;
};
export type Judge = { role: string; passed: boolean; summary: string; evidence: string[] };
export type Proof = {
  round: number;
  pr_url: string;
  suite: { command: string; passed: boolean; result: string; output: string };
  base_tests: string;
  changed: string[];
  judges: Judge[];
  deviations: string[];
  artifacts: Artifact[];
};
export type Section = "stopped" | "holding" | "waiting" | "sent" | "done";
export type Thread = {
  id: string;
  project_id: string;
  project: string;
  ref: string;
  seq: number;
  name: string;
  plane_state: string;
  pr_url: string;
  pr_number: number | null;
  cost: number;
  rounds: number;
  updated_at: string;
  holds: string[];
  questions: Question[];
  actions: Action[];
  spec: string;
  messages: Message[];
  proof: Proof | null;
  error: string;
  section: Section;
  kind: "spec" | "question" | "merge" | "failed" | "proof";
  reason: string;
};
export type BoardPost = { ts: number; role: string; ref?: string; text: string };
export type InboxResponse = {
  threads: Thread[];
  boards: Record<string, BoardPost[]>;
  projects: { id: string; name: string }[];
  /** Tickets whose comments the factory has not fetched yet (a big workspace fills in over a few polls). */
  loading?: number;
};

// The page and every sidebar badge poll this; callers within a couple of seconds share one request.
let shared: { at: number; p: Promise<InboxResponse> } | null = null;

export function fetchInbox(): Promise<InboxResponse> {
  if (shared && Date.now() - shared.at < 2000) return shared.p;
  const p = boardFetch("/inbox.json", { cache: "no-store" }).then((r) => {
    if (!r.ok) throw new Error(`inbox ${r.status}`);
    return r.json() as Promise<InboxResponse>;
  });
  shared = { at: Date.now(), p };
  p.catch(() => {
    if (shared?.p === p) shared = null;
  });
  return p;
}

export async function postToBoard(projectId: string, text: string, author: string, ref = ""): Promise<void> {
  const r = await boardFetch(`/inbox/board/${projectId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, author, ref }),
  });
  if (!r.ok) throw new Error(`board ${r.status}`);
}

export const proofUrl = (t: Thread, a: Artifact): string =>
  `/runs/${encodeURIComponent(t.project)}/${t.seq}/proof/${a.path.split("/").map(encodeURIComponent).join("/")}`;

/** Threads that need this person now: what the sidebar badge counts. */
export const needsYou = (t: Thread): boolean =>
  t.section === "stopped" || t.section === "holding" || t.section === "waiting";

// ---- per-viewer read state --------------------------------------------------

const SEEN_KEY = "cswarm.inbox.seen";
const ASIDE_KEY = "cswarm.inbox.aside";

function readMap(key: string): Record<string, string> {
  try {
    return JSON.parse(window.localStorage.getItem(key) || "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

function writeMap(key: string, value: Record<string, string>): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage blocked: read state just does not persist */
  }
}

export const readSeen = () => readMap(SEEN_KEY);
export const readAside = () => readMap(ASIDE_KEY);
export const markSeen = (t: Thread) => writeMap(SEEN_KEY, { ...readSeen(), [t.id]: t.updated_at });
export const setAside = (t: Thread) => writeMap(ASIDE_KEY, { ...readAside(), [t.id]: t.updated_at });
export const unsetAside = (t: Thread) => {
  const m = readAside();
  delete m[t.id];
  writeMap(ASIDE_KEY, m);
};

/** The section this viewer sees: done work they have looked at, and anything set aside, goes quiet until it changes. */
export type View = "stopped" | "holding" | "waiting" | "new" | "sent" | "quiet";
export function viewOf(t: Thread, seen: Record<string, string>, aside: Record<string, string>): View {
  if (aside[t.id] && aside[t.id] >= t.updated_at) return "quiet";
  if (t.section === "done") return seen[t.id] && seen[t.id] >= t.updated_at ? "quiet" : "new";
  return t.section;
}

export const VIEWS: { key: View; title: string; hint: string }[] = [
  { key: "stopped", title: "Stopped on you", hint: "An agent is parked until you answer." },
  { key: "holding", title: "Holding up work", hint: "Other tickets wait on these." },
  { key: "waiting", title: "Waiting on you", hint: "Something only a person can do." },
  { key: "new", title: "New since you looked", hint: "Finished work with proof to check." },
  { key: "sent", title: "Sent", hint: "You replied; the agent has not picked it up yet." },
  { key: "quiet", title: "Quiet", hint: "Read, or set aside." },
];

// ---- composing a reply --------------------------------------------------------

export type Annotation = { quote: string; comment: string };
export type Draft = {
  picks: Record<string, string>;
  answers: Record<string, string>;
  text: string;
  notes: Annotation[];
};
export const emptyDraft = (): Draft => ({ picks: {}, answers: {}, text: "", notes: [] });

/** How many questions on the thread the draft leaves open. */
export function openCount(t: Thread, d: Draft): number {
  return t.questions.filter((q) => !(d.picks[q.id] || d.answers[q.id]?.trim())).length;
}

/**
 * One reply carrying every pick, answer, comment and the free text, in the words the factory reads.
 *
 * A spec reply that changes nothing is the word "approve", which accepts every recommendation; any
 * other reply goes back to the spec agent as final decisions (stages.py). Quoted comments use the
 * `> quote` form the factory anchors to the spec's blocks.
 */
export function composeReply(t: Thread, d: Draft): string {
  const parts: string[] = [];
  const changed = t.questions.some((q) => d.picks[q.id] && d.picks[q.id] !== q.recommended);
  const answered = t.questions.filter((q) => d.picks[q.id] || d.answers[q.id]?.trim());
  if (t.kind === "spec") {
    if (!changed && !d.text.trim() && d.notes.length === 0 && !Object.values(d.answers).some((a) => a.trim()))
      return "approve";
    if (t.questions.length) {
      parts.push(
        "Design decisions:\n" +
          t.questions
            .map((q, n) => {
              const pick =
                d.picks[q.id] ||
                d.answers[q.id]?.trim() ||
                (q.recommended ? `${q.recommended} (your recommendation)` : "");
              return `${n + 1}. ${q.text}\n   → ${pick || "no decision; ask again if it matters"}`;
            })
            .join("\n")
      );
    }
  } else if (answered.length) {
    parts.push(
      "Answers:\n" +
        answered.map((q, n) => `${n + 1}. ${q.text}\n   → ${d.picks[q.id] || d.answers[q.id].trim()}`).join("\n")
    );
  }
  for (const a of d.notes)
    parts.push(
      `${a.quote
        .split("\n")
        .map((l) => `> ${l}`)
        .join("\n")}\n\n${a.comment.trim()}`
    );
  if (d.text.trim()) parts.push(d.text.trim());
  return parts.join("\n\n");
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Plane stores comment bodies as HTML; keep the reply's lines and quotes readable there. */
export function replyHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((block) =>
      block.startsWith("> ")
        ? `<blockquote><p>${block
            .split("\n")
            .map((l) => esc(l.replace(/^> ?/, "")))
            .join("<br/>")}</p></blockquote>`
        : `<p>${block.split("\n").map(esc).join("<br/>")}</p>`
    )
    .join("");
}
