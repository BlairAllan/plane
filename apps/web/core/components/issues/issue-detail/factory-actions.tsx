/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useProjectState } from "@/hooks/store/use-project-state";

type Props = { workspaceSlug: string; projectId: string; issueId: string };

const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// The factory treats a reply on a work item in Needs Direction as the answer.
export const FactoryActions = observer(function FactoryActions({ workspaceSlug, projectId, issueId }: Props) {
  const {
    issue: { getIssueById, updateIssue },
    createComment,
  } = useIssueDetail();
  const { getStateById, getProjectStates } = useProjectState();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const issue = getIssueById(issueId);
  const state = issue?.state_id ? getStateById(issue.state_id) : undefined;
  const waiting = state?.name === "Needs Direction";
  if (!waiting && state?.name !== "In Review" && state?.name !== "Cancelled") return null;

  const retry = async () => {
    const todo = getProjectStates(projectId)?.find((st) => st.name === "Todo");
    if (!todo) return;
    setBusy(true);
    try {
      if (note.trim())
        await createComment(workspaceSlug, projectId, issueId, {
          comment_html: `<p>Retry: ${escapeHtml(note.trim())}</p>`,
        });
      await updateIssue(workspaceSlug, projectId, issueId, { state_id: todo.id });
      setNote("");
      setToast({ type: TOAST_TYPE.SUCCESS, title: "Re-queued", message: "The factory will pick it up shortly." });
    } catch {
      setToast({ type: TOAST_TYPE.ERROR, title: "Error!", message: "Could not re-queue the work item." });
    } finally {
      setBusy(false);
    }
  };

  const reply = async (text: string) => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await createComment(workspaceSlug, projectId, issueId, { comment_html: `<p>${escapeHtml(text.trim())}</p>` });
      setNote("");
      setToast({ type: TOAST_TYPE.SUCCESS, title: "Sent", message: "The factory will pick this up shortly." });
    } catch {
      setToast({ type: TOAST_TYPE.ERROR, title: "Error!", message: "Could not send the reply." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="my-4 flex flex-col gap-2 rounded-lg border border-subtle bg-layer-1 p-3">
      <div className="text-13 font-medium text-primary">
        {waiting ? "The agent is waiting for you" : "Not what you wanted?"}
      </div>
      <div className="text-12 text-tertiary">
        {waiting
          ? "Approve to let it continue, or write what it should change or the answer to its question."
          : "Retry puts it back in the queue; add guidance and the agent will see it."}
      </div>
      <div className="flex items-center gap-2">
        <input
          className="min-w-0 flex-1 rounded-md border border-subtle bg-surface-1 px-2 py-1.5 text-13 text-primary"
          placeholder="Your answer or requested changes"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        {waiting ? (
          <>
            <Button variant="secondary" size="lg" disabled={busy || !note.trim()} onClick={() => reply(note)}>
              Send
            </Button>
            <Button variant="primary" size="lg" disabled={busy} onClick={() => reply("approve")}>
              Approve
            </Button>
          </>
        ) : (
          <Button variant="primary" size="lg" disabled={busy} onClick={retry}>
            Retry
          </Button>
        )}
      </div>
    </div>
  );
});
