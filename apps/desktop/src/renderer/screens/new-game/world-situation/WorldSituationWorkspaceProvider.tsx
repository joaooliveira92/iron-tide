import { createContext, use, type ReactNode } from "react";
import { BluewaveError } from "@bluewave/contracts";
import type {
  WorldSituationWorkspace,
  WorldSituationWorkspaceActions,
  WorldSituationWorkspaceMeta,
  WorldSituationWorkspaceState,
} from "./useWorldSituationWorkspace.js";

const StateContext = createContext<WorldSituationWorkspaceState | null>(null);
const ActionsContext = createContext<WorldSituationWorkspaceActions | null>(null);
const MetaContext = createContext<WorldSituationWorkspaceMeta | null>(null);

export interface WorldSituationWorkspaceProviderProps {
  readonly workspace: WorldSituationWorkspace;
  readonly children: ReactNode;
}

export function WorldSituationWorkspaceProvider({
  workspace,
  children,
}: WorldSituationWorkspaceProviderProps) {
  return (
    <StateContext.Provider value={workspace.state}>
      <ActionsContext.Provider value={workspace.actions}>
        <MetaContext.Provider value={workspace.meta}>{children}</MetaContext.Provider>
      </ActionsContext.Provider>
    </StateContext.Provider>
  );
}

function missing(hook: string): never {
  throw new BluewaveError("WORLD_SITUATION_WORKSPACE_PROVIDER_MISSING", { hook });
}

export function useWorldSituationState(): WorldSituationWorkspaceState {
  return use(StateContext) ?? missing("useWorldSituationState");
}

export function useWorldSituationActions(): WorldSituationWorkspaceActions {
  return use(ActionsContext) ?? missing("useWorldSituationActions");
}

export function useWorldSituationMeta(): WorldSituationWorkspaceMeta {
  return use(MetaContext) ?? missing("useWorldSituationMeta");
}
