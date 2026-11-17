import { useState } from "react";
import type {
  MapOrderDestination,
  MapOrderFleet,
  MapPendingOrder,
} from "../../components/world-map/map-orders.js";
import {
  CourseChip,
  DispatchSlip,
  SealedLine,
  SlipButton,
} from "../../components/slate/DispatchSlip.js";
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
  readonly onOrder: (fleetId: string, areaId: string, shipIds?: readonly string[]) => void;
  readonly onChoose: (areaId: string) => void;
  readonly onCancelChoice: () => void;
  readonly onCancelOrder: (commandId: string) => void;
}

function shipCount(count: number): string {
  return count === 1
    ? translate("map.orders.ship")
    : translate("map.orders.ships", { count: String(count) });
}

function duration(months: number): string {
  return months === 1
    ? translate("map.orders.month")
    : translate("map.orders.months", { count: String(months) });
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
  const [picked, setPicked] = useState<{ fleetId: string; shipIds: readonly string[] }>({
    fleetId: "",
    shipIds: [],
  });
  const pendingOrder =
    selectedFleet === null
      ? undefined
      : pending.find((order) => order.fleetId === selectedFleet.fleetId);
  const fleetShips = selectedFleet?.ships ?? [];
  const pickedShips =
    selectedFleet !== null && picked.fleetId === selectedFleet.fleetId ? picked.shipIds : [];
  const partialShips =
    selectedFleet !== null && pickedShips.length > 0 && pickedShips.length < fleetShips.length
      ? pickedShips
      : undefined;
  const toggleShip = (fleetId: string, shipId: string) => {
    const current = picked.fleetId === fleetId ? picked.shipIds : [];
    setPicked({
      fleetId,
      shipIds: current.includes(shipId)
        ? current.filter((id) => id !== shipId)
        : [...current, shipId],
    });
  };
  const pendingMonths =
    selectedFleet === null || pendingOrder === undefined
      ? undefined
      : selectedFleet.legalDestinations.find((d) => d.areaId === pendingOrder.toAreaId)?.months;

  return (
    <DispatchSlip
      label={translate("map.orders.title")}
      testId="map-orders-panel"
      sealed={pendingOrder !== undefined}
    >
      {fleets.length === 0 ? (
        <p className="text-sm text-admiralty-ink-muted">{translate("map.orders.empty")}</p>
      ) : (
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] gap-x-5 gap-y-2 p-0">
          {fleets.map((fleet) => {
            const selected = selectedFleet?.fleetId === fleet.fleetId;
            return (
              <li key={fleet.fleetId} data-fleet={fleet.fleetId}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onSelectFleet(fleet.fleetId)}
                  className={cn(
                    "block w-full border-l-2 py-0.5 pl-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admiralty-signal",
                    selected
                      ? "border-admiralty-accent"
                      : "border-admiralty-border opacity-75 hover:opacity-100",
                  )}
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-display text-lg font-semibold leading-tight">
                      {fleet.fleetName}
                    </span>
                    <span className="shrink-0 text-sm tabular-nums text-admiralty-ink-muted">
                      {shipCount(fleet.shipCount)}
                    </span>
                  </span>
                  <span className="block text-sm leading-snug text-admiralty-ink-muted">
                    {translate("map.orders.from", { area: fleet.areaName })}
                  </span>
                  {fleet.enRoute == null ? null : (
                    <span
                      data-testid="map-fleet-en-route"
                      className="block text-sm leading-snug text-admiralty-accent"
                    >
                      {translate("map.orders.enRoute", {
                        area: fleet.enRoute.destinationName,
                        duration: duration(fleet.enRoute.months),
                      })}
                    </span>
                  )}
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
        <div className="space-y-2 border-t border-admiralty-border pt-3">
          {selectedFleet.blockedReason === null ? null : (
            <p role="status" className="text-sm font-medium text-admiralty-accent">
              {translate(`fleet.move.blocked.${selectedFleet.blockedReason.code}`, {
                fleet: selectedFleet.fleetName,
              })}
            </p>
          )}
          {choices.length > 0 ? (
            <div
              role="group"
              aria-label={translate("map.orders.choose")}
              className="flex flex-wrap items-center gap-2"
            >
              <span className="w-full text-sm font-medium text-admiralty-ink-muted">
                {translate("map.orders.choose")}
              </span>
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
              <span className="w-full text-sm font-medium text-admiralty-ink-muted">
                {translate("map.orders.sailTo")}
              </span>
              {selectedFleet.legalDestinations.map((destination) => (
                <CourseChip
                  key={destination.areaId}
                  label={translate("map.orders.destination", {
                    area: destination.name,
                    duration: duration(destination.months ?? 1),
                  })}
                  pressed={pendingOrder?.destinationName === destination.name}
                  onClick={() => onOrder(selectedFleet.fleetId, destination.areaId, partialShips)}
                />
              ))}
            </div>
          )}
          {fleetShips.length > 1 && choices.length === 0 ? (
            <fieldset className="m-0 space-y-1 border-0 p-0">
              <legend className="text-sm font-medium text-admiralty-ink-muted">
                {translate("map.orders.shipsOnly")}
              </legend>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {fleetShips.map((ship) => (
                  <label key={ship.id} className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={pickedShips.includes(ship.id)}
                      onChange={() => toggleShip(selectedFleet.fleetId, ship.id)}
                    />
                    {ship.name}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
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
          {pendingMonths === undefined
            ? translate("map.orders.pending", { area: pendingOrder.destinationName })
            : translate("map.orders.pendingRoute", {
                area: pendingOrder.destinationName,
                duration: duration(pendingMonths),
              })}
        </SealedLine>
      )}

      {notice === null || (pendingOrder !== undefined && noticeKind === "status") ? null : (
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
