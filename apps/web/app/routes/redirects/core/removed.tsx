/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { redirect } from "react-router";
import type { ClientLoaderFunctionArgs } from "react-router";

// c-swarm: pages removed from the factory UI (cycles, modules, views, pages, intake, archives, analytics, drafts,
// notifications, profile, stickies, workspace views). Old links and bookmarks land somewhere useful, not a 404:
// a project's work items, or the Agent inbox.
export const clientLoader = ({ params }: ClientLoaderFunctionArgs) => {
  const { workspaceSlug, projectId } = params;
  throw redirect(projectId ? `/${workspaceSlug}/projects/${projectId}/issues/` : `/${workspaceSlug}/agent-inbox/`);
};

export default function Removed() {
  return null;
}
