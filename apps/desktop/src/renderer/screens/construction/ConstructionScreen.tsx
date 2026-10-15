import { useCallback, useEffect, useMemo, useState } from "react";
import { Hammer } from "lucide-react";
import { PageHeader } from "../../components/shared/PageHeader.js";
import { Badge } from "../../components/ui/badge.js";
import { Button } from "../../components/ui/button.js";
import { debugRevisionActions } from "../../components/shared/debugRevisionActions.js";
import { Skeleton } from "../../components/ui/skeleton.js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs.js";
import {
  BatchBuildDialog,
  CommandTable,
  ConstructionWizard,
  DesignPicker,
  DockCapacityPanel,
  LoadErrorCard,
  ProjectsCard,
  StatsPanel,
} from "./components/index.js";
import type {
  ConstructionBatchPreviewOutcome,
  ForeignConstructionPreviewOutcome,
} from "../../../shared/construction-contract.js";
import { projectRows } from "./project-progress.js";
import { useConstructionScreen } from "./hooks/useConstructionScreen.js";
import { CollapsibleSection } from "../../components/shared/CollapsibleSection.js";
import { DeferredFeaturesPanel } from "../../components/shared/DeferredFeaturesPanel.js";
import { DEFERRED_CONSTRUCTION_ITEMS } from "./construction-screen-state.js";

