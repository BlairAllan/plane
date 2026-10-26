/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { lazy, Suspense } from "react";
import type {
  CompactAssetType,
  DetailedAssetType,
  HorizontalStackAssetType,
  IllustrationAssetType,
  VerticalStackAssetType,
} from "./asset-types";

type TAsset = React.ComponentType<{ className?: string }>;

// Each illustration is tens of KB of inline SVG, so each one is its own chunk, fetched when an empty state shows it
// rather than all of them shipping with every page that can render an empty state.

// Horizontal Stack Asset Registry
export const HORIZONTAL_STACK_ASSETS: Record<HorizontalStackAssetType, TAsset> = {
  customer: lazy(() =>
    import("./horizontal-stack/customer").then((m) => ({ default: m.CustomerHorizontalStackIllustration }))
  ),
  epic: lazy(() => import("./horizontal-stack/epic").then((m) => ({ default: m.EpicHorizontalStackIllustration }))),
  estimate: lazy(() =>
    import("./horizontal-stack/estimate").then((m) => ({ default: m.EstimateHorizontalStackIllustration }))
  ),
  export: lazy(() =>
    import("./horizontal-stack/export").then((m) => ({ default: m.ExportHorizontalStackIllustration }))
  ),
  intake: lazy(() =>
    import("./horizontal-stack/intake").then((m) => ({ default: m.IntakeHorizontalStackIllustration }))
  ),
  label: lazy(() => import("./horizontal-stack/label").then((m) => ({ default: m.LabelHorizontalStackIllustration }))),
  link: lazy(() => import("./horizontal-stack/link").then((m) => ({ default: m.LinkHorizontalStackIllustration }))),
  members: lazy(() =>
    import("./horizontal-stack/members").then((m) => ({ default: m.MembersHorizontalStackIllustration }))
  ),
  note: lazy(() => import("./horizontal-stack/note").then((m) => ({ default: m.NoteHorizontalStackIllustration }))),
  priority: lazy(() =>
    import("./horizontal-stack/priority").then((m) => ({ default: m.PriorityHorizontalStackIllustration }))
  ),
  project: lazy(() =>
    import("./horizontal-stack/project").then((m) => ({ default: m.ProjectHorizontalStackIllustration }))
  ),
  settings: lazy(() =>
    import("./horizontal-stack/settings").then((m) => ({ default: m.SettingsHorizontalStackIllustration }))
  ),
  state: lazy(() => import("./horizontal-stack/state").then((m) => ({ default: m.StateHorizontalStackIllustration }))),
  template: lazy(() =>
    import("./horizontal-stack/template").then((m) => ({ default: m.TemplateHorizontalStackIllustration }))
  ),
  token: lazy(() => import("./horizontal-stack/token").then((m) => ({ default: m.TokenHorizontalStackIllustration }))),
  unknown: lazy(() =>
    import("./horizontal-stack/unknown").then((m) => ({ default: m.UnknownHorizontalStackIllustration }))
  ),
  update: lazy(() =>
    import("./horizontal-stack/update").then((m) => ({ default: m.UpdateHorizontalStackIllustration }))
  ),
  webhook: lazy(() =>
    import("./horizontal-stack/webhook").then((m) => ({ default: m.WebhookHorizontalStackIllustration }))
  ),
  "work-item": lazy(() =>
    import("./horizontal-stack/work-item").then((m) => ({ default: m.WorkItemHorizontalStackIllustration }))
  ),
  worklog: lazy(() =>
    import("./horizontal-stack/worklog").then((m) => ({ default: m.WorklogHorizontalStackIllustration }))
  ),
};

