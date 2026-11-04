import { createContext, use, type ReactNode } from "react";
import { BluewaveError } from "@bluewave/contracts";

import {
  useStatusStripWorkspace,
  type StatusStripActions,
  type StatusStripInput,
  type StatusStripMeta,
  type StatusStripState,
} from "./useStatusStripWorkspace.js";

const StateContext = createContext<StatusStripState | null>(null);
const ActionsContext = createContext<StatusStripActions | null>(null);
const MetaContext = createContext<StatusStripMeta | null>(null);

export interface StatusStripProviderProps extends StatusStripInput {
  readonly children: ReactNode;
}

export function StatusStripProvider({ children, ...input }: StatusStripProviderProps) {
  const { state, actions, meta } = useStatusStripWorkspace(input);
  return (
    <StateContext.Provider value={state}>
      <ActionsContext.Provider value={actions}>
        <MetaContext.Provider value={meta}>{children}</MetaContext.Provider>
      </ActionsContext.Provider>
    </StateContext.Provider>
  );
}

function missing(hook: string): never {
  throw new BluewaveError("STATUS_STRIP_PROVIDER_MISSING", { hook });
}

export function useStatusStripState(): StatusStripState {
  return use(StateContext) ?? missing("useStatusStripState");
}

export function useStatusStripActions(): StatusStripActions {
  return use(ActionsContext) ?? missing("useStatusStripActions");
}

export function useStatusStripMeta(): StatusStripMeta {
  return use(MetaContext) ?? missing("useStatusStripMeta");
}
