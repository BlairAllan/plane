/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { index, layout, route } from "@react-router/dev/routes";
import type { RouteConfig, RouteConfigEntry } from "@react-router/dev/routes";

export const coreRoutes: RouteConfigEntry[] = [
  // ========================================================================
  // USER MANAGEMENT ROUTES
  // ========================================================================

  // Home - Sign In
  layout("./(home)/layout.tsx", [index("./(home)/page.tsx")]),

  // Sign Up
  layout("./(all)/sign-up/layout.tsx", [route("sign-up", "./(all)/sign-up/page.tsx")]),

  // Account Routes - Password Management
  layout("./(all)/accounts/forgot-password/layout.tsx", [
    route("accounts/forgot-password", "./(all)/accounts/forgot-password/page.tsx"),
  ]),
  layout("./(all)/accounts/reset-password/layout.tsx", [
    route("accounts/reset-password", "./(all)/accounts/reset-password/page.tsx"),
  ]),
  layout("./(all)/accounts/set-password/layout.tsx", [
    route("accounts/set-password", "./(all)/accounts/set-password/page.tsx"),
  ]),

  // Create Workspace
  layout("./(all)/create-workspace/layout.tsx", [route("create-workspace", "./(all)/create-workspace/page.tsx")]),

  // Onboarding
  layout("./(all)/onboarding/layout.tsx", [route("onboarding", "./(all)/onboarding/page.tsx")]),

  // Invitations
  layout("./(all)/invitations/layout.tsx", [route("invitations", "./(all)/invitations/page.tsx")]),

  // Workspace Invitations
  layout("./(all)/workspace-invitations/layout.tsx", [
    route("workspace-invitations", "./(all)/workspace-invitations/page.tsx"),
  ]),

  // ========================================================================
  // ALL APP ROUTES
  // ========================================================================
  layout("./(all)/layout.tsx", [
    // ======================================================================
    // WORKSPACE-SCOPED ROUTES
    // ======================================================================
    layout("./(all)/[workspaceSlug]/layout.tsx", [
      // ====================================================================
      // PROJECTS APP SECTION - WORKSPACE LEVEL ROUTES
      // ====================================================================
      layout("./(all)/[workspaceSlug]/(projects)/layout.tsx", [
        // --------------------------------------------------------------------
        // WORKSPACE LEVEL ROUTES
        // --------------------------------------------------------------------

        // Workspace Home
        route(":workspaceSlug", "./(all)/[workspaceSlug]/(projects)/page.tsx"),

        // Agent inbox (what the factory's agents need from a person)
        layout("./(all)/[workspaceSlug]/(projects)/agent-inbox/layout.tsx", [
          route(":workspaceSlug/agent-inbox", "./(all)/[workspaceSlug]/(projects)/agent-inbox/page.tsx"),
        ]),

        // Agents (factory runs)
        layout("./(all)/[workspaceSlug]/(projects)/agents/layout.tsx", [
          route(":workspaceSlug/agents", "./(all)/[workspaceSlug]/(projects)/agents/page.tsx"),
        ]),

        // Browse
        layout("./(all)/[workspaceSlug]/(projects)/browse/[workItem]/layout.tsx", [
          route(":workspaceSlug/browse/:workItem", "./(all)/[workspaceSlug]/(projects)/browse/[workItem]/page.tsx"),
        ]),

        // --------------------------------------------------------------------
        // PROJECT LEVEL ROUTES
        // --------------------------------------------------------------------

        // Project List
        layout("./(all)/[workspaceSlug]/(projects)/projects/(list)/layout.tsx", [
          route(":workspaceSlug/projects", "./(all)/[workspaceSlug]/(projects)/projects/(list)/page.tsx"),
        ]),

        // Project Detail
        layout("./(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/layout.tsx", [
          // Project Issues List
          layout("./(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/issues/(list)/layout.tsx", [
            route(
              ":workspaceSlug/projects/:projectId/issues",
              "./(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/issues/(list)/page.tsx"
            ),
          ]),
          // Issue Detail
          route(
            ":workspaceSlug/projects/:projectId/issues/:issueId",
            "./(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/issues/(detail)/[issueId]/page.tsx"
          ),
        ]),
      ]),

      // ====================================================================
      // SETTINGS SECTION
      // ====================================================================
      layout("./(all)/[workspaceSlug]/(settings)/layout.tsx", [
        // --------------------------------------------------------------------
        // WORKSPACE SETTINGS
        // --------------------------------------------------------------------

        layout("./(all)/[workspaceSlug]/(settings)/settings/(workspace)/layout.tsx", [
          route(":workspaceSlug/settings", "./(all)/[workspaceSlug]/(settings)/settings/(workspace)/page.tsx"),
          route(
            ":workspaceSlug/settings/members",
            "./(all)/[workspaceSlug]/(settings)/settings/(workspace)/members/page.tsx"
          ),
          route(
            ":workspaceSlug/settings/exports",
            "./(all)/[workspaceSlug]/(settings)/settings/(workspace)/exports/page.tsx"
          ),
          route(
            ":workspaceSlug/settings/webhooks",
            "./(all)/[workspaceSlug]/(settings)/settings/(workspace)/webhooks/page.tsx"
          ),
          route(
            ":workspaceSlug/settings/webhooks/:webhookId",
            "./(all)/[workspaceSlug]/(settings)/settings/(workspace)/webhooks/[webhookId]/page.tsx"
          ),
        ]),

        // --------------------------------------------------------------------
        // PROJECT SETTINGS
        // --------------------------------------------------------------------

        layout("./(all)/[workspaceSlug]/(settings)/settings/projects/layout.tsx", [
          // No Projects available page
          route(":workspaceSlug/settings/projects", "./(all)/[workspaceSlug]/(settings)/settings/projects/page.tsx"),
          layout("./(all)/[workspaceSlug]/(settings)/settings/projects/[projectId]/layout.tsx", [
            // Project Settings
            route(
              ":workspaceSlug/settings/projects/:projectId",
              "./(all)/[workspaceSlug]/(settings)/settings/projects/[projectId]/page.tsx"
            ),
            // Project Members
            route(
              ":workspaceSlug/settings/projects/:projectId/members",
              "./(all)/[workspaceSlug]/(settings)/settings/projects/[projectId]/members/page.tsx"
            ),
            // Project Features
            route(
              ":workspaceSlug/settings/projects/:projectId/features/cycles",
              "./(all)/[workspaceSlug]/(settings)/settings/projects/[projectId]/features/cycles/page.tsx"
            ),
            route(
              ":workspaceSlug/settings/projects/:projectId/features/modules",
              "./(all)/[workspaceSlug]/(settings)/settings/projects/[projectId]/features/modules/page.tsx"
            ),
            route(
              ":workspaceSlug/settings/projects/:projectId/features/views",
              "./(all)/[workspaceSlug]/(settings)/settings/projects/[projectId]/features/views/page.tsx"
            ),
            route(
              ":workspaceSlug/settings/projects/:projectId/features/pages",
              "./(all)/[workspaceSlug]/(settings)/settings/projects/[projectId]/features/pages/page.tsx"
            ),
            route(
              ":workspaceSlug/settings/projects/:projectId/features/intake",
              "./(all)/[workspaceSlug]/(settings)/settings/projects/[projectId]/features/intake/page.tsx"
            ),
            // Project States
            route(
              ":workspaceSlug/settings/projects/:projectId/states",
              "./(all)/[workspaceSlug]/(settings)/settings/projects/[projectId]/states/page.tsx"
            ),
            // Project Labels
            route(
              ":workspaceSlug/settings/projects/:projectId/labels",
              "./(all)/[workspaceSlug]/(settings)/settings/projects/[projectId]/labels/page.tsx"
            ),
            // Project Estimates
            route(
              ":workspaceSlug/settings/projects/:projectId/estimates",
              "./(all)/[workspaceSlug]/(settings)/settings/projects/[projectId]/estimates/page.tsx"
            ),
            // Project Automations
            layout("./(all)/[workspaceSlug]/(settings)/settings/projects/[projectId]/automations/layout.tsx", [
              route(
                ":workspaceSlug/settings/projects/:projectId/automations",
                "./(all)/[workspaceSlug]/(settings)/settings/projects/[projectId]/automations/page.tsx"
              ),
            ]),
            // Project Factory
            route(
              ":workspaceSlug/settings/projects/:projectId/factory",
              "./(all)/[workspaceSlug]/(settings)/settings/projects/[projectId]/factory/page.tsx"
            ),
          ]),
        ]),
      ]),
    ]),
    // ======================================================================
    // STANDALONE ROUTES (outside workspace context)
    // ======================================================================

    // --------------------------------------------------------------------
    // PROFILE SETTINGS
    // --------------------------------------------------------------------

    layout("./(all)/settings/profile/layout.tsx", [
      route("settings/profile/:profileTabId", "./(all)/settings/profile/[profileTabId]/page.tsx"),
    ]),
  ]),

  // ========================================================================
  // REDIRECT ROUTES
  // ========================================================================
  // Legacy URL redirects for backward compatibility

  // --------------------------------------------------------------------
  // REDIRECT ROUTES
  // --------------------------------------------------------------------

  // Project settings redirect: /:workspaceSlug/projects/:projectId/settings/:path*
  // → /:workspaceSlug/settings/projects/:projectId/:path*
  route(":workspaceSlug/projects/:projectId/settings/*", "routes/redirects/core/project-settings.tsx"),

  // Pages removed from the factory UI -> a project's work items, or the Agent inbox
  route(":workspaceSlug/analytics/*", "routes/redirects/core/removed.tsx", { id: "removed-analytics" }),
  route(":workspaceSlug/drafts", "routes/redirects/core/removed.tsx", { id: "removed-drafts" }),
  route(":workspaceSlug/notifications", "routes/redirects/core/removed.tsx", { id: "removed-notifications" }),
  route(":workspaceSlug/profile/*", "routes/redirects/core/removed.tsx", { id: "removed-profile" }),
  route(":workspaceSlug/stickies", "routes/redirects/core/removed.tsx", { id: "removed-stickies" }),
  route(":workspaceSlug/workspace-views/*", "routes/redirects/core/removed.tsx", { id: "removed-workspace-views" }),
  route(":workspaceSlug/projects/archives", "routes/redirects/core/removed.tsx", { id: "removed-projects-archives" }),
  route(":workspaceSlug/projects/:projectId/cycles/*", "routes/redirects/core/removed.tsx", {
    id: "removed-project-cycles",
  }),
  route(":workspaceSlug/projects/:projectId/modules/*", "routes/redirects/core/removed.tsx", {
    id: "removed-project-modules",
  }),
  route(":workspaceSlug/projects/:projectId/views/*", "routes/redirects/core/removed.tsx", {
    id: "removed-project-views",
  }),
  route(":workspaceSlug/projects/:projectId/pages/*", "routes/redirects/core/removed.tsx", {
    id: "removed-project-pages",
  }),
  route(":workspaceSlug/projects/:projectId/intake", "routes/redirects/core/removed.tsx", {
    id: "removed-project-intake",
  }),
  route(":workspaceSlug/projects/:projectId/archives/*", "routes/redirects/core/removed.tsx", {
    id: "removed-project-archives",
  }),

  // API tokens redirect: /:workspaceSlug/settings/api-tokens
  // → /settings/profile/api-tokens
  route(":workspaceSlug/settings/api-tokens", "routes/redirects/core/api-tokens.tsx"),

  // Sign-up redirects
  route("accounts/sign-up", "routes/redirects/core/accounts-signup.tsx"),

  // Sign-in redirects (all redirect to home page)
  route("sign-in", "routes/redirects/core/sign-in.tsx"),
  route("signin", "routes/redirects/core/signin.tsx"),
  route("login", "routes/redirects/core/login.tsx"),

  // Register redirect
  route("register", "routes/redirects/core/register.tsx"),

  // Profile settings redirects
  route("profile/*", "routes/redirects/core/profile-settings.tsx"),

  // Account settings redirects
  route(":workspaceSlug/settings/account/*", "routes/redirects/core/workspace-account-settings.tsx"),
] satisfies RouteConfig;
