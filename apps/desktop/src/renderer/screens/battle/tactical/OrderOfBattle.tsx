import { memo, useMemo } from "react";
import {
  MAX_SPEED_PERCENT,
  MIN_SPEED_PERCENT,
  PLAYER_BATTLE_STANCES,
  SPEED_PERCENT_STEP,
  type DivisionOrder,
} from "../../../../shared/player-battle-orders.js";
import type { FormattingLocale } from "../../../../shared/preferences-contract.js";
import { AccuracyDisclosure } from "../AccuracyDisclosure.js";
import { BattleExplanationDisclosure } from "../BattleExplanationDisclosure.js";
import { shortDivisionId } from "./tactical-model.js";
import type { TacticalShip, TacticalView } from "./tactical-view.js";

export interface OrderOfBattleProps {
  readonly view: TacticalView;
  readonly locale: FormattingLocale;
  readonly orderFor: (divisionId: string) => DivisionOrder;
  readonly setOrder: (divisionId: string, patch: Partial<DivisionOrder>) => void;
  readonly selectedShipId: string | null;
  readonly selectedDivisionId: string | null;
  readonly onSelectShip: (shipId: string) => void;
  readonly onSelectDivision: (divisionId: string) => void;
}

function Damage({ ship }: { readonly ship: TacticalShip }) {
  if (ship.hitPoints === null || ship.maxHitPoints === null) return null;
  return (
    <span className={ship.damageState === "NORMAL" ? "" : "text-red-400"}>
      {ship.damageState === "NORMAL" ? "" : "▼ "}
      {ship.hitPoints}/{ship.maxHitPoints} {ship.damageState}
    </span>
  );
}

export const OrderOfBattle = memo(function OrderOfBattle(props: OrderOfBattleProps) {
  const { view, locale, orderFor, setOrder, selectedShipId, selectedDivisionId } = props;
  const { shipsById, divisions, contacts } = useMemo(
    () => ({
      shipsById: new Map(view.ships.map((ship) => [ship.shipId, ship])),
      divisions: view.divisions,
      contacts: view.ships.filter((ship) => !ship.own),
    }),
    [view],
  );

  return (
    <div className="space-y-4">
      <section aria-label="Your divisions">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground">Your divisions</h3>
        <div className="mt-2 space-y-2">
          {divisions.length === 0 && <p className="text-xs">No player divisions committed.</p>}
          {divisions.map((division) => {
            const order = orderFor(division.divisionId);
            const isSelected = selectedDivisionId === division.divisionId;
            return (
              <div
                key={division.divisionId}
                data-testid={`battle-division-${division.divisionId}`}
                data-selected={isSelected}
                className={`rounded border p-2 ${isSelected ? "border-sky-400" : "border-border"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    aria-label={`Select division ${division.divisionId}`}
                    className="text-xs font-semibold hover:underline"
                    onClick={() => props.onSelectDivision(division.divisionId)}
                  >
                    {shortDivisionId(division.divisionId)}
                  </button>
                  <span className="text-xs text-muted-foreground">
                    {division.role} · {division.formation}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <select
                    aria-label={`Stance for ${division.divisionId}`}
                    className="rounded border border-border bg-background px-1 py-0.5 text-xs"
                    value={order.stance}
                    disabled={view.ended}
                    onChange={(event) => {
                      const stance = PLAYER_BATTLE_STANCES.find(
                        (candidate) => candidate === event.target.value,
                      );
                      if (stance !== undefined) setOrder(division.divisionId, { stance });
                    }}
                  >
                    {PLAYER_BATTLE_STANCES.map((stance) => (
                      <option key={stance} value={stance}>
                        {stance.charAt(0) + stance.slice(1).toLowerCase()}
                      </option>
                    ))}
                  </select>
                  <label className="flex items-center gap-1 text-xs">
                    Speed {String(order.speedPercent)}%
                    <input
                      type="range"
                      min={MIN_SPEED_PERCENT}
                      max={MAX_SPEED_PERCENT}
                      step={SPEED_PERCENT_STEP}
                      value={order.speedPercent}
                      disabled={view.ended}
                      onChange={(event) =>
                        setOrder(division.divisionId, { speedPercent: Number(event.target.value) })
                      }
                    />
                  </label>
                </div>
                <ul className="mt-1 space-y-0.5 text-xs">
                  {division.unitIds.map((unitId) => {
                    const ship = shipsById.get(unitId);
                    if (ship === undefined) return null;
                    return (
                      <li
                        key={unitId}
                        data-testid={`battle-ship-${unitId}`}
                        data-selected={selectedShipId === unitId}
                        className="flex flex-wrap justify-between gap-x-2"
                      >
                        <button
                          type="button"
                          aria-pressed={selectedShipId === unitId}
                          className="text-left hover:underline"
                          onClick={() => props.onSelectShip(unitId)}
                        >
                          {ship.name}{" "}
                          <span className="text-muted-foreground">({ship.shipType})</span>
                        </button>
                        <Damage ship={ship} />
                        {ship.gunneryAccuracy === undefined ? null : (
                          <AccuracyDisclosure tree={ship.gunneryAccuracy} locale={locale} />
                        )}
                        {ship.torpedoSolution === undefined ? null : (
                          <BattleExplanationDisclosure
                            tree={ship.torpedoSolution}
                            locale={locale}
                            summaryKey="battle.torpedo_solution.summary"
                          />
                        )}
                        {ship.damageControl === undefined ? null : (
                          <BattleExplanationDisclosure
                            tree={ship.damageControl}
                            locale={locale}
                            summaryKey="battle.damage_control.summary"
                          />
                        )}
                        {ship.loss === undefined ? null : (
                          <BattleExplanationDisclosure
                            tree={ship.loss}
                            locale={locale}
                            summaryKey="battle.battle_loss.summary"
                          />
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      <section aria-label="Enemy contacts">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground">Enemy contacts</h3>
        <div className="mt-2 space-y-2">
          {contacts.length === 0 && <p className="text-xs">No contacts held.</p>}
          {contacts.length > 0 && (
            <div className="rounded border border-border p-2">
              <ul className="mt-1 space-y-0.5 text-xs">
                {contacts.map((ship) => (
                  <li
                    key={ship.shipId}
                    data-testid={`battle-ship-${ship.shipId}`}
                    className="flex justify-between gap-2"
                  >
                    <button
                      type="button"
                      className="text-left hover:underline"
                      onClick={() => props.onSelectShip(ship.shipId)}
                    >
                      {ship.name}
                    </button>
                    {ship.contactConfidenceBp === null ? null : (
                      <span className="text-muted-foreground">
                        {Math.round(ship.contactConfidenceBp / 100)}%
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>
    </div>
  );
});
