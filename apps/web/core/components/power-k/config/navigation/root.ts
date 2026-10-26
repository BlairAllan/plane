/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// components
import type { TPowerKCommandConfig } from "@/components/power-k/core/types";
// local imports
import type { TPowerKNavigationCommandKeys } from "./commands";
import { usePowerKNavigationCommandsRecord } from "./commands";

export const usePowerKNavigationCommands = (): TPowerKCommandConfig[] => {
  const optionsList: Record<TPowerKNavigationCommandKeys, TPowerKCommandConfig> = usePowerKNavigationCommandsRecord();

  return [
    // Open actions from lowest to highest scope
    optionsList["open_project_setting"],
    optionsList["open_project"],
    optionsList["open_workspace_setting"],
    optionsList["open_workspace"],
    // Project-Level Navigation (Only visible in project context)
    optionsList["nav_project_work_items"],
    optionsList["nav_project_settings"],
    // Navigate to workspace-level pages
    optionsList["nav_workspace_settings"],
    optionsList["nav_projects_list"],
    // Account-Level Navigation
    optionsList["nav_account_settings"],
  ];
};
