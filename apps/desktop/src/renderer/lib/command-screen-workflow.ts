import { useCallback, useEffect, useRef, useState } from "react";

import type { BridgeResult } from "../../shared/bridge-contract.js";
import { describeTransportFailure } from "./bridge-read.js";
import { stampCommand, type CommandStamp, type TransportIdSource } from "./command-envelope.js";

export type RequestKind =
  | "submit"
  | "replace"
  | "cancel"
  | "cancel-project"
  | "halt"
  | "resume"
  | "accelerate"
  | "order-batch"
  | "order-foreign"
  | "assign-station"
  | "clear-station"
  | "set-readiness"
  | "authorize-dock-expansion"
  | "advance-battle"
  | "finish-battle";

export interface PendingRequest {
  readonly kind: RequestKind;
  readonly transportRequestId: string;
}

export interface RequestLifecycle {
  readonly revision: number;
  readonly pendingRequest: PendingRequest | null;
  readonly requiresRefresh: boolean;
  readonly notice: string | null;
}

export type CommandSender<Value> = (context: CommandStamp) => Promise<BridgeResult<Value>>;

export interface PreparedCommand<Value> {
  readonly kind: RequestKind;
  readonly context: CommandStamp;
  readonly send: CommandSender<Value>;
}

export type CommandRejection = Extract<BridgeResult<unknown>, { readonly outcome: "rejected" }>;

export interface CommandScreenAdapter<
  State extends { readonly revision: number },
  Projection extends { readonly revision: number },
  Value,
> {
  readonly initialState: () => State;
  readonly load: () => Promise<BridgeResult<Projection>>;
  readonly project: (state: State, projection: Projection) => State;
  readonly begin: (state: State, pending: PendingRequest) => State;
  readonly reject: (state: State, rejection: CommandRejection) => State;
  readonly transportFailure: (state: State, message: string) => State;
  readonly accept: (state: State, value: Value) => State;
  readonly requiresRefresh: (state: State) => boolean;
  readonly onProjection?: (projection: Projection) => void;
}

export interface RequestLifecycleAdapterConfig<
  State extends RequestLifecycle,
  Projection extends { readonly revision: number },
  Value,
> {
  readonly initialState: () => State;
  readonly load: () => Promise<BridgeResult<Projection>>;
  readonly project: (projection: Projection) => Partial<State>;
  readonly accept: (value: Value) => {
    readonly patch: Partial<State>;
    readonly notice: string;
  };
  readonly onProjection?: (projection: Projection) => void;
}

export function requestLifecycleAdapter<
  State extends RequestLifecycle,
  Projection extends { readonly revision: number },
  Value,
>(
  config: RequestLifecycleAdapterConfig<State, Projection, Value>,
): CommandScreenAdapter<State, Projection, Value> {
  return {
    initialState: config.initialState,
    load: config.load,
    project: (state, projection) => applyProjection(state, projection, config.project(projection)),
    begin: beginRequest,
    reject: applyRejection,
    transportFailure: applyTransportFailure,
    accept: (state, value) => {
      const { patch, notice } = config.accept(value);
      return acceptCommand(state, patch, notice);
    },
    requiresRefresh: (state) => state.requiresRefresh,
    ...(config.onProjection === undefined ? {} : { onProjection: config.onProjection }),
  };
}

export type CommandOutcome = "accepted" | "rejected" | "transport-failure";

export interface CommandScreenWorkflow<State extends { readonly revision: number }, Value> {
  readonly state: State;
  readonly loadError: string | null;
  readonly request: {
    readonly outcomeUnknown: boolean;
    readonly retry: () => void;
  };
  readonly loadScreen: () => Promise<void>;
  readonly updateState: (fold: (state: State) => State) => void;
  readonly execute: (kind: RequestKind, send: CommandSender<Value>) => Promise<CommandOutcome>;
}

export function describeRejection(
  reason: string,
  diagnostics: readonly string[],
  currentRevision?: number,
): string {
  const lines =
    diagnostics.length === 0
      ? [reason]
      : diagnostics.length === 1
        ? [`${reason}: ${diagnostics[0]}`]
        : [`${reason}:`, ...diagnostics.map((diagnostic) => `• ${diagnostic}`)];

  if (currentRevision !== undefined) lines.push(`current revision ${currentRevision}`);
  return lines.join("\n");
}

export function beginRequest<State extends RequestLifecycle>(
  state: State,
  pending: PendingRequest,
): State {
  return {
    ...state,
    pendingRequest: pending,
    notice: null,
  };
}

export function applyRejection<State extends RequestLifecycle>(
  state: State,
  rejection: CommandRejection,
): State {
  return {
    ...state,
    revision: rejection.currentRevision ?? state.revision,
    pendingRequest: null,
    requiresRefresh: rejection.currentRevision !== undefined,
    notice: describeRejection(rejection.reason, rejection.diagnostics, rejection.currentRevision),
  };
}

export function applyTransportFailure<State extends RequestLifecycle>(
  state: State,
  message: string,
): State {
  return { ...state, notice: `TRANSPORT_FAILURE: ${message}` };
}

