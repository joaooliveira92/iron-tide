import { createContext, use, type ReactNode } from "react";
import { BluewaveError } from "@bluewave/contracts";
import type {
  PresetWorkspace,
  PresetWorkspaceActions,
  PresetWorkspaceMeta,
  PresetWorkspaceState,
} from "./usePresetWorkspace.js";

const StateContext = createContext<PresetWorkspaceState | null>(null);
const ActionsContext = createContext<PresetWorkspaceActions | null>(null);
const MetaContext = createContext<PresetWorkspaceMeta | null>(null);

export interface PresetWorkspaceProviderProps {
  readonly workspace: PresetWorkspace;
  readonly children: ReactNode;
}

export function PresetWorkspaceProvider({ workspace, children }: PresetWorkspaceProviderProps) {
  return (
    <StateContext.Provider value={workspace.state}>
      <ActionsContext.Provider value={workspace.actions}>
        <MetaContext.Provider value={workspace.meta}>{children}</MetaContext.Provider>
      </ActionsContext.Provider>
    </StateContext.Provider>
  );
}

function missing(hook: string): never {
  throw new BluewaveError("PRESET_WORKSPACE_PROVIDER_MISSING", { hook });
}

export function usePresetState(): PresetWorkspaceState {
  return use(StateContext) ?? missing("usePresetState");
}

export function usePresetActions(): PresetWorkspaceActions {
  return use(ActionsContext) ?? missing("usePresetActions");
}

export function usePresetMeta(): PresetWorkspaceMeta {
  return use(MetaContext) ?? missing("usePresetMeta");
}
