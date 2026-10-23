import { useCallback, useMemo } from "react";
import type { CampaignCommandMap } from "../../shared/campaign-contract.js";
import type { MovementCommandOutcome } from "../../shared/fleet-contract.js";
import { useBridge } from "./bridge-context.js";
import { envelopeOf, type CommandStamp } from "./command-envelope.js";
import type { CommandOutcome, CommandSender, RequestKind } from "./command-screen-workflow.js";

export interface MovementRouteTarget {
  readonly divisionId: string;
  readonly fromAreaId: string;
  readonly toAreaId: string;
}

function routeOf(target: MovementRouteTarget): MovementRouteTarget {
  return {
    divisionId: target.divisionId,
    fromAreaId: target.fromAreaId,
    toAreaId: target.toAreaId,
  };
}

export type MovementOrderSender = (
  kind: RequestKind,
  send: CommandSender<MovementCommandOutcome>,
) => Promise<CommandOutcome>;

export interface MovementOrders {
  readonly submit: (target: MovementRouteTarget) => Promise<CommandOutcome>;
  readonly replace: (target: MovementRouteTarget, commandId: string) => Promise<CommandOutcome>;
  readonly cancel: (commandId: string) => Promise<CommandOutcome>;
}

type MovementCommandName =
  | "submitMovementCommand"
  | "replaceMovementCommand"
  | "cancelMovementCommand";

export function useMovementOrders(sessionId: string, execute: MovementOrderSender): MovementOrders {
  const bridge = useBridge();

  const send = useCallback(
    <Name extends MovementCommandName>(
      kind: RequestKind,
      command: Name,
      build: (stamp: CommandStamp) => CampaignCommandMap[Name]["payload"],
    ) => {
      if (bridge === undefined) return Promise.resolve("transport-failure" as const);
      return execute(kind, (stamp) => bridge.campaign.execute(command, build(stamp)));
    },
    [bridge, execute],
  );

  return useMemo(
    () => ({
      submit: (target: MovementRouteTarget) =>
        send("submit", "submitMovementCommand", (stamp) => ({
          ...envelopeOf(sessionId, stamp),
          ...routeOf(target),
        })),
      replace: (target: MovementRouteTarget, commandId: string) =>
        send("replace", "replaceMovementCommand", (stamp) => ({
          ...envelopeOf(sessionId, stamp),
          ...routeOf(target),
          commandId,
        })),
      cancel: (commandId: string) =>
        send("cancel", "cancelMovementCommand", (stamp) => ({
          ...envelopeOf(sessionId, stamp),
          commandId,
        })),
    }),
    [send, sessionId],
  );
}
