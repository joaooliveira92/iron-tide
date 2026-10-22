import { useCallback, useMemo } from "react";
import type { CampaignCommandMap } from "../../shared/campaign-command-contract.js";
import type {
  CancelMovementCommandPayload,
  MovementCommandOutcome,
  ReplaceMovementCommandPayload,
  SubmitMovementCommandPayload,
} from "../../shared/fleet-contract.js";
import { useBridge } from "./bridge-context.js";
import type {
  CommandExecutionContext,
  CommandOutcome,
  CommandSender,
  RequestKind,
} from "./command-screen-workflow.js";

export interface MovementRouteTarget {
  readonly divisionId: string;
  readonly fromAreaId: string;
  readonly toAreaId: string;
}

export type MovementOrderSender = (
  kind: RequestKind,
  send: CommandSender<MovementCommandOutcome>,
) => Promise<CommandOutcome>;

export function movementSubmitBody(
  sessionId: string,
  target: MovementRouteTarget,
  context: CommandExecutionContext,
): SubmitMovementCommandPayload {
  return {
    sessionId,
    divisionId: target.divisionId,
    fromAreaId: target.fromAreaId,
    toAreaId: target.toAreaId,
    expectedRevision: context.expectedRevision,
    transportRequestId: context.transportRequestId,
  };
}

export function movementReplaceBody(
  sessionId: string,
  target: MovementRouteTarget,
  commandId: string,
  context: CommandExecutionContext,
): ReplaceMovementCommandPayload {
  return {
    ...movementSubmitBody(sessionId, target, context),
    commandId,
  };
}

export function movementCancelBody(
  sessionId: string,
  commandId: string,
  context: CommandExecutionContext,
): CancelMovementCommandPayload {
  return {
    sessionId,
    commandId,
    expectedRevision: context.expectedRevision,
    transportRequestId: context.transportRequestId,
  };
}

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
      build: (context: CommandExecutionContext) => CampaignCommandMap[Name]["payload"],
    ) => {
      if (bridge === undefined) return Promise.resolve("transport-failure" as const);
      return execute(kind, (context) => bridge.campaign.execute(command, build(context)));
    },
    [bridge, execute],
  );

  return useMemo(
    () => ({
      submit: (target: MovementRouteTarget) =>
        send("submit", "submitMovementCommand", (context) =>
          movementSubmitBody(sessionId, target, context),
        ),
      replace: (target: MovementRouteTarget, commandId: string) =>
        send("replace", "replaceMovementCommand", (context) =>
          movementReplaceBody(sessionId, target, commandId, context),
        ),
      cancel: (commandId: string) =>
        send("cancel", "cancelMovementCommand", (context) =>
          movementCancelBody(sessionId, commandId, context),
        ),
    }),
    [send, sessionId],
  );
}
