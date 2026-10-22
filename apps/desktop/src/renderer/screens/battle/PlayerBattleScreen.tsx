import { useEffect, useMemo, useState } from "react";
import type { PlayerBattleView } from "@bluewave/combat";
import type { BluewaveDesktopBridge } from "../../../preload/index.js";
import type {
  InterruptionRequestDto,
  PlayerBattleDivisionOrderDto,
  PlayerBattleResultDto,
} from "../../../shared/campaign-command-contract.js";
import { usePreferences } from "../../lib/preferences-context.js";
import { formatMeasurement, UM_PER_METRE } from "../../lib/presentation-format/index.js";

/** Physical constant: metres in one nautical mile (the engine reports visibility in nm). */
const METRES_PER_NAUTICAL_MILE = 1852;

interface DivisionOrderState {
  readonly stance: PlayerBattleDivisionOrderDto["stance"];
  readonly speedPercent: number;
}

function playerSideOf(view: PlayerBattleView): "ATTACKER" | "DEFENDER" | null {
  if (view.playerNationId === view.attackerId) return "ATTACKER";
  if (view.playerNationId === view.defenderId) return "DEFENDER";
  return null;
}

function defaultOrders(view: PlayerBattleView): Record<string, DivisionOrderState> {
  const side = playerSideOf(view);
  const out: Record<string, DivisionOrderState> = {};
  for (const division of view.divisions) {
    if (division.sideId === side)
      out[division.divisionId] = { stance: "ENGAGE", speedPercent: 100 };
  }
  return out;
}

function ordersOf(
  orders: Record<string, DivisionOrderState>,
): readonly PlayerBattleDivisionOrderDto[] {
  return Object.entries(orders).map(([divisionId, order]) => ({ divisionId, ...order }));
}

/**
 * T-2 (issue #221): the production player-fought battle. The tactical session
 * lives in the desktop main process; this surface only reads its view, sends
 * per-division standing orders, and hands the final result to the existing
 * `submitBattleResult` interruption path. Nothing here re-derives combat.
 */
