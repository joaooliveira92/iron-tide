import { ComparePanel } from "../../../components/design-workspace/panels/ComparePanel.js";
import { plainShipTypeName } from "../../../components/design-workspace/shipTypes.js";
import { shipTypeIcon } from "../../../components/design-workspace/ship-type-icon.js";
import { CommandBar } from "../components/CommandBar.js";
import {
  useShipbuildingActions,
  useShipbuildingMeta,
  useShipbuildingState,
} from "./WorkspaceContext.js";

export function CommandBarSection() {
  const {
    shipClassName,
    shipType,
    canUndo,
    canRedo,
    baseline,
    preset,
    developedFrom,
    autosave,
    nameInputRef,
  } = useShipbuildingState();
  const { hosted } = useShipbuildingMeta();
  const { setShipClassName, undo, redo, setDialog, openSection, setPendingPreset, finish } =
    useShipbuildingActions();
  const ShipTypeIcon = shipTypeIcon(shipType);
  return (
    <CommandBar
      variant={hosted ? "header" : "overlay"}
      shipClassName={shipClassName}
      onShipClassName={setShipClassName}
      nameInputRef={nameInputRef}
      onStartFromReference={() => setDialog("start")}
      shipTypeName={plainShipTypeName(shipType)}
      shipTypeIcon={<ShipTypeIcon aria-hidden="true" className="size-4" />}
      developedFrom={developedFrom}
      canUndo={canUndo}
      canRedo={canRedo}
      onUndo={undo}
      onRedo={redo}
      compare={<ComparePanel baseline={baseline} name={preset.name} />}
      autosaved={autosave.enabled}
      onFinish={finish}
      overflow={[
        {
          label: "Design",
          items: [
            { label: "Edit history…", onSelect: () => setDialog("history") },
            { label: "Design alternatives…", onSelect: () => setDialog("alternatives") },
            {
              label: "Rebuild a completed ship…",
              onSelect: () => openSection("review", "rebuild"),
            },
          ],
        },
        {
          label: "File",
          items: [
            { label: "Open design…", onSelect: () => setDialog("open") },
            { label: "Import or export design…", onSelect: () => setDialog("file") },
          ],
        },
        {
          label: "Danger zone",
          items: [
            {
              label: "Reset to the starting design",
              destructive: true,
              onSelect: () => setPendingPreset(preset.id),
            },
          ],
        },
      ]}
    />
  );
}
