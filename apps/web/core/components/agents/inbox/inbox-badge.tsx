/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { fetchInbox, needsYou } from "@/lib/c-swarm-inbox";

/** How many tickets need a person, beside "Agent inbox" in the sidebar. Silent when the board is unreachable. */
export function AgentInboxBadge() {
  const [count, setCount] = useState(0);
  const [stopped, setStopped] = useState(false);
  useEffect(() => {
    let live = true;
    const load = () =>
      fetchInbox()
        .then((r) => {
          if (!live) return undefined;
          setCount(r.threads.filter(needsYou).length);
          setStopped(r.threads.some((t) => t.section === "stopped"));
          return undefined;
        })
        .catch(() => live && setCount(0));
    void load();
    const t = setInterval(load, 30000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, []);
  if (!count) return null;
  return (
    <span
      className={`ml-auto rounded-full px-1.5 text-11 leading-4 font-semibold ${stopped ? "bg-danger-primary text-on-color" : "bg-layer-2 text-secondary"}`}
      title={`${count} ticket${count === 1 ? "" : "s"} need you`}
      data-testid="agent-inbox-badge"
    >
      {count}
    </span>
  );
}
