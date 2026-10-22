import { useState } from "react";
import { useBridge } from "../../../lib/bridge-context.js";
import type { DesignDraft } from "@bluewave/ship-design";
import { Alert } from "../../ui/alert.js";
import { Button } from "../../ui/button.js";
import { useCampaignRevision } from "../../../shell/CampaignShellContext.js";
import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";
import type { PresentationFormat } from "../../../lib/presentation-format/index.js";
import { Panel } from "./Panel.js";
import { plural } from "../plural.js";
import type { DesignStudyPreview } from "../../../../shared/design-contract.js";

let submitCounter = 0;

/** What the player is told when a design is queued: with study rules, its study's months and cost (ADR-0085). */
export function queuedLines(
  name: string,
  study: DesignStudyPreview | undefined,
  format: PresentationFormat,
): string[] {
  if (study === undefined)
    return [`Design queued. "${name}" joins the Design Catalog when the month is advanced.`];
  const lines = [
    `Design queued. Its design study starts when the month is advanced: ${plural(study.months, "month", undefined, undefined, format)} and ${plural(study.cost, "treasury unit", undefined, undefined, format)}, paid month by month.`,
  ];
  if (study.derived && study.baselineClassName !== null)
    lines.push(
      `A variant of ${study.baselineClassName}: the study is ${format.percent(study.discountBp, 0)} shorter and cheaper.`,
    );
  else if (study.failedCriteria.length > 0)
    lines.push(
      `Too different from the earlier "${name}" design to be a variant (${study.failedCriteria
        .map((c) =>
          c
            .replace(/^DERIVED_DESIGN_/, "")
            .replaceAll("_", " ")
            .toLowerCase(),
        )
        .join(", ")}), so it starts a new design family at the full study cost.`,
    );
  lines.push(
    `"${name}" joins the Design Catalog when the study is done. A month without the money makes no progress.`,
  );
  return lines;
}

/** What a refused submission means for the player; the engine's own lines follow it. */
export function rejectionLead(reason: string): string {
  switch (reason) {
    case "DESIGN_REJECTED":
      return "The game's own check found this design cannot be built:";
    case "INVALID_COMMAND_PAYLOAD":
      return "The design is incomplete and was not sent:";
    case "SESSION_NOT_FOUND":
      return "The campaign is no longer open. Reopen it from Campaign File and submit again.";
    case "IDEMPOTENCY_CONFLICT":
      return "A different design was already sent under this request. Submit again.";
    default:
      return `The design was not queued (${reason.replaceAll("_", " ").toLowerCase()}):`;
  }
}

/**
 * Sends the working design to the engine (ADR-0066). The main process re-compiles it and queues a real `SubmitDesign`
 * command; the design appears in the Design Catalog when the month is committed.
 */
export function SubmitPanel({
  sessionId,
  draft,
  valid,
  name,
  onNameChange,
}: {
  readonly sessionId: string;
  readonly draft: DesignDraft;
  readonly valid: boolean;
  /** The class name, when a host owns it (the Shipbuilding top bar); the panel keeps its own otherwise. */
  readonly name?: string;
  readonly onNameChange?: (name: string) => void;
}) {
  const revision = useCampaignRevision();
  const bridge = useBridge();
  const format = usePresentationFormat();
  const [ownName, setOwnName] = useState("");
  const className = name ?? ownName;
  const setClassName = onNameChange ?? setOwnName;
  const [result, setResult] = useState<{
    readonly tone: "ok" | "bad";
    readonly lines: readonly string[];
  } | null>(null);
  const [busy, setBusy] = useState(false);
  // The exact design last queued this month, so the same one is not sent twice by a second click.
  const [queuedKey, setQueuedKey] = useState<string | null>(null);
  if (!bridge) return null;
  const key = `${revision ?? ""}|${className.trim()}|${JSON.stringify(draft)}`;
  const alreadyQueued = queuedKey === key;
  const canSubmit =
    valid && revision !== null && className.trim() !== "" && !busy && !alreadyQueued;
  const submit = async () => {
    if (revision === null) return;
    setBusy(true);
    submitCounter++;
    try {
      const r = await bridge.campaign.execute("submitDesignCommand", {
        sessionId,
        expectedRevision: revision,
        transportRequestId: `design-${Date.now().toString(36)}-${submitCounter}`,
        className: className.trim(),
        draft: draft as unknown as Record<string, unknown>,
      });
      if (r.outcome === "success") {
        setQueuedKey(key);
        setResult({ tone: "ok", lines: queuedLines(className.trim(), r.value.study, format) });
      } else {
        setResult({
          tone: "bad",
          lines: [
            rejectionLead(r.reason),
            ...r.diagnostics,
            "Your design is unchanged on the board.",
          ],
        });
      }
    } catch (e) {
      setResult({
        tone: "bad",
        lines: [
          `The game could not be reached (${e instanceof Error ? e.message : String(e)}).`,
          "Your design is unchanged on the board; submit again.",
        ],
      });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Panel title="Submit for construction">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label htmlFor="class-name" className="block text-xs text-muted-foreground">
            Class name
          </label>
          <input
            id="class-name"
            className="h-8 w-64 rounded-md border bg-background px-2 text-sm"
            value={className}
            maxLength={60}
            onChange={(e) => setClassName(e.target.value)}
          />
        </div>
        <Button onClick={() => void submit()} disabled={!canSubmit}>
          {busy ? "Submitting…" : alreadyQueued ? "Queued" : "Submit design"}
        </Button>
      </div>
      {!valid && (
        <p className="text-xs text-muted-foreground">
          Resolve the blocking findings before submitting.
        </p>
      )}
      {result !== null && (
        <Alert role="status" variant={result.tone === "ok" ? "default" : "destructive"}>
          <ul>
            {result.lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </Alert>
      )}
    </Panel>
  );
}
