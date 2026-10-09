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
const INFRA_URL = "http://127.0.0.1:8089/factory.json";

type Infra = {
  models: { id: string; tier: string; runner: string; input_per_mtok: number; output_per_mtok: number }[];
  tiers: Record<string, string>;
  backend: string;
  roles: { role: string; name: string; email: string; own_token: boolean }[];
  repo_skills: boolean;
  snapshots: { store: string; items: { name: string; commit: string; note?: string }[] };
  mcp: string;
  boards: Record<string, { ts: number; role: string; ref?: string; text: string }[]>;
};

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

  const [infra, setInfra] = useState<Infra | null>(null);

  useEffect(() => {
    fetch(INFRA_URL)
      .then((r) => (r.ok ? r.json() : null))
      .then(setInfra)
      .catch(() => setInfra(null));
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
        {infra && (
          <div className="mt-8 flex max-w-xl flex-col gap-4">
            <div className="text-13 font-medium text-secondary">Agents &amp; infrastructure</div>
            <div className="rounded-lg border border-subtle bg-layer-1 p-3">
              <div className="mb-2 text-12 text-tertiary">Model catalogue (USD per million tokens)</div>
              {infra.models.length === 0 ? (
                <div className="text-12 text-tertiary">
                  No models.yaml yet. Copy models.yaml.example to add prices and tiers.
                </div>
              ) : (
                <table className="w-full text-12 text-primary">
                  <tbody>
                    {infra.models.map((m) => (
                      <tr key={m.id}>
                        <td className="py-0.5">{m.id}</td>
                        <td className="text-tertiary">{m.tier}</td>
                        <td className="text-right">
                          ${m.input_per_mtok} in / ${m.output_per_mtok} out
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {Object.keys(infra.tiers).length > 0 && (
                <div className="mt-2 text-12 text-tertiary">
                  {Object.entries(infra.tiers)
                    .map(([tier, id]) => `tier:${tier} → ${id}`)
                    .join("  ·  ")}
                </div>
              )}
            </div>
            <div className="rounded-lg border border-subtle bg-layer-1 p-3 text-12 text-primary">
              <div className="mb-2 text-tertiary">Agent identities (commits and PRs are attributed per role)</div>
              {infra.roles.map((r) => (
                <div key={r.role} className="flex justify-between py-0.5">
                  <span>{r.name}</span>
                  <span className="text-tertiary">{r.own_token ? "own GitHub token" : "shared token"}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 text-12">
              {[
                ["Worker backend", infra.backend],
                ["Skills in the repo", infra.repo_skills ? "on" : "off"],
                ["Snapshot store", infra.snapshots.store || "not set"],
                ["Saved snapshots", String(infra.snapshots.items.length)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-subtle bg-layer-1 p-3">
                  <div className="text-tertiary">{label}</div>
                  <div className="break-all text-14 font-medium text-primary">{value}</div>
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-subtle bg-layer-1 p-3 text-12 text-primary">
              <div className="mb-2 text-tertiary">
                Message board for this project: how its agents talk to each other. Add the label &quot;epic&quot; to a work item
                to give the factory a goal; it plans the tasks itself.
              </div>
              {(infra.boards?.[projectId] ?? []).length === 0 ? (
                <div className="text-tertiary">Nothing posted yet.</div>
              ) : (
                (infra.boards?.[projectId] ?? [])
                  .slice(-15)
                  .reverse()
                  .map((m, i) => (
                    <div key={i} className="border-t border-subtle py-1 first:border-t-0">
                      <span className="text-tertiary">
                        {m.ref || ""} {m.role}:{" "}
                      </span>
                      <span className="whitespace-pre-wrap">{m.text}</span>
                    </div>
                  ))
              )}
            </div>
            <div className="rounded-lg border border-subtle bg-layer-1 p-3 text-12">
              <div className="mb-1 text-tertiary">Connect a local agent so it can pull work from this factory</div>
              <code className="break-all text-primary">{infra.mcp}</code>
            </div>
          </div>
        )}
      </section>
    </SettingsContentWrapper>
  );
}

export default observer(FactorySettingsPage);
