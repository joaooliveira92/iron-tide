import { useMemo, useState } from "react";

import type { AllocationSegment, BudgetAllocation } from "../../../status-strip-state.js";

export interface BudgetAllocationInput {
  readonly allocation: BudgetAllocation;
  readonly noteFor: (id: AllocationSegment["id"]) => string;
}

export interface BudgetAllocationState {
  readonly allocation: BudgetAllocation;
  readonly active: AllocationSegment["id"] | null;
}

export interface BudgetAllocationActions {
  readonly setActive: (id: AllocationSegment["id"] | null) => void;
  readonly activate: (id: AllocationSegment["id"]) => void;
  readonly clear: () => void;
}

export interface BudgetAllocationMeta {
  readonly noteFor: (id: AllocationSegment["id"]) => string;
  readonly limit: number | null;
}

export interface BudgetAllocationWorkspace {
  readonly state: BudgetAllocationState;
  readonly actions: BudgetAllocationActions;
  readonly meta: BudgetAllocationMeta;
}

export function useBudgetAllocationWorkspace({
  allocation,
  noteFor,
}: BudgetAllocationInput): BudgetAllocationWorkspace {
  const [active, setActive] = useState<AllocationSegment["id"] | null>(null);

  const state = useMemo<BudgetAllocationState>(
    () => ({ allocation, active }),
    [allocation, active],
  );
  const actions = useMemo<BudgetAllocationActions>(
    () => ({
      setActive,
      activate: (id) => setActive(id),
      clear: () => setActive(null),
    }),
    [],
  );
  const meta = useMemo<BudgetAllocationMeta>(
    () => ({ noteFor, limit: allocation.overCommitted ? allocation.limit : null }),
    [noteFor, allocation],
  );

  return { state, actions, meta };
}
