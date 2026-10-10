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
import { PageHead } from "@/components/core/page-title";
import { useProject } from "@/hooks/store/use-project";
import { useProjectState } from "@/hooks/store/use-project-state";
import { IssueCommentService, IssueLabelService, IssueService } from "@/services/issue";
import type { Route } from "./+types/page";

const RUNS_URL = "http://127.0.0.1:8089/runs.json";
const INFRA_URL = "http://127.0.0.1:8089/factory.json";

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
};
type RunsResponse = { runs: Run[]; spent: number; cap: number };
type Post = { ts: number; role: string; ref?: string; text: string };
type Infra = { notes: Record<string, { ts: number; role: string; text: string }[]>; boards: Record<string, Post[]> };

type Status = "Active" | "Needs attention" | "Ready for review" | "Merged" | "Failed" | "Queued";

const STATUS_STYLE: Record<Status, { color: string; pulse?: boolean }> = {
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
  if (r.phase === "failed" || r.phase === "crashed") return "Failed";
  if (r.bucket === "Needs attention") return "Needs attention";
  if (r.bucket === "Active") return "Active";
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
    <span title={title} className="rounded bg-layer-1 px-1.5 py-0.5 font-mono text-11 text-tertiary">
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
  const done = kids.filter((k) => k.merged).length;
  return (
    <div
      onClick={onSelect}
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
            <span className="w-12 shrink-0 font-mono text-12 text-tertiary">{run.ref}</span>
      <span className="min-w-0 flex-1 truncate text-primary">{run.name}</span>
      {run.is_epic && kids.length > 0 && (
        <span className="flex w-40 shrink-0 items-center gap-2 text-11 text-tertiary">
          <span className="h-1.5 flex-1 overflow-hidden rounded bg-layer-2">
            <span className="block h-full bg-green-500" style={{ width: `${(done / kids.length) * 100}%` }} />
          </span>
          {done}/{kids.length} merged
        </span>
      )}
      <span className="w-24 shrink-0 truncate"><Chip>{run.project}</Chip></span>
      <span className="w-24 shrink-0"><Chip title="source">{run.is_epic ? "epic" : run.parent_id ? "epic task" : "work item"}</Chip></span>
      <StatusChip status={status} />
      <span className="w-14 shrink-0 text-right font-mono text-12 text-tertiary">
        {run.rounds ? `${run.rounds} rd` : ""}
      </span>
      <span className="w-14 shrink-0 text-right font-mono text-12 text-secondary">${run.cost.toFixed(2)}</span>
      {run.pr_url ? (
        <a
          href={run.pr_url}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="w-12 shrink-0 font-mono text-12 text-accent-primary hover:underline"
        >
          PR #{run.pr_number}
        </a>
      ) : (
        <span className="w-12 shrink-0" />
      )}
      <span className="w-16 shrink-0 text-right text-12 text-tertiary">{ago(run.updated_at)}</span>
    </div>
  );
}

