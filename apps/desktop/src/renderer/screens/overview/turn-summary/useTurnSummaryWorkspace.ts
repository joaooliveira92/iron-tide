import { useMemo, useState } from "react";
import type {
  EntityReferenceDto,
  TurnMessageDto,
  TurnSummaryEntry,
} from "../../../../shared/turn-message-contract.js";
import type { UiStateTurnMessages } from "../../../../shared/ui-state-contract.js";
import {
  DEFAULT_FILTERS,
  filterTurnMessages,
  groupTurnMessages,
  isActionable,
  type TurnMessageGroup,
  type TurnSummaryFilters,
} from "../turn-summary-format.js";

const EMPTY_MESSAGES: readonly TurnMessageDto[] = [];
const ALWAYS_AVAILABLE = () => true;
const NEVER_HANDLED = () => undefined;

export interface TurnSummaryInput {
  readonly summaries: readonly TurnSummaryEntry[];
  readonly loading: boolean;
  readonly turnMessages: UiStateTurnMessages;
  readonly onTogglePinned: (id: string) => void;
  readonly onToggleRead: (id: string) => void;
  readonly onOpenEntity?: (ref: EntityReferenceDto) => void;
  readonly isEntityAvailable?: (ref: EntityReferenceDto) => boolean;
  readonly onAssignToFleet?: (shipId: string) => void;
}

export interface TurnSummaryState {
  readonly summaries: readonly TurnSummaryEntry[];
  readonly loading: boolean;
  readonly selectedTurnId: string | null;
  readonly filters: TurnSummaryFilters;
}

export interface TurnSummaryActions {
  readonly selectTurn: (turnId: string) => void;
  readonly patchFilters: (patch: Partial<TurnSummaryFilters>) => void;
  readonly toggleActionableOnly: () => void;
  readonly togglePinned: (id: string) => void;
  readonly toggleRead: (id: string) => void;
  readonly openEntity: (ref: EntityReferenceDto) => void;
  readonly assignToFleet?: (shipId: string) => void;
}

export interface TurnSummaryMeta {
  readonly selected: TurnSummaryEntry | null;
  readonly messages: readonly TurnMessageDto[];
  readonly visible: readonly TurnMessageDto[];
  readonly groups: readonly TurnMessageGroup[];
  readonly actionableCount: number;
  readonly pinnedIds: ReadonlySet<string>;
  readonly readIds: ReadonlySet<string>;
  readonly showHistory: boolean;
  readonly showFilters: boolean;
  readonly isEmpty: boolean;
  readonly noMatch: boolean;
  readonly isEntityAvailable: (ref: EntityReferenceDto) => boolean;
}

export interface TurnSummaryWorkspace {
  readonly state: TurnSummaryState;
  readonly actions: TurnSummaryActions;
  readonly meta: TurnSummaryMeta;
}

export function useTurnSummaryWorkspace(input: TurnSummaryInput): TurnSummaryWorkspace {
  const [selectedTurnId, setSelectedTurnId] = useState<string | null>(null);
  const [filters, setFilters] = useState<TurnSummaryFilters>(DEFAULT_FILTERS);

  const selected =
    input.summaries.find((entry) => entry.turnId === selectedTurnId) ?? input.summaries[0] ?? null;

  const messages = useMemo(() => selected?.messages ?? EMPTY_MESSAGES, [selected]);
  const visible = useMemo(() => filterTurnMessages(messages, filters), [messages, filters]);
  const groups = useMemo(() => groupTurnMessages(visible), [visible]);
  const actionableCount = useMemo(() => messages.filter(isActionable).length, [messages]);
  const pinnedIds = useMemo(
    () => new Set(input.turnMessages.pinnedIds),
    [input.turnMessages.pinnedIds],
  );
  const readIds = useMemo(() => new Set(input.turnMessages.readIds), [input.turnMessages.readIds]);

  const state = useMemo<TurnSummaryState>(
    () => ({
      summaries: input.summaries,
      loading: input.loading,
      selectedTurnId,
      filters,
    }),
    [input.summaries, input.loading, selectedTurnId, filters],
  );

  const actions = useMemo<TurnSummaryActions>(
    () => ({
      selectTurn: setSelectedTurnId,
      patchFilters: (patch) => setFilters((current) => ({ ...current, ...patch })),
      toggleActionableOnly: () =>
        setFilters((current) => ({ ...current, actionableOnly: !current.actionableOnly })),
      togglePinned: input.onTogglePinned,
      toggleRead: input.onToggleRead,
      openEntity: input.onOpenEntity ?? NEVER_HANDLED,
      ...(input.onAssignToFleet === undefined ? {} : { assignToFleet: input.onAssignToFleet }),
    }),
    [input.onTogglePinned, input.onToggleRead, input.onOpenEntity, input.onAssignToFleet],
  );

  const meta = useMemo<TurnSummaryMeta>(
    () => ({
      selected,
      messages,
      visible,
      groups,
      actionableCount,
      pinnedIds,
      readIds,
      showHistory: input.summaries.length > 1,
      showFilters: input.summaries.length > 0,
      isEmpty: !input.loading && input.summaries.length === 0,
      noMatch: !input.loading && messages.length > 0 && visible.length === 0,
      isEntityAvailable: input.isEntityAvailable ?? ALWAYS_AVAILABLE,
    }),
    [
      selected,
      messages,
      visible,
      groups,
      actionableCount,
      pinnedIds,
      readIds,
      input.summaries,
      input.loading,
      input.isEntityAvailable,
    ],
  );

  return { state, actions, meta };
}
