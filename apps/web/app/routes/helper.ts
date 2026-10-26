/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { RouteConfigEntry } from "@react-router/dev/routes";

/**
 * Merges two route configurations intelligently.
 * - Deep merges children when the same layout file exists in both arrays
 * - Deduplicates routes by id, or by file when there is no id (several routes may share one module, each with
 *   its own id), preferring extended over core
 * - Maintains order: core routes first, then extended routes at each level
 */
const keyOf = (route: RouteConfigEntry): string => route.id ?? route.file;

export function mergeRoutes(core: RouteConfigEntry[], extended: RouteConfigEntry[]): RouteConfigEntry[] {
  // Step 1: Create a Map to track routes by file path
  const routeMap = new Map<string, RouteConfigEntry>();

  // Step 2: Process core routes first
  for (const coreRoute of core) {
    const fileKey = keyOf(coreRoute);
    routeMap.set(fileKey, coreRoute);
  }

  // Step 3: Process extended routes
  for (const extendedRoute of extended) {
    const fileKey = keyOf(extendedRoute);

    if (routeMap.has(fileKey)) {
      // Route exists in both - need to merge
      const coreRoute = routeMap.get(fileKey)!;

      // Check if both have children (layouts that need deep merging)
      if (coreRoute.children && extendedRoute.children) {
        // Deep merge: recursively merge children
        const mergedChildren = mergeRoutes(
          Array.isArray(coreRoute.children) ? coreRoute.children : [],
          Array.isArray(extendedRoute.children) ? extendedRoute.children : []
        );
        routeMap.set(fileKey, {
          ...extendedRoute,
          children: mergedChildren,
        });
      } else {
        // No children or only one has children - prefer extended
        routeMap.set(fileKey, extendedRoute);
      }
    } else {
      // Route only exists in extended
      routeMap.set(fileKey, extendedRoute);
    }
  }

  // Step 4: Build final array maintaining order (core first, then extended-only)
  const result: RouteConfigEntry[] = [];

  // Add all core routes (now merged or original)
  for (const coreRoute of core) {
    const fileKey = keyOf(coreRoute);
    if (routeMap.has(fileKey)) {
      result.push(routeMap.get(fileKey)!);
      routeMap.delete(fileKey); // Remove so we don't add it again
    }
  }

  // Add remaining extended-only routes
  for (const extendedRoute of extended) {
    const fileKey = keyOf(extendedRoute);
    if (routeMap.has(fileKey)) {
      result.push(routeMap.get(fileKey)!);
      routeMap.delete(fileKey);
    }
  }

  return result;
}
