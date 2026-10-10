/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Outlet } from "react-router";
import { AiIcon } from "@plane/propel/icons";
import { Breadcrumbs, Header } from "@plane/ui";
import { AppHeader } from "@/components/core/app-header";
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";

function AgentsHeader() {
  return (
    <Header>
      <Header.LeftItem>
        <Breadcrumbs>
          <Breadcrumbs.Item component={<BreadcrumbLink label="Agents" icon={<AiIcon className="size-4" />} />} />
        </Breadcrumbs>
      </Header.LeftItem>
    </Header>
  );
}

export default function AgentsLayout() {
  return (
    <>
      <AppHeader header={<AgentsHeader />} />
      <div className="relative h-full w-full overflow-hidden">
        <Outlet />
      </div>
    </>
  );
}
