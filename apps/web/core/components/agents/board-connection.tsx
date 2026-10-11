/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_BOARD_URL,
  boardToken,
  boardUrl,
  maskedToken,
  resetBoardConfig,
  saveBoardConfig,
  testBoard,
} from "@/lib/c-swarm-board";
import type { BoardTest } from "@/lib/c-swarm-board";

/** Gear button + popover to point the Agents page at a factory board (local default, or a hosted one with a token). */
export function BoardConnection({
  open,
  onOpenChange,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const [url, setUrl] = useState(DEFAULT_BOARD_URL);
  const [token, setToken] = useState("");
  const [hint, setHint] = useState("");
  const [result, setResult] = useState<BoardTest | null>(null);
  const [testing, setTesting] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setUrl(boardUrl());
    setToken("");
    setHint(maskedToken());
    setResult(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) onOpenChange(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, onOpenChange]);

  const save = () => {
    // An empty token box keeps the saved token (it is never shown back); "Clear token" removes it.
    saveBoardConfig(url, token ? token : null);
    setToken("");
    setHint(maskedToken());
    onChanged();
  };

  const test = async () => {
    save();
    setTesting(true);
    setResult(await testBoard());
    setTesting(false);
  };

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-label="Board connection"
        title="Board connection"
        onClick={() => onOpenChange(!open)}
        className="rounded p-1.5 text-tertiary hover:bg-layer-1 hover:text-primary"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-80 rounded border border-subtle bg-surface-1 p-3 shadow-lg">
          <div className="mb-2 text-13 font-medium text-primary">Board connection</div>
          <label className="mb-1 block text-11 text-tertiary" htmlFor="cswarm-board-url">
            Factory board URL
          </label>
          <input
            id="cswarm-board-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            spellCheck={false}
            className="mb-2 w-full rounded border border-subtle bg-layer-1 px-2 py-1 font-mono text-12 text-primary outline-none focus:border-accent-strong"
          />
          <label className="mb-1 block text-11 text-tertiary" htmlFor="cswarm-board-token">
            Token {hint && <span className="font-mono">(saved: {hint})</span>}
          </label>
          <input
            id="cswarm-board-token"
            type="password"
            autoComplete="off"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={boardToken() ? "leave empty to keep the saved token" : "none (local board)"}
            className="mb-2 w-full rounded border border-subtle bg-layer-1 px-2 py-1 font-mono text-12 text-primary outline-none focus:border-accent-strong"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={save} className="rounded bg-accent-primary px-2.5 py-1 text-12 text-on-color">
              Save
            </button>
            <button
              type="button"
              onClick={() => void test()}
              disabled={testing}
              className="rounded border border-subtle px-2.5 py-1 text-12 text-secondary hover:bg-layer-1"
            >
              {testing ? "Testing…" : "Test"}
            </button>
            <button
              type="button"
              onClick={() => {
                saveBoardConfig(url, "");
                setHint("");
                setToken("");
                onChanged();
              }}
              className="rounded px-2 py-1 text-12 text-tertiary hover:bg-layer-1"
            >
              Clear token
            </button>
            <button
              type="button"
              onClick={() => {
                resetBoardConfig();
                setUrl(DEFAULT_BOARD_URL);
                setToken("");
                setHint("");
                setResult(null);
                onChanged();
              }}
              className="rounded px-2 py-1 text-12 text-tertiary hover:bg-layer-1"
            >
              Reset to default
            </button>
          </div>
          {result && (
            <div className={`mt-2 text-12 ${result.ok ? "text-green-400" : "text-red-400"}`} role="status">
              {result.message}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
