import { useCallback, useState } from "react";
import { useBridge } from "../../../lib/bridge-context.js";
import type {
  ConstructionBatchPreviewOutcome,
  ConstructionCommandOutcome,
  ConstructionCommandQueuedOutcome,
  ConstructionScreenProjection,
  ForeignConstructionPreviewOutcome,
} from "../../../../shared/construction-contract.js";
import { useCommandScreenWorkflow } from "../../../lib/command-screen-workflow.js";
import { useCampaignRevision } from "../../../shell/CampaignShellContext.js";
import type { ConstructionScreenState } from "../construction-screen-state.js";
import {
  acceptConstructionCommand,
  initialConstructionScreenState,
  nextDesignSelection,
  projectConstructionScreen,
} from "../construction-screen-state.js";

export interface UseConstructionScreenReturn {
  readonly state: ConstructionScreenState;
  readonly loadError: string | null;
  readonly selectedDesignId: string | null;
  readonly request: {
    readonly outcomeUnknown: boolean;
    readonly retry: () => void;
  };
  readonly loadScreen: () => Promise<void>;
  readonly setSelectedDesignId: React.Dispatch<React.SetStateAction<string | null>>;
  readonly submit: () => void;
  readonly replace: (commandId: string) => void;
  readonly cancel: (commandId: string) => void;
  readonly cancelProject: (projectId: string) => void;
  readonly halt: (projectId: string) => void;
  readonly resume: (projectId: string) => void;
  readonly setAcceleration: (projectId: string, accelerated: boolean) => void;
  readonly orderBatch: (designVersionId: string, quantity: number) => void;
  readonly previewBatch: (
    designVersionId: string,
    quantity: number,
  ) => Promise<ConstructionBatchPreviewOutcome | null>;
  readonly previewForeign: (
    designVersionId: string,
    quantity: number,
    builderNationId?: string,
  ) => Promise<ForeignConstructionPreviewOutcome | null>;
  readonly placeForeignOrder: (
    designVersionId: string,
    builderNationId: string,
    quantity: number,
  ) => void;
  readonly authorizeDockExpansion: (possessionId: string) => void;
}

