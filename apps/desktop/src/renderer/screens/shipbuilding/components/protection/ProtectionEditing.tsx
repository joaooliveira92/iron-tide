import { createContext, use, useState, type ReactNode } from "react";
import {
  newArmourRegion,
  type ArmourRegion,
  type ArmourRegionId,
  type DraftEdit,
} from "@bluewave/ship-design";
import { BluewaveError } from "@bluewave/contracts";
import { usePresentationFormat } from "../../../../shell/usePresentationFormat.js";
import type { ProtectionModel } from "../../protection-view.js";

export interface ProtectionEditingState {
  readonly model: ProtectionModel;
  readonly selectedRegion: ArmourRegionId | null;
  readonly toAdd: string;
  readonly errorFor?: (field: string) => string | undefined;
}

export interface ProtectionEditingActions {
  readonly edit: (edit: DraftEdit) => void;
  readonly setToAdd: (regionId: string) => void;
  readonly add: () => void;
  readonly patch: (region: ArmourRegion, change: Partial<ArmourRegion>) => void;
  readonly remove: (region: ArmourRegionId) => void;
  readonly toggleRegion: (region: ArmourRegionId) => void;
}

export interface ProtectionEditingMeta {
  readonly format: ReturnType<typeof usePresentationFormat>;
}

const StateContext = createContext<ProtectionEditingState | null>(null);
const ActionsContext = createContext<ProtectionEditingActions | null>(null);
const MetaContext = createContext<ProtectionEditingMeta | null>(null);

export interface ProtectionEditingProviderProps {
  readonly model: ProtectionModel;
  readonly edit: (edit: DraftEdit) => void;
  readonly errorFor?: (field: string) => string | undefined;
  readonly onSelectRegion?: (region: ArmourRegionId | null) => void;
  readonly selectedRegion?: ArmourRegionId | null;
  readonly children: ReactNode;
}

export function ProtectionEditingProvider({
  model,
  edit,
  errorFor,
  onSelectRegion,
  selectedRegion = null,
  children,
}: ProtectionEditingProviderProps) {
  const format = usePresentationFormat();
  const [toAdd, setToAdd] = useState("");
  const patch = (region: ArmourRegion, change: Partial<ArmourRegion>) =>
    edit({ kind: "set_armour_region", region: { ...region, ...change } });
  const remove = (region: ArmourRegionId) => edit({ kind: "remove_armour_region", region });
  const add = () => {
    const region = (toAdd === "" ? model.availableRegions[0]?.id : toAdd) as
      | ArmourRegionId
      | undefined;
    if (region === undefined || model.defaultMaterialId === "") return;
    edit({
      kind: "set_armour_region",
      region: newArmourRegion(region, model.regionSizing, model.defaultMaterialId),
    });
    setToAdd("");
  };
  const toggleRegion = (region: ArmourRegionId) =>
    onSelectRegion?.(selectedRegion === region ? null : region);

  const state: ProtectionEditingState = { model, selectedRegion, toAdd, errorFor };
  const actions: ProtectionEditingActions = { edit, setToAdd, add, patch, remove, toggleRegion };
  const meta: ProtectionEditingMeta = { format };
  return (
    <ActionsContext.Provider value={actions}>
      <MetaContext.Provider value={meta}>
        <StateContext.Provider value={state}>{children}</StateContext.Provider>
      </MetaContext.Provider>
    </ActionsContext.Provider>
  );
}

function missing(hook: string): never {
  throw new BluewaveError("PROTECTION_EDITOR_PROVIDER_MISSING", { hook });
}

export function useProtectionEditing(): ProtectionEditingState {
  return use(StateContext) ?? missing("useProtectionEditing");
}

export function useProtectionActions(): ProtectionEditingActions {
  return use(ActionsContext) ?? missing("useProtectionActions");
}

export function useProtectionMeta(): ProtectionEditingMeta {
  return use(MetaContext) ?? missing("useProtectionMeta");
}
