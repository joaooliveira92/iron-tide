import { Badge } from "../../../components/ui/badge.js";
import { Button } from "../../../components/ui/button.js";
import { Card, CardContent } from "../../../components/ui/card.js";
import { ExplanationDisclosure } from "../../../components/shared/ExplanationDisclosure.js";
import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";
import type { CommandOutcome } from "../../../lib/command-screen-workflow.js";
import type { FleetTradeProjection, TradeDutyRequest } from "../../../../shared/fleet-contract.js";
import { translate } from "../../../lib/strings.js";
import { percentOfBp, type TradeState } from "./trade-model.js";
import { TradeShipList } from "./TradeShipList.js";
import { useFleetTrade } from "./useFleetTrade.js";

export interface FleetTradeViewProps {
  readonly state: TradeState;
  readonly selected: readonly string[];
  readonly loadError: string | null;
  readonly busy: boolean;
  readonly outcomeUnknown: boolean;
  readonly onToggle: (shipId: string) => void;
  readonly onSend: (duty: TradeDutyRequest) => Promise<CommandOutcome>;
  readonly onRetry: () => void;
  readonly onReload: () => void;
}

function Readout({ trade }: { readonly trade: FleetTradeProjection }) {
  const format = usePresentationFormat();
  return (
    <div className="space-y-1.5 text-sm" data-testid="fleet-trade-readout">
      <p role="status" className="text-xs text-muted-foreground">
        {translate(trade.atWar ? "fleet.trade.war" : "fleet.trade.peace")}
      </p>
      <p data-testid="fleet-trade-quota">
        {translate("fleet.trade.quota", { quota: trade.quota })}
      </p>
      <ExplanationDisclosure
        tree={trade.quotaExplanation}
        area="fleet"
        summaryKey="fleet.fleet_trade_quota.summary"
        format={format}
        testId="fleet-trade-quota-explanation"
      />
      <p data-testid="fleet-trade-assigned">
        {translate("fleet.trade.assigned", { assigned: trade.assigned })}
      </p>
      <ExplanationDisclosure
        tree={trade.assignedExplanation}
        area="fleet"
        summaryKey="fleet.fleet_trade_assigned.summary"
        format={format}
        testId="fleet-trade-assigned-explanation"
      />
      <p data-testid="fleet-trade-shortfall">
        {trade.shortfall === 0
          ? translate("fleet.trade.met")
          : translate("fleet.trade.shortfall", {
              shortfall: trade.shortfall,
              percent: percentOfBp(trade.shortfallBp),
            })}
      </p>
      <ExplanationDisclosure
        tree={trade.shortfallExplanation}
        area="fleet"
        summaryKey="fleet.fleet_trade_shortfall.summary"
        format={format}
        testId="fleet-trade-shortfall-explanation"
      />
      <p data-testid="fleet-trade-pool">
        {translate("fleet.trade.pool", { percent: percentOfBp(trade.merchantPoolBp) })}
      </p>
    </div>
  );
}

export function FleetTradeView({
  state,
  selected,
  loadError,
  busy,
  outcomeUnknown,
  onToggle,
  onSend,
  onRetry,
  onReload,
}: FleetTradeViewProps) {
  const trade = state.trade;
  if (trade === null) return null;
  const idle = busy || selected.length === 0;
  return (
    <section
      className="space-y-3 border-t pt-4"
      data-testid="fleet-trade"
      aria-labelledby="fleet-trade-h"
    >
      <div className="flex items-center gap-2">
        <h3 id="fleet-trade-h" className="text-sm font-medium">
          {translate("fleet.trade.heading")}
        </h3>
        <Badge variant={trade.shortfall === 0 ? "secondary" : "destructive"} className="text-xs">
          {trade.assigned}/{trade.quota}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">{translate("fleet.trade.intro")}</p>
      <Readout trade={trade} />

      {loadError !== null && (
        <div role="alert" className="space-y-2 rounded-md border border-destructive/50 p-3 text-sm">
          <p className="whitespace-pre-line text-destructive">{loadError}</p>
          <Button type="button" size="sm" variant="outline" onClick={onReload}>
            {translate("fleet.trade.reload")}
          </Button>
        </div>
      )}
      {state.notice !== null && (
        <div role="status" className="rounded-md border px-3 py-2 text-sm">
          <p className="whitespace-pre-line">{state.notice}</p>
        </div>
      )}
      {outcomeUnknown && (
        <div role="alert" className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
          <span>{translate("fleet.trade.outcomeUnknown")}</span>
          <Button type="button" size="sm" variant="outline" onClick={onRetry}>
            {translate("fleet.trade.retry")}
          </Button>
        </div>
      )}

      {trade.ships.length === 0 ? (
        <p className="text-sm text-muted-foreground">{translate("fleet.trade.noShips")}</p>
      ) : (
        <Card>
          <CardContent className="space-y-1.5 p-4">
            <TradeShipList
              ships={trade.ships}
              selected={selected}
              busy={busy}
              onToggle={onToggle}
            />
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={idle}
          onClick={() => void onSend("TRADE_PROTECTION")}
        >
          {translate("fleet.trade.assign")}
        </Button>
        <Button type="button" size="sm" disabled={idle} onClick={() => void onSend("RAIDER")}>
          {translate("fleet.trade.raider")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={idle}
          onClick={() => void onSend("NONE")}
        >
          {translate("fleet.trade.clear")}
        </Button>
      </div>
    </section>
  );
}

export function FleetTradeSection({ sessionId }: { readonly sessionId: string }) {
  const trade = useFleetTrade(sessionId);
  return (
    <FleetTradeView
      state={trade.state}
      selected={trade.selected}
      loadError={trade.loadError}
      busy={trade.busy}
      outcomeUnknown={trade.outcomeUnknown}
      onToggle={trade.toggle}
      onSend={trade.send}
      onRetry={trade.retry}
      onReload={trade.reload}
    />
  );
}
