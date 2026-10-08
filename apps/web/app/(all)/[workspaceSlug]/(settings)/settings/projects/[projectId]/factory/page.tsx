/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { observer } from "mobx-react";
// plane imports
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { TextArea } from "@plane/ui";
import { NotAuthorizedView } from "@/components/auth-screens/not-authorized-view";
import { PageHead } from "@/components/core/page-title";
import { SettingsContentWrapper } from "@/components/settings/content-wrapper";
import { SettingsHeading } from "@/components/settings/heading";
// hooks
import { useProject } from "@/hooks/store/use-project";
import { useUserPermissions } from "@/hooks/store/user";
// local imports
import type { Route } from "./+types/page";
import { FactoryProjectSettingsHeader } from "./header";

// The factory reads `Repos:` lines from the project description.
const REPOS_LINE = /^\s*repos?\s*:/i;

const readRepos = (description?: string): string =>
  (description ?? "")
    .split("\n")
    .filter((line) => REPOS_LINE.test(line))
    .flatMap((line) => line.replace(REPOS_LINE, "").split(/[\s,]+/))
    .filter(Boolean)
    .join("\n");

const writeRepos = (description: string | undefined, repos: string): string => {
  const rest = (description ?? "").split("\n").filter((line) => !REPOS_LINE.test(line));
  const list = repos.split(/[\s,]+/).filter(Boolean);
  if (list.length) rest.push(`Repos: ${list.join(", ")}`);
  return rest.join("\n").trim();
};

type Stats = {
  merged: number;
  opened: number;
  needs_you: number;
  total_cost: number;
  autonomy: number | null;
  cycle_minutes: number | null;
  cost_per_merged: number | null;
};

// `factory up` serves this read-only summary on the same machine.
const STATS_URL = "http://127.0.0.1:8089/board.json";

function FactorySettingsPage({ params }: Route.ComponentProps) {
  const { workspaceSlug, projectId } = params;
  const { workspaceUserInfo, allowPermissions } = useUserPermissions();
  const { currentProjectDetails: project, updateProject } = useProject();
  const { t } = useTranslation();
  const [repos, setRepos] = useState("");
  const [saving, setSaving] = useState(false);

  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch(STATS_URL)
      .then((r) => (r.ok ? r.json() : null))
      .then(setStats)
      .catch(() => setStats(null));
  }, []);

  const isAdmin = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.PROJECT);

  useEffect(() => {
    setRepos(readRepos(project?.description));
  }, [project?.description]);

  if (workspaceUserInfo && !isAdmin) return <NotAuthorizedView section="settings" isProjectView className="h-auto" />;

  const save = async () => {
    setSaving(true);
    try {
      await updateProject(workspaceSlug, projectId, { description: writeRepos(project?.description, repos) });
      setToast({ type: TOAST_TYPE.SUCCESS, title: "Saved", message: "The factory picks this up within a minute." });
    } catch {
      setToast({ type: TOAST_TYPE.ERROR, title: "Error!", message: "Something went wrong. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsContentWrapper header={<FactoryProjectSettingsHeader />} hugging>
      <PageHead title={project?.name ? `${project.name} - Factory` : undefined} />
      <section className="w-full">
        <SettingsHeading
          title={t("project_settings.factory.heading")}
          description={t("project_settings.factory.description")}
        />
        {stats && (
          <div className="mt-6 grid max-w-xl grid-cols-3 gap-2">
            {[
              ["Need you", String(stats.needs_you)],
              ["Merged / PRs", `${stats.merged} / ${stats.opened}`],
              ["Autonomy", stats.autonomy === null ? "-" : `${stats.autonomy}%`],
              ["Cycle time", stats.cycle_minutes === null ? "-" : `${stats.cycle_minutes} min`],
              ["Cost / merged PR", stats.cost_per_merged === null ? "-" : `$${stats.cost_per_merged}`],
              ["Total cost", `$${stats.total_cost}`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-subtle bg-layer-1 p-3">
                <div className="text-12 text-tertiary">{label}</div>
                <div className="text-16 font-medium text-primary">{value}</div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-6 flex flex-col gap-2 max-w-xl">
          <label className="text-13 font-medium text-secondary" htmlFor="factory-repos">
            Repositories
          </label>
          <TextArea
            id="factory-repos"
            name="repos"
            value={repos}
            onChange={(e) => setRepos(e.target.value)}
            placeholder={"owner/repo\nhttps://github.com/owner/other-repo"}
            rows={5}
            className="w-full"
            disabled={!isAdmin}
          />
          <p className="text-12 text-tertiary">
            One per line. The first is the default; a work item can name more with a Repos: line, or a repo:name label.
          </p>
          <div>
            <Button variant="primary" size="lg" onClick={save} loading={saving} disabled={!isAdmin}>
              {saving ? "Saving" : "Save"}
            </Button>
          </div>
        </div>
      </section>
    </SettingsContentWrapper>
  );
}

export default observer(FactorySettingsPage);
