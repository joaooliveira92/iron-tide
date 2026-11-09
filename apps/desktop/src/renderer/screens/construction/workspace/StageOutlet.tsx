import {
  CatalogStage,
  DockCapacityPanel,
  OrdersStage,
  SlipwaysStage,
} from "../components/index.js";
import { OrderDialog } from "../order/OrderDialog.js";
import {
  useConstructionActions,
  useConstructionMeta,
  useConstructionState,
} from "./ConstructionContext.js";

export function StageOutlet() {
  return (
    <>
      <Stage />
      <OrderDialog />
    </>
  );
}

function Stage() {
  const { screen, selectedDesignId } = useConstructionState();
  const {
    selectProject,
    selectDesign,
    selectCommand,
    browseCatalog,
    replace,
    cancel,
    openOrderDialog,
    authorizeDockExpansion,
  } = useConstructionActions();
  const { place, rows, selectedRow, selectedCommandId, busy, figures } = useConstructionMeta();
  const workspace = screen.workspace;
  const economy = screen.economy;
  if (workspace === null || economy === null || figures === null) return null;

  switch (place) {
    case "slipways":
      return (
        <SlipwaysStage
          rows={rows}
          economy={economy}
          selectedId={selectedRow?.projectId ?? null}
          onSelect={selectProject}
          onBrowseCatalog={browseCatalog}
        />
      );
    case "catalog":
      return (
        <CatalogStage
          designs={screen.designs}
          economy={economy}
          workspace={workspace}
          studies={screen.studies}
          selectedDesignId={selectedDesignId}
          onSelectDesign={selectDesign}
          onOpenStudy={openOrderDialog}
        />
      );
    case "orders":
      return (
        <OrdersStage
          commands={workspace.commands}
          economy={economy}
          busy={busy}
          selectedDesignId={selectedDesignId}
          selectedCommandId={selectedCommandId}
          onSelectCommand={selectCommand}
          onReplace={replace}
          onCancel={cancel}
          onBrowseCatalog={browseCatalog}
        />
      );
    case "dock":
      return (
        <DockCapacityPanel
          dockMaxBuildDisplacementKg={economy.dockMaxBuildDisplacementKg}
          maxConcurrentConstructionMassKg={economy.maxConcurrentConstructionMassKg}
          committedNewConstructionMassKg={economy.committedNewConstructionMassKg}
          exemptNewConstructionMassKg={economy.exemptNewConstructionMassKg}
          dockExpansionReadyMonth={economy.dockExpansionReadyMonth}
          dockExpansionDurationMonths={economy.dockExpansionDurationMonths}
          dockExpansionNextStepKg={economy.dockExpansionNextStepKg}
          dockPossessions={economy.dockPossessions}
          pending={busy}
          onAuthorizeDockExpansion={authorizeDockExpansion}
        />
      );
  }
}
