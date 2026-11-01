import { Badge } from "../../../components/ui/badge.js";
import { Panel } from "../../../components/design-workspace/panels/Panel.js";
import { SEVERITY_STYLE } from "../../../components/design-workspace/validation/severity.js";
import type { OverviewModel } from "../overview.js";

export function OverviewPanel({ model }: { readonly model: OverviewModel }) {
  return (
    <Panel title="Overview" hideTitle>
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
    </Panel>
  );
}
