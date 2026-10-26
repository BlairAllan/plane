/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";

/**
 * True from the first time `isOpen` is true, and from then on, so a lazily loaded dialog is fetched only
 * when someone first opens it and stays mounted afterwards (its close transition still plays).
 */
export function useOpenedOnce(isOpen: boolean): boolean {
  const [opened, setOpened] = useState(isOpen);
  if (isOpen && !opened) setOpened(true);
  return opened || isOpen;
}
