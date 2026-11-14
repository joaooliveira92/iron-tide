import { createContext, use, useMemo, type ReactNode } from "react";
import { BluewaveError } from "@bluewave/contracts";
import { DesignWorkspaceProvider } from "../../../components/design-workspace/DesignWorkspaceContext.js";
import { ShipSelectionProvider } from "../../../components/design-workspace/selection/useShipSelection.js";
import type { RevisionProject } from "../../../components/design-workspace/revisionPreview.js";
import { useWorkspaceNavigation, type WorkspaceNavigation } from "./useWorkspaceNavigation.js";
import { useWorkspaceSession, type WorkspaceSession } from "./useWorkspaceSession.js";

export type ShipbuildingState = WorkspaceSession["state"];
export type ShipbuildingActions = WorkspaceSession["actions"] & WorkspaceNavigation["actions"];
export type ShipbuildingMeta = WorkspaceNavigation["meta"];

const StateContext = createContext<ShipbuildingState | null>(null);
const ActionsContext = createContext<ShipbuildingActions | null>(null);
const MetaContext = createContext<ShipbuildingMeta | null>(null);

export interface ShipbuildingProviderProps {
  readonly sessionId?: string;
  readonly projects?: readonly RevisionProject[];
  readonly catalogue?: readonly RevisionProject[];
  readonly children: ReactNode;
}

export function ShipbuildingProvider({
  sessionId,
  projects = [],
  catalogue,
  children,
}: ShipbuildingProviderProps) {
  const session = useWorkspaceSession(sessionId, projects, catalogue);
  const navigation = useWorkspaceNavigation(session);
  const state = session.state;
  const actions = useMemo(
    () => ({ ...session.actions, ...navigation.actions }),
    [session.actions, navigation.actions],
  );
  return (
    <ShipSelectionProvider store={state.selection}>
      <DesignWorkspaceProvider
        draft={state.draft}
        view={state.view}
        content={state.content}
        ctx={state.env.ctx}
        month={state.month}
        edit={actions.edit}
        errorFor={state.choiceCheck.errorFor}
      >
        <StateContext.Provider value={state}>
          <ActionsContext.Provider value={actions}>
            <MetaContext.Provider value={navigation.meta}>{children}</MetaContext.Provider>
          </ActionsContext.Provider>
        </StateContext.Provider>
      </DesignWorkspaceProvider>
    </ShipSelectionProvider>
  );
}

function missing(hook: string): never {
  throw new BluewaveError("SHIPBUILDING_PROVIDER_MISSING", { hook });
}

export function useShipbuildingState(): ShipbuildingState {
  return use(StateContext) ?? missing("useShipbuildingState");
}

export function useShipbuildingActions(): ShipbuildingActions {
  return use(ActionsContext) ?? missing("useShipbuildingActions");
}

export function useShipbuildingMeta(): ShipbuildingMeta {
  return use(MetaContext) ?? missing("useShipbuildingMeta");
}
