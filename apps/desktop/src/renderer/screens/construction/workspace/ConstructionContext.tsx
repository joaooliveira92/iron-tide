import { createContext, use, useMemo, type ReactNode } from "react";
import { BluewaveError } from "@bluewave/contracts";
import type { ConstructionScreenState } from "../construction-screen-state.js";
import {
  useConstructionScreen,
  type UseConstructionScreenReturn,
} from "../hooks/useConstructionScreen.js";
import { useOrderDialog, type OrderDialogState } from "../order/useOrderDialog.js";
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
  readonly order: OrderDialogState;
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
    readonly openOrderDialog: (designVersionId?: string) => void;
    readonly closeOrderDialog: () => void;
    readonly setOrderQuantity: (quantity: number) => void;
    readonly setOrderBuilder: (nationId: string | null) => void;
    readonly placeOrder: () => void;
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
  const order = useOrderDialog(session);
  const yard = useYardWorkspace(session, order.state.open, sessionId);

  const state = useMemo<ConstructionState>(
    () => ({
      sessionId,
      screen: session.state,
      selectedDesignId: session.selectedDesignId,
      loadError: session.loadError,
      order: order.state,
    }),
    [sessionId, session.state, session.selectedDesignId, session.loadError, order.state],
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
      openOrderDialog: order.actions.open,
      closeOrderDialog: order.actions.close,
      setOrderQuantity: order.actions.setQuantity,
      setOrderBuilder: order.actions.setBuilder,
      placeOrder: order.actions.confirm,
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
      order.actions,
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
