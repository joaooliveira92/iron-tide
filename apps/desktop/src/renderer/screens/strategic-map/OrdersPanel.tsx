import type { PlayerProjectionPresence } from "../../../shared/fleet-contract.js";
import { Button } from "../../components/ui/button.js";
import { translate } from "../../lib/strings.js";
import type {
  MapOrderDestination,
  MapOrderFleet,
  MapPendingOrder,
} from "../../components/world-map/map-orders.js";

export interface BlockadeRow {
  readonly key: string;
  readonly text: string;
}

export interface OrdersPanelProps {
  readonly fleets: readonly MapOrderFleet[];
  readonly pending: readonly MapPendingOrder[];
  readonly selectedFleet: MapOrderFleet | null;
  readonly choices: readonly MapOrderDestination[];
  readonly notice: string | null;
  readonly noticeKind: "status" | "alert";
  readonly presence: PlayerProjectionPresence | null;
  readonly areaName: (areaId: string) => string;
  readonly blockades: readonly BlockadeRow[];
  readonly onSelectFleet: (fleetId: string) => void;
  readonly onOrder: (fleetId: string, areaId: string) => void;
  readonly onChoose: (areaId: string) => void;
  readonly onCancelChoice: () => void;
  readonly onCancelOrder: (commandId: string) => void;
  readonly className?: string;
}

function presenceRows(
  presence: PlayerProjectionPresence | null,
  areaName: (areaId: string) => string,
): readonly string[] | null {
  if (presence === null || !presence.configured) return null;
  return presence.areas
    .filter((area) => area.shortfallTons > 0)
    .map((area) =>
      translate("map.presence.row", {
        area: areaName(area.areaId),
        shortfall: area.shortfallTons,
        required: area.requiredTons,
        present: area.presentTons,
      }),
    );
}

export function OrdersPanel({
  fleets,
  pending,
  selectedFleet,
  choices,
  notice,
  noticeKind,
  presence,
  areaName,
  blockades,
  onSelectFleet,
  onOrder,
  onChoose,
  onCancelChoice,
  onCancelOrder,
  className = "",
}: OrdersPanelProps) {
  const shortfalls = presenceRows(presence, areaName);
  return (
    <aside
      aria-label={translate("map.orders.title")}
      data-testid="map-orders-panel"
      className={`flex min-h-0 flex-col gap-3 overflow-y-auto rounded-lg border bg-background p-3 ${className}`}
    >
      <div>
        <h2 className="text-sm font-semibold">{translate("map.orders.title")}</h2>
        <p className="text-xs text-muted-foreground">{translate("map.orders.hint")}</p>
      </div>

      {fleets.length === 0 ? (
        <p className="text-xs text-muted-foreground">{translate("map.orders.empty")}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {fleets.map((fleet) => {
            const pendingOrder = pending.find((order) => order.fleetId === fleet.fleetId);
            const selected = selectedFleet?.fleetId === fleet.fleetId;
            return (
              <li
                key={fleet.fleetId}
                className="rounded-md border border-border/60 p-2"
                data-fleet={fleet.fleetId}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={selected ? "default" : "outline"}
                    aria-pressed={selected}
                    className="h-7 px-2 text-xs"
                    onClick={() => onSelectFleet(fleet.fleetId)}
                  >
                    {fleet.fleetName}
                  </Button>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {fleet.areaName} · {fleet.shipCount}
                  </span>
                </div>
                {fleet.blockedReason === null ? null : (
                  <p className="mt-1 text-xs text-amber-600 dark:text-amber-400" role="status">
                    {fleet.blockedReason.message}
                  </p>
                )}
                {pendingOrder === undefined ? null : (
                  <p className="mt-1 flex items-center justify-between gap-2 text-xs">
                    <span>
                      {translate("map.orders.pending", { area: pendingOrder.destinationName })}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-xs"
                      onClick={() => onCancelOrder(pendingOrder.commandId)}
                    >
                      {translate("map.orders.cancel")}
                    </Button>
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {selectedFleet === null ? null : (
        <div className="rounded-md border border-border/60 p-2">
          <p className="text-xs font-medium">
            {translate("map.orders.destinations", { fleet: selectedFleet.fleetName })}
          </p>
          {choices.length > 0 ? (
            <div
              role="group"
              aria-label={translate("map.orders.choose")}
              className="mt-1 flex flex-col gap-1"
            >
              <p className="text-xs text-muted-foreground">{translate("map.orders.choose")}</p>
              {choices.map((destination) => (
                <Button
                  key={destination.areaId}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 justify-start px-2 text-xs"
                  onClick={() => onChoose(destination.areaId)}
                >
                  {destination.name}
                </Button>
              ))}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 justify-start px-2 text-xs"
                onClick={onCancelChoice}
              >
                {translate("map.orders.cancelChoice")}
              </Button>
            </div>
          ) : selectedFleet.legalDestinations.length === 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {translate("map.orders.noDestinations")}
            </p>
          ) : (
            <div
              role="group"
              aria-label={translate("map.orders.legal")}
              className="mt-1 flex flex-wrap gap-1"
            >
              {selectedFleet.legalDestinations.map((destination) => (
                <Button
                  key={destination.areaId}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  onClick={() => onOrder(selectedFleet.fleetId, destination.areaId)}
                >
                  {destination.name}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}

      {notice === null ? null : (
        <p
          role={noticeKind === "alert" ? "alert" : "status"}
          className={`whitespace-pre-line rounded-md border px-2 py-1 text-xs ${
            noticeKind === "alert"
              ? "border-destructive/60 text-destructive"
              : "border-border/60 text-muted-foreground"
          }`}
        >
          {notice}
        </p>
      )}

      <section className="border-t border-border/60 pt-2 text-xs">
        <h3 className="font-medium">{translate("map.presence.title")}</h3>
        {shortfalls === null ? (
          <p className="text-muted-foreground">{translate("map.presence.unconfigured")}</p>
        ) : shortfalls.length === 0 ? (
          <p className="text-muted-foreground">{translate("map.presence.none")}</p>
        ) : (
          <ul className="m-0 mt-1 flex list-none flex-col gap-1 p-0">
            {shortfalls.map((row) => (
              <li key={row}>{row}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="border-t border-border/60 pt-2 text-xs">
        <h3 className="font-medium">{translate("map.blockade.title")}</h3>
        {blockades.length === 0 ? (
          <p className="text-muted-foreground">{translate("map.blockade.none")}</p>
        ) : (
          <ul className="m-0 mt-1 flex list-none flex-col gap-1 p-0">
            {blockades.map((row) => (
              <li key={row.key}>{row.text}</li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-muted-foreground">{translate("map.legend.notModelled")}</p>
    </aside>
  );
}
