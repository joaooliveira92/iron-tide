import { createContext, type ReactNode, use, useMemo } from "react";
import { BluewaveError } from "@bluewave/contracts";
import type { DesignDraft, ShipContext, WorkshopView } from "@bluewave/ship-design";
import type { DrawingBoardContent } from "./content.js";
import type { Edit } from "./panels/types.js";

export interface DesignState {
  readonly draft: DesignDraft;
  readonly view: WorkshopView;
  readonly content: DrawingBoardContent;
  readonly ctx: ShipContext;
  readonly month: string;
}

export interface DesignActions {
  readonly edit: Edit;
  readonly errorFor: (field: string) => string | undefined;
}

const StateContext = createContext<DesignState | null>(null);
const ActionsContext = createContext<DesignActions | null>(null);

export interface DesignWorkspaceProviderProps extends DesignState, DesignActions {
  readonly children: ReactNode;
}

export function DesignWorkspaceProvider({
  draft,
  view,
  content,
  ctx,
  month,
  edit,
  errorFor,
  children,
}: DesignWorkspaceProviderProps) {
  const state = useMemo(
    () => ({ draft, view, content, ctx, month }),
    [draft, view, content, ctx, month],
  );
  const actions = useMemo(() => ({ edit, errorFor }), [edit, errorFor]);
  return (
    <ActionsContext.Provider value={actions}>
      <StateContext.Provider value={state}>{children}</StateContext.Provider>
    </ActionsContext.Provider>
  );
}

export function useDesignState(): DesignState {
  const state = use(StateContext);
  if (state === null) {
    throw new BluewaveError("DESIGN_WORKSPACE_PROVIDER_MISSING", { hook: "useDesignState" });
  }
  return state;
}

export function useDesignActions(): DesignActions {
  const actions = use(ActionsContext);
  if (actions === null) {
    throw new BluewaveError("DESIGN_WORKSPACE_PROVIDER_MISSING", { hook: "useDesignActions" });
  }
  return actions;
}
