import type { CampaignSnapshot, CampaignState } from "@bluewave/campaign";
import { advanceMonth, canAdvance, createCampaignSnapshotEnvelope } from "@bluewave/campaign";
import type { CommitMonthResponse } from "@bluewave/campaign-engine";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import {
  computeOrderedInputsHash,
  computeTurnId,
  type InterruptionRequest,
  type PendingDecision,
  type RecordedInput,
} from "@bluewave/messages";
import { MonthExecutor, type InterruptionChannel } from "@bluewave/phase-engine";
import { Effect } from "effect";
import { monthInputOf } from "../monthInput.js";
import { buildPendingTurn, type PendingTurnRecord } from "../pendingTurn.js";
import { CampaignSessionStore } from "../runtime/campaignSessionStore.js";
import { CommandQueue } from "../runtime/commandQueue.js";
import { ContentArtifact } from "../runtime/contentArtifact.js";
import { CommandFailed, SessionNotFound } from "../runtime/commandError.js";
import { ProjectStore } from "../runtime/projectStore.js";
import { ReportsStore, TurnSummariesStore } from "../runtime/sidecarStores.js";
import { toSaveableState } from "../saveHelpers.js";
import { buildTurnSummary } from "../turnSummaries.js";
import {
  sumByCategory,
  toDomainEvents,
  toFinancialLedgerEntries,
  toRandomDecisions,
} from "./commitMonth/responseMappers.js";
import { collectBattleOutcomes } from "./commitMonth/battleOutcomes.js";
import { buildMonthlyReportEntry } from "./commitMonth/reportEntry.js";
import { promotePlayerSlotForExecution } from "./commitMonth/snapshot.js";
import type { TurnSummaryEntry } from "../../shared/turn-message-contract.js";

export type TurnTransactionOutcome =
  | {
      readonly kind: "completed";
      readonly response: CommitMonthResponse;
      readonly summary: TurnSummaryEntry;
      readonly diagnostics: readonly string[];
    }
  | {
      readonly kind: "suspended";
      readonly request: InterruptionRequest | null;
      readonly pendingTurn: PendingTurnRecord;
      readonly snapshot: CampaignSnapshot;
      readonly diagnostics: readonly string[];
    }
  | { readonly kind: "unavailable"; readonly diagnostics: readonly string[] }
  | {
      readonly kind: "rejected";
      readonly reason: string;
      readonly diagnostics: readonly string[];
      readonly currentRevision?: number;
    }
  | {
      readonly kind: "error";
      readonly reason: string;
      readonly diagnostics: readonly string[];
    };

export interface TurnTransactionInput {
  readonly sessionId: string;
  readonly expectedRevision: number;
  readonly recordedInputs?: readonly RecordedInput[];
  readonly pendingDecisions?: readonly PendingDecision[];
  readonly allowInterruptions: boolean;
}

export const runTurnTransaction = (
  input: TurnTransactionInput,
): Effect.Effect<
  TurnTransactionOutcome,
  CommandFailed | SessionNotFound,
  | CampaignSessionStore
  | ProjectStore
  | ReportsStore
  | TurnSummariesStore
  | CommandQueue
  | ContentArtifact
