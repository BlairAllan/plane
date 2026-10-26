/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { observer } from "mobx-react";
import { BoardConnection } from "@/components/agents/board-connection";
import { BoardPane } from "@/components/agents/inbox/board-pane";
import { ThreadPane } from "@/components/agents/inbox/thread-pane";
import { PageHead } from "@/components/core/page-title";
import { useProject } from "@/hooks/store/use-project";
import { useUser } from "@/hooks/store/user";
import { usePoll } from "@/hooks/use-poll";
import { boardUrl } from "@/lib/c-swarm-board";
import type { BoardPost, InboxResponse, Thread, View } from "@/lib/c-swarm-inbox";
import { VIEWS, fetchInbox, markSeen, readAside, readSeen, setAside, unsetAside, viewOf } from "@/lib/c-swarm-inbox";
import type { Route } from "./+types/page";

const VIEW_COLOR: Record<View, string> = {
  stopped: "#ef4444",
  holding: "#f59e0b",
  waiting: "#a855f7",
  new: "#3b82f6",
  sent: "#737373",
  quiet: "#525252",
};

const ago = (iso: string): string => {
  const t = Date.parse(iso);
  if (!t) return "";
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
};

function Row({
  t,
  view,
  selected,
  unseen,
  onSelect,
}: {
  t: Thread;
  view: View;
  selected: boolean;
  unseen: boolean;
  onSelect: () => void;
}) {
  const qs = t.questions.length;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected}
      data-testid={`inbox-row-${t.ref}`}
      className={`flex w-full flex-col gap-0.5 border-b border-subtle px-3 py-2.5 text-left hover:bg-layer-1 ${selected ? "bg-layer-1" : ""}`}
    >
      <div className="flex items-center gap-2 text-11 text-tertiary">
        <span className="inline-block size-2 shrink-0 rounded-full" style={{ background: VIEW_COLOR[view] }} />
        <span className="font-mono truncate">
          {t.project} · {t.ref}
        </span>
        <span className="ml-auto shrink-0">{ago(t.updated_at)}</span>
      </div>
      <div className={`truncate text-13 ${unseen ? "font-semibold text-primary" : "text-secondary"}`}>{t.name}</div>
      <div className="flex items-center gap-1.5 text-12 text-tertiary">
        <span className="truncate">{t.reason}</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {t.section === "stopped" && (
          <span className="rounded bg-danger-subtle px-1.5 text-11 font-medium text-danger-primary">Stopped</span>
        )}
        {t.holds.length > 0 && (
          <span className="rounded bg-warning-subtle px-1.5 text-11 font-medium text-warning-primary">
            Holds {t.holds.length}
          </span>
        )}
        {qs > 0 && t.section === "stopped" && (
          <span className="rounded bg-layer-2 px-1.5 text-11 text-secondary">
            {qs} question{qs === 1 ? "" : "s"}
          </span>
        )}
        {t.actions.length > 0 && (
          <span className="rounded bg-layer-2 px-1.5 text-11 text-secondary">1 action item</span>
        )}
        {t.proof && (
          <span className="rounded bg-success-subtle px-1.5 text-11 text-success-primary">
            proof{t.proof.artifacts.length ? ` · ${t.proof.artifacts.length} files` : ""}
          </span>
        )}
      </div>
    </button>
  );
}

function BackBar({ onBack }: { onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="flex shrink-0 items-center gap-1 border-b border-subtle px-4 py-2 text-left text-13 text-accent-primary"
    >
      ← All threads
    </button>
  );
}

// Start reading the inbox as soon as the route matches, alongside Plane's own workspace requests rather than after
// them: the page's first poll, moments later, shares this request.
export const clientLoader = () => {
  fetchInbox().catch(() => undefined);
  return null;
};

