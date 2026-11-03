import type { PlayerBattleView } from "@bluewave/combat/battleResolution";
import { useCallback } from "react";
import type { BridgeResult } from "../../../shared/bridge-contract.js";
import type {
  AdvancePlayerBattleResult,
  PlayerBattleResultDto,
  StartPlayerBattleResult,
} from "../../../shared/player-battle-contract.js";
import {
  DEFAULT_DIVISION_ORDER,
  defaultOrdersFor,
  ordersToDtos,
  standingOrdersFor,
  type DivisionOrder,
  type DivisionOrders,
} from "../../../shared/player-battle-orders.js";
import { useBridge } from "../../lib/bridge-context.js";
import { loadThroughBridge } from "../../lib/bridge-read.js";
import {
  requestLifecycleAdapter,
  useCommandScreenWorkflow,
  type RequestLifecycle,
} from "../../lib/command-screen-workflow.js";

export type BattleResume = "fresh" | "resumed";

export interface PlayerBattleState extends RequestLifecycle {
  readonly view: PlayerBattleView | null;
  readonly orders: DivisionOrders;
  readonly acceptedOrders: DivisionOrders;
  readonly resume: BattleResume;
}

interface BattleProjection extends StartPlayerBattleResult {
  readonly revision: number;
}

const initialState = (): PlayerBattleState => ({
  revision: 0,
  pendingRequest: null,
  requiresRefresh: false,
  notice: null,
  view: null,
  orders: {},
  acceptedOrders: {},
  resume: "fresh",
});

export interface UsePlayerBattleReturn {
  readonly view: PlayerBattleView | null;
  readonly resume: BattleResume;
  readonly acceptedOrders: DivisionOrders;
  readonly error: string | null;
  readonly busy: boolean;
  readonly orderFor: (divisionId: string) => DivisionOrder;
  readonly setOrder: (divisionId: string, patch: Partial<DivisionOrder>) => void;
  readonly releaseCourse: (divisionId: string) => void;
  readonly advance: (mode: "minute" | "to_end") => void;
  readonly submit: () => void;
}

export function usePlayerBattle(
  sessionId: string,
  battleId: string,
  onSubmitResult: (result: PlayerBattleResultDto) => void,
): UsePlayerBattleReturn {
  const bridge = useBridge();
  const workflow = useCommandScreenWorkflow<
    PlayerBattleState,
    BattleProjection,
    AdvancePlayerBattleResult | null
  >(
    requestLifecycleAdapter({
      initialState,
      load: async (): Promise<BridgeResult<BattleProjection>> => {
        const result = await loadThroughBridge(bridge, (b) =>
          b.campaign.execute("startPlayerBattle", { sessionId, battleId }),
        );
        return result.outcome === "success"
          ? { ...result, value: { ...result.value, revision: 0 } }
          : result;
      },
      project: (projection) => ({
        view: projection.view,
        orders: standingOrdersFor(projection.view, projection.lastOrders),
        acceptedOrders: standingOrdersFor(projection.view, projection.lastOrders),
        resume: projection.resumed ? "resumed" : "fresh",
      }),
      accept: (value) => ({
        patch: value === null ? {} : { view: value.view },
        notice: "",
      }),
    }),
  );
  const { state, execute, updateState } = workflow;
  const { view, orders } = state;

  const orderFor = useCallback(
    (divisionId: string): DivisionOrder =>
      orders[divisionId] ??
      (view === null ? undefined : defaultOrdersFor(view)[divisionId]) ??
      DEFAULT_DIVISION_ORDER,
    [orders, view],
  );

  const setOrder = useCallback(
    (divisionId: string, patch: Partial<DivisionOrder>): void => {
      updateState((current) => ({
        ...current,
        orders: {
          ...current.orders,
          [divisionId]: {
            ...(current.orders[divisionId] ?? DEFAULT_DIVISION_ORDER),
            ...patch,
          },
        },
      }));
    },
    [updateState],
  );

  const releaseCourse = useCallback(
    (divisionId: string): void => {
      updateState((current) => {
        const existing = current.orders[divisionId] ?? DEFAULT_DIVISION_ORDER;
        const { courseDeg: _course, speedKnots: _knots, ...stance } = existing;
        return { ...current, orders: { ...current.orders, [divisionId]: stance } };
      });
    },
    [updateState],
  );

  const advance = useCallback(
    (mode: "minute" | "to_end"): void => {
      if (bridge === undefined || view === null || view.ended) return;
      const effective = { ...defaultOrdersFor(view), ...orders };
      void execute("advance-battle", () =>
        bridge.campaign.execute("advancePlayerBattle", {
          sessionId,
          battleId,
          mode,
          divisions: ordersToDtos(effective),
        }),
      ).then((outcome) => {
        if (outcome === "accepted") {
          updateState((current) => ({ ...current, acceptedOrders: effective }));
        }
      });
    },
    [battleId, bridge, execute, orders, sessionId, updateState, view],
  );

  const submit = useCallback((): void => {
    if (bridge === undefined || view === null || !view.ended) return;
    let finished: PlayerBattleResultDto | null = null;
    void execute("finish-battle", async () => {
      const result = await bridge.campaign.execute("finishPlayerBattle", { sessionId, battleId });
      if (result.outcome === "success") finished = result.value.result;
      return result.outcome === "success" ? { ...result, value: null } : result;
    }).then((outcome) => {
      if (outcome === "accepted" && finished !== null) onSubmitResult(finished);
    });
  }, [battleId, bridge, execute, onSubmitResult, sessionId, view]);

  return {
    view,
    resume: state.resume,
    acceptedOrders: state.acceptedOrders,
    error: workflow.loadError ?? (state.notice === "" ? null : state.notice),
    busy: state.pendingRequest !== null,
    orderFor,
    setOrder,
    releaseCourse,
    advance,
    submit,
  };
}
