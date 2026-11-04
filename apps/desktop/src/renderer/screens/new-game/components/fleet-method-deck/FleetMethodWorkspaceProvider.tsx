import { createContext, use, type ReactNode } from "react";
import { BluewaveError } from "@bluewave/contracts";
import type {
  FleetMethodWorkspace,
  FleetMethodWorkspaceActions,
  FleetMethodWorkspaceMeta,
  FleetMethodWorkspaceState,
} from "./useFleetMethodWorkspace.js";

const StateContext = createContext<FleetMethodWorkspaceState | null>(null);
const ActionsContext = createContext<FleetMethodWorkspaceActions | null>(null);
const MetaContext = createContext<FleetMethodWorkspaceMeta | null>(null);

export interface FleetMethodWorkspaceProviderProps {
  readonly workspace: FleetMethodWorkspace;
  readonly children: ReactNode;
}

export function FleetMethodWorkspaceProvider({
  workspace,
  children,
}: FleetMethodWorkspaceProviderProps) {
  return (
    <StateContext.Provider value={workspace.state}>
      <ActionsContext.Provider value={workspace.actions}>
        <MetaContext.Provider value={workspace.meta}>{children}</MetaContext.Provider>
      </ActionsContext.Provider>
    </StateContext.Provider>
  );
}

function missing(hook: string): never {
  throw new BluewaveError("FLEET_METHOD_WORKSPACE_PROVIDER_MISSING", { hook });
}

export function useFleetMethodState(): FleetMethodWorkspaceState {
  return use(StateContext) ?? missing("useFleetMethodState");
}

export function useFleetMethodActions(): FleetMethodWorkspaceActions {
  return use(ActionsContext) ?? missing("useFleetMethodActions");
}

export function useFleetMethodMeta(): FleetMethodWorkspaceMeta {
  return use(MetaContext) ?? missing("useFleetMethodMeta");
}
