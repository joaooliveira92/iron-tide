import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ConstructionBatchPreviewOutcome,
  ForeignConstructionPreviewOutcome,
} from "../../../../shared/construction-contract.js";
import type { UseConstructionScreenReturn } from "../hooks/useConstructionScreen.js";

export interface BatchOrderState {
  readonly open: boolean;
  readonly quantity: number;
  readonly preview: ConstructionBatchPreviewOutcome | null;
  readonly foreignPreview: ForeignConstructionPreviewOutcome | null;
  readonly builderNationId: string | null;
  readonly fetching: boolean;
}

export interface BatchOrderActions {
  readonly open: () => void;
  readonly close: () => void;
  readonly setQuantity: (quantity: number) => void;
  readonly setBuilder: (nationId: string | null) => void;
  readonly confirm: () => void;
}

export interface BatchOrder {
  readonly state: BatchOrderState;
  readonly actions: BatchOrderActions;
}

type BatchSession = Pick<
  UseConstructionScreenReturn,
  "selectedDesignId" | "previewBatch" | "previewForeign" | "orderBatch" | "placeForeignOrder"
>;

export function useBatchOrder(session: BatchSession): BatchOrder {
  const { selectedDesignId, previewBatch, previewForeign, orderBatch, placeForeignOrder } = session;
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [preview, setPreview] = useState<ConstructionBatchPreviewOutcome | null>(null);
  const [foreignPreview, setForeignPreview] = useState<ForeignConstructionPreviewOutcome | null>(
    null,
  );
  const [builderNationId, setBuilderNationId] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);

  const reset = useCallback(() => {
    setPreview(null);
    setForeignPreview(null);
    setBuilderNationId(null);
  }, []);

  const start = useCallback(() => {
    reset();
    setOpen(true);
  }, [reset]);

  const close = useCallback(() => setOpen(false), []);

  const quantityInRange = Number.isInteger(quantity) && quantity >= 1;

  useEffect(() => {
    if (!open || builderNationId !== null || selectedDesignId === null || !quantityInRange) {
      setPreview(null);
      setFetching(false);
      return;
    }
    let cancelled = false;
    setFetching(true);
    void previewBatch(selectedDesignId, quantity).then((result) => {
      if (cancelled) return;
      setPreview(result);
      setFetching(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, builderNationId, selectedDesignId, quantity, quantityInRange, previewBatch]);

  useEffect(() => {
    if (!open || selectedDesignId === null || !quantityInRange) {
      setForeignPreview(null);
      return;
    }
    let cancelled = false;
    void previewForeign(selectedDesignId, quantity, builderNationId ?? undefined).then((result) => {
      if (!cancelled) setForeignPreview(result);
    });
    return () => {
      cancelled = true;
    };
  }, [open, selectedDesignId, quantity, quantityInRange, builderNationId, previewForeign]);

  const confirm = useCallback(() => {
    if (selectedDesignId === null) return;
    if (builderNationId === null) orderBatch(selectedDesignId, quantity);
    else placeForeignOrder(selectedDesignId, builderNationId, quantity);
    setOpen(false);
  }, [orderBatch, placeForeignOrder, selectedDesignId, builderNationId, quantity]);

  const state = useMemo(
    () => ({ open, quantity, preview, foreignPreview, builderNationId, fetching }),
    [open, quantity, preview, foreignPreview, builderNationId, fetching],
  );
  const actions = useMemo(
    () => ({
      open: start,
      close,
      setQuantity,
      setBuilder: setBuilderNationId,
      confirm,
    }),
    [start, close, confirm],
  );

  return { state, actions };
}