const AgentInboxPage = observer(function AgentInboxPage({ params }: Route.ComponentProps) {
  const { workspaceSlug } = params;
  const { getProjectById } = useProject();
  const { data: user } = useUser();
  const [data, setData] = useState<InboxResponse | null>(null);
  const [offline, setOffline] = useState(false);
  const [patches, setPatches] = useState<Record<string, Partial<Thread>>>({});
  const [extraPosts, setExtraPosts] = useState<Record<string, BoardPost[]>>({});
  const [project, setProject] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [boardOf, setBoardOf] = useState<string | null>(null);
  const [quietOpen, setQuietOpen] = useState(false);
  const [connOpen, setConnOpen] = useState(false);
  const [seen, setSeen] = useState<Record<string, string>>({});
  const [aside, setAsideMap] = useState<Record<string, string>>({});
  // the open thread keeps the section it was in when opened, so reading it does not whisk it away
  const [pinned, setPinned] = useState<{ id: string; view: View } | null>(null);
  // Laid out from the inbox's own width, not the window's: Plane's sidebar takes a varying share.
  const root = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1600);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const wide = width >= 1100; // project rail, list and thread side by side
  const split = width >= 720; // list and thread side by side; below this, one at a time

  const lastInbox = useRef<InboxResponse | null>(null);
  const load = useCallback(async () => {
    try {
      const fresh = await fetchInbox();
      setOffline(false);
      // a 304 hands back the same object: nothing changed, so nothing to re-render
      if (fresh === lastInbox.current) return;
      lastInbox.current = fresh;
      setData(fresh);
      // optimistic changes stay until the server reports the same Plane state
      setPatches((p) => {
        const next: Record<string, Partial<Thread>> = {};
        for (const [id, patch] of Object.entries(p)) {
          const live = fresh.threads.find((t) => t.id === id);
          if (live && patch.plane_state && live.plane_state !== patch.plane_state) next[id] = patch;
        }
        return next;
      });
      setExtraPosts({});
    } catch {
      setOffline(true);
    }
  }, []);

  useEffect(() => {
    setSeen(readSeen());
    setAsideMap(readAside());
  }, []);
  usePoll(load, 8000);

  const threads = useMemo(
    () =>
      (data?.threads ?? [])
        .map((t) => (patches[t.id] ? Object.assign({}, t, patches[t.id]) : t))
        .filter((t) => t.plane_state !== "Cancelled"), // cancelled here: gone at once, not after the next poll
    [data, patches]
  );
  const visible = threads.filter((t) => !project || t.project_id === project);
  const grouped = useMemo(() => {
    const m: Record<View, Thread[]> = { stopped: [], holding: [], waiting: [], new: [], sent: [], quiet: [] };
    for (const t of visible) m[pinned?.id === t.id ? pinned.view : viewOf(t, seen, aside)].push(t);
    return m;
  }, [visible, seen, aside, pinned]);
  const counts = (pid: string) =>
    threads.filter(
      (t) => (!pid || t.project_id === pid) && ["stopped", "holding", "waiting"].includes(viewOf(t, seen, aside))
    ).length;

  const sel = threads.find((t) => t.id === selected) ?? null;
  const open = (t: Thread) => {
    setSelected(t.id);
    setBoardOf(null);
    setPinned({ id: t.id, view: viewOf(t, seen, aside) });
    markSeen(t);
    setSeen(readSeen());
  };

  // first visit: open the most urgent thread so the page starts on what needs doing
  useEffect(() => {
    if (selected || boardOf || !data || !split) return;
    const first = VIEWS.map((v) => grouped[v.key][0]).find(Boolean);
    if (first && viewOf(first, seen, aside) !== "quiet") open(first);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const boardProject = data?.projects.find((p) => p.id === boardOf);
  const author = user?.display_name || user?.first_name || "";

  return (
    <>
      <PageHead title="Agent inbox" />
      <div ref={root} className={`flex h-full w-full overflow-hidden ${split ? "" : "flex-col"}`}>
        {wide && (
          <nav
            className="flex w-52 shrink-0 flex-col gap-1 overflow-y-auto border-r border-subtle p-2 text-13"
            aria-label="Inbox projects"
          >
            <div className="flex items-center justify-between px-2 pt-1 pb-2">
              <span className="text-12 font-semibold text-tertiary uppercase">Projects</span>
              <BoardConnection align="left" open={connOpen} onOpenChange={setConnOpen} onChanged={() => void load()} />
            </div>
            {[{ id: "", name: "Everything" }, ...(data?.projects ?? [])].map((p) => (
              <button
                key={p.id || "all"}
                type="button"
                onClick={() => {
                  setProject(p.id);
                  setBoardOf(null);
                }}
                className={`flex items-center justify-between rounded px-2 py-1.5 text-left ${project === p.id && !boardOf ? "bg-layer-2 text-primary" : "text-secondary hover:bg-layer-1"}`}
              >
                <span className="truncate">{p.name}</span>
                {counts(p.id) > 0 && <span className="font-mono text-11 text-tertiary">{counts(p.id)}</span>}
              </button>
            ))}
            <div className="mt-3 px-2 pb-1 text-12 font-semibold text-tertiary uppercase">Message boards</div>
            {(data?.projects ?? []).map((p) => (
              <button
                key={`b-${p.id}`}
                type="button"
                onClick={() => {
                  setBoardOf(p.id);
                  setSelected(null);
                }}
                className={`flex items-center justify-between rounded px-2 py-1.5 text-left ${boardOf === p.id ? "bg-layer-2 text-primary" : "text-secondary hover:bg-layer-1"}`}
              >
                <span className="truncate"># {p.name}</span>
                <span className="font-mono text-11 text-tertiary">{(data?.boards[p.id] ?? []).length || ""}</span>
              </button>
            ))}
          </nav>
        )}

        <div
          className={`flex shrink-0 flex-col overflow-y-auto border-r border-subtle ${split ? (wide ? "w-[360px]" : "w-[320px]") : "w-full"} ${!split && (sel || boardProject) ? "hidden" : ""}`}
          aria-label="Threads"
        >
          {!wide && (
            <div className="flex items-center gap-2 border-b border-subtle p-2">
              <select
                aria-label="Show"
                className="min-w-0 flex-1 rounded border border-subtle bg-layer-1 px-2 py-1.5 text-13 text-primary"
                value={boardOf ? `board:${boardOf}` : project}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v.startsWith("board:")) {
                    setBoardOf(v.slice(6));
                    setSelected(null);
                  } else {
                    setProject(v);
                    setBoardOf(null);
                  }
                }}
              >
                {[{ id: "", name: "Everything" }, ...(data?.projects ?? [])].map((p) => (
                  <option key={p.id || "all"} value={p.id}>
                    {p.name}
                    {counts(p.id) ? ` (${counts(p.id)})` : ""}
                  </option>
                ))}
                <optgroup label="Message boards">
                  {(data?.projects ?? []).map((p) => (
                    <option key={`b-${p.id}`} value={`board:${p.id}`}>
                      # {p.name}
                    </option>
                  ))}
                </optgroup>
              </select>
              <BoardConnection open={connOpen} onOpenChange={setConnOpen} onChanged={() => void load()} />
            </div>
          )}
          {offline && (
            <div className="m-3 rounded bg-danger-subtle p-3 text-12 text-danger-primary">
              The factory board is not reachable at {boardUrl()}.{" "}
              <button type="button" className="underline" onClick={() => setConnOpen(true)}>
                Configure
              </button>
            </div>
          )}
          {!offline && (data?.loading ?? 0) > 0 && (
            <div className="border-b border-subtle px-3 py-1.5 text-11 text-tertiary">
              Fetching {data?.loading} more ticket{data?.loading === 1 ? "" : "s"} from Plane, most urgent first…
            </div>
          )}
          {!offline && data && visible.length === 0 && !data.loading && (
            <div className="p-6 text-13 text-tertiary">
              Nothing needs you. Agents leave questions, reviews and finished work with proof here.
            </div>
          )}
          {VIEWS.map((v) => {
            const rows = grouped[v.key];
            if (!rows.length) return null;
            const folded = v.key === "quiet" && !quietOpen;
            return (
              <section key={v.key} aria-label={v.title}>
                <button
                  type="button"
                  disabled={v.key !== "quiet"}
                  onClick={() => setQuietOpen((o) => !o)}
                  className="sticky top-0 z-10 flex w-full items-center gap-2 border-b border-subtle bg-surface-1 px-3 py-1.5 text-left"
                  title={v.hint}
                >
                  <span className="inline-block size-2 rounded-full" style={{ background: VIEW_COLOR[v.key] }} />
                  <span className="text-12 font-semibold text-secondary">{v.title}</span>
                  <span className="font-mono text-11 text-tertiary">{rows.length}</span>
                  {v.key === "quiet" && (
                    <span className="ml-auto text-11 text-tertiary">{folded ? "Show" : "Hide"}</span>
                  )}
                </button>
                {!folded &&
                  rows.map((t) => (
                    <Row
                      key={t.id}
                      t={t}
                      view={v.key}
                      selected={selected === t.id}
                      unseen={!seen[t.id] || seen[t.id] < t.updated_at}
                      onSelect={() => open(t)}
                    />
                  ))}
              </section>
            );
          })}
        </div>

        {!split && (sel || boardProject) && (
          <BackBar
            onBack={() => {
              setSelected(null);
              setBoardOf(null);
            }}
          />
        )}
        {sel && (
          <ThreadPane
            key={sel.id}
            thread={sel}
            workspaceSlug={workspaceSlug}
            identifier={getProjectById(sel.project_id)?.identifier ?? ""}
            board={data?.boards[sel.project_id] ?? []}
            aside={!!aside[sel.id] && aside[sel.id] >= sel.updated_at}
            onSent={(patch) => {
              setPatches((p) => ({ ...p, [sel.id]: { ...p[sel.id], ...patch } }));
              setPinned(null);
              setTimeout(() => void load(), 4000);
            }}
            onAside={(on) => {
              setPinned(null);
              if (on) {
                if (sel.section === "done") markSeen(sel);
                setAside(sel);
              } else {
                unsetAside(sel);
              }
              setAsideMap(readAside());
              setSeen(readSeen());
            }}
            onClose={() => setSelected(null)}
          />
        )}
        {boardProject && (
          <BoardPane
            key={boardProject.id}
            projectId={boardProject.id}
            projectName={boardProject.name}
            posts={[...(data?.boards[boardProject.id] ?? []), ...(extraPosts[boardProject.id] ?? [])]}
            author={author}
            onPosted={(p) => setExtraPosts((m) => ({ ...m, [boardProject.id]: [...(m[boardProject.id] ?? []), p] }))}
          />
        )}
        {split && !sel && !boardProject && (
          <div className="flex flex-1 items-center justify-center p-8 text-13 text-tertiary">
            Pick a thread or a message board.
          </div>
        )}
      </div>
    </>
  );
});

export default AgentInboxPage;
