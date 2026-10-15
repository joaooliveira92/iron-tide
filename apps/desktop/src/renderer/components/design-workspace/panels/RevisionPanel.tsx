import { useEffect, useState } from "react";
import { useBridge } from "../../../lib/bridge-context.js";
import {
  draftChangeKinds,
  type ChangeKind,
  type DesignDraft,
  type DraftEdit,
  type RevisionDecision,
} from "@bluewave/ship-design";
import { Ship } from "lucide-react";
import {
  Attachment,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from "../../ui/attachment.js";
import { Badge } from "../../ui/badge.js";
import { Alert } from "../../ui/alert.js";
import { useCampaignRevision } from "../../../shell/CampaignShellContext.js";
import type { DrawingBoardContent } from "../content.js";
import { ConfirmAction } from "../ConfirmAction.js";
import { SelectField } from "../fields.js";
import {
  changeKinds,
  previewRevision,
  REASON_TEXT,
  revisableProjects,
  TIER_LABEL,
  type RevisionProject,
} from "../revisionPreview.js";
import { Panel } from "./Panel.js";
import { plural } from "../plural.js";

const TIER_BADGE: Record<RevisionDecision["tier"], "secondary" | "outline" | "destructive"> = {
  T0_FREE: "outline",
  T1_REVISION: "secondary",
  T2_REDESIGN: "destructive",
  T3_RECONSTRUCTION: "destructive",
};
const pct = (bp: number) => `${(bp / 100).toFixed(1)}%`;
let reviseCounter = 0;

/**
 * What would these changes cost on a ship already being built, and (for ships whose design the engine kept) apply them.
 * For a revisable project the comparison is against that ship's real draft with the engine's own diff, so the preview
 * is exactly what the engine will decide. For an authored design there is no draft: the preview then counts the edits
 * made on the board and cannot be applied.
 */
export function RevisionPanel({
  sessionId,
  projects,
  history,
  draft,
  startDraft,
  content,
  onLoad,
  dirty,
}: {
  readonly sessionId?: string;
  readonly projects: readonly RevisionProject[];
  readonly history: readonly DraftEdit[];
  readonly draft: DesignDraft;
  readonly startDraft: DesignDraft;
  readonly content: DrawingBoardContent;
  readonly onLoad: (draft: DesignDraft) => void;
  readonly dirty: boolean;
}) {
  const balance = content.revision;
  const open = revisableProjects(projects);
  const [chosen, setChosen] = useState<string>("");
  const project = open.find((p) => p.projectId === chosen) ?? open[0];
  const bridge = useBridge();
  const revision = useCampaignRevision();
  const [real, setReal] = useState<{ projectId: string; draft: DesignDraft } | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const projectId = project?.projectId;
  const revisable = project?.revisable === true;

  useEffect(() => {
    setReal(null);
    setResult(null);
    if (!bridge || sessionId === undefined || projectId === undefined || !revisable) return;
    let live = true;
    void bridge.campaign.execute("loadProjectDraft", { sessionId, projectId }).then((r) => {
      if (live && r.outcome === "success")
        setReal({ projectId, draft: r.value.draft as unknown as DesignDraft });
    });
    return () => {
      live = false;
    };
  }, [bridge, sessionId, projectId, revisable]);

  if (balance === null) {
    return (
      <Panel title="Revision preview">
        <p className="text-sm text-muted-foreground">This ruleset has no revision rules.</p>
      </Panel>
    );
  }
  if (project === undefined) {
    return (
      <Panel title="Revision preview">
        <p className="text-sm text-muted-foreground">
          No ships are under construction, so there is nothing to revise.
        </p>
      </Panel>
    );
  }
  const categories = new Map(content.catalogue.map((e) => [e.id, e.category]));
  const categoryOf = (id: string) => categories.get(id);
  const exact = real !== null && real.projectId === project.projectId;
  const kinds: ChangeKind[] = exact
    ? draftChangeKinds(real.draft, draft, categoryOf)
    : changeKinds(history, startDraft, draft, categoryOf);
  const d: RevisionDecision | null = previewRevision(kinds, project, balance);
  const canApply =
    exact &&
    d !== null &&
    !d.requiresRebuildProject &&
    sessionId !== undefined &&
    revision !== null &&
    bridge !== undefined &&
    !busy;

  const apply = async () => {
    if (!bridge || sessionId === undefined || revision === null) return;
    setBusy(true);
    reviseCounter++;
    try {
      const r = await bridge.campaign.execute("reviseProjectCommand", {
        sessionId,
        expectedRevision: revision,
        transportRequestId: `revise-${Date.now().toString(36)}-${reviseCounter}`,
        projectId: project.projectId,
        draft: draft as unknown as Record<string, unknown>,
      });
      setResult(
        r.outcome === "success"
          ? {
              tone: "ok",
              text: `Revision queued (${TIER_LABEL[r.value.tier]}). It takes effect when the month is committed.`,
            }
          : {
              tone: "bad",
              text: (r.diagnostics.length > 0 ? r.diagnostics : [r.reason]).join(" "),
            },
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="Revision preview">
      <SelectField
        label="If applied to project"
        value={project.projectId}
        options={open.map((p) => ({
          value: p.projectId,
          label: `${p.className} (${pct(p.totalWork > 0 ? Math.floor((p.completedWork * 10_000) / p.totalWork) : 10_000)} built${p.holdUntilMonth ? `, on hold until ${p.holdUntilMonth}` : ""})`,
        }))}
        onChange={setChosen}
      />
      <Attachment aria-label="Selected ship" state={revisable ? "done" : "idle"}>
        <AttachmentMedia>
          <Ship />
        </AttachmentMedia>
        <AttachmentContent>
          <AttachmentTitle>{project.className}</AttachmentTitle>
          <AttachmentDescription>
            {pct(
              project.totalWork > 0
                ? Math.floor((project.completedWork * 10_000) / project.totalWork)
                : 10_000,
            )}{" "}
            built · {revisable ? "design on file" : "authored design"}
            {project.holdUntilMonth ? ` · on hold until ${project.holdUntilMonth}` : ""}
          </AttachmentDescription>
        </AttachmentContent>
      </Attachment>
      {exact && (
        <ConfirmAction
          variant="outline"
          confirm={dirty}
          title="Replace your design?"
          description="Loading this ship's design replaces the design you are working on, and its edit history is cleared."
          confirmLabel="Replace my design"
          onConfirm={() => onLoad(real.draft)}
        >
          Load this ship&apos;s design into the board
        </ConfirmAction>
      )}
      {d === null ? (
        <p className="text-sm">No changes yet, so nothing would need revising.</p>
      ) : (
        <div role="status" className="space-y-1 text-sm">
          <p className="font-medium">
            <Badge variant={TIER_BADGE[d.tier]}>{TIER_LABEL[d.tier]}</Badge>{" "}
            <span className="font-normal">at {pct(d.progressBp)} hull progress</span>
          </p>
          <ul className="list-disc pl-5 text-muted-foreground">
            {d.reasonCodes.map((c) => (
              <li key={c}>{REASON_TEXT[c] ?? c}</li>
            ))}
            {d.reasonCodes.length === 0 && <li>Early enough that nothing is lost.</li>}
          </ul>
          <dl className="grid grid-cols-2 gap-x-4 tabular-nums">
            {d.delayMonths > 0 && (
              <>
                <dt className="text-muted-foreground">Funding on hold for</dt>
                <dd className="text-right">{plural(d.delayMonths, "month")}</dd>
              </>
            )}
            {d.reworkWorkMicro > 0 && (
              <>
                <dt className="text-muted-foreground">Rework</dt>
                <dd className="text-right">{d.reworkWorkMicro.toLocaleString("en-US")} work</dd>
              </>
            )}
            {d.studyCostMultiplierBp > 0 && (
              <>
                <dt className="text-muted-foreground">Redesign study cost</dt>
                <dd className="text-right">×{(d.studyCostMultiplierBp / 10_000).toFixed(2)}</dd>
              </>
            )}
            {d.tier === "T2_REDESIGN" && (
              <>
                <dt className="text-muted-foreground">Hull work kept</dt>
                <dd className="text-right">
                  {Math.round(d.hullDoneWorkAfter).toLocaleString("en-US")} of{" "}
                  {project.completedWork.toLocaleString("en-US")}
                </dd>
              </>
            )}
          </dl>
          {d.requiresRebuildProject && (
            <p>
              This ship is too far along to be revised. Finish it as designed, then rebuild it from
              the Rebuild a ship panel, or use "Submit design" to add this version as a new class
              and order it as a separate ship.
            </p>
          )}
        </div>
      )}
      {exact && (
        <ConfirmAction
          confirm
          disabled={!canApply}
          title="Apply this revision?"
          description={
            d === null
              ? ""
              : `${TIER_LABEL[d.tier]} at ${pct(d.progressBp)} hull progress. ${d.tier === "T2_REDESIGN" ? "Part of the hull work already done will be lost. " : ""}It is queued now and takes effect when the month is committed.`
          }
          confirmLabel="Queue the revision"
          onConfirm={() => void apply()}
        >
          {busy ? "Queuing…" : "Apply revision to this ship"}
        </ConfirmAction>
      )}
      {result !== null && (
        <Alert variant={result.tone === "ok" ? "default" : "destructive"}>{result.text}</Alert>
      )}
      <p className="text-xs text-muted-foreground">
        Changes counted:{" "}
        {kinds.length > 0 ? kinds.join(", ").toLowerCase().replaceAll("_", " ") : "none"}.{" "}
        {exact
          ? "Compared with this ship's real design. Armour and machinery orders are assumed not placed."
          : revisable
            ? "Loading this ship's design…"
            : "This ship uses an authored design with no component-level drawing yet, so it cannot be revised; this is only an estimate from your edits."}
      </p>
    </Panel>
  );
}
