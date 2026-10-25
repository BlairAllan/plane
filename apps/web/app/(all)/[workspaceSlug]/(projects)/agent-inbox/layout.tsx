/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Outlet } from "react-router";
import { InboxIcon } from "@plane/propel/icons";
import { Breadcrumbs, Header } from "@plane/ui";
import { AppHeader } from "@/components/core/app-header";
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";

function AgentInboxHeader() {
  return (
    <Header>
      <Header.LeftItem>
        <Breadcrumbs>
          <Breadcrumbs.Item
            component={<BreadcrumbLink label="Agent inbox" icon={<InboxIcon className="size-4" />} />}
          />
        </Breadcrumbs>
      </Header.LeftItem>
    </Header>
  );
}

export default function AgentInboxLayout() {
  return (
    <>
      <AppHeader header={<AgentInboxHeader />} />
      <div className="relative h-full w-full overflow-hidden">
        <Outlet />
      </div>
    </>
  );
}