function DetailPane({
  run,
  workspaceSlug,
  infra,
  singleProject,
  identifier,
  onClose,
}: {
  run: Run;
  workspaceSlug: string;
  infra: Infra | null;
  singleProject: boolean;
  identifier: string;
  onClose: () => void;
}) {
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const status = statusOf(run);
  const board = (infra?.boards?.[run.project_id] ?? []).slice(-12).reverse();
  const notes = singleProject ? (infra?.notes?.[seqOf(run.ref)] ?? []) : [];
  const workItemHref = identifier ? `/${workspaceSlug}/browse/${identifier}-${seqOf(run.ref)}/` : "";

  const send = async () => {
    if (!comment.trim()) return;
    setSending(true);
    try {
      await new IssueCommentService().createIssueComment(workspaceSlug, run.project_id, run.id, {
        comment_html: `<p>${comment.replace(/</g, "&lt;")}</p>`,
      });
      setComment("");
      setToast({ type: TOAST_TYPE.SUCCESS, title: "Comment added", message: "The factory reads it on its next poll." });
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
          <div className="mt-1 text-15 font-semibold text-primary">{run.name}</div>
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
          {run.branch && <div className="truncate font-mono text-12 text-tertiary">{run.branch}</div>}
          {workItemHref && (
            <Link to={workItemHref} className="text-accent-primary hover:underline">
              Open work item in Plane
            </Link>
          )}
        </div>

        {run.error && (
          <section>
            <h4 className="mb-1 text-12 font-semibold text-tertiary uppercase">Needs attention</h4>
            <pre className="rounded bg-amber-500/10 p-2 font-mono text-12 whitespace-pre-wrap text-amber-400">
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
              {run.findings.map((f, i) => (
                <li key={i} className="flex gap-2 rounded bg-layer-1 p-2">
                  <span className={f.state === "open" ? "text-amber-400" : "text-green-500"}>
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
              {notes.slice(-8).map((n, i) => (
                <li key={i} className="rounded bg-layer-1 p-2">
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
              {board.map((p, i) => (
                <li key={i} className="rounded bg-layer-1 p-2">
                  <span className="font-mono text-11 text-tertiary">
                    {p.role}
                    {p.ref ? ` · ${p.ref}` : ""}
                  </span>
                  <div className="line-clamp-4 whitespace-pre-wrap">{p.text}</div>
                </li>
              ))}
            </ul>
          )}
        </section>

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

function NewRunDialog({
  workspaceSlug,
  onClose,
}: {
  workspaceSlug: string;
  onClose: () => void;
}) {
  const { joinedProjectIds, getProjectById } = useProject();
  const { fetchProjectStates } = useProjectState();
  const [projectId, setProjectId] = useState(joinedProjectIds[0] ?? "");
  const [goal, setGoal] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!projectId || !goal.trim()) return;
    setBusy(true);
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
        description_html: rest.length ? `<p>${rest.join("</p><p>").replace(/<(?!\/?p>)/g, "&lt;")}</p>` : `<p>${first}</p>`,
        label_ids: [label.id],
        ...(todo ? { state_id: todo.id } : {}),
      });
      setToast({ type: TOAST_TYPE.SUCCESS, title: "Goal sent", message: "The factory will plan it into tasks." });
      onClose();
    } catch {
      setToast({ type: TOAST_TYPE.ERROR, title: "Could not create the goal", message: "Check the project and try again." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-[560px] rounded-lg border border-subtle bg-surface-1 p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 text-16 font-semibold text-primary">New run</div>
        <label className="mb-1 block text-12 text-tertiary">Project</label>
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="mb-3 w-full rounded border border-subtle bg-layer-1 p-2 text-13 text-primary"
        >
          {joinedProjectIds.map((id) => (
            <option key={id} value={id}>
              {getProjectById(id)?.name}
            </option>
          ))}
        </select>
        <label className="mb-1 block text-12 text-tertiary">Goal</label>
        <textarea
          autoFocus
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          rows={7}
          placeholder="Describe what to build. The factory plans it into dependent tasks, builds, reviews and merges them."
          className="w-full rounded border border-subtle bg-layer-1 p-2 text-13 text-primary outline-none focus:border-accent-strong"
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={submit} disabled={busy || !goal.trim() || !projectId}>
            Start
          </Button>
        </div>
      </div>
    </div>
  );
}

const AgentsPage = observer(function AgentsPage({ params }: Route.ComponentProps) {
  const { workspaceSlug } = params;
  const { getProjectById } = useProject();
  const [data, setData] = useState<RunsResponse | null>(null);
  const [infra, setInfra] = useState<Infra | null>(null);
  const [offline, setOffline] = useState(false);
  const [tab, setTab] = useState<Tab>("All");
  const [project, setProject] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [dialog, setDialog] = useState(false);

  const load = useCallback(async () => {
    try {
      const [r, i] = await Promise.all([fetch(RUNS_URL), fetch(INFRA_URL)]);
      if (!r.ok) throw new Error("runs");
      setData(await r.json());
      if (i.ok) setInfra(await i.json());
      setOffline(false);
    } catch {
      setOffline(true);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  const runs = data?.runs ?? [];
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
      if (tab === "Needs attention" && s !== "Needs attention") return false;
      if (tab === "Active" && s !== "Active") return false;
      if (tab === "Failed" && s !== "Failed") return false;
      if (tab === "Merged" && s !== "Merged") return false;
      if (project && r.project !== project) return false;
      const q = query.trim().toLowerCase();
      return !q || `${r.name} ${r.ref} ${r.project} ${r.branch}`.toLowerCase().includes(q);
    },
    [tab, project, query]
  );

  const known = useMemo(() => new Set(runs.map((r) => r.id)), [runs]);
  const visibleRoots = runs
    .filter((r) => !r.parent_id || !known.has(r.parent_id))
    .filter((r) => matches(r) || (children[r.id] ?? []).some(matches))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));

  const counts = (t: Tab) =>
    runs.filter((r) => t === "All" || statusOf(r) === t).length;
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
              className="w-72 rounded border border-subtle bg-layer-1 px-2 py-1 font-mono text-12 text-primary outline-none focus:border-accent-strong"
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
                className="flex items-center gap-2 rounded bg-layer-1 px-2 py-1 font-mono text-12 text-secondary"
                title="Total spend across runs vs the factory's cost cap"
              >
                ${data.spent.toFixed(2)}
                {data.cap > 0 && (
                  <>
                    <span className="h-1.5 w-16 overflow-hidden rounded bg-layer-2">
                      <span
                        className={`block h-full ${capPct > 90 ? "bg-red-500" : "bg-accent-primary"}`}
                        style={{ width: `${capPct}%` }}
                      />
                    </span>
                    / ${data.cap}
                  </>
                )}
              </span>
            )}
            <Button variant="primary" size="sm" onClick={() => setDialog(true)}>
              New run
            </Button>
          </div>

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
                {t} <span className="ml-1 font-mono text-11 text-tertiary">{counts(t)}</span>
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {offline && (
              <div className="p-6 text-13 text-tertiary">
                The factory is not reachable at 127.0.0.1:8089. Start it with <span className="font-mono">factory up</span>.
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
            run={sel}
            workspaceSlug={workspaceSlug}
            infra={infra}
            singleProject={projects.length === 1}
            identifier={identifier}
            onClose={() => setSelected(null)}
          />
        )}
      </div>
      {dialog && <NewRunDialog workspaceSlug={workspaceSlug} onClose={() => setDialog(false)} />}
    </>
  );
});

export default AgentsPage;
