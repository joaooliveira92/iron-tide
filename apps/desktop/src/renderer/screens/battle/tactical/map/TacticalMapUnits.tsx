import type { PlayerBattleShipView } from "@bluewave/combat/battleResolution";
import { useMemo, type KeyboardEvent } from "react";
import { translate } from "../../../../lib/strings.js";
import { useBattleActions, useBattleState } from "../../session/battle-session-contexts.js";
import { visibleLabelKeys, type LabelCandidate } from "../tactical-geometry.js";
import { shipPoint, shipStatus } from "../tactical-model.js";
import { TACTICAL_PALETTE } from "../tactical-palette.js";
import { useTacticalMap } from "./tactical-map-context.js";

const LABEL_CHAR_PX = 6.8;
const LABEL_HEIGHT_PX = 16;

function Ship({ ship }: { readonly ship: PlayerBattleShipView }) {
  const { view, project, playerSide, symbolSize: size, moveStyle } = useTacticalMap();
  const state = useBattleState();
  const actions = useBattleActions();
  const [x, y] = project(shipPoint(ship)!);
  const own = ship.sideId === playerSide;
  const status = shipStatus(ship);
  const colour = own ? TACTICAL_PALETTE.own : TACTICAL_PALETTE.hostile;
  const heading = ship.headingDeg ?? 0;
  const opacity =
    status === "sunk"
      ? 0.4
      : ship.contactConfidenceBp === null
        ? 1
        : 0.45 + (0.55 * Math.min(ship.contactConfidenceBp, 10_000)) / 10_000;
  const isSelected = ship.shipId === state.selectedShipId;
  const isFlagship = view.divisions.some((division) => division.flagshipId === ship.shipId);
  const label = `${ship.name}, ${own ? translate("tactical.side.own") : translate("tactical.side.hostile")}, ${translate(`tactical.status.${status}`)}`;

  const selectOnKey = (event: KeyboardEvent<SVGGElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      event.stopPropagation();
      actions.selectShip(ship.shipId);
    }
  };

  return (
    <g
      data-testid={`tactical-ship-${ship.shipId}`}
      data-status={status}
      data-side={own ? "own" : "hostile"}
      role="button"
      tabIndex={0}
      aria-label={label}
      aria-pressed={isSelected}
      style={{
        transform: `translate(${String(x)}px, ${String(y)}px)`,
        transition: moveStyle,
        outline: "none",
      }}
      opacity={opacity}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        actions.selectShip(ship.shipId);
      }}
      onKeyDown={selectOnKey}
      className="cursor-pointer focus-visible:[&>circle.focus]:stroke-white"
    >
      {isSelected ? (
        <circle
          r={size + 7}
          fill="none"
          stroke={TACTICAL_PALETTE.selection}
          strokeWidth={2}
          data-testid="tactical-selection"
        />
      ) : null}
      <circle
        className="focus"
        r={size + 10}
        fill="transparent"
        stroke="transparent"
        strokeWidth={2}
      />
      <g transform={`rotate(${String(-heading)})`}>
        {status === "sunk" ? (
          <path
            d={`M${String(-size)} ${String(-size)} L${String(size)} ${String(size)} M${String(-size)} ${String(size)} L${String(size)} ${String(-size)}`}
            stroke={colour}
            strokeWidth={2}
          />
        ) : (
          <path
            d={`M${String(size * 1.4)} 0 L${String(-size)} ${String(size * 0.8)} L${String(-size * 0.5)} 0 L${String(-size)} ${String(-size * 0.8)} Z`}
            fill={status === "damaged" ? "none" : colour}
            stroke={colour}
            strokeWidth={status === "damaged" ? 2 : 1}
            strokeDasharray={status === "damaged" ? "3 2" : undefined}
          />
        )}
      </g>
      {isFlagship ? <circle r={2} fill={TACTICAL_PALETTE.selection} pointerEvents="none" /> : null}
    </g>
  );
}

function Ships() {
  const { visibleShips } = useTacticalMap();
  return visibleShips.map((ship) => <Ship key={ship.shipId} ship={ship} />);
}

function ShipNames() {
  const { view, visibleShips, project, playerSide, symbolSize: size, moveStyle } = useTacticalMap();
  const { selectedShipId, overlays } = useBattleState();

  const labelKeys = useMemo(() => {
    if (overlays.labels === "none") return new Set<string>();
    const named =
      overlays.labels === "selected"
        ? visibleShips.filter((ship) => ship.shipId === selectedShipId)
        : visibleShips;
    const candidates: LabelCandidate[] = named.map((ship) => {
      const [x, y] = project(shipPoint(ship)!);
      const width = ship.name.length * LABEL_CHAR_PX + 8;
      const priority =
        (ship.shipId === selectedShipId ? 100 : 0) +
        (ship.sideId === playerSide ? 10 : 0) +
        (view.divisions.some((division) => division.flagshipId === ship.shipId) ? 5 : 0);
      return {
        key: ship.shipId,
        priority,
        x: x + size + 4,
        y: y - LABEL_HEIGHT_PX / 2,
        width,
        height: LABEL_HEIGHT_PX,
      };
    });
    return visibleLabelKeys(candidates);
  }, [overlays.labels, visibleShips, project, selectedShipId, playerSide, view.divisions, size]);

  return visibleShips
    .filter((ship) => labelKeys.has(ship.shipId))
    .map((ship) => {
      const [x, y] = project(shipPoint(ship)!);
      return (
        <g
          key={`label-${ship.shipId}`}
          pointerEvents="none"
          style={{
            transform: `translate(${String(x)}px, ${String(y)}px)`,
            transition: moveStyle,
          }}
        >
          <text
            data-testid={`tactical-label-${ship.shipId}`}
            x={size + 6}
            y={4}
            fill={
              ship.sideId === playerSide ? TACTICAL_PALETTE.ownLabel : TACTICAL_PALETTE.hostileLabel
            }
            fontSize={12}
          >
            {ship.name}
          </text>
        </g>
      );
    });
}

export function TacticalMapUnits() {
  return (
    <>
      <Ships />
      <ShipNames />
    </>
  );
}