export function applyProjection<
  State extends RequestLifecycle,
  Projection extends { readonly revision: number },
>(state: State, projection: Projection, patch: Partial<State>): State {
  return {
    ...state,
    ...patch,
    revision: projection.revision,
    pendingRequest: null,
    requiresRefresh: false,
    notice: null,
  };
}

export function acceptCommand<State extends RequestLifecycle>(
  state: State,
  patch: Partial<State>,
  notice: string,
): State {
  return {
    ...state,
    ...patch,
    pendingRequest: null,
    requiresRefresh: false,
    notice,
  };
}

export function commandNotice(command: {
  readonly commandId: string;
  readonly status: string;
}): string {
  return `Command ${command.commandId} is ${command.status}`;
}

export function prepareCommand<Value>(
  kind: RequestKind,
  expectedRevision: number,
  send: CommandSender<Value>,
  nextId?: TransportIdSource,
): PreparedCommand<Value> {
  return {
    kind,
    context: stampCommand(kind, expectedRevision, nextId),
    send,
  };
}

export interface CommandScreenWorkflowOptions {
  readonly refreshKey?: number | null;
}

export function useCommandScreenWorkflow<
  State extends { readonly revision: number },
  Projection extends { readonly revision: number },
  Value,
>(
  adapter: CommandScreenAdapter<State, Projection, Value>,
  options: CommandScreenWorkflowOptions = {},
): CommandScreenWorkflow<State, Value> {
  const [state, setState] = useState<State>(adapter.initialState);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [outcomeUnknown, setOutcomeUnknown] = useState(false);
  const unresolvedCommand = useRef<PreparedCommand<Value> | null>(null);
  const activeExecution = useRef<string | null>(null);
  const loadGeneration = useRef(0);
  const adapterRef = useRef(adapter);
  const revisionRef = useRef(state.revision);
  adapterRef.current = adapter;
  revisionRef.current = state.revision;

  const loadScreen = useCallback(async () => {
    const generation = ++loadGeneration.current;
    const current = adapterRef.current;
    try {
      const result = await current.load();
      if (generation !== loadGeneration.current) return;
      if (result.outcome !== "success") {
        setLoadError(
          describeRejection(
            result.reason,
            result.diagnostics,
            result.outcome === "rejected" ? result.currentRevision : undefined,
          ),
        );
        return;
      }
      setLoadError(null);
      setState((currentState) => current.project(currentState, result.value));
      current.onProjection?.(result.value);
    } catch (error) {
      if (generation !== loadGeneration.current) return;
      setLoadError(`TRANSPORT_FAILURE: ${describeTransportFailure(error)}`);
    }
  }, []);

  const run = useCallback(async (command: PreparedCommand<Value>): Promise<CommandOutcome> => {
    const executionId = command.context.transportRequestId;
    activeExecution.current = executionId;
    unresolvedCommand.current = command;
    setOutcomeUnknown(false);
    setState((currentState) =>
      adapterRef.current.begin(currentState, {
        kind: command.kind,
        transportRequestId: executionId,
      }),
    );
    try {
      const result = await command.send(command.context);
      if (activeExecution.current !== executionId) return "transport-failure";
      activeExecution.current = null;
      unresolvedCommand.current = null;
      if (result.outcome === "rejected") {
        setState((currentState) => adapterRef.current.reject(currentState, result));
        return "rejected";
      } else if (result.outcome === "error") {
        setOutcomeUnknown(false);
        setState((currentState) =>
          adapterRef.current.reject(currentState, {
            outcome: "rejected",
            reason: result.reason,
            diagnostics: result.diagnostics,
          }),
        );
        return "rejected";
      } else {
        setState((currentState) => adapterRef.current.accept(currentState, result.value));
        return "accepted";
      }
    } catch (error) {
      if (activeExecution.current !== executionId) return "transport-failure";
      setOutcomeUnknown(true);
      setState((currentState) =>
        adapterRef.current.transportFailure(currentState, describeTransportFailure(error)),
      );
      return "transport-failure";
    }
  }, []);

  const retry = useCallback(() => {
    const command = unresolvedCommand.current;
    if (command !== null) void run(command);
  }, [run]);

  const execute = useCallback(
    (kind: RequestKind, send: CommandSender<Value>): Promise<CommandOutcome> =>
      run(prepareCommand(kind, revisionRef.current, send)),
    [run],
  );

  useEffect(() => {
    void loadScreen();
  }, [loadScreen]);

  const needsRefresh = adapter.requiresRefresh(state);
  useEffect(() => {
    if (needsRefresh) void loadScreen();
  }, [needsRefresh, loadScreen]);

  const seenRefreshKey = useRef(options.refreshKey);
  useEffect(() => {
    if (seenRefreshKey.current === options.refreshKey) return;
    seenRefreshKey.current = options.refreshKey;
    void loadScreen();
  }, [options.refreshKey, loadScreen]);

  return {
    state,
    loadError,
    request: { outcomeUnknown, retry },
    loadScreen,
    updateState: setState,
    execute,
  };
}
