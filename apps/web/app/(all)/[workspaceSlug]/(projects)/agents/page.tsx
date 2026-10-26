/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { observer } from "mobx-react";
import { Link } from "react-router";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { BoardConnection } from "@/components/agents/board-connection";
import { LiveOutput } from "@/components/agents/live-output";
import { PageHead } from "@/components/core/page-title";
import { usePoll } from "@/hooks/use-poll";
import { boardConfigured, boardJson, boardUrl } from "@/lib/c-swarm-board";
import { useProject } from "@/hooks/store/use-project";
import { useProjectState } from "@/hooks/store/use-project-state";
import { IssueCommentService, IssueLabelService, IssueService } from "@/services/issue";
import type { Route } from "./+types/page";

type Finding = { round: number; judge: string; text: string; state: string };
type Run = {
  id: string;
  ref: string;
  name: string;
  bucket: string;
  phase: string;
  cost: number;
  rounds: number;
  pr_url: string;
  pr_number: number | null;
  error: string;
  findings: Finding[];
  open_findings: number;
  updated_at: string;
  project_id: string;
  project: string;
  parent_id: string;
  is_epic: boolean;
  started_at: string;
  merged: boolean;
  branch: string;
  human_answered: boolean;
  plane_state: string;
  question?: string;
};
type RunsResponse = { runs: Run[]; spent: number; cap: number };
type Post = { ts: number; role: string; ref?: string; text: string };
type Infra = { notes: Record<string, { ts: number; role: string; text: string }[]>; boards: Record<string, Post[]> };

type Status =
  | "Blocked"
  | "Cancelled"
  | "Building"
  | "Active"
  | "Needs attention"
  | "Ready for review"
  | "Merged"
  | "Failed"
  | "Queued";

const STATUS_STYLE: Record<Status, { color: string; pulse?: boolean }> = {
  Building: { color: "#3b82f6", pulse: true },
  Cancelled: { color: "#525252" },
  Blocked: { color: "#ef4444" },
  Active: { color: "#3b82f6", pulse: true },
  "Needs attention": { color: "#f59e0b" },
  "Ready for review": { color: "#a855f7" },
  Merged: { color: "#22c55e" },
  Failed: { color: "#ef4444" },
  Queued: { color: "#737373" },
};

function Dot({ status }: { status: Status }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      className={`inline-block size-2 shrink-0 rounded-full ${s.pulse ? "animate-pulse" : ""}`}
      style={{ background: s.color }}
    />
  );
}

const statusOf = (r: Run): Status => {
  if (r.merged) return "Merged";
  if (r.phase === "cancelled") return "Cancelled";
  if (r.phase === "failed" || r.phase === "crashed") return "Failed";
  if (r.plane_state === "Blocked") return "Blocked";
  if (r.bucket === "Needs attention") return "Needs attention";
  if (r.bucket === "Active") return r.is_epic && r.phase === "building" ? "Building" : "Active";
  if (r.bucket === "Ready for review") return "Ready for review";
  return "Queued";
};

const TABS = ["All", "Needs attention", "Active", "Failed", "Merged"] as const;
type Tab = (typeof TABS)[number];

