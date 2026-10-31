import type {
  MapOrderDestination,
  MapOrderFleet,
  MapPendingOrder,
} from "../../components/world-map/map-orders.js";
import { CourseChip, DispatchSlip, SealedLine, SlipButton } from "../../components/slate/DispatchSlip.js";
import { translate } from "../../lib/strings.js";
import { cn } from "../../lib/utils.js";

export interface MapDispatchProps {
  readonly fleets: readonly MapOrderFleet[];
  readonly pending: readonly MapPendingOrder[];
  readonly selectedFleet: MapOrderFleet | null;
  readonly choices: readonly MapOrderDestination[];
  readonly notice: string | null;
  readonly noticeKind: "status" | "alert";
  readonly onSelectFleet: (fleetId: string) => void;
  readonly onOrder: (fleetId: string, areaId: string) => void;
  readonly onChoose: (areaId: string) => void;
  readonly onCancelChoice: () => void;
  readonly onCancelOrder: (commandId: string) => void;
}

function shipCount(count: number): string {
  return count === 1
    ? translate("map.orders.ship")
    : translate("map.orders.ships", { count: String(count) });
}

export function MapDispatch({
  fleets,
  pending,
  selectedFleet,
  choices,
  notice,
  noticeKind,
  onSelectFleet,
  onOrder,
  onChoose,
  onCancelChoice,
  onCancelOrder,
}: MapDispatchProps) {
  const pendingOrder =
    selectedFleet === null
      ? undefined
      : pending.find((order) => order.fleetId === selectedFleet.fleetId);

  return (
    <DispatchSlip
      label={translate("map.orders.title")}
      testId="map-orders-panel"
      sealed={pendingOrder !== undefined}
    >
      {fleets.length === 0 ? (
        <p className="text-sm text-admiralty-ink-muted">{translate("map.orders.empty")}</p>
      ) : (
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] gap-x-4 gap-y-1 p-0">
          {fleets.map((fleet) => {
            const selected = selectedFleet?.fleetId === fleet.fleetId;
            return (
              <li key={fleet.fleetId} data-fleet={fleet.fleetId}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onSelectFleet(fleet.fleetId)}
                  className={cn(
                    "block w-full border-b-2 pb-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admiralty-signal",
                    selected ? "border-admiralty-accent" : "border-admiralty-border",
                  )}
                >
                  <span className="block font-display text-base font-semibold leading-tight">
                    {fleet.fleetName}
                  </span>
                  <span className="block text-sm leading-snug text-admiralty-ink-muted">
                    {translate("map.orders.from", { area: fleet.areaName })} ·{" "}
                    {shipCount(fleet.shipCount)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {selectedFleet === null ? (
        fleets.length === 0 ? null : (
          <p className="text-sm text-admiralty-ink-muted">{translate("map.orders.pick")}</p>
        )
      ) : (
        <div className="space-y-2">
          {selectedFleet.blockedReason === null ? null : (
            <p role="status" className="text-sm font-medium text-admiralty-accent">
              {selectedFleet.blockedReason.message}
            </p>
          )}
          {choices.length > 0 ? (
            <div
              role="group"
              aria-label={translate("map.orders.choose")}
              className="flex flex-wrap items-center gap-2"
            >
              <span className="text-sm font-medium">{translate("map.orders.choose")}</span>
              {choices.map((destination) => (
                <CourseChip
                  key={destination.areaId}
                  label={destination.name}
                  onClick={() => onChoose(destination.areaId)}
                />
              ))}
              <CourseChip label={translate("map.orders.cancelChoice")} onClick={onCancelChoice} />
            </div>
          ) : selectedFleet.legalDestinations.length === 0 ? (
            <p className="text-sm text-admiralty-ink-muted">
              {translate("map.orders.noDestinations")}
            </p>
          ) : (
            <div
              role="group"
              aria-label={translate("map.orders.legal")}
              className="flex flex-wrap items-center gap-2"
            >
              <span className="mr-1 text-sm font-medium">{translate("map.orders.sailTo")}</span>
              {selectedFleet.legalDestinations.map((destination) => (
                <CourseChip
                  key={destination.areaId}
                  label={destination.name}
                  pressed={pendingOrder?.destinationName === destination.name}
                  onClick={() => onOrder(selectedFleet.fleetId, destination.areaId)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {pendingOrder === undefined ? null : (
        <SealedLine
          key={pendingOrder.commandId}
          action={
            <SlipButton tone="quiet" onClick={() => onCancelOrder(pendingOrder.commandId)}>
              {translate("map.orders.cancel")}
            </SlipButton>
          }
        >
          {translate("map.orders.pending", { area: pendingOrder.destinationName })}
        </SealedLine>
      )}

      {notice === null ? null : (
        <p
          role={noticeKind === "alert" ? "alert" : "status"}
          className={cn(
            "whitespace-pre-line border-l-2 pl-3 text-sm",
            noticeKind === "alert"
              ? "border-destructive text-destructive"
              : "border-admiralty-border text-admiralty-ink-muted",
          )}
        >
          {notice}
        </p>
      )}
    </DispatchSlip>
  );
}
