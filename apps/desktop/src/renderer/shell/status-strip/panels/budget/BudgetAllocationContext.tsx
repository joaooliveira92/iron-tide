import { createContext, use, type ReactNode } from "react";
import { BluewaveError } from "@bluewave/contracts";

import {
  useBudgetAllocationWorkspace,
  type BudgetAllocationActions,
  type BudgetAllocationInput,
  type BudgetAllocationMeta,
  type BudgetAllocationState,
} from "./useBudgetAllocationWorkspace.js";

const StateContext = createContext<BudgetAllocationState | null>(null);
const ActionsContext = createContext<BudgetAllocationActions | null>(null);
const MetaContext = createContext<BudgetAllocationMeta | null>(null);

export interface BudgetAllocationProviderProps extends BudgetAllocationInput {
  readonly children: ReactNode;
}

export function BudgetAllocationProvider({ children, ...input }: BudgetAllocationProviderProps) {
  const { state, actions, meta } = useBudgetAllocationWorkspace(input);
  return (
    <StateContext.Provider value={state}>
      <ActionsContext.Provider value={actions}>
        <MetaContext.Provider value={meta}>{children}</MetaContext.Provider>
      </ActionsContext.Provider>
    </StateContext.Provider>
  );
}

function missing(hook: string): never {
  throw new BluewaveError("BUDGET_ALLOCATION_PROVIDER_MISSING", { hook });
}

export function useBudgetAllocationState(): BudgetAllocationState {
  return use(StateContext) ?? missing("useBudgetAllocationState");
}

export function useBudgetAllocationActions(): BudgetAllocationActions {
  return use(ActionsContext) ?? missing("useBudgetAllocationActions");
}

export function useBudgetAllocationMeta(): BudgetAllocationMeta {
  return use(MetaContext) ?? missing("useBudgetAllocationMeta");
}
