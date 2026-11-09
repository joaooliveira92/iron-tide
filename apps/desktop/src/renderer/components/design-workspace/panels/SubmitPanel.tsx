import { useEffect, useState } from "react";
import { useDesignPriceView } from "../design-price-view.js";
import { envelopeOf, stampCommand } from "../../../lib/command-envelope.js";
import { useBridge } from "../../../lib/bridge-context.js";
import { Alert } from "../../ui/alert.js";
import { Button } from "../../ui/button.js";
import { useCampaignRevision } from "../../../shell/CampaignShellContext.js";
import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";
import type { PresentationFormat } from "../../../lib/presentation-format/index.js";
import { useDesignState } from "../DesignWorkspaceContext.js";
import { Panel } from "./Panel.js";
import { plural } from "../plural.js";
import { plainShipTypeName } from "../shipTypes.js";
import type {
  DesignStudyPreview,
  DesignStudyPreviewOutcome,
} from "../../../../shared/design-contract.js";

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

export function studyPreviewLine(
  study: DesignStudyPreview | undefined,
  unitsText: string,
  format: PresentationFormat,
): string {
  if (study === undefined)
    return `Charged to the treasury when ordered: ${unitsText}. Name the class to see its design study.`;
  return `Design study before this can be ordered: ${plural(study.months, "month", undefined, undefined, format)} and ${plural(study.cost, "treasury unit", undefined, undefined, format)}${study.derived ? `, ${format.percent(study.discountBp, 0)} less as a variant of ${study.baselineClassName ?? "an earlier class"}` : ""}. Build cost ${unitsText}.`;
}

export function useStudyPreview(
  bridge: ReturnType<typeof useBridge>,
  sessionId: string,
  className: string,
  draft: unknown,
  valid: boolean,
): DesignStudyPreviewOutcome | undefined {
  const [outcome, setOutcome] = useState<DesignStudyPreviewOutcome | undefined>(undefined);
  useEffect(() => {
    if (!bridge || !valid || className === "") {
      setOutcome(undefined);
      return;
    }
    let current = true;
    void bridge.campaign
      .execute("previewDesignStudy", {
        sessionId,
        className,
        draft: draft as Record<string, unknown>,
      })
      .then((r) => {
        if (current) setOutcome(r.outcome === "success" ? r.value : undefined);
      })
      .catch(() => {
        if (current) setOutcome(undefined);
      });
    return () => {
      current = false;
    };
  }, [bridge, sessionId, className, draft, valid]);
  return outcome;
}

export type Affordability = "affordable" | "tight" | "unaffordable";

export interface StudyReview {
  readonly monthlyPayment: number;
  readonly freeTreasury: number | null;
  readonly after: number | null;
  readonly affordability: Affordability | null;
}

export function reviewOf(
  outcome: DesignStudyPreviewOutcome,
  study: DesignStudyPreview,
): StudyReview {
  const monthlyPayment = Math.ceil(study.cost / Math.max(1, study.months));
  const free = outcome.freeTreasury ?? null;
  const affordability: Affordability | null =
    free === null || outcome.affordable === undefined
      ? null
      : !outcome.affordable
        ? "unaffordable"
        : study.cost > free
          ? "tight"
          : "affordable";
  return {
    monthlyPayment,
    freeTreasury: free,
    after: free === null ? null : free - study.cost,
    affordability,
  };
}

export function affordabilityLine(
  review: StudyReview,
  study: DesignStudyPreview,
  format: PresentationFormat,
): string | null {
  const payment = format.count(review.monthlyPayment);
  switch (review.affordability) {
    case null:
      return null;
    case "affordable":
      return "The treasury covers the whole study.";
    case "tight":
      return `The treasury covers the first payment of ${payment} but not the whole study (${format.count(study.cost)}). Later months depend on income. A month without the money makes no progress.`;
    case "unaffordable":
      return `The treasury cannot pay the first monthly payment of ${payment} this month. The study makes no progress until it can. You can still submit.`;
  }
}

export interface SubmitBlocker {
  readonly id: string;
  readonly text: string;
  readonly actionLabel: string;
  readonly onSelect: () => void;
}

