import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";
import { useDesignState } from "../DesignWorkspaceContext.js";
import { useDesignPriceView } from "../design-price-view.js";
import { Panel } from "./Panel.js";
import { YardList } from "./YardList.js";

export function ForecastPanel() {
  const { view } = useDesignState();
  const price = useDesignPriceView();
  const format = usePresentationFormat();
  return (
    <Panel title="Cost and construction forecast">
      <dl className="grid grid-cols-1 gap-1 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Build cost (first of class)</dt>
          <dd className="tabular-nums">{format.moneyFromMicro(price.price.costMicro)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Charged to the treasury when ordered</dt>
          <dd className="tabular-nums">
            {price.treasuryText ?? price.unitsText}{" "}
            <span className="text-muted-foreground">({price.unitSizeText})</span>
          </dd>
        </div>
        {price.overBudgetText !== null && (
          <div role="status" className="font-medium text-destructive">
            {price.overBudgetText}
          </div>
        )}
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Monthly upkeep</dt>
          <dd className="tabular-nums">{price.upkeepText}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Build time</dt>
          <dd className="tabular-nums">
            {view.forecast.months === null
              ? (view.forecast.note ?? "n/a")
              : view.forecast.historicalMonths !== null &&
                  view.forecast.months <= view.forecast.historicalMonths
                ? `${view.forecast.months} months (historical build time for this displacement${view.forecast.historicalProvisional ? ", provisional: some source points are not verified" : ""})`
                : `${view.forecast.months} months (limited by ${view.forecast.bottleneck ?? "capacity"})`}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">{view.cve.label}</dt>
          <dd className="tabular-nums">
            {format.number(view.cve.cveBp / 100, { maximumFractionDigits: 0 })} / 100
          </dd>
        </div>
      </dl>
      <YardList yards={view.forecast.yards} />
    </Panel>
  );
}