export function PlayerBattleScreen({
  bridge,
  request,
  sessionId,
  onSubmitResult,
  onAbandon,
}: {
  readonly bridge: BluewaveDesktopBridge | undefined;
  readonly request: InterruptionRequestDto;
  readonly sessionId: string;
  readonly onSubmitResult: (result: PlayerBattleResultDto) => void;
  readonly onAbandon: () => void;
}) {
  const battleId = request.battleId ?? "";
  const [view, setView] = useState<PlayerBattleView | null>(null);
  const [orders, setOrders] = useState<Record<string, DivisionOrderState>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resumed, setResumed] = useState(false);
  const { preferences } = usePreferences();

  useEffect(() => {
    let cancelled = false;
    if (bridge === undefined) {
      setError("Desktop bridge unavailable");
      setLoading(false);
      return;
    }
    void (async () => {
      const result = await bridge.campaign.execute("startPlayerBattle", { sessionId, battleId });
      if (cancelled) return;
      if (result.outcome !== "success") {
        setError(result.reason);
        setLoading(false);
        return;
      }
      setView(result.value.view);
      const fresh = defaultOrders(result.value.view);
      for (const order of result.value.lastOrders) {
        fresh[order.divisionId] = { stance: order.stance, speedPercent: order.speedPercent };
      }
      setOrders(fresh);
      setResumed(result.value.resumed);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [battleId, bridge, sessionId]);

  const playerSide = view === null ? null : playerSideOf(view);
  const divisions = useMemo(
    () =>
      view === null ? [] : view.divisions.filter((division) => division.sideId === playerSide),
    [view, playerSide],
  );
  const shipsById = useMemo(
    () => new Map((view?.ships ?? []).map((ship) => [ship.shipId, ship])),
    [view],
  );

  const advance = async (mode: "minute" | "to_end"): Promise<void> => {
    if (bridge === undefined || view === null || view.ended) return;
    setLoading(true);
    setError(null);
    const result = await bridge.campaign.execute("advancePlayerBattle", {
      sessionId,
      battleId,
      mode,
      divisions: ordersOf(orders),
    });
    setLoading(false);
    if (result.outcome !== "success") {
      setError(result.reason);
      return;
    }
    setView(result.value.view);
    setOrders((current) => ({ ...defaultOrders(result.value.view), ...current }));
  };

  const submit = async (): Promise<void> => {
    if (bridge === undefined || view === null || !view.ended) return;
    setSubmitting(true);
    setError(null);
    const result = await bridge.campaign.execute("finishPlayerBattle", { sessionId, battleId });
    setSubmitting(false);
    if (result.outcome !== "success") {
      setError(result.reason);
      return;
    }
    onSubmitResult(result.value.result);
  };

  const setOrder = (divisionId: string, patch: Partial<DivisionOrderState>): void => {
    setOrders((current) => ({
      ...current,
      [divisionId]: {
        ...(current[divisionId] ?? { stance: "ENGAGE", speedPercent: 100 }),
        ...patch,
      },
    }));
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Tactical battle"
      data-testid="player-battle"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-auto bg-black/60 p-4"
    >
      <div className="max-h-full w-full max-w-5xl overflow-auto rounded-lg border border-border bg-background p-4 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold">Battle of {view?.areaId ?? request.areaId}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {view === null
                ? "Projecting the committed battle…"
                : `${view.campaignMonth} · minute ${String(view.minute)} / ${String(view.maxMinutes)} · sea ${view.weather.seaState}`}
              {view !== null && (
                <span data-testid="battle-weather">
                  {" · visibility "}
                  {formatMeasurement(
                    view.weather.visibilityNm * METRES_PER_NAUTICAL_MILE * UM_PER_METRE,
                    {
                      locale: preferences.formattingLocale,
                      category: "range",
                      preset: preferences.measurementPreset,
                      selections: preferences.measurementSelections,
                    },
                  )}
                </span>
              )}
            </p>
            {resumed && (
              <p data-testid="battle-resumed" className="mt-1 text-xs text-muted-foreground">
                Resumed from the saved battle at minute {view?.minute ?? 0}.
              </p>
            )}
          </div>
          <button
            type="button"
            data-testid="battle-abandon"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={onAbandon}
          >
            Abandon turn
          </button>
        </div>

        {error !== null && (
          <p data-testid="battle-error" className="mt-2 text-xs text-red-400">
            {error}
          </p>
        )}

        {view !== null && (
          <>
            <div className="mt-3 flex flex-wrap gap-3 text-xs">
              <span data-testid="battle-status">
                {view.ended ? `Ended: ${view.endReason ?? "unknown"}` : "In progress"}
              </span>
              {view.objectives.length > 0 && (
                <span className="text-muted-foreground">
                  Objectives: {view.objectives.join(", ")}
                </span>
              )}
              {view.ended && (
                <span data-testid="battle-outcome">
                  Winner: {view.winnerId ?? "none"} · Loser: {view.loserId ?? "none"}
                </span>
              )}
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <section>
                <h3 className="text-xs font-semibold uppercase text-muted-foreground">
                  Your divisions
                </h3>
                <div className="mt-2 space-y-2">
                  {divisions.length === 0 && (
                    <p className="text-xs">No player divisions committed.</p>
                  )}
                  {divisions.map((division) => {
                    const order = orders[division.divisionId] ?? {
                      stance: "ENGAGE" as const,
                      speedPercent: 100,
                    };
                    return (
                      <div
                        key={division.divisionId}
                        data-testid={`battle-division-${division.divisionId}`}
                        className="rounded border border-border p-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold">{division.divisionId}</span>
                          <span className="text-xs text-muted-foreground">
                            {division.role} · {division.formation}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <select
                            aria-label={`Stance for ${division.divisionId}`}
                            className="rounded border border-border bg-background px-1 py-0.5 text-xs"
                            value={order.stance}
                            disabled={view.ended}
                            onChange={(event) =>
                              setOrder(division.divisionId, {
                                stance: event.target.value as DivisionOrderState["stance"],
                              })
                            }
                          >
                            <option value="ENGAGE">Engage</option>
                            <option value="HOLD">Hold</option>
                            <option value="WITHDRAW">Withdraw</option>
                          </select>
                          <label className="flex items-center gap-1 text-xs">
                            Speed {String(order.speedPercent)}%
                            <input
                              type="range"
                              min={0}
                              max={100}
                              step={5}
                              value={order.speedPercent}
                              disabled={view.ended}
                              onChange={(event) =>
                                setOrder(division.divisionId, {
                                  speedPercent: Number(event.target.value),
                                })
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
                                className="flex justify-between gap-2"
                              >
                                <span>
                                  {ship.name}{" "}
                                  <span className="text-muted-foreground">({ship.shipType})</span>
                                </span>
                                <span
                                  className={ship.damageState === "NORMAL" ? "" : "text-red-400"}
                                >
                                  {ship.damageState === "NORMAL" ? "" : "▼ "}
                                  {ship.hitPoints}/{ship.maxHitPoints} {ship.damageState}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section>
                <h3 className="text-xs font-semibold uppercase text-muted-foreground">
                  Enemy divisions
                </h3>
                <div className="mt-2 space-y-2">
                  {view.divisions
                    .filter((division) => division.sideId !== playerSide)
                    .map((division) => (
                      <div key={division.divisionId} className="rounded border border-border p-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold">{division.divisionId}</span>
                          <span className="text-xs text-muted-foreground">
                            {division.role} · {division.formation}
                          </span>
                        </div>
                        <ul className="mt-1 space-y-0.5 text-xs">
                          {division.unitIds.map((unitId) => {
                            const ship = shipsById.get(unitId);
                            if (ship === undefined) return null;
                            return (
                              <li key={unitId} className="flex justify-between gap-2">
                                <span>{ship.name}</span>
                                <span
                                  className={ship.damageState === "NORMAL" ? "" : "text-red-400"}
                                >
                                  {ship.damageState === "NORMAL" ? "" : "▼ "}
                                  {ship.hitPoints}/{ship.maxHitPoints} {ship.damageState}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  {view.ships.some(
                    (ship) => ship.sideId !== playerSide && ship.divisionId === null,
                  ) && (
                    <div className="rounded border border-border p-2">
                      <span className="text-xs font-semibold">Not in a division</span>
                      <ul className="mt-1 space-y-0.5 text-xs">
                        {view.ships
                          .filter((ship) => ship.sideId !== playerSide && ship.divisionId === null)
                          .map((ship) => (
                            <li
                              key={ship.shipId}
                              data-testid={`battle-ship-${ship.shipId}`}
                              className="flex justify-between gap-2"
                            >
                              <span>{ship.name}</span>
                              <span>
                                {ship.damageState === "NORMAL" ? "" : "▼ "}
                                {ship.hitPoints}/{ship.maxHitPoints} {ship.damageState}
                              </span>
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}
                </div>
              </section>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                data-testid="battle-advance"
                className="rounded border border-border px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
                disabled={loading || view.ended}
                onClick={() => void advance("minute")}
              >
                Advance minute
              </button>
              <button
                type="button"
                data-testid="battle-auto"
                className="rounded border border-border px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
                disabled={loading || view.ended}
                onClick={() => void advance("to_end")}
              >
                Auto-fight
              </button>
              <button
                type="button"
                data-testid="battle-submit"
                className="rounded border border-border px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
                disabled={!view.ended || submitting}
                onClick={() => void submit()}
              >
                Submit result
              </button>
            </div>

            <section className="mt-4">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">Battle log</h3>
              <ol
                data-testid="battle-log"
                className="mt-1 max-h-40 space-y-0.5 overflow-auto font-mono text-xs"
              >
                {view.log.slice(-80).map((event, index) => (
                  <li key={`${String(event.minute)}-${String(index)}`}>
                    m{String(event.minute).padStart(3, "0")} {event.eventType} {event.actorId}
                    {event.targetId === "" ? "" : ` → ${event.targetId}`}
                  </li>
                ))}
              </ol>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
