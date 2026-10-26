/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { redirect } from "react-router";
import type { Route } from "./+types/page";

// c-swarm: the workspace opens on the Agent inbox; Plane's home dashboard is not part of the factory UI.
export const clientLoader = ({ params }: Route.ClientLoaderArgs) => {
  throw redirect(`/${params.workspaceSlug}/agent-inbox/`);
};

export default function WorkspaceHome() {
  return null;
}