export function ConstructionScreen({ sessionId }: { readonly sessionId: string }) {
  const {
    state,
    loadError,
    selectedDesignId,
    request,
    loadScreen,
    setSelectedDesignId,
    submit,
    replace,
    cancel,
    cancelProject,
    halt,
    resume,
    setAcceleration,
    orderBatch,
    previewBatch,
    previewForeign,
    placeForeignOrder,
    authorizeDockExpansion,
  } = useConstructionScreen(sessionId);
  const [activeTab, setActiveTab] = useState("overview");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchQuantity, setBatchQuantity] = useState(1);
  const [batchPreview, setBatchPreview] = useState<ConstructionBatchPreviewOutcome | null>(null);
  const [batchForeignPreview, setBatchForeignPreview] =
    useState<ForeignConstructionPreviewOutcome | null>(null);
  const [batchBuilderNationId, setBatchBuilderNationId] = useState<string | null>(null);
  const [batchFetching, setBatchFetching] = useState(false);
  const selectedDesign = useMemo(
    () => state.designs.find((d) => d.designId === selectedDesignId) ?? null,
    [state.designs, selectedDesignId],
  );

  // Stable handlers so the memo()'d catalog and wizard only re-render on real changes.
  const openWizard = useCallback(() => setWizardOpen(true), []);
  const closeWizard = useCallback(() => setWizardOpen(false), []);
  const openBatch = useCallback(() => {
    setBatchPreview(null);
    setBatchForeignPreview(null);
    setBatchBuilderNationId(null);
    setBatchOpen(true);
  }, []);
  const closeBatch = useCallback(() => setBatchOpen(false), []);
  const refresh = useCallback(() => void loadScreen(), [loadScreen]);
  const confirmOrder = useCallback(() => {
    submit();
    closeWizard();
  }, [submit, closeWizard]);

  // The batch dialog previews the engine's names/dock fit for the current design and quantity (SB3-R30/R33). The
  // wire schema only carries a positive quantity; the engine decides `1..12` and reports its own reason otherwise.
  useEffect(() => {
    if (
      !batchOpen ||
      batchBuilderNationId !== null ||
      selectedDesignId === null ||
      !(Number.isInteger(batchQuantity) && batchQuantity >= 1)
    ) {
      setBatchPreview(null);
      setBatchFetching(false);
      return;
    }
    let cancelled = false;
    setBatchFetching(true);
    void previewBatch(selectedDesignId, batchQuantity).then((result) => {
      if (cancelled) return;
      setBatchPreview(result);
      setBatchFetching(false);
    });
    return () => {
      cancelled = true;
    };
  }, [batchOpen, batchBuilderNationId, selectedDesignId, batchQuantity, previewBatch]);

  // The foreign builder list and (when one is chosen) the contract terms (SB3-R20/R34). Fetched whenever the dialog is
  // open so the builder selector can offer foreign yards; the engine derives every figure, including the refusal.
  useEffect(() => {
    if (
      !batchOpen ||
      selectedDesignId === null ||
      !(Number.isInteger(batchQuantity) && batchQuantity >= 1)
    ) {
      setBatchForeignPreview(null);
      return;
    }
    let cancelled = false;
    void previewForeign(selectedDesignId, batchQuantity, batchBuilderNationId ?? undefined).then(
      (result) => {
        if (!cancelled) setBatchForeignPreview(result);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [batchOpen, selectedDesignId, batchQuantity, batchBuilderNationId, previewForeign]);

  const confirmBatch = useCallback(() => {
    if (selectedDesignId === null) return;
    if (batchBuilderNationId === null) orderBatch(selectedDesignId, batchQuantity);
    else placeForeignOrder(selectedDesignId, batchBuilderNationId, batchQuantity);
    closeBatch();
  }, [
    orderBatch,
    placeForeignOrder,
    selectedDesignId,
    batchBuilderNationId,
    batchQuantity,
    closeBatch,
  ]);

  if (loadError !== null) {
    return (
      <div data-guided-target="construction">
        <LoadErrorCard message={loadError} onReload={() => void loadScreen()} />
      </div>
    );
  }

  if (state.workspace === null || state.economy === null) {
    return (
      <div data-guided-target="construction" className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[0, 1, 2].map((idx) => (
          <Skeleton key={idx} className="h-24" />
        ))}
      </div>
    );
  }

  const busy = state.pendingRequest !== null || state.requiresRefresh;
  const submittedCount = state.workspace.commands.filter(
    (command) => command.status === "submitted",
  ).length;

  return (
    <div data-guided-target="construction" className="space-y-6">
      <PageHeader
        icon={Hammer}
        title="Construction Commands"
        description="Drydock procurement and shipyard queue management."
        actions={debugRevisionActions(state.month, state.revision)}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Shipyard Ledger</TabsTrigger>
          <TabsTrigger value="catalog">Design Catalog</TabsTrigger>
          <TabsTrigger value="commands">
            Command Ledger
            {submittedCount > 0 && (
              <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
                {submittedCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="space-y-4">
            <StatsPanel economy={state.economy} workspace={state.workspace} />
            <DockCapacityPanel
              dockMaxBuildDisplacementKg={state.economy.dockMaxBuildDisplacementKg}
              maxConcurrentConstructionMassKg={state.economy.maxConcurrentConstructionMassKg}
              committedNewConstructionMassKg={state.economy.committedNewConstructionMassKg}
              exemptNewConstructionMassKg={state.economy.exemptNewConstructionMassKg}
              dockExpansionDurationMonths={state.economy.dockExpansionDurationMonths}
              dockExpansionNextStepKg={state.economy.dockExpansionNextStepKg}
              dockPossessions={state.economy.dockPossessions}
              pending={busy}
              onAuthorizeDockExpansion={authorizeDockExpansion}
            />
            {state.notice !== null && (
              <p role="status" className="text-sm whitespace-pre-line text-muted-foreground">
                {state.notice}
              </p>
            )}
            <ProjectsCard
              rows={projectRows(state.projects)}
              onHalt={halt}
              onResume={resume}
              onAccelerate={setAcceleration}
              onCancelProject={cancelProject}
            />
          </div>
        </TabsContent>

        <TabsContent value="catalog">
          {batchOpen ? (
            <BatchBuildDialog
              designs={state.designs}
              selectedDesignId={selectedDesignId}
              onSelectDesign={setSelectedDesignId}
              quantity={batchQuantity}
              onQuantityChange={setBatchQuantity}
              preview={batchPreview}
              foreignPreview={batchForeignPreview}
              builderNationId={batchBuilderNationId}
              onSelectBuilder={setBatchBuilderNationId}
              busy={busy || batchFetching}
              notice={state.notice}
              onConfirm={confirmBatch}
              onCancel={closeBatch}
            />
          ) : !wizardOpen ? (
            <div className="space-y-4">
              <DesignPicker
                designs={state.designs}
                selectedDesignId={selectedDesignId}
                onSelectDesign={setSelectedDesignId}
                onSubmit={openWizard}
                onRefresh={refresh}
                busy={busy}
                hasPendingRequest={request.outcomeUnknown}
                onRetry={request.outcomeUnknown ? request.retry : undefined}
                notice={state.notice}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={openBatch}
                disabled={state.designs.length === 0}
              >
                Order a class batch (1–12)
              </Button>
            </div>
          ) : (
            <ConstructionWizard
              design={selectedDesign}
              economy={state.economy}
              workspace={state.workspace}
              busy={busy}
              notice={state.notice}
              onConfirm={confirmOrder}
              onCancelWizard={closeWizard}
            />
          )}
        </TabsContent>

        <TabsContent value="commands">
          <CommandTable
            commands={state.workspace.commands}
            busy={busy}
            selectedDesignId={selectedDesignId}
            onReplace={replace}
            onCancel={cancel}
          />
        </TabsContent>
      </Tabs>

      <CollapsibleSection
        title="Not yet modelled"
        testId="construction-deferred-section"
        summary={`${DEFERRED_CONSTRUCTION_ITEMS.length} items`}
      >
        <DeferredFeaturesPanel
          items={DEFERRED_CONSTRUCTION_ITEMS}
          testId="construction-deferred"
          title="Construction features the engine cannot supply yet"
        />
      </CollapsibleSection>
    </div>
  );
}
