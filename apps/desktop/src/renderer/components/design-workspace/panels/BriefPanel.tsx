import type { DesignDraft, ShipContext, WorkshopView } from "@bluewave/ship-design";
import { Badge } from "../../ui/badge.js";
import { formatExplanation } from "../../../lib/presentation-format/index.js";
import { shipTypeIcon } from "../ship-type-icon.js";
import { NumberField, SelectField } from "../fields.js";
import { shipTypeChoices } from "../shipTypes.js";
import { Panel } from "./Panel.js";
import type { Edit } from "./types.js";

/** The design brief: the ship type the design must qualify as, and the speed and range it is judged against. */
export function BriefPanel({
  draft,
  view,
  edit,
  errorFor,
  ctx,
}: {
  readonly draft: DesignDraft;
  readonly view: WorkshopView;
  readonly edit: Edit;
  /** The inline message for a setting, filed as `<edit kind>:<setting>` (see `editField`), while it breaks the design. */
  readonly errorFor?: (field: string) => string | undefined;
  /** The rules context of the board's month, for which ship types are offered. */
  readonly ctx: ShipContext;
}) {
  const r = draft.requirement;
  const icon = (t: string) => {
    const Icon = shipTypeIcon(t);
    return <Icon className="h-4 w-4" aria-hidden="true" />;
  };
  // The finding next to an unavailable type explains why it cannot be built (see `shipTypeChoices`).
  const options = shipTypeChoices(ctx, r.category).map((c) => ({ ...c, icon: icon(c.value) }));
  // Findings about the brief itself (type unavailable, classification) sit next to the control that fixes them.
  const briefFindings = [
    ...view.findingsBySeverity.BLOCKING,
    ...view.findingsBySeverity.CRITICAL,
    ...view.findingsBySeverity.WARNING,
    ...view.findingsBySeverity.ADVISORY,
  ].filter((f) => f.subject?.settings === "brief");
  const mismatch = view.naturalClass !== null && view.naturalClass !== r.category;
  return (
    <Panel title="Design brief">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Class code</span>
        <Badge
          variant="outline"
          className="tabular-nums"
          aria-label={`Class code ${view.classCode}`}
        >
          {view.classCode}
        </Badge>
        <span className="text-muted-foreground">Natural class</span>
        <Badge variant={mismatch ? "destructive" : "secondary"}>
          {view.naturalClass ?? "none"}
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label="Ship type"
          className="col-span-2"
          value={r.category}
          options={options}
          error={errorFor?.("set_requirement:category")}
          onChange={(v) => edit({ kind: "set_requirement", patch: { category: v } })}
        />
        <NumberField
          label="Required top speed"
          unit="kn"
          value={r.requiredSpeedMilliKnots}
          scale={1000}
          decimals={1}
          error={errorFor?.("set_requirement:requiredSpeedMilliKnots")}
          onCommit={(v) => edit({ kind: "set_requirement", patch: { requiredSpeedMilliKnots: v } })}
        />
        <NumberField
          label="Cruising speed"
          unit="kn"
          value={r.cruiseSpeedMilliKnots}
          scale={1000}
          decimals={1}
          error={errorFor?.("set_requirement:cruiseSpeedMilliKnots")}
          onCommit={(v) => edit({ kind: "set_requirement", patch: { cruiseSpeedMilliKnots: v } })}
        />
        <NumberField
          label="Required range"
          unit="nm"
          value={r.requiredRangeNm}
          error={errorFor?.("set_requirement:requiredRangeNm")}
          onCommit={(v) => edit({ kind: "set_requirement", patch: { requiredRangeNm: v } })}
        />
      </div>
      {briefFindings.length > 0 && (
        <ul aria-label="Findings about the ship type" className="space-y-1 text-xs">
          {briefFindings.map((f, i) => (
            <li key={`${f.id}-${i}`}>
              <span className="font-medium">
                {f.severity === "BLOCKING"
                  ? "Blocking: "
                  : `${f.severity[0]}${f.severity.slice(1).toLowerCase()}: `}
              </span>
              {formatExplanation(f.what)} {formatExplanation(f.why)}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">
        The type is what the ship must qualify as. A design that does not meet its type cannot be
        built; the natural class is the type it would actually qualify as.
      </p>
    </Panel>
  );
}
