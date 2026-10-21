import { useCallback, useEffect, useRef, useState } from "react";

import type { BridgeResult } from "../../shared/bridge-contract.js";

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
  | "authorize-dock-expansion";

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

export interface CommandExecutionContext {
  readonly expectedRevision: number;
  readonly transportRequestId: string;
}

export type CommandSender<Value> = (
  context: CommandExecutionContext,
) => Promise<BridgeResult<Value>>;

export interface PreparedCommand<Value> {
  readonly kind: RequestKind;
  readonly context: CommandExecutionContext;
  readonly send: CommandSender<Value>;
}

export interface CommandScreenAdapter<
  State extends RequestLifecycle,
  Projection extends { readonly revision: number },
  Value,
> {
  readonly initialState: () => State;
  readonly load: () => Promise<BridgeResult<Projection>>;
  /** Map a projection's domain fields into the state; lifecycle is handled by the module. */
  readonly project: (projection: Projection) => Partial<State>;
  /** Map an accepted command's domain fields and produce the resulting notice. */
  readonly accept: (value: Value) => {
    readonly patch: Partial<State>;
    readonly notice: string;
  };
  readonly onProjection?: (projection: Projection) => void;
}

/** How a submitted command settled, so a caller can react without re-reading state. */
export type CommandOutcome = "accepted" | "rejected" | "transport-failure";

export interface CommandScreenWorkflow<State extends RequestLifecycle, Value> {
  readonly state: State;
  readonly loadError: string | null;
  readonly request: {
    readonly outcomeUnknown: boolean;
    readonly retry: () => void;
  };
  readonly loadScreen: () => Promise<void>;
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
  command: PreparedCommand<unknown>,
): State {
  return {
    ...state,
    pendingRequest: {
      kind: command.kind,
      transportRequestId: command.context.transportRequestId,
    },
    notice: null,
  };
}

export function applyRejection<State extends RequestLifecycle>(
  state: State,
  rejection: Extract<BridgeResult<unknown>, { outcome: "rejected" }>,
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

/**
 * Fold a fresh projection into the state: adopt the engine revision and clear
 * every pending/refresh/notice marker in one place.
 */
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

/** Fold an accepted command result into the state: clear pending and set its notice. */
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

/** The uniform notice text both command screens show after an accepted command. */
export function commandNotice(command: {
  readonly commandId: string;
  readonly status: string;
}): string {
  return `Command ${command.commandId} is ${command.status}`;
}

/**
 * Folds a submit's transport result into a screen state, given that screen's
 * own phase transitions. The one place the three-outcome envelope is mapped:
 * `success` -> accepted, `rejected` (with its optional stale revision) ->
 * rejected, anything else -> a transport failure. Lets a screen keep its
 * discriminated-union state while sharing the transport bookkeeping.
 */
export function foldCommandResult<State, Value>(
  result: BridgeResult<Value>,
  folds: {
    readonly success: (state: State, value: Value) => State;
    readonly rejected: (
      state: State,
      rejection: {
        readonly reason: string;
        readonly diagnostics: readonly string[];
        readonly currentRevision?: number;
      },
    ) => State;
    readonly transportFailure: (state: State, message: string) => State;
  },
): (state: State) => State {
  return (state) => {
    if (result.outcome === "success") return folds.success(state, result.value);
    if (result.outcome === "rejected") {
      return folds.rejected(state, {
        reason: result.reason,
        diagnostics: result.diagnostics,
        currentRevision: result.currentRevision,
      });
    }
    return folds.transportFailure(state, `${result.reason}: ${result.diagnostics.join("; ")}`);
  };
}

let commandCounter = 0;

/**
 * Renderer-side transport identity for the optimistic-concurrency flow
 * (`expectedRevision` / `transportRequestId` triple). The single generator for
 * every command screen, so the id shape cannot drift between them.
 */
export function createTransportRequestId(prefix: string): string {
  commandCounter++;
  return `${prefix}-${Date.now().toString(36)}-${commandCounter}`;
}

/**
 * Captures the command's concurrency and idempotency context exactly once.
 * Re-running this prepared command therefore retries the same transport request
 * against the same expected revision instead of accidentally issuing new work.
 */
export function prepareCommand<Value>(
  kind: RequestKind,
  expectedRevision: number,
  send: CommandSender<Value>,
  transportRequestId = createTransportRequestId(kind),
): PreparedCommand<Value> {
  return {
    kind,
    context: { expectedRevision, transportRequestId },
    send,
  };
}

/**
 * Deep command-screen module. Callers describe only the domain operation they
 * want to send. Revision capture, transport identity, pending state,
 * idempotent retry, rejection adoption, and stale-projection refresh remain
 * behind this interface.
 */
export interface CommandScreenWorkflowOptions {
  /**
   * When this value changes after mount, the screen reloads its projection. Pass the
   * campaign revision so a month advanced from elsewhere (the header's Advance Month)
   * does not leave this screen showing pre-advance data.
   */
  readonly refreshKey?: number | null;
}

export function useCommandScreenWorkflow<
  State extends RequestLifecycle,
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
      setState((currentState) =>
        applyProjection(currentState, result.value, current.project(result.value)),
      );
      current.onProjection?.(result.value);
    } catch (error) {
      if (generation !== loadGeneration.current) return;
      setLoadError(
        `TRANSPORT_FAILURE: ${error instanceof Error ? error.message : "unknown transport error"}`,
      );
    }
  }, []);

  const run = useCallback(async (command: PreparedCommand<Value>): Promise<CommandOutcome> => {
    const executionId = command.context.transportRequestId;
    activeExecution.current = executionId;
    unresolvedCommand.current = command;
    setOutcomeUnknown(false);
    setState((currentState) => beginRequest(currentState, command));
    try {
      const result = await command.send(command.context);
      if (activeExecution.current !== executionId) return "transport-failure";
      activeExecution.current = null;
      unresolvedCommand.current = null;
      if (result.outcome === "rejected") {
        setState((currentState) => applyRejection(currentState, result));
        return "rejected";
      } else if (result.outcome === "error") {
        setOutcomeUnknown(false);
        setState((currentState) =>
          applyRejection(currentState, {
            outcome: "rejected",
            reason: result.reason,
            diagnostics: result.diagnostics,
          }),
        );
        return "rejected";
      } else {
        const { patch, notice } = adapterRef.current.accept(result.value);
        setState((currentState) => acceptCommand(currentState, patch, notice));
        return "accepted";
      }
    } catch (error) {
      if (activeExecution.current !== executionId) return "transport-failure";
      setOutcomeUnknown(true);
      setState((currentState) =>
        applyTransportFailure(
          currentState,
          error instanceof Error ? error.message : "unknown transport error",
        ),
      );
      return "transport-failure";
    }
  }, []);

  const retry = useCallback(() => {
    const command = unresolvedCommand.current;
    if (command !== null) void run(command);
  }, [run]);

  // Memoized so a screen can safely use it as a dependency of its own callbacks —
  // otherwise every command handler a screen hands a memo() child changes each render.
  const execute = useCallback(
    (kind: RequestKind, send: CommandSender<Value>): Promise<CommandOutcome> =>
      run(prepareCommand(kind, revisionRef.current, send)),
    [run],
  );

  useEffect(() => {
    void loadScreen();
  }, [loadScreen]);

  useEffect(() => {
    if (state.requiresRefresh) void loadScreen();
  }, [state.requiresRefresh, loadScreen]);

  // Reload when the campaign moved on elsewhere. The mount load above already
  // covers the first render, so the initial key is remembered, not acted on.
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
    execute,
  };
}