> =>
  Effect.gen(function* () {
    const sessions = yield* CampaignSessionStore;
    const projects = yield* ProjectStore;
    const reports = yield* ReportsStore;
    const summaries = yield* TurnSummariesStore;
    const queue = yield* CommandQueue;
    const contentArtifact = yield* ContentArtifact;

    const record = yield* sessions.get(input.sessionId);

    const currentRevision = Number(record.state.snapshot.turnNumber);
    if (input.expectedRevision !== currentRevision) {
      return {
        kind: "rejected",
        reason: "REVISION_MISMATCH",
        currentRevision,
        diagnostics: [
          `Expected revision ${String(input.expectedRevision)} but session ${input.sessionId} is at revision ${String(currentRevision)}`,
        ],
      };
    }

    if (record.state.snapshot.careerResult !== undefined) {
      return {
        kind: "rejected",
        reason: "CAREER_ENDED",
        diagnostics: [`The career of session ${input.sessionId} has ended`],
      };
    }

    if (!canAdvance(record.month.year, record.month.month)) {
      return {
        kind: "rejected",
        reason: "SIMULATION_END_REACHED",
        diagnostics: [
          `Campaign cannot advance beyond December 1970 (at ${String(record.month.year)}-${String(record.month.month)})`,
        ],
      };
    }

    const playerNationBefore = record.state.snapshot.nations.get(record.playerSlotId);
    if (!playerNationBefore) {
      return {
        kind: "error",
        reason: "UNKNOWN_PLAYER_SLOT",
        diagnostics: [`No nation ${record.playerSlotId} in session ${input.sessionId}`],
      };
    }

    const randomSeed = `${record.campaignSeed}:month:${String(record.state.snapshot.turnNumber)}`;
    const executor = new MonthExecutor();
    const collector = new DiagnosticCollector();

    const originalSlots = record.state.snapshot.slots;
    const executionSnapshot = promotePlayerSlotForExecution(
      record.state.snapshot,
      record.playerSlotId,
    );
    const pendingCommands = yield* queue.forExecution(input.sessionId, executionSnapshot);
    const shipBuilding = yield* contentArtifact.loadShipBuildingContent();
    const battleOffers = yield* contentArtifact.loadBattleOfferRules();

    const recordedInputs = input.recordedInputs ?? [];
    const committedOrderHash = sha256Hex(canonicalSerialize(pendingCommands));
    const orderedInputsHash = computeOrderedInputsHash([]);
    const turnId = computeTurnId({
      campaignId: record.state.snapshot.campaignId,
      startingRevision: currentRevision,
      committedOrderHash,
      orderedInputsHash,
    });
    const channel: InterruptionChannel | undefined = input.allowInterruptions
      ? {
          turnId,
          recordedInputs,
          pendingDecisions: input.pendingDecisions ?? [],
        }
      : undefined;

    const result = executor.execute(
      executionSnapshot,
      [...pendingCommands],
      randomSeed,
      collector,
      undefined,
      {
        shipBuilding,
        ...(shipBuilding.presence !== undefined ? { presence: shipBuilding.presence } : {}),
        ...(battleOffers !== undefined
          ? { battleOffers, playerNationId: record.playerSlotId }
          : {}),
        ...(channel !== undefined ? { interruptions: channel } : {}),
      },
    );

    const shipBuildingHash = yield* contentArtifact.shipBuildingContentHash();
    const armamentHash = yield* contentArtifact.armamentContentHash();

    if (result.outcome === "suspended") {
      const request = result.suspended?.request ?? null;
      const outstanding =
        request === null
          ? undefined
          : {
              kind: request.kind,
              phase: request.phase,
              ordinal: request.ordinal,
              subjectKey: request.subjectKey,
              ...(request.kind === "offer" ? { acceptanceClass: request.acceptanceClass } : {}),
            };
      const pendingTurn = buildPendingTurn({
        projectionVersion: "1.0.0",
        turnId,
        campaignId: record.state.snapshot.campaignId,
        playerNationId: record.playerSlotId,
        startingRevision: currentRevision,
        rulesetVersion: record.state.snapshot.rulesetVersion,
        compatibilityVersion: record.state.snapshot.compatibilityVersion,
        contentHashes: {
          shipBuilding: shipBuildingHash,
          armament: armamentHash,
          contentArtifact: record.state.rawHash,
        },
        committedOrderHash,
        recordedInputs,
        nextInterruptionOrdinal: result.suspended?.nextInterruptionOrdinal ?? 0,
        createdAt: `${String(record.month.year)}-${String(record.month.month).padStart(2, "0")}`,
        ...(outstanding !== undefined ? { outstanding } : {}),
      });
      return {
        kind: "suspended",
        request: result.suspended?.request ?? null,
        pendingTurn,
        snapshot: result.finalSnapshot,
        diagnostics: collector.all.map((d) => d.message),
      };
    }

    const success = result.success;
    if (!success) {
      return {
        kind: "error",
        reason: "MONTH_EXECUTION_FAILED",
        diagnostics: collector.all.map((d) => d.message),
      };
    }

    const playerNationAfter = result.finalSnapshot.nations.get(record.playerSlotId);
    if (!playerNationAfter) {
      return {
        kind: "error",
        reason: "UNKNOWN_PLAYER_SLOT",
        diagnostics: [`Nation ${record.playerSlotId} missing from post-month snapshot`],
      };
    }

    const ledgerEntries = result.financialLedger.all.filter(
      (entry) => entry.nationId === record.playerSlotId,
    );
    const maintenanceCost = sumByCategory(ledgerEntries, ["MAINTENANCE_EXPENDITURE"]);
    const newConstructionSpending = sumByCategory(ledgerEntries, [
      "APPROPRIATION",
      "CONSTRUCTION_BUDGET",
    ]);

    const nextTurnNumber = SafeInt.add(result.finalSnapshot.turnNumber, SafeInt.ONE);
    const nextSnapshot = {
      ...result.finalSnapshot,
      turnNumber: nextTurnNumber,
      slots: originalSlots,
    };
    const nextMonth = advanceMonth(record.month.year, record.month.month, 1);

    const nextEnvelope = createCampaignSnapshotEnvelope(
      nextSnapshot.compatibilityVersion,
      nextSnapshot,
    );
    const nextState: CampaignState = toSaveableState({
      snapshot: nextSnapshot,
      envelope: nextEnvelope,
      rawHash: record.state.rawHash,
    });

    const saveMetadata = yield* projects.save(nextState, record.saveDir, {
      monthInput: monthInputOf(
        pendingCommands,
        result.commandLedger.all,
        shipBuildingHash,
        armamentHash,
      ),
    });

    yield* sessions.register({ ...record, month: nextMonth, state: nextState });
    yield* queue.clear(input.sessionId);

    const activeWars = result.finalSnapshot.wars.wars.filter((war) => war.status !== "ENDED");
    const response: CommitMonthResponse = {
      report: {
        month: record.month,
        openingTreasury: Number(playerNationBefore.treasury),
        maintenanceCost,
        newConstructionSpending,
        closingTreasury: Number(playerNationAfter.treasury),
      },
      domainEvents: toDomainEvents(result.eventLedger.all),
      financialLedger: toFinancialLedgerEntries(ledgerEntries),
      randomDecisions: toRandomDecisions(result.randomLedger.all),
      closingSnapshot: {
        revision: Number(nextTurnNumber),
        month: nextMonth,
        submarinePools: [],
        minePressure: [],
        landTargetDamage: [],
        battleOutcomes: collectBattleOutcomes(record.state.snapshot, result.finalSnapshot),
        activeWars,
      },
    };

    const diagnostics: string[] = [];
    const runSidecars = <R>(
      effect: Effect.Effect<void, CommandFailed, R>,
    ): Effect.Effect<void, never, R> =>
      effect.pipe(
        Effect.catchTag("CommandFailed", (error) =>
          Effect.sync(() => {
            diagnostics.push(...error.diagnostics);
          }),
        ),
      );

    yield* runSidecars(
      Effect.gen(function* () {
        const entry = buildMonthlyReportEntry({
          response,
          month: record.month,
          nextMonth,
          turn: Number(nextTurnNumber),
          reportId: saveMetadata.saveId,
          generatedAt: saveMetadata.timestamp,
          campaignId: nextSnapshot.campaignId,
          playerNationId: record.playerSlotId,
          playerNationBefore,
          playerNationAfter,
          postSnapshot: nextSnapshot,
          ledgerEntries,
          domainEvents: result.eventLedger.all,
        });
        const existing = yield* reports.load(record.saveDir);
        const appended = yield* reports.append(existing, entry);
        yield* reports.save(record.saveDir, appended);
      }),
    );

    const summary = buildTurnSummary({
      turnId,
      events: result.eventLedger.all,
      snapshot: record.state.snapshot,
      rulesetVersion: nextSnapshot.rulesetVersion,
      contentVersion: saveMetadata.contentArtifactHash,
    });
    yield* runSidecars(
      Effect.gen(function* () {
        const existing = yield* summaries.load(record.saveDir);
        const appended = yield* summaries.append(existing, summary);
        yield* summaries.save(record.saveDir, appended);
      }),
    );

    return { kind: "completed", response, summary, diagnostics };
  });
