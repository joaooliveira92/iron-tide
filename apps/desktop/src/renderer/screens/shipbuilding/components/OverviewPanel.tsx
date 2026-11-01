import { Badge } from "../../../components/ui/badge.js";
import { Panel } from "../../../components/design-workspace/panels/Panel.js";
import { SelectField } from "../../../components/design-workspace/fields.js";
import { SEVERITY_STYLE } from "../../../components/design-workspace/validation/severity.js";
import { PRIORITY_IDS, PRIORITY_LABEL, type OverviewModel, type PriorityId } from "../overview.js";

const LEVELS = [
  { value: "LOW", label: "Low" },
  { value: "NORMAL", label: "Normal" },
  { value: "HIGH", label: "High" },
] as const;

export type PriorityLevel = "LOW" | "NORMAL" | "HIGH";
export const DEFAULT_PRIORITIES: Readonly<Record<PriorityId, PriorityLevel>> = {
  speed: "NORMAL",
  protection: "NORMAL",
  firepower: "NORMAL",
  range: "NORMAL",
  cost: "NORMAL",
};

export function OverviewPanel({
  model,
  priorities,
  onPriority,
}: {
  readonly model: OverviewModel;
  readonly priorities: Readonly<Record<PriorityId, PriorityLevel>>;
  readonly onPriority: (id: PriorityId, level: PriorityLevel) => void;
}) {
  return (
    <Panel title="Overview">
      <dl className="grid grid-cols-1 gap-y-1.5 text-sm" data-testid="overview-summary">
        {model.values.map((v) => (
          <div key={v.id} className="flex items-baseline justify-between gap-3" data-value={v.id}>
            <dt className="text-muted-foreground">{v.label}</dt>
            <dd className="text-right tabular-nums">{v.value}</dd>
          </div>
        ))}
      </dl>

      <section aria-label="Design warnings" className="space-y-2 border-t pt-3">
        <h3 className="text-sm font-medium">Design warnings</h3>
        <ul className="flex flex-wrap gap-2" data-testid="overview-warnings">
          {model.warnings.map((w) => (
            <li key={w.severity}>
              <Badge variant={SEVERITY_STYLE[w.severity].badge} data-severity={w.severity}>
                {w.count} {SEVERITY_STYLE[w.severity].label.toLowerCase()}
              </Badge>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          Advisories never prevent submission; blocking findings do. The same findings appear under
          Review.
        </p>
      </section>

      <details className="group border-t pt-3">
        <summary className="cursor-pointer text-sm font-medium">Design priorities</summary>
        <section aria-label="Design priorities" className="mt-2 space-y-2">
          <p className="text-xs text-muted-foreground">
            A record of your intent. Changing a priority does not modify the design (no
            assisted-design mode exists yet).
          </p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {PRIORITY_IDS.map((id) => (
              <SelectField
                key={id}
                label={`${PRIORITY_LABEL[id]} priority`}
                shortLabel={PRIORITY_LABEL[id]}
                value={priorities[id]}
                options={[...LEVELS]}
                onChange={(v) => onPriority(id, v as PriorityLevel)}
              />
            ))}
          </div>
        </section>
      </details>
    </Panel>
  );
}