function ReviewStep({
  className,
  category,
  study,
  review,
  format,
}: {
  readonly className: string;
  readonly category: string;
  readonly study: DesignStudyPreview;
  readonly review: StudyReview;
  readonly format: PresentationFormat;
}) {
  const message = affordabilityLine(review, study, format);
  const rows: Array<readonly [string, string]> = [
    ["Class", className],
    ["Type", plainShipTypeName(category)],
    ["Study length", plural(study.months, "month", undefined, undefined, format)],
    ["Study cost", plural(study.cost, "treasury unit", undefined, undefined, format)],
    [
      "Monthly payments",
      `${plural(review.monthlyPayment, "treasury unit", undefined, undefined, format)} a month for ${plural(study.months, "month", undefined, undefined, format)}`,
    ],
    ...(review.freeTreasury === null
      ? []
      : ([
          ["Treasury now", format.count(review.freeTreasury)],
          ["After the whole study", format.count(review.after ?? 0)],
        ] as const)),
    ...(study.derived && study.baselineClassName !== null
      ? ([
          [
            "Variant discount",
            `A variant of ${study.baselineClassName}: ${format.percent(study.discountBp, 0)} shorter and cheaper`,
          ],
        ] as const)
      : []),
  ];
  return (
    <section
      aria-label="Review before submitting"
      data-testid="submit-review"
      className="space-y-2"
    >
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {message !== null && (
        <p
          data-testid="affordability"
          className={
            review.affordability === "affordable"
              ? "text-xs text-muted-foreground"
              : "text-xs text-amber-600"
          }
        >
          {message}
        </p>
      )}
    </section>
  );
}

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

export function SubmitPanel({
  sessionId,
  name,
  onNameChange,
  onRequestName,
  blockers = [],
}: {
  readonly sessionId: string;
  readonly name?: string;
  readonly onNameChange?: (name: string) => void;
  readonly onRequestName?: () => void;
  readonly blockers?: readonly SubmitBlocker[];
}) {
  const {
    draft,
    view: { valid },
  } = useDesignState();
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
  const [queuedKey, setQueuedKey] = useState<string | null>(null);
  const trimmedName = className.trim();
  const previewOutcome = useStudyPreview(bridge, sessionId, trimmedName, draft, valid);
  const preview = previewOutcome?.study;
  const priceView = useDesignPriceView();
  if (!bridge) return null;
  const key = `${revision ?? ""}|${className.trim()}|${JSON.stringify(draft)}`;
  const alreadyQueued = queuedKey === key;
  const canSubmit =
    valid && revision !== null && className.trim() !== "" && !busy && !alreadyQueued;
  const submit = async () => {
    if (revision === null) return;
    setBusy(true);
    try {
      const r = await bridge.campaign.execute("submitDesignCommand", {
        ...envelopeOf(sessionId, stampCommand("design", revision)),
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
  const hostNamed = onNameChange !== undefined;
  return (
    <Panel title="Submit for construction">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          {hostNamed ? (
            <>
              <p className="text-xs text-muted-foreground">Class name</p>
              <p className="flex h-8 items-center text-sm font-medium">
                {className.trim() === "" ? "Not named yet" : className.trim()}
              </p>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
        <Button onClick={() => void submit()} disabled={!canSubmit}>
          {busy ? "Submitting…" : alreadyQueued ? "Queued" : "Submit design"}
        </Button>
      </div>
      {valid && (
        <p className="text-xs text-muted-foreground" data-testid="study-preview">
          {studyPreviewLine(preview, priceView.unitsText, format)}
        </p>
      )}
      {valid && previewOutcome !== undefined && preview !== undefined && (
        <ReviewStep
          className={trimmedName}
          category={draft.requirement.category}
          study={preview}
          review={reviewOf(previewOutcome, preview)}
          format={format}
        />
      )}
      {!valid && (
        <div className="space-y-1.5 text-xs text-muted-foreground">
          <p>
            {blockers.length > 0
              ? `Submit is unavailable: ${plural(blockers.length, "blocking finding", undefined, undefined, format)} must be fixed first.`
              : "Submit is unavailable: resolve the blocking findings first."}
          </p>
          {blockers.length > 0 && (
            <ul className="space-y-1">
              {blockers.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center gap-2">
                  <span className="text-foreground">{b.text}</span>
                  <Button variant="outline" size="sm" onClick={b.onSelect}>
                    {b.actionLabel}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {valid && className.trim() === "" && (
        <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          Name the class to submit it.
          {onRequestName !== undefined && (
            <Button variant="outline" size="sm" onClick={onRequestName}>
              Enter a class name
            </Button>
          )}
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
