import type { DivisionOrder } from "../../../../shared/player-battle-orders.js";
import { translate } from "../../../lib/strings.js";
import type { TacticalView } from "./tactical-view.js";

export interface TargetOrderControlProps {
  readonly view: TacticalView;
  readonly divisionId: string;
  readonly order: DivisionOrder;
  readonly acceptedHandle: string | undefined;
  readonly setTarget: (divisionId: string, targetHandle: string | null) => void;
}

const AUTOMATIC = "";

export function TargetOrderControl(props: TargetOrderControlProps) {
  const { view, divisionId, order, acceptedHandle } = props;
  const contacts = view.ships.filter((ship) => !ship.own);
  const chosen = order.targetHandle;
  const known = chosen === undefined || contacts.some((ship) => ship.shipId === chosen);
  const state =
    chosen === acceptedHandle ? (chosen === undefined ? "automatic" : "accepted") : "pending";
  return (
    <div className="space-y-1">
      <label className="flex flex-col gap-0.5">
        {translate("tactical.unit.target_input")}
        <select
          data-testid="unit-target-select"
          className="rounded border border-border bg-background px-1 py-0.5"
          value={chosen ?? AUTOMATIC}
          disabled={view.ended}
          onChange={(event) =>
            props.setTarget(
              divisionId,
              event.target.value === AUTOMATIC ? null : event.target.value,
            )
          }
        >
          <option value={AUTOMATIC}>{translate("tactical.unit.target_automatic")}</option>
          {contacts.map((ship) => (
            <option key={ship.shipId} value={ship.shipId}>
              {ship.name}
            </option>
          ))}
          {known || chosen === undefined ? null : (
            <option value={chosen}>{translate("tactical.unit.target_lost")}</option>
          )}
        </select>
      </label>
      <p data-testid="unit-target-state" data-state={state} role="status">
        {state === "pending"
          ? translate("tactical.unit.target_pending")
          : state === "accepted"
            ? translate("tactical.unit.target_accepted")
            : translate("tactical.unit.target_auto_state")}
      </p>
    </div>
  );
}
