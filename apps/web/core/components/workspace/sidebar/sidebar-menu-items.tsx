/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { observer } from "mobx-react";
import { Disclosure, Transition } from "@headlessui/react";
// plane imports
import {
  WORKSPACE_SIDEBAR_STATIC_NAVIGATION_ITEMS_LINKS,
  WORKSPACE_SIDEBAR_STATIC_PINNED_NAVIGATION_ITEMS_LINKS,
} from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { ChevronRightIcon } from "@plane/propel/icons";
import { cn } from "@plane/utils";
// hooks
import useLocalStorage from "@/hooks/use-local-storage";
import { SidebarItemBase } from "./sidebar-item";

// c-swarm: a fixed menu (Agent inbox, Agents, Projects). Plane's personal and per-workspace menu items
// (stickies, drafts, views, analytics, archives) are not part of the factory UI.
export const SidebarMenuItems = observer(function SidebarMenuItems() {
  // routers
  const { setValue: toggleWorkspaceMenu, storedValue: isWorkspaceMenuOpen } = useLocalStorage<boolean>(
    "is_workspace_menu_open",
    true
  );
  // translation
  const { t } = useTranslation();

  const toggleListDisclosure = (isOpen: boolean) => {
    toggleWorkspaceMenu(isOpen);
  };

  return (
    <>
      <div className="flex flex-col gap-0.5">
        {WORKSPACE_SIDEBAR_STATIC_NAVIGATION_ITEMS_LINKS.map((item) => (
          <SidebarItemBase key={item.key} item={item} />
        ))}
      </div>
      <Disclosure as="div" className="flex flex-col" defaultOpen={!!isWorkspaceMenuOpen}>
        <div className="group flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-placeholder hover:bg-layer-transparent-hover">
          <Disclosure.Button
            as="button"
            type="button"
            className="flex w-full items-center gap-1 text-left text-13 font-semibold whitespace-nowrap text-placeholder"
            onClick={() => toggleListDisclosure(!isWorkspaceMenuOpen)}
            aria-label={t(
              isWorkspaceMenuOpen
                ? "aria_labels.app_sidebar.close_workspace_menu"
                : "aria_labels.app_sidebar.open_workspace_menu"
            )}
          >
            <span className="text-13 font-semibold">{t("common.workspace")}</span>
          </Disclosure.Button>
          <div className="pointer-events-none flex items-center opacity-0 group-hover:pointer-events-auto group-hover:opacity-100">
            <Disclosure.Button
              as="button"
              type="button"
              className="flex-shrink-0 rounded-sm p-0.5 hover:bg-layer-1"
              onClick={() => toggleListDisclosure(!isWorkspaceMenuOpen)}
              aria-label={t(
                isWorkspaceMenuOpen
                  ? "aria_labels.app_sidebar.close_workspace_menu"
                  : "aria_labels.app_sidebar.open_workspace_menu"
              )}
            >
              <ChevronRightIcon
                className={cn("size-3 flex-shrink-0 transition-all", {
                  "rotate-90": isWorkspaceMenuOpen,
                })}
              />
            </Disclosure.Button>
          </div>
        </div>
        <Transition
          show={!!isWorkspaceMenuOpen}
          enter="transition duration-100 ease-out"
          enterFrom="transform scale-95 opacity-0"
          enterTo="transform scale-100 opacity-100"
          leave="transition duration-75 ease-out"
          leaveFrom="transform scale-100 opacity-100"
          leaveTo="transform scale-95 opacity-0"
        >
          {isWorkspaceMenuOpen && (
            <Disclosure.Panel as="div" className="flex flex-col gap-0.5" static>
              <>
                {WORKSPACE_SIDEBAR_STATIC_PINNED_NAVIGATION_ITEMS_LINKS.map((item) => (
                  <SidebarItemBase key={item.key} item={item} />
                ))}
              </>
            </Disclosure.Panel>
          )}
        </Transition>
      </Disclosure>
    </>
  );
});
