/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// components
import { SidebarWrapper } from "@/components/sidebar/sidebar-wrapper";
import { SidebarProjectsList } from "@/components/workspace/sidebar/projects-list";
import { SidebarQuickActions } from "@/components/workspace/sidebar/quick-actions";
import { SidebarMenuItems } from "@/components/workspace/sidebar/sidebar-menu-items";

export const AppSidebar = observer(function AppSidebar() {
  return (
    <SidebarWrapper title="Projects" quickActions={<SidebarQuickActions />}>
      <SidebarMenuItems />
      {/* Projects List */}
      <SidebarProjectsList />
    </SidebarWrapper>
  );
});
