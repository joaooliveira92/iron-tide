import { createContext, use, type ReactNode } from "react";
import { BluewaveError } from "@bluewave/contracts";
import type {
  ArchetypeWorkspace,
  ArchetypeWorkspaceActions,
  ArchetypeWorkspaceMeta,
  ArchetypeWorkspaceState,
} from "./useArchetypeWorkspace.js";

const StateContext = createContext<ArchetypeWorkspaceState | null>(null);
const ActionsContext = createContext<ArchetypeWorkspaceActions | null>(null);
const MetaContext = createContext<ArchetypeWorkspaceMeta | null>(null);

export interface ArchetypeWorkspaceProviderProps {
  readonly workspace: ArchetypeWorkspace;
  readonly children: ReactNode;
}

export function ArchetypeWorkspaceProvider({
  workspace,
  children,
}: ArchetypeWorkspaceProviderProps) {
  return (
    <StateContext.Provider value={workspace.state}>
      <ActionsContext.Provider value={workspace.actions}>
        <MetaContext.Provider value={workspace.meta}>{children}</MetaContext.Provider>
      </ActionsContext.Provider>
    </StateContext.Provider>
  );
}

function missing(hook: string): never {
  throw new BluewaveError("ARCHETYPE_WORKSPACE_PROVIDER_MISSING", { hook });
}

export function useArchetypeState(): ArchetypeWorkspaceState {
  return use(StateContext) ?? missing("useArchetypeState");
}

export function useArchetypeActions(): ArchetypeWorkspaceActions {
  return use(ActionsContext) ?? missing("useArchetypeActions");
}

export function useArchetypeMeta(): ArchetypeWorkspaceMeta {
  return use(MetaContext) ?? missing("useArchetypeMeta");
}