// Vertical Stack Asset Registry
export const VERTICAL_STACK_ASSETS: Record<VerticalStackAssetType, TAsset> = {
  "archived-cycle": lazy(() =>
    import("./vertical-stack/archived-cycle").then((m) => ({ default: m.ArchivedCycleVerticalStackIllustration }))
  ),
  "archived-module": lazy(() =>
    import("./vertical-stack/archived-module").then((m) => ({ default: m.ArchivedModuleVerticalStackIllustration }))
  ),
  "archived-work-item": lazy(() =>
    import("./vertical-stack/archived-work-item").then((m) => ({
      default: m.ArchivedWorkItemVerticalStackIllustration,
    }))
  ),
  changelog: lazy(() =>
    import("./vertical-stack/changelog").then((m) => ({ default: m.ChangelogVerticalStackIllustration }))
  ),
  customer: lazy(() =>
    import("./vertical-stack/customer").then((m) => ({ default: m.CustomerVerticalStackIllustration }))
  ),
  cycle: lazy(() => import("./vertical-stack/cycle").then((m) => ({ default: m.CycleVerticalStackIllustration }))),
  dashboard: lazy(() =>
    import("./vertical-stack/dashboard").then((m) => ({ default: m.DashboardVerticalStackIllustration }))
  ),
  draft: lazy(() => import("./vertical-stack/draft").then((m) => ({ default: m.DraftVerticalStackIllustration }))),
  epic: lazy(() => import("./vertical-stack/epic").then((m) => ({ default: m.EpicVerticalStackIllustration }))),
  "error-404": lazy(() =>
    import("./vertical-stack/404-error").then((m) => ({ default: m.Error404VerticalStackIllustration }))
  ),
  initiative: lazy(() =>
    import("./vertical-stack/initiative").then((m) => ({ default: m.InitiativeVerticalStackIllustration }))
  ),
  "invalid-link": lazy(() =>
    import("./vertical-stack/invalid-link").then((m) => ({ default: m.InvalidLinkVerticalStackIllustration }))
  ),
  module: lazy(() => import("./vertical-stack/module").then((m) => ({ default: m.ModuleVerticalStackIllustration }))),
  "no-access": lazy(() =>
    import("./vertical-stack/no-access").then((m) => ({ default: m.NoAccessVerticalStackIllustration }))
  ),
  page: lazy(() => import("./vertical-stack/page").then((m) => ({ default: m.PageVerticalStackIllustration }))),
  project: lazy(() =>
    import("./vertical-stack/project").then((m) => ({ default: m.ProjectVerticalStackIllustration }))
  ),
  "server-error": lazy(() =>
    import("./vertical-stack/server-error").then((m) => ({ default: m.ServerErrorVerticalStackIllustration }))
  ),
  teamspace: lazy(() =>
    import("./vertical-stack/teamspace").then((m) => ({ default: m.TeamspaceVerticalStackIllustration }))
  ),
  view: lazy(() => import("./vertical-stack/view").then((m) => ({ default: m.ViewVerticalStackIllustration }))),
  "work-item": lazy(() =>
    import("./vertical-stack/work-item").then((m) => ({ default: m.WorkItemVerticalStackIllustration }))
  ),
};

// Illustration Asset Registry
export const ILLUSTRATION_ASSETS: Record<IllustrationAssetType, TAsset> = {
  inbox: lazy(() => import("./illustration/inbox").then((m) => ({ default: m.InboxIllustration }))),
  search: lazy(() => import("./illustration/search").then((m) => ({ default: m.SearchIllustration }))),
};
// Helper functions to get assets
export const getCompactAsset = (assetKey: CompactAssetType, className?: string): React.ReactNode => {
  const AssetComponent =
    HORIZONTAL_STACK_ASSETS[assetKey as HorizontalStackAssetType] ||
    ILLUSTRATION_ASSETS[assetKey as IllustrationAssetType];

  if (!AssetComponent) {
    console.warn(`Asset "${assetKey}" not found in compact asset registry`);
    return null;
  }

  return (
    <Suspense fallback={null}>
      <AssetComponent className={className} />
    </Suspense>
  );
};

export const getDetailedAsset = (assetKey: DetailedAssetType, className?: string): React.ReactNode => {
  const AssetComponent =
    VERTICAL_STACK_ASSETS[assetKey as VerticalStackAssetType] || ILLUSTRATION_ASSETS[assetKey as IllustrationAssetType];

  if (!AssetComponent) {
    console.warn(`Asset "${assetKey}" not found in detailed asset registry`);
    return null;
  }

  return (
    <Suspense fallback={null}>
      <AssetComponent className={className} />
    </Suspense>
  );
};