export function useConstructionScreen(sessionId: string): UseConstructionScreenReturn {
  const [selectedDesignId, setSelectedDesignId] = useState<string | null>(null);
  const bridge = useBridge();
  const campaignRevision = useCampaignRevision();
  const workflow = useCommandScreenWorkflow<
    ConstructionScreenState,
    ConstructionScreenProjection,
    ConstructionCommandOutcome | ConstructionCommandQueuedOutcome
  >(
    {
      initialState: initialConstructionScreenState,
      load: () =>
        bridge
          ? bridge.campaign.execute("inspectConstructionScreen", sessionId)
          : Promise.reject(new Error("Bluewave bridge not available")),
      project: projectConstructionScreen,
      accept: acceptConstructionCommand,
      onProjection: (projection) =>
        setSelectedDesignId((current) => nextDesignSelection(current, projection.designs)),
    },
    { refreshKey: campaignRevision },
  );
  const { execute } = workflow;

  const submit = useCallback(() => {
    if (!bridge || selectedDesignId === null) return;
    void execute("submit", ({ expectedRevision, transportRequestId }) =>
      bridge.campaign.execute("submitConstructionCommand", {
        sessionId,
        designId: selectedDesignId,
        expectedRevision,
        transportRequestId,
      }),
    );
  }, [bridge, execute, sessionId, selectedDesignId]);

  const replace = useCallback(
    (commandId: string) => {
      if (!bridge || selectedDesignId === null) return;
      void execute("replace", ({ expectedRevision, transportRequestId }) =>
        bridge.campaign.execute("replaceConstructionCommand", {
          sessionId,
          commandId,
          designId: selectedDesignId,
          expectedRevision,
          transportRequestId,
        }),
      );
    },
    [bridge, execute, sessionId, selectedDesignId],
  );

  const cancel = useCallback(
    (commandId: string) => {
      if (!bridge) return;
      void execute("cancel", ({ expectedRevision, transportRequestId }) =>
        bridge.campaign.execute("cancelConstructionCommand", {
          sessionId,
          commandId,
          expectedRevision,
          transportRequestId,
        }),
      );
    },
    [bridge, execute, sessionId],
  );

  // DESIGN-23 sections 7-8: halt, resume and the acceleration toggle queue a real engine envelope that applies on the
  // next `commitMonth`; the current month's readouts stay the engine's own compiled values until then.
  // DESIGN-23 section 23: cancel a committed project and settle it in the engine; the ship of a cancelled rebuild is
  // released on the next `commitMonth`.
  const cancelProject = useCallback(
    (projectId: string) => {
      if (!bridge) return;
      void execute("cancel-project", ({ expectedRevision, transportRequestId }) =>
        bridge.campaign.execute("cancelConstructionProjectCommand", {
          sessionId,
          projectId,
          expectedRevision,
          transportRequestId,
        }),
      );
    },
    [bridge, execute, sessionId],
  );

  const halt = useCallback(
    (projectId: string) => {
      if (!bridge) return;
      void execute("halt", ({ expectedRevision, transportRequestId }) =>
        bridge.campaign.execute("haltConstructionCommand", {
          sessionId,
          projectId,
          expectedRevision,
          transportRequestId,
        }),
      );
    },
    [bridge, execute, sessionId],
  );

  const resume = useCallback(
    (projectId: string) => {
      if (!bridge) return;
      void execute("resume", ({ expectedRevision, transportRequestId }) =>
        bridge.campaign.execute("resumeConstructionCommand", {
          sessionId,
          projectId,
          expectedRevision,
          transportRequestId,
        }),
      );
    },
    [bridge, execute, sessionId],
  );

  const setAcceleration = useCallback(
    (projectId: string, accelerated: boolean) => {
      if (!bridge) return;
      void execute("accelerate", ({ expectedRevision, transportRequestId }) =>
        bridge.campaign.execute("setAccelerationCommand", {
          sessionId,
          projectId,
          accelerated,
          expectedRevision,
          transportRequestId,
        }),
      );
    },
    [bridge, execute, sessionId],
  );

  // DESIGN-23 sections 3-5 (SB3-R11/R30): order `1..12` ships of one approved compiled design in a single engine
  // command (mirrors `halt`); the engine reserves the whole batch on the next `commitMonth`.
  const orderBatch = useCallback(
    (designVersionId: string, quantity: number) => {
      if (!bridge) return;
      void execute("order-batch", ({ expectedRevision, transportRequestId }) =>
        bridge.campaign.execute("orderConstructionBatchCommand", {
          sessionId,
          designVersionId,
          quantity,
          expectedRevision,
          transportRequestId,
        }),
      );
    },
    [bridge, execute, sessionId],
  );

  // SB3-R30/R33: the build dialog's read-only preview, straight from the engine through the bridge. A refused batch
  // comes back with the engine's own reason (never a UI-invented code); a transport failure is surfaced the same way.
  const previewBatch = useCallback(
    async (
      designVersionId: string,
      quantity: number,
    ): Promise<ConstructionBatchPreviewOutcome | null> => {
      if (!bridge) return null;
      try {
        const result = await bridge.campaign.execute("previewConstructionBatchCommand", {
          sessionId,
          designVersionId,
          quantity,
        });
        if (result.outcome === "success") return result.value;
        return { ok: false, reason: result.reason, diagnostics: result.diagnostics };
      } catch (error) {
        // A rejected bridge call must not leave the dialog stuck busy: surface it as a refusal.
        return { ok: false, reason: "PREVIEW_FAILED", diagnostics: [String(error)] };
      }
    },
    [bridge, sessionId],
  );

  // SB3-R20/R34: the foreign-order preview, straight from the engine through the bridge. It lists candidate builders
  // (dock ceiling, free capacity, capability verdict, impoundment risk, delivery guarantee) and, when a builder is
  // chosen, the contract terms. A refusal carries the engine's own reason (never a UI-invented code); a transport
  // failure is surfaced the same way.
  const previewForeign = useCallback(
    async (
      designVersionId: string,
      quantity: number,
      builderNationId?: string,
    ): Promise<ForeignConstructionPreviewOutcome | null> => {
      if (!bridge) return null;
      try {
        const result = await bridge.campaign.execute("previewForeignConstructionCommand", {
          sessionId,
          designVersionId,
          quantity,
          ...(builderNationId === undefined ? {} : { builderNationId }),
        });
        if (result.outcome === "success") return result.value;
        return { ok: false, reason: result.reason, diagnostics: result.diagnostics };
      } catch (error) {
        return { ok: false, reason: "PREVIEW_FAILED", diagnostics: [String(error)] };
      }
    },
    [bridge, sessionId],
  );

  // SB3-R20: order a hull from a foreign yard. The engine derives the contract server-side (INC-17); the payload carries
  // only the player's choices, and the command applies on the next `commitMonth` like the other steering commands.
  const placeForeignOrder = useCallback(
    (designVersionId: string, builderNationId: string, quantity: number) => {
      if (!bridge) return;
      void execute("order-foreign", ({ expectedRevision, transportRequestId }) =>
        bridge.campaign.execute("placeForeignConstructionCommand", {
          sessionId,
          designVersionId,
          builderNationId,
          quantity,
          expectedRevision,
          transportRequestId,
        }),
      );
    },
    [bridge, execute, sessionId],
  );

  // DESIGN-16 sections 5-6 (SB3-R16): the dock-expansion authorization queues a real engine envelope that applies on the
  // next `commitMonth`; the era step is locked by the engine at authorization time.
  const authorizeDockExpansion = useCallback(
    (possessionId: string) => {
      if (!bridge) return;
      void execute("authorize-dock-expansion", ({ expectedRevision, transportRequestId }) =>
        bridge.campaign.execute("authorizeDockExpansionCommand", {
          sessionId,
          possessionId,
          expectedRevision,
          transportRequestId,
        }),
      );
    },
    [bridge, execute, sessionId],
  );

  return {
    state: workflow.state,
    loadError: workflow.loadError,
    selectedDesignId,
    request: workflow.request,
    loadScreen: workflow.loadScreen,
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
  };
}
