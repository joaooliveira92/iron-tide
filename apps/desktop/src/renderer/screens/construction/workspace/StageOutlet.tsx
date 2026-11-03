import {
  BatchBuildDialog,
  CatalogStage,
  DockCapacityPanel,
  OrdersStage,
  SlipwaysStage,
} from "../components/index.js";
import {
  useConstructionActions,
  useConstructionMeta,
  useConstructionState,
} from "./ConstructionContext.js";

export function StageOutlet() {
  const { screen, selectedDesignId, batch } = useConstructionState();
  const {
    selectProject,
    selectDesign,
    selectCommand,
    browseCatalog,
    replace,
    cancel,
    setSelectedDesignId,
    setBatchQuantity,
    setBatchBuilder,
    closeBatch,
    confirmBatch,
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
      return batch.open ? (
        <BatchBuildDialog
          designs={screen.designs}
          selectedDesignId={selectedDesignId}
          onSelectDesign={setSelectedDesignId}
          quantity={batch.quantity}
          onQuantityChange={setBatchQuantity}
          preview={batch.preview}
          foreignPreview={batch.foreignPreview}
          builderNationId={batch.builderNationId}
          onSelectBuilder={setBatchBuilder}
          busy={busy || batch.fetching}
          notice={screen.notice}
          onConfirm={confirmBatch}
          onCancel={closeBatch}
        />
      ) : (
        <CatalogStage
          designs={screen.designs}
          economy={economy}
          workspace={workspace}
          selectedDesignId={selectedDesignId}
          onSelectDesign={selectDesign}
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
          dockExpansionDurationMonths={economy.dockExpansionDurationMonths}
          dockExpansionNextStepKg={economy.dockExpansionNextStepKg}
          dockPossessions={economy.dockPossessions}
          pending={busy}
          onAuthorizeDockExpansion={authorizeDockExpansion}
        />
      );
  }
}
