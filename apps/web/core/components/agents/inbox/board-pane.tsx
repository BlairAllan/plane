/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useRef, useState } from "react";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { BoardPost } from "@/lib/c-swarm-inbox";
import { postToBoard } from "@/lib/c-swarm-inbox";

const clock = (ts: number) =>
  new Date(ts * 1000).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/**
 * The project's message board: where agents on different tickets tell each other what they decided.
 * Every agent on the project reads the latest posts in its prompt, so a person posting here reaches
 * all of them at once.
 */
export function BoardPane({
  projectId,
  projectName,
  posts,
  author,
  onPosted,
}: {
  projectId: string;
  projectName: string;
  posts: BoardPost[];
  author: string;
  onPosted: (p: BoardPost) => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  // a block body: Chromium's scrollIntoView now returns a Promise, which React would call as the cleanup
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [posts.length]);

  const send = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await postToBoard(projectId, text.trim(), author);
      onPosted({ ts: Date.now() / 1000, role: author ? `human:${author}` : "human", text: text.trim() });
      setText("");
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "Posted to the board",
        message: "Every agent on the project reads it from its next run.",
      });
    } catch {
      setToast({ type: TOAST_TYPE.ERROR, title: "Not posted", message: "The factory board refused the post." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface-1"
      aria-label={`${projectName} message board`}
    >
      <header className="border-b border-subtle px-5 py-3">
        <h2 className="text-16 font-semibold text-primary">{projectName} · message board</h2>
        <p className="text-13 text-secondary">
          Decisions agents share across tickets: interfaces, naming rules, dependencies. Agents read the latest posts
          before they start.
        </p>
      </header>
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <ol className="mx-auto flex max-w-3xl flex-col gap-2">
          {posts.length === 0 && <li className="text-13 text-tertiary">No posts yet.</li>}
          {posts.map((p) => {
            const human = p.role.startsWith("human");
            return (
              <li
                key={`${p.ts}-${p.role}`}
                className={`rounded-lg border p-3 ${human ? "ml-10 border-accent-strong/30 bg-accent-primary/5" : "border-subtle bg-layer-1"}`}
              >
                <div className="mb-1 flex justify-between text-11 text-tertiary">
                  <span className="font-mono">
                    {human ? p.role.replace(/^human:?/, "") || "a person" : p.role}
                    {p.ref ? ` · ${p.ref}` : ""}
                  </span>
                  <span>{clock(p.ts)}</span>
                </div>
                <div className="text-13 whitespace-pre-wrap text-primary">{p.text}</div>
              </li>
            );
          })}
          <div ref={end} />
        </ol>
      </div>
      <footer className="border-t border-subtle px-5 py-3">
        <div className="mx-auto flex max-w-3xl gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void send();
            }}
            rows={2}
            placeholder="Tell every agent on this project something (⌘↵ posts)…"
            className="flex-1 rounded border border-subtle bg-layer-1 p-2 text-13 text-primary outline-none focus:border-accent-strong"
            aria-label="Post to the message board"
          />
          <Button variant="primary" size="sm" disabled={busy || !text.trim()} onClick={send}>
            Post
          </Button>
        </div>
      </footer>
    </section>
  );
}
