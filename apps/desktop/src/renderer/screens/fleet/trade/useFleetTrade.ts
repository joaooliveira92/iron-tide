import { useCallback, useMemo, useState } from "react";
import { envelopeOf } from "../../../lib/command-envelope.js";
import type {
  FleetScreenProjection,
  TradeDutyOutcome,
  TradeDutyRequest,
} from "../../../../shared/fleet-contract.js";
import { useBridge } from "../../../lib/bridge-context.js";
import { translate } from "../../../lib/strings.js";
import {
  type CommandOutcome,
  requestLifecycleAdapter,
  useCommandScreenWorkflow,
} from "../../../lib/command-screen-workflow.js";
import { useCampaignRevision } from "../../../shell/CampaignShellContext.js";
import { useFleetInspectionLoader } from "../hooks/useFleetInspection.js";
import {
  explainTradeRejection,
  initialTradeState,
  projectTrade,
  type TradeState,
} from "./trade-model.js";

export interface UseFleetTradeReturn {
  readonly state: TradeState;
  readonly selected: readonly string[];
  readonly loadError: string | null;
  readonly busy: boolean;
  readonly outcomeUnknown: boolean;
  readonly retry: () => void;
  readonly reload: () => void;
  readonly toggle: (shipId: string) => void;
  readonly send: (duty: TradeDutyRequest) => Promise<CommandOutcome>;
}

export function useFleetTrade(sessionId: string): UseFleetTradeReturn {
  const bridge = useBridge();
  const campaignRevision = useCampaignRevision();
  const load = useFleetInspectionLoader(sessionId);
  const [selection, setSelection] = useState<readonly string[]>([]);
  const workflow = useCommandScreenWorkflow<TradeState, FleetScreenProjection, TradeDutyOutcome>(
    requestLifecycleAdapter({
      initialState: initialTradeState,
      load,
      project: projectTrade,
      accept: (value) => ({
        patch: {},
        notice: translate(
          `fleet.trade.queued.${value.duty}.${value.shipCount === 1 ? "one" : "many"}`,
          { n: value.shipCount },
        ),
      }),
    }),
    { refreshKey: campaignRevision },
  );

  const ships = workflow.state.trade?.ships;
  const names = useMemo(
    () => new Map((ships ?? []).map((ship) => [ship.shipId, ship.name] as const)),
    [ships],
  );
  const selected = useMemo(() => {
    const known = new Set(ships?.map((ship) => ship.shipId));
    return selection.filter((id) => known.has(id));
  }, [selection, ships]);
  const toggle = useCallback(
    (shipId: string) =>
      setSelection((current) =>
        current.includes(shipId) ? current.filter((id) => id !== shipId) : [...current, shipId],
      ),
    [],
  );

  const send = useCallback(
    (duty: TradeDutyRequest): Promise<CommandOutcome> => {
      if (!bridge || selected.length === 0) return Promise.resolve("transport-failure");
      const shipIds = [...selected];
      return workflow
        .execute(`trade-duty-${duty}`, async (stamp) => {
          const result = await bridge.campaign.execute("submitTradeDuty", {
            ...envelopeOf(sessionId, stamp),
            duty,
            shipIds,
          });
          if (result.outcome !== "rejected" || result.reason !== "TRADE_DUTY_REJECTED") {
            return result;
          }
          return { ...result, diagnostics: explainTradeRejection(result.diagnostics, names) };
        })
        .then((outcome) => {
          if (outcome === "accepted") setSelection([]);
          return outcome;
        });
    },
    [bridge, names, selected, sessionId, workflow.execute],
  );

  const { loadScreen } = workflow;
  const reload = useCallback(() => void loadScreen(), [loadScreen]);

  return {
    state: workflow.state,
    selected,
    loadError: workflow.loadError,
    busy: workflow.state.pendingRequest !== null || workflow.state.requiresRefresh,
    outcomeUnknown: workflow.request.outcomeUnknown,
    retry: workflow.request.retry,
    reload,
    toggle,
    send,
  };
}
