/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect } from "react";

/**
 * Run `fn` now and every `ms` while the tab is visible. A hidden tab does not poll; coming back to it polls at once,
 * so what it shows is current without background tabs costing the board (or the battery) anything.
 */
export function usePoll(fn: () => unknown, ms: number): void {
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") void fn();
    };
    void fn();
    const t = setInterval(tick, ms);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [fn, ms]);
}
