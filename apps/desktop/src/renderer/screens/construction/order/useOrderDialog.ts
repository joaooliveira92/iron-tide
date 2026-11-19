import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { createValueStore, subscribeWithLifecycle } from "../../../lib/value-store.js";
import type { CompiledDesignVersion } from "@bluewave/campaign-engine";
import type {
  ConstructionBatchPreviewOutcome,
  ConstructionStudyEntry,
  ForeignConstructionPreviewOutcome,
} from "../../../../shared/construction-contract.js";
import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";
import type { UseConstructionScreenReturn } from "../hooks/useConstructionScreen.js";
import {
  ORDER_QUANTITY_MAX,
  ORDER_QUANTITY_MIN,
  orderViewModel,
  type OrderViewModel,
} from "./order-view-model.js";

export interface OrderDialogState {
  readonly open: boolean;
  readonly className: string | null;
  readonly design: CompiledDesignVersion | null;
  readonly study: ConstructionStudyEntry | null;
  readonly quantity: number;
  readonly builderNationId: string | null;
  readonly fetching: boolean;
  readonly model: OrderViewModel;
}

export interface OrderDialogActions {
  readonly open: (designVersionId?: string) => void;
  readonly close: () => void;
  readonly setQuantity: (quantity: number) => void;
  readonly setBuilder: (nationId: string | null) => void;
  readonly confirm: () => void;
}

export interface OrderDialog {
  readonly state: OrderDialogState;
  readonly actions: OrderDialogActions;
}

type OrderSession = Pick<
  UseConstructionScreenReturn,
  | "state"
  | "selectedDesignId"
  | "previewBatch"
  | "previewForeign"
  | "orderBatch"
  | "placeForeignOrder"
>;

interface PreviewState {
  readonly home: ConstructionBatchPreviewOutcome | null;
  readonly foreign: ForeignConstructionPreviewOutcome | null;
  readonly fetching: boolean;
}

const IDLE_PREVIEWS: PreviewState = { home: null, foreign: null, fetching: false };

function clampQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) return ORDER_QUANTITY_MIN;
  return Math.min(ORDER_QUANTITY_MAX, Math.max(ORDER_QUANTITY_MIN, Math.trunc(quantity)));
}

export function useOrderDialog(session: OrderSession): OrderDialog {
  const {
    state: screen,
    selectedDesignId,
    previewBatch,
    previewForeign,
    orderBatch,
    placeForeignOrder,
  } = session;
  const [target, setTarget] = useState<string | null>(null);
  const [quantity, setQuantityState] = useState(ORDER_QUANTITY_MIN);
  const [builderNationId, setBuilderNationId] = useState<string | null>(null);
  const [previews] = useState(() => createValueStore<PreviewState>(IDLE_PREVIEWS));

  const study = useMemo(
    () => screen.studies.find((entry) => entry.designVersionId === target) ?? null,
    [screen.studies, target],
  );
  const design = useMemo<CompiledDesignVersion | null>(
    () => screen.designs.find((entry) => entry.designId === target) ?? null,
    [screen.designs, target],
  );
  const open = target !== null;
  const needsPreview = open && study === null;

  const subscribePreview = useMemo(
    () =>
      subscribeWithLifecycle(previews, (store) => {
        if (!needsPreview || target === null) {
          store.set(IDLE_PREVIEWS);
          return undefined;
        }
        let cancelled = false;
        store.set((current) => ({ ...current, fetching: true }));
        void Promise.all([previewBatch(target, quantity), previewForeign(target, quantity)]).then(
          ([homeResult, foreignResult]) => {
            if (cancelled) return;
            store.set({ home: homeResult, foreign: foreignResult, fetching: false });
          },
        );
        return () => {
          cancelled = true;
        };
      }),
    [previews, needsPreview, target, quantity, previewBatch, previewForeign],
  );
  const { home, foreign, fetching } = useSyncExternalStore(subscribePreview, previews.get);

  const freeTreasury =
    screen.economy === null || screen.workspace === null
      ? 0
      : screen.economy.treasury - screen.workspace.treasuryReserved;
  const format = usePresentationFormat();
  const model = useMemo(
    () =>
      orderViewModel({
        study,
        home,
        foreign,
        builderNationId,
        freeTreasury,
        formatMoney: format.money,
      }),
    [study, home, foreign, builderNationId, freeTreasury, format],
  );

  const openDialog = useCallback(
    (designVersionId?: string) => {
      const next = designVersionId ?? selectedDesignId;
      if (next === null) return;
      previews.set((current) => ({ ...current, home: null, foreign: null }));
      setBuilderNationId(null);
      setQuantityState(ORDER_QUANTITY_MIN);
      setTarget(next);
    },
    [selectedDesignId, previews],
  );
  const close = useCallback(() => setTarget(null), []);
  const setQuantity = useCallback((next: number) => setQuantityState(clampQuantity(next)), []);
  const confirm = useCallback(() => {
    if (target === null || fetching || model.status !== "ready") return;
    if (builderNationId === null) orderBatch(target, quantity);
    else placeForeignOrder(target, builderNationId, quantity);
    setTarget(null);
  }, [target, fetching, model.status, builderNationId, quantity, orderBatch, placeForeignOrder]);

  const state = useMemo<OrderDialogState>(
    () => ({
      open,
      className: design?.className ?? study?.className ?? null,
      design,
      study,
      quantity,
      builderNationId,
      fetching,
      model,
    }),
    [open, design, study, quantity, builderNationId, fetching, model],
  );
  const actions = useMemo<OrderDialogActions>(
    () => ({ open: openDialog, close, setQuantity, setBuilder: setBuilderNationId, confirm }),
    [openDialog, close, setQuantity, confirm],
  );
  return { state, actions };
}
