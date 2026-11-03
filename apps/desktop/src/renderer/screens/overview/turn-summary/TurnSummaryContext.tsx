import { createContext, use, type ReactNode } from "react";
import { BluewaveError } from "@bluewave/contracts";
import {
  useTurnSummaryWorkspace,
  type TurnSummaryActions,
  type TurnSummaryInput,
  type TurnSummaryMeta,
  type TurnSummaryState,
} from "./useTurnSummaryWorkspace.js";

const StateContext = createContext<TurnSummaryState | null>(null);
const ActionsContext = createContext<TurnSummaryActions | null>(null);
const MetaContext = createContext<TurnSummaryMeta | null>(null);

export interface TurnSummaryProviderProps extends TurnSummaryInput {
  readonly children: ReactNode;
}

export function TurnSummaryProvider({ children, ...input }: TurnSummaryProviderProps) {
  const { state, actions, meta } = useTurnSummaryWorkspace(input);

  return (
    <StateContext.Provider value={state}>
      <ActionsContext.Provider value={actions}>
        <MetaContext.Provider value={meta}>{children}</MetaContext.Provider>
      </ActionsContext.Provider>
    </StateContext.Provider>
  );
}

function missing(hook: string): never {
  throw new BluewaveError("TURN_SUMMARY_PROVIDER_MISSING", { hook });
}

export function useTurnSummaryState(): TurnSummaryState {
  return use(StateContext) ?? missing("useTurnSummaryState");
}

export function useTurnSummaryActions(): TurnSummaryActions {
  return use(ActionsContext) ?? missing("useTurnSummaryActions");
}

export function useTurnSummaryMeta(): TurnSummaryMeta {
  return use(MetaContext) ?? missing("useTurnSummaryMeta");
}
