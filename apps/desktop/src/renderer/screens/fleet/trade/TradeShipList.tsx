import { useMemo } from "react";
import type { FleetTradeShipView } from "../../../../shared/fleet-contract.js";
import { translate } from "../../../lib/strings.js";

export function TradeShipList({
  ships,
  selected,
  busy,
  onToggle,
}: {
  readonly ships: readonly FleetTradeShipView[];
  readonly selected: readonly string[];
  readonly busy: boolean;
  readonly onToggle: (shipId: string) => void;
}) {
  const selectedIds = useMemo(() => new Set(selected), [selected]);
  return (
    <ul className="space-y-1.5" data-testid="fleet-trade-ships">
      {ships.map((ship) => (
        <li key={ship.shipId}>
          <label className="flex flex-wrap items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={selectedIds.has(ship.shipId)}
              disabled={busy || !ship.assignable}
              onChange={() => onToggle(ship.shipId)}
              aria-label={translate("fleet.trade.shipLabel", { name: ship.name })}
            />
            <span>{ship.name}</span>
            {ship.duty !== null && (
              <span
                className="rounded border px-1 text-xs"
                data-testid={`fleet-trade-duty-${ship.shipId}`}
              >
                {translate(`fleet.trade.duty.${ship.duty}`)}
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              {translate(
                ship.contributes ? "fleet.trade.flag.contributes" : "fleet.trade.flag.noContribute",
              )}
              {" · "}
              {translate(ship.canRaid ? "fleet.trade.flag.canRaid" : "fleet.trade.flag.cannotRaid")}
            </span>
          </label>
        </li>
      ))}
    </ul>
  );
}