const ago = (iso: string): string => {
  const t = Date.parse(iso);
  if (!t) return "";
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

const seqOf = (ref: string): string => ref.replace("#", "");

function StatusChip({ status }: { status: Status }) {
  const c = STATUS_STYLE[status].color;
  return (
    <span
      className="inline-flex w-[124px] shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-11 font-medium"
      style={{ background: `${c}26`, color: c }}
    >
      <Dot status={status} />
      {status}
    </span>
  );
}

function Chip({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <span title={title} className="font-mono rounded bg-layer-1 px-1.5 py-0.5 text-11 text-tertiary">
      {children}
    </span>
  );
}

function RunRow({
  run,
  depth,
  selected,
  onSelect,
  kids,
  expanded,
  onToggle,
}: {
  run: Run;
  depth: number;
  selected: boolean;
  onSelect: () => void;
  kids: Run[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const status = statusOf(run);
  const done = kids.filter((k) => k.merged || k.plane_state === "Done").length;
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <div
      // a row, not a <button>: it holds the epic's expand button
      // oxlint-disable-next-line jsx_a11y/prefer-tag-over-role
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`flex cursor-pointer items-center gap-3 border-b border-subtle px-4 py-2 text-13 hover:bg-layer-1 ${
        selected ? "bg-layer-1" : ""
      }`}
      style={{ paddingLeft: 16 + depth * 24 }}
    >
      {run.is_epic ? (
        <button
          type="button"
          className="w-4 text-tertiary"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
        >
          {expanded ? "▾" : "▸"}
        </button>
      ) : (
        <span className="w-4" />
      )}
      <span className="font-mono w-12 shrink-0 text-12 text-tertiary">{run.ref}</span>
      <span className="min-w-[14rem] flex-1 truncate text-primary" title={run.name}>
        {run.name}
      </span>
      {run.is_epic && kids.length > 0 && (
        <span className="hidden w-36 shrink-0 items-center gap-2 text-11 text-tertiary xl:flex">
          <span className="h-1.5 flex-1 overflow-hidden rounded bg-layer-2">
            <span
              className="block h-full bg-success-primary"
              style={{ width: `${status === "Merged" ? 100 : (done / kids.length) * 100}%` }}
            />
          </span>
          {status === "Merged" ? kids.length : done}/{kids.length} merged
        </span>
      )}
      <span className="w-24 shrink-0 truncate">
        <Chip>{run.project}</Chip>
      </span>
      <span className="hidden w-24 shrink-0 2xl:block">
        <Chip title="source">{run.is_epic ? "epic" : run.parent_id ? "epic task" : "work item"}</Chip>
      </span>
      <StatusChip status={status} />
      <span className="w-2 shrink-0" title={status === "Active" && !run.is_epic ? "live output" : undefined}>
        {status === "Active" && !run.is_epic && (
          <span className="inline-block size-1.5 animate-pulse rounded-full bg-success-primary" />
        )}
      </span>
      <span className="font-mono hidden w-14 shrink-0 text-right text-12 text-tertiary 2xl:block">
        {run.rounds ? `${run.rounds} rd` : ""}
      </span>
      <span className="font-mono w-14 shrink-0 text-right text-12 text-secondary">${run.cost.toFixed(2)}</span>
      {run.pr_url ? (
        <a
          href={run.pr_url}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="font-mono w-12 shrink-0 text-12 text-accent-primary hover:underline"
        >
          PR #{run.pr_number}
        </a>
      ) : (
        <span className="w-12 shrink-0" />
      )}
      <span className="w-16 shrink-0 text-right text-12 text-tertiary" suppressHydrationWarning>
        {mounted ? ago(run.updated_at) : ""}
      </span>
    </div>
  );
}

function Post({ p }: { p: { role: string; ref?: string; text: string } }) {
  const [full, setFull] = useState(false);
  const long = p.text.length > 220;
  return (
    <li className="rounded bg-layer-1 p-2">
      <span className="font-mono text-11 text-tertiary">
        {p.role}
        {p.ref ? ` · ${p.ref}` : ""}
      </span>
      <div className={`whitespace-pre-wrap ${full ? "" : "line-clamp-4"}`}>{p.text}</div>
      {long && (
        <button type="button" onClick={() => setFull((f) => !f)} className="mt-1 text-11 text-accent-primary">
          {full ? "Show less" : "Show more"}
        </button>
      )}
    </li>
  );
}

function DetailPane({
  run,
  workspaceSlug,
  infra,
  identifier,
  onClose,
  onChanged,
  onOptimistic,
}: {
  run: Run;
  workspaceSlug: string;
  infra: Infra | null;
  identifier: string;
  onClose: () => void;
  onChanged: () => void;
  onOptimistic: (patch: Partial<Run> | null) => void;
}) {
  const { fetchProjectStates } = useProjectState();
  const [note, setNote] = useState("");
  const [acting, setActing] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  useEffect(() => {
    if (!confirmCancel) return;
    const t = setTimeout(() => setConfirmCancel(false), 4000);
    return () => clearTimeout(t);
  }, [confirmCancel]);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const status = statusOf(run);
  const board = (infra?.boards?.[run.project_id] ?? []).slice(-12);
  board.reverse(); // a copy from slice; newest first
  const notes = infra?.notes?.[`${run.project_id}:${seqOf(run.ref)}`] ?? [];
  const workItemHref = identifier ? `/${workspaceSlug}/browse/${identifier}-${seqOf(run.ref)}/` : "";

  const state = run.plane_state;
  const retried = state === "Todo" && !run.merged && !run.is_epic && status !== "Merged";
  const canRetry =
    !run.merged &&
    !run.is_epic &&
    (run.bucket === "Needs attention" || state === "Backlog" || state === "Cancelled" || state === "Blocked");
  const showRetry = canRetry || retried;
  const needsAnswer = state === "Needs Direction";
  const canCancel = !run.merged && state !== "Done" && state !== "Cancelled";
  const showBox = showRetry || needsAnswer || canCancel;

  const moveTo = async (stateName: string, withComment: string) => {
    setActing(true);
    onOptimistic(
      stateName === "Cancelled"
        ? { plane_state: "Cancelled", bucket: "Idle", phase: "cancelled", error: "", question: "" }
        : { plane_state: "Todo", bucket: "Waiting", phase: "queued", error: "", question: "" }
    );
    try {
      const states = await fetchProjectStates(workspaceSlug, run.project_id);
      const target = states?.find((x) => x.name.toLowerCase() === stateName.toLowerCase());
      if (!target) throw new Error(`no ${stateName} state`);
      if (withComment.trim()) {
        await new IssueCommentService().createIssueComment(workspaceSlug, run.project_id, run.id, {
          comment_html: `<p>${withComment.trim().replace(/</g, "&lt;")}</p>`,
        });
      }
      await new IssueService().patchIssue(workspaceSlug, run.project_id, run.id, { state_id: target.id });
      setNote("");
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: stateName === "Cancelled" ? `${run.ref} cancelled` : `${run.ref} sent back to the factory`,
        message: stateName === "Todo" ? "It is queued and will be picked up on the next poll." : undefined,
      });
      onChanged();
    } catch {
      onOptimistic(null);
      setToast({ type: TOAST_TYPE.ERROR, title: "Action failed", message: "Plane rejected the change." });
    } finally {
      setActing(false);
    }
  };

  const send = async () => {
    if (!comment.trim()) return;
    setSending(true);
    try {
      await new IssueCommentService().createIssueComment(workspaceSlug, run.project_id, run.id, {
        comment_html: `<p>${comment.replace(/</g, "&lt;")}</p>`,
      });
      setComment("");
      setToast({ type: TOAST_TYPE.SUCCESS, title: "Comment added", message: "The factory reads it on its next poll." });
      onChanged();
    } catch {
      setToast({ type: TOAST_TYPE.ERROR, title: "Could not comment", message: "Plane rejected the comment." });
    } finally {
      setSending(false);
    }
  };

  return (
    <aside className="flex h-full w-[440px] shrink-0 flex-col overflow-y-auto border-l border-subtle bg-surface-1">
      <div className="flex items-start justify-between gap-2 border-b border-subtle p-4">
        <div className="min-w-0">
          <div className="font-mono text-12 text-tertiary">
            {run.project} · {run.ref}
          </div>
          <div className="text-15 mt-1 font-semibold text-primary">{run.name}</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusChip status={status} />
            <Chip>{run.phase}</Chip>
            <Chip>${run.cost.toFixed(2)}</Chip>
            {run.rounds > 0 && <Chip>{run.rounds} rounds</Chip>}
            {run.human_answered && <Chip>human answered</Chip>}
          </div>
        </div>
        <button type="button" onClick={onClose} className="text-tertiary hover:text-primary">
          ✕
        </button>
      </div>

      <div className="flex flex-col gap-4 p-4 text-13">
        <div className="flex flex-col gap-1">
          {run.pr_url && (
            <a href={run.pr_url} target="_blank" rel="noreferrer" className="text-accent-primary hover:underline">
              Pull request #{run.pr_number}
            </a>
          )}
          {run.branch && <div className="font-mono truncate text-12 text-tertiary">{run.branch}</div>}
          {workItemHref && (
            <Link to={workItemHref} className="text-accent-primary hover:underline">
              Open work item in Plane
            </Link>
          )}
        </div>

        <LiveOutput
          project={run.project}
          seq={seqOf(run.ref)}
          polling={
            status === "Active" ||
            status === "Ready for review" ||
            run.plane_state === "In Progress" ||
            run.plane_state === "In Review"
          }
        />

        {run.error && (
          <section>
            <h4 className="mb-1 text-12 font-semibold text-tertiary uppercase">Needs attention</h4>
            <pre className="font-mono rounded bg-warning-subtle p-2 text-12 whitespace-pre-wrap text-warning-primary">
              {run.error}
            </pre>
          </section>
        )}

        <section>
          <h4 className="mb-1 text-12 font-semibold text-tertiary uppercase">
            Review findings ({run.open_findings} open)
          </h4>
          {run.findings.length === 0 ? (
            <div className="text-tertiary">None.</div>
          ) : (
            <ul className="flex flex-col gap-1">
              {run.findings.map((f) => (
                <li key={`${f.round}-${f.judge}-${f.text}`} className="flex gap-2 rounded bg-layer-1 p-2">
                  <span className={f.state === "open" ? "text-warning-primary" : "text-success-primary"}>
                    {f.state === "open" ? "●" : "✓"}
                  </span>
                  <span className="flex-1">
                    <span className="font-mono text-11 text-tertiary">
                      round {f.round} · {f.judge}
                    </span>
                    <br />
                    {f.text}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {notes.length > 0 && (
          <section>
            <h4 className="mb-1 text-12 font-semibold text-tertiary uppercase">Agent notes</h4>
            <ul className="flex flex-col gap-1">
              {notes.slice(-8).map((n) => (
                <li key={`${n.ts}-${n.role}`} className="rounded bg-layer-1 p-2">
                  <span className="font-mono text-11 text-tertiary">{n.role}</span> {n.text}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h4 className="mb-1 text-12 font-semibold text-tertiary uppercase">Project message board</h4>
          {board.length === 0 ? (
            <div className="text-tertiary">No posts yet.</div>
          ) : (
            <ul className="flex flex-col gap-1">
              {board.map((p) => (
                <Post key={`${p.ts}-${p.role}`} p={p} />
              ))}
            </ul>
          )}
        </section>

        {showBox && (
          <section className="rounded border border-subtle p-3">
            <h4 className="mb-1 text-12 font-semibold text-tertiary uppercase">
              {needsAnswer ? "The factory is asking" : "Actions"}
            </h4>
            {needsAnswer && run.question && (
              <div className="mb-2 max-h-64 overflow-y-auto rounded bg-layer-1 p-2 text-13 whitespace-pre-wrap text-primary">
                {run.question}
              </div>
            )}
            {(showRetry || needsAnswer) && (
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder={needsAnswer ? "Your answer…" : "Optional guidance for the retry…"}
                className="w-full rounded border border-subtle bg-layer-1 p-2 text-13 text-primary outline-none focus:border-accent-strong"
              />
            )}
            {(showRetry || needsAnswer) && (
              <div className="mt-2 flex h-8 items-center justify-end gap-2">
                {needsAnswer && (
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={acting || !note.trim()}
                    onClick={() => moveTo("Todo", note)}
                  >
                    {acting ? "Working…" : "Send answer"}
                  </Button>
                )}
                {showRetry && !needsAnswer && (
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={acting || retried}
                    onClick={() => moveTo("Todo", note.trim() ? `Retry: ${note.trim()}` : "")}
                  >
                    {acting ? "Working…" : retried ? "Queued" : "Retry"}
                  </Button>
                )}
              </div>
            )}
            {canCancel && (
              <div className="mt-3 flex h-7 items-center gap-3 border-t border-subtle pt-3 text-12">
                {confirmCancel ? (
                  <>
                    <span className="text-tertiary">Cancel {run.ref}?</span>
                    <button
                      type="button"
                      disabled={acting}
                      className="text-danger-primary hover:underline"
                      onClick={() => {
                        setConfirmCancel(false);
                        void moveTo("Cancelled", "");
                      }}
                    >
                      Yes, cancel it
                    </button>
                    <button
                      type="button"
                      className="text-tertiary hover:underline"
                      onClick={() => setConfirmCancel(false)}
                    >
                      Keep
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={acting}
                    className="text-tertiary hover:text-primary hover:underline"
                    onClick={() => setConfirmCancel(true)}
                  >
                    Cancel run…
                  </button>
                )}
              </div>
            )}
          </section>
        )}

        <section>
          <h4 className="mb-1 text-12 font-semibold text-tertiary uppercase">Steer</h4>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder="Answer a question, or write “Retry: …” and move the item to Todo"
            className="w-full rounded border border-subtle bg-layer-1 p-2 text-13 text-primary outline-none focus:border-accent-strong"
          />
          <div className="mt-2 flex justify-end">
            <Button variant="primary" size="sm" onClick={send} disabled={sending || !comment.trim()}>
              Add comment
            </Button>
          </div>
        </section>
      </div>
    </aside>
  );
}

const LAST_PROJECT_KEY = "agents:last-project";

function NewRunDialog({
  workspaceSlug,
  recentProjectId,
  onClose,
  onCreated,
}: {
  workspaceSlug: string;
  recentProjectId: string;
  onClose: () => void;
  onCreated: (projectName: string) => void;
}) {
  const { joinedProjectIds, getProjectById } = useProject();
  const { fetchProjectStates } = useProjectState();
  const [projectId, setProjectId] = useState(() => {
    try {
      const last = localStorage.getItem(LAST_PROJECT_KEY);
      if (last && joinedProjectIds.includes(last)) return last;
    } catch {
      /* storage unavailable */
    }
    if (recentProjectId && joinedProjectIds.includes(recentProjectId)) return recentProjectId;
    return joinedProjectIds[0] ?? "";
  });
  const [goal, setGoal] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const remember = (id: string) => {
    try {
      localStorage.setItem(LAST_PROJECT_KEY, id);
    } catch {
      /* storage unavailable */
    }
  };

  const submit = async () => {
    if (!projectId || !goal.trim()) return;
    setBusy(true);
    setError("");
    remember(projectId);
    try {
      const labels = new IssueLabelService();
      const existing = await labels.getProjectLabels(workspaceSlug, projectId);
      const label =
        existing.find((l) => l.name.toLowerCase() === "epic") ??
        (await labels.createIssueLabel(workspaceSlug, projectId, { name: "epic", color: "#8b5cf6" }));
      const states = await fetchProjectStates(workspaceSlug, projectId);
      const todo = states?.find((s) => s.name.toLowerCase() === "todo");
      const [first, ...rest] = goal.trim().split("\n");
      await new IssueService().createIssue(workspaceSlug, projectId, {
        name: first.slice(0, 250),
        description_html: rest.length
          ? `<p>${rest.join("</p><p>").replace(/<(?!\/?p>)/g, "&lt;")}</p>`
          : `<p>${first}</p>`,
        label_ids: [label.id],
        ...(todo ? { state_id: todo.id } : {}),
      });
      const name = getProjectById(projectId)?.name ?? "the project";
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: `Run started in ${name}`,
        message: "The planner will break it into tasks; they appear here within a minute.",
      });
      onCreated(name);
      onClose();
    } catch (e) {
      const detail = (e as { error?: string; detail?: string })?.error ?? (e as { detail?: string })?.detail ?? "";
      setError(detail || "Plane rejected the goal. Check the project and try again.");
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Could not create the goal",
        message: detail || "Check the project and try again.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="New run"
        className="shadow-xl relative w-[560px] rounded-lg border border-subtle bg-surface-1 p-5"
      >
        <div className="mb-3 text-16 font-semibold text-primary">New run</div>
        <label htmlFor="new-run-project" className="mb-1 block text-12 text-tertiary">
          Project
        </label>
        <select
          id="new-run-project"
          value={projectId}
          onChange={(e) => {
            setProjectId(e.target.value);
            remember(e.target.value);
          }}
          className="mb-3 w-full rounded border border-subtle bg-layer-1 p-2 text-13 text-primary"
        >
          {joinedProjectIds.map((id) => (
            <option key={id} value={id}>
              {getProjectById(id)?.name}
            </option>
          ))}
        </select>
        <label htmlFor="new-run-goal" className="mb-1 block text-12 text-tertiary">
          Goal
        </label>
        <textarea
          id="new-run-goal"
          ref={(el) => el?.focus()}
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          rows={7}
          placeholder="Describe what to build. The factory plans it into dependent tasks, builds, reviews and merges them."
          className="w-full rounded border border-subtle bg-layer-1 p-2 text-13 text-primary outline-none focus:border-accent-strong"
        />
        {error && <div className="mt-2 rounded bg-danger-subtle p-2 text-12 text-danger-primary">{error}</div>}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={submit} disabled={busy || !goal.trim() || !projectId}>
            {busy ? "Starting…" : "Start"}
          </Button>
        </div>
      </div>
    </div>
  );
}

const AgentsPage = observer(function AgentsPage({ params }: Route.ComponentProps) {
  const { workspaceSlug } = params;
  const { getProjectById, joinedProjectIds } = useProject();
  const [notice, setNotice] = useState("");
  const [data, setData] = useState<RunsResponse | null>(null);
  const [overrides, setOverrides] = useState<Record<string, Partial<Run>>>({});
  const [infra, setInfra] = useState<Infra | null>(null);
  const [offline, setOffline] = useState(false);
  const [tab, setTab] = useState<Tab>("All");
  const [project, setProject] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [dialog, setDialog] = useState(false);
  const [connOpen, setConnOpen] = useState(false);
  const [unauthorized, setUnauthorized] = useState(false);

  const load = useCallback(async () => {
    try {
      const [r, i] = await Promise.all([boardJson<RunsResponse>("/runs.json"), boardJson<Infra>("/factory.json")]);
      setUnauthorized(r.status === 401 || r.status === 403 || r.status === 404);
      if (!r.ok || !r.value) throw new Error("runs");
      const fresh = r.value;
      setData(fresh);
      // drop optimistic patches once the server reports the same Plane state
      setOverrides((o) => {
        const next: Record<string, Partial<Run>> = {};
        for (const [id, patch] of Object.entries(o)) {
          const live = fresh.runs.find((x) => x.id === id);
          if (live && live.plane_state !== patch.plane_state) next[id] = patch;
        }
        return Object.keys(next).length === Object.keys(o).length ? o : next;
      });
      if (i.ok) setInfra(i.value);
      setOffline(false);
    } catch {
      setOffline(true);
    }
  }, []);

  usePoll(load, 5000);

  const runs = useMemo(
    () => (data?.runs ?? []).map((r) => (overrides[r.id] ? Object.assign({}, r, overrides[r.id]) : r)),
    [data, overrides]
  );
  const projects = useMemo(() => Array.from(new Set(runs.map((r) => r.project))), [runs]);
  const children = useMemo(() => {
    const m: Record<string, Run[]> = {};
    for (const r of runs) if (r.parent_id) (m[r.parent_id] ??= []).push(r);
    for (const k of Object.values(m)) k.sort((a, b) => Number(seqOf(a.ref)) - Number(seqOf(b.ref)));
    return m;
  }, [runs]);

  const matches = useCallback(
    (r: Run) => {
      const s = statusOf(r);
      if (tab === "Needs attention" && s !== "Needs attention" && s !== "Blocked") return false;
      if (tab === "Active" && s !== "Active" && s !== "Building") return false;
      if (tab === "Failed" && s !== "Failed") return false;
      if (tab === "Merged" && s !== "Merged") return false;
      if (project && r.project !== project) return false;
      const q = query.trim().toLowerCase();
      return !q || `${r.name} ${r.ref} ${r.project} ${r.branch}`.toLowerCase().includes(q);
    },
    [tab, project, query]
  );

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 10000);
    return () => clearTimeout(t);
  }, [notice]);

  const recentProjectId = useMemo(() => {
    const newest = [...runs]
      // oxlint-disable-next-line unicorn/no-array-sort -- a copy; toSorted is ES2023 and the app targets ES2022
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .find((r) => joinedProjectIds.includes(r.project_id));
    return newest?.project_id ?? "";
  }, [runs, joinedProjectIds]);

  const known = useMemo(() => new Set(runs.map((r) => r.id)), [runs]);
  const visibleRoots = runs
    .filter((r) => !r.parent_id || !known.has(r.parent_id))
    .filter((r) => matches(r) || (children[r.id] ?? []).some(matches))
    // oxlint-disable-next-line unicorn/no-array-sort -- filter made a copy; the app targets ES2022
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));

  const counts = (t: Tab) =>
    runs.filter((r) => {
      const s = statusOf(r);
      return (
        t === "All" || s === t || (t === "Active" && s === "Building") || (t === "Needs attention" && s === "Blocked")
      );
    }).length;
  const sel = runs.find((r) => r.id === selected) ?? null;
  const identifier = sel ? (getProjectById(sel.project_id)?.identifier ?? "") : "";

  const rows: React.ReactNode[] = [];
  const push = (r: Run, depth: number) => {
    const kids = children[r.id] ?? [];
    const expanded = open[r.id] ?? true;
    rows.push(
      <RunRow
        key={r.id}
        run={r}
        depth={depth}
        selected={selected === r.id}
        onSelect={() => setSelected(r.id)}
        kids={kids}
        expanded={expanded}
        onToggle={() => setOpen((o) => ({ ...o, [r.id]: !expanded }))}
      />
    );
    if (r.is_epic && expanded) kids.filter((k) => matches(k) || !query).forEach((k) => push(k, depth + 1));
  };
  visibleRoots.forEach((r) => push(r, 0));

  const capPct = data && data.cap ? Math.min(100, (data.spent / data.cap) * 100) : 0;

  return (
    <>
      <PageHead title="Agents" />
      <div className="flex h-full w-full">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-3 border-b border-subtle px-4 py-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search runs…"
              className="font-mono w-72 rounded border border-subtle bg-layer-1 px-2 py-1 text-12 text-primary outline-none focus:border-accent-strong"
            />
            <select
              value={project}
              onChange={(e) => setProject(e.target.value)}
              className="rounded border border-subtle bg-layer-1 px-2 py-1 text-12 text-primary"
            >
              <option value="">All projects</option>
              {projects.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <div className="flex-1" />
            {data && (
              <span
                className="font-mono flex items-center gap-2 rounded bg-layer-1 px-2 py-1 text-12 whitespace-nowrap text-secondary"
                title="Total spend across runs vs the factory's cost cap"
              >
                ${data.spent.toFixed(2)}
                {data.cap > 0 && (
                  <>
                    <span className="h-1.5 w-16 overflow-hidden rounded bg-layer-2">
                      <span
                        className={`block h-full ${capPct > 90 ? "bg-danger-primary" : "bg-accent-primary"}`}
                        style={{ width: `${capPct}%` }}
                      />
                    </span>
                    / ${data.cap}
                  </>
                )}
                {data.cap === 0 && <span className="text-tertiary">(no cap)</span>}
              </span>
            )}
            <BoardConnection open={connOpen} onOpenChange={setConnOpen} onChanged={() => void load()} />
            <Button variant="primary" size="sm" onClick={() => setDialog(true)}>
              New run
            </Button>
          </div>

          {offline && (
            <div className="flex items-center justify-between gap-3 border-b border-subtle bg-danger-subtle px-4 py-2 text-12 text-danger-primary">
              <span>
                {unauthorized
                  ? "The factory board refused this browser (check the token)."
                  : `The factory board is not reachable at ${boardUrl()}.`}
              </span>
              <button type="button" className="underline" onClick={() => setConnOpen(true)}>
                Configure
              </button>
            </div>
          )}
          {notice && (
            <div className="flex items-center justify-between gap-3 border-b border-subtle bg-success-subtle px-4 py-2 text-12 text-success-primary">
              <span>{notice}</span>
              <button
                type="button"
                className="text-success-primary hover:text-success-primary"
                onClick={() => setNotice("")}
              >
                ✕
              </button>
            </div>
          )}
          <div className="flex items-center gap-1 border-b border-subtle px-4 py-1.5">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`rounded px-2.5 py-1 text-12 font-medium ${
                  tab === t ? "bg-layer-2 text-primary" : "text-tertiary hover:bg-layer-1"
                }`}
              >
                {t} <span className="font-mono ml-1 text-11 text-tertiary">{counts(t)}</span>
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {offline && (
              <div className="p-6 text-13 text-tertiary">
                {boardConfigured() ? (
                  <>The factory board is not reachable. Use the gear icon above to check its URL and token.</>
                ) : (
                  <>
                    The factory is not reachable at {boardUrl()}. Start it with{" "}
                    <span className="font-mono">factory up</span>.
                  </>
                )}
              </div>
            )}
            {!offline && data && rows.length === 0 && (
              <div className="p-6 text-13 text-tertiary">No runs match. Press New run to give the factory a goal.</div>
            )}
            {rows}
          </div>
        </div>

        {sel && (
          <DetailPane
            key={sel.id}
            run={sel}
            workspaceSlug={workspaceSlug}
            infra={infra}
            identifier={identifier}
            onClose={() => setSelected(null)}
            onChanged={() => setTimeout(() => void load(), 4000)}
            onOptimistic={(patch) =>
              setOverrides((o) => {
                const next = { ...o };
                if (patch) next[sel.id] = patch;
                else delete next[sel.id];
                return next;
              })
            }
          />
        )}
      </div>
      {dialog && (
        <NewRunDialog
          workspaceSlug={workspaceSlug}
          recentProjectId={recentProjectId}
          onClose={() => setDialog(false)}
          onCreated={(name) => {
            setNotice(
              `Run started in ${name}. The planner is breaking it into tasks; they appear below within a minute.`
            );
            void load();
            setTimeout(() => void load(), 15000);
          }}
        />
      )}
    </>
  );
});

export default AgentsPage;
