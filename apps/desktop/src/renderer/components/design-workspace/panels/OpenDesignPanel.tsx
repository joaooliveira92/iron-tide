import { useState } from "react";
import type { DesignDraft } from "@bluewave/ship-design";
import { useBridge } from "../../../lib/bridge-context.js";
import { Button } from "../../ui/button.js";
import { ConfirmDialog } from "../ConfirmAction.js";
import { revisableProjects, type RevisionProject } from "../revisionPreview.js";

export function OpenDesignPanel({
  sessionId,
  projects,
  dirty,
  onOpen,
}: {
  readonly sessionId: string | undefined;
  readonly projects: readonly RevisionProject[];
  readonly dirty: boolean;
  readonly onOpen: (draft: DesignDraft, name: string) => void;
}) {
  const bridge = useBridge();
  const [pending, setPending] = useState<RevisionProject | null>(null);
  const [error, setError] = useState<string | null>(null);
  const open = revisableProjects(projects);

  const load = (project: RevisionProject) => {
    if (!bridge || sessionId === undefined) return;
    void bridge.campaign
      .execute("loadProjectDraft", { sessionId, projectId: project.projectId })
      .then((r) => {
        if (r.outcome === "success") onOpen(r.value.draft, project.className);
        else setError(`${project.className} could not be opened.`);
      });
  };
  const choose = (project: RevisionProject) => {
    setError(null);
    if (dirty) setPending(project);
    else load(project);
  };

  return (
    <div className="flex flex-col gap-2 p-3">
      {open.length === 0 ? (
        <p className="text-sm text-muted-foreground">No ships are under construction to open.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {open.map((p) => (
            <li key={p.projectId}>
              <Button variant="outline" className="w-full justify-start" onClick={() => choose(p)}>
                {p.className}
                <span className="ml-auto text-xs text-muted-foreground">Under construction</span>
              </Button>
            </li>
          ))}
        </ul>
      )}
      {error !== null && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(next) => !next && setPending(null)}
        title="Replace my design?"
        description="This replaces the design you are working on, and its edit history is cleared."
        confirmLabel="Replace my design"
        onConfirm={() => {
          if (pending !== null) load(pending);
          setPending(null);
        }}
      />
    </div>
  );
}
