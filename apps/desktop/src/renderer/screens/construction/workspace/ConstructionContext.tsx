import { createContext, use, useMemo, type ReactNode } from "react";
import { BluewaveError } from "@bluewave/contracts";
import type { ConstructionScreenState } from "../construction-screen-state.js";
import {
  useConstructionScreen,
  type UseConstructionScreenReturn,
} from "../hooks/useConstructionScreen.js";
import { useBatchOrder, type BatchOrderState } from "./useBatchOrder.js";
import {
  useYardWorkspace,
  type YardWorkspaceActions,
  type YardWorkspaceMeta,
} from "./useYardWorkspace.js";

export interface ConstructionState {
  readonly sessionId: string;
  readonly screen: ConstructionScreenState;
  readonly selectedDesignId: string | null;
  readonly loadError: string | null;
  readonly batch: BatchOrderState;
}

export type ConstructionActions = Pick<
  UseConstructionScreenReturn,
  | "loadScreen"
  | "setSelectedDesignId"
  | "submit"
  | "replace"
  | "cancel"
  | "cancelProject"
  | "halt"
  | "resume"
  | "setAcceleration"
  | "orderBatch"
  | "authorizeDockExpansion"
> &
  YardWorkspaceActions & {
    readonly retryRequest: () => void;
    readonly closeBatch: () => void;
    readonly setBatchQuantity: (quantity: number) => void;
    readonly setBatchBuilder: (nationId: string | null) => void;
    readonly confirmBatch: () => void;
  };

export type ConstructionMeta = YardWorkspaceMeta & {
  readonly requestOutcomeUnknown: boolean;
};

const StateContext = createContext<ConstructionState | null>(null);
const ActionsContext = createContext<ConstructionActions | null>(null);
const MetaContext = createContext<ConstructionMeta | null>(null);

export interface ConstructionProviderProps {
  readonly sessionId: string;
  readonly children: ReactNode;
}

export function ConstructionProvider({ sessionId, children }: ConstructionProviderProps) {
  const session = useConstructionScreen(sessionId);
  const batch = useBatchOrder(session);
  const yard = useYardWorkspace(session, batch, sessionId);

  const state = useMemo<ConstructionState>(
    () => ({
      sessionId,
      screen: session.state,
      selectedDesignId: session.selectedDesignId,
      loadError: session.loadError,
      batch: batch.state,
    }),
    [sessionId, session.state, session.selectedDesignId, session.loadError, batch.state],
  );

  const actions = useMemo<ConstructionActions>(
    () => ({
      loadScreen: session.loadScreen,
      retryRequest: session.request.retry,
      setSelectedDesignId: session.setSelectedDesignId,
      submit: session.submit,
      replace: session.replace,
      cancel: session.cancel,
      cancelProject: session.cancelProject,
      halt: session.halt,
      resume: session.resume,
      setAcceleration: session.setAcceleration,
      orderBatch: session.orderBatch,
      authorizeDockExpansion: session.authorizeDockExpansion,
      ...yard.actions,
      closeBatch: batch.actions.close,
      setBatchQuantity: batch.actions.setQuantity,
      setBatchBuilder: batch.actions.setBuilder,
      confirmBatch: batch.actions.confirm,
    }),
    [
      session.loadScreen,
      session.request.retry,
      session.setSelectedDesignId,
      session.submit,
      session.replace,
      session.cancel,
      session.cancelProject,
      session.halt,
      session.resume,
      session.setAcceleration,
      session.orderBatch,
      session.authorizeDockExpansion,
      yard.actions,
      batch.actions,
    ],
  );

  const meta = useMemo<ConstructionMeta>(
    () => ({ ...yard.meta, requestOutcomeUnknown: session.request.outcomeUnknown }),
    [yard.meta, session.request.outcomeUnknown],
  );

  return (
    <StateContext.Provider value={state}>
      <ActionsContext.Provider value={actions}>
        <MetaContext.Provider value={meta}>{children}</MetaContext.Provider>
      </ActionsContext.Provider>
    </StateContext.Provider>
  );
}

function missing(hook: string): never {
  throw new BluewaveError("CONSTRUCTION_PROVIDER_MISSING", { hook });
}

export function useConstructionState(): ConstructionState {
  return use(StateContext) ?? missing("useConstructionState");
}

export function useConstructionActions(): ConstructionActions {
  return use(ActionsContext) ?? missing("useConstructionActions");
}

export function useConstructionMeta(): ConstructionMeta {
  return use(MetaContext) ?? missing("useConstructionMeta");
}
