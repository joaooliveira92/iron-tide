import { Effect, ManagedRuntime, Result, Schema } from "effect";
import type { BridgeResult } from "../shared/bridge-contract.js";
import { CAMPAIGN_COMMAND_NAMES } from "../shared/campaign-command-descriptors.js";
import {
  generateBattleProgram,
  replayBattleBoundaryProgram,
  resolveBattleProgram,
  resolveTacticalBattleProgram,
  seedCampaignBattleDrillProgram,
} from "./commands/battleSandboxCommands.js";
import { commitMonthProgram } from "./commands/commitMonth.js";
import { compileCampaignProgram } from "./commands/compileCampaign.js";
import {
  inspectDrawingBoardContentProgram,
  inspectPresentationContentProgram,
  inspectUiCatalogueProgram,
} from "./commands/contentCommands.js";
import {
  inspectConstructionScreenProgram,
  previewConstructionBatchCommandProgram,
  previewForeignConstructionCommandProgram,
  replaceConstructionCommandProgram,
  cancelConstructionCommandProgram,
  submitConstructionCommandProgram,
} from "./commands/constructionCommands.js";
import {
  authorizeDockExpansionCommandProgram,
  cancelConstructionProjectCommandProgram,
  haltConstructionCommandProgram,
  orderConstructionBatchCommandProgram,
  placeForeignConstructionCommandProgram,
  resumeConstructionCommandProgram,
  setAccelerationCommandProgram,
} from "./commands/constructionStatusCommands.js";
import {
  listCampaignsProgram,
  loadCampaignProgram,
  listRecentCampaignsProgram,
  loadRecentCampaignProgram,
  removeRecentCampaignProgram,
  recoverCampaignProgram,
  replayCampaignProgram,
  verifyCampaignProgram,
} from "./commands/continuityCommands.js";
import {
  checkRebuildProgram,
  listRebuildableShipsProgram,
  loadProjectDraftProgram,
  loadShipDraftProgram,
  reviseProjectCommandProgram,
  startRebuildCommandProgram,
  submitDesignCommandProgram,
} from "./commands/designCommands.js";
import {
  inspectDiplomacyScreenProgram,
  submitDiplomacyCommandProgram,
} from "./commands/diplomacyCommands.js";
import {
  inspectDivisionScreenProgram,
  submitDivisionCommandProgram,
} from "./commands/divisionCommands.js";
import {
  cancelMovementCommandProgram,
  inspectFleetScreenProgram,
  replaceMovementCommandProgram,
  submitMovementCommandProgram,
  submitStationAssignmentProgram,
} from "./commands/fleetCommands.js";
import {
  inspectBudgetScreenProgram,
  submitBudgetAllocationProgram,
} from "./commands/budgetCommands.js";
import { inspectBattleHistoryProgram } from "./commands/inspectBattleHistory.js";
import { inspectCampaignProgram } from "./commands/inspectCampaign.js";
import { inspectMapProgram } from "./commands/inspectMap.js";
import { inspectOpeningBriefingProgram } from "./commands/inspectOpeningBriefing.js";
import { inspectPrioritiesProgram } from "./commands/inspectPriorities.js";
import { listNewGameOptionsProgram } from "./commands/listNewGameOptions.js";
import {
  closeCampaignProgram,
  copyCampaignProgram,
  saveCampaignProgram,
} from "./commands/sessionCommands.js";
import {
  inspectResearchScreenProgram,
  setResearchPriorityCommandProgram,
} from "./commands/researchCommands.js";
import {
  readDrawingBoardDraftProgram,
  writeDrawingBoardDraftProgram,
} from "./drawingBoardDraft.js";
import { readMonthlyReportsProgram } from "./monthlyReports.js";
import { readTurnSummariesProgram } from "./turnSummaries.js";
import {
  abandonPendingTurnProgram,
  answerDecisionProgram,
  readPendingTurnProgram,
  resolveTurnProgram,
  submitBattleResultProgram,
  submitOfferResponseProgram,
} from "./commands/resolveTurn.js";
import {
  advancePlayerBattleProgram,
  finishPlayerBattleProgram,
  startPlayerBattleProgram,
} from "./commands/playerBattle.js";
import { readUiStateProgram, writeUiStateProgram } from "./uiState.js";
import { runCommandHandler, type CommandHandlers } from "./runtime/commandProgram.js";
import { NotImplemented, UnknownCommand } from "./runtime/commandError.js";
import { projectCommandExit } from "./runtime/bridgeResult.js";
import { type CommandEnv, desktopMainLayer } from "./runtime/desktopMainLayer.js";

const CommandNameSchema = Schema.Literals(CAMPAIGN_COMMAND_NAMES);

export const commandHandlers: CommandHandlers = {
  listNewGameOptions: () => listNewGameOptionsProgram,
  compileCampaign: compileCampaignProgram,
  inspectCampaign: inspectCampaignProgram,
  inspectMap: inspectMapProgram,
  inspectBattleHistory: inspectBattleHistoryProgram,
  inspectOpeningBriefing: inspectOpeningBriefingProgram,
  inspectPriorities: inspectPrioritiesProgram,
  inspectDrawingBoardContent: () => inspectDrawingBoardContentProgram,
  inspectPresentationContent: () => inspectPresentationContentProgram,
  inspectUiCatalogue: () => inspectUiCatalogueProgram,
  commitMonth: commitMonthProgram,
  inspectConstructionScreen: inspectConstructionScreenProgram,
  submitConstructionCommand: submitConstructionCommandProgram,
  replaceConstructionCommand: replaceConstructionCommandProgram,
  cancelConstructionCommand: cancelConstructionCommandProgram,
  haltConstructionCommand: haltConstructionCommandProgram,
  resumeConstructionCommand: resumeConstructionCommandProgram,
  setAccelerationCommand: setAccelerationCommandProgram,
  cancelConstructionProjectCommand: cancelConstructionProjectCommandProgram,
  orderConstructionBatchCommand: orderConstructionBatchCommandProgram,
  previewConstructionBatchCommand: previewConstructionBatchCommandProgram,
  authorizeDockExpansionCommand: authorizeDockExpansionCommandProgram,
  placeForeignConstructionCommand: placeForeignConstructionCommandProgram,
  previewForeignConstructionCommand: previewForeignConstructionCommandProgram,
  inspectFleetScreen: inspectFleetScreenProgram,
  submitMovementCommand: submitMovementCommandProgram,
  submitStationAssignment: submitStationAssignmentProgram,
  replaceMovementCommand: replaceMovementCommandProgram,
  cancelMovementCommand: cancelMovementCommandProgram,
  submitDesignCommand: submitDesignCommandProgram,
  reviseProjectCommand: reviseProjectCommandProgram,
  loadProjectDraft: loadProjectDraftProgram,
  readDrawingBoardDraft: readDrawingBoardDraftProgram,
  writeDrawingBoardDraft: writeDrawingBoardDraftProgram,
  listRebuildableShips: listRebuildableShipsProgram,
  loadShipDraft: loadShipDraftProgram,
  checkRebuild: checkRebuildProgram,
  startRebuildCommand: startRebuildCommandProgram,
  inspectResearchScreen: inspectResearchScreenProgram,
  setResearchPriorityCommand: setResearchPriorityCommandProgram,
  inspectDiplomacyScreen: inspectDiplomacyScreenProgram,
  submitDiplomacyCommand: submitDiplomacyCommandProgram,
  inspectDivisionScreen: inspectDivisionScreenProgram,
  submitDivisionCommand: submitDivisionCommandProgram,
  inspectBudgetScreen: inspectBudgetScreenProgram,
  submitBudgetAllocation: submitBudgetAllocationProgram,
  saveCampaign: saveCampaignProgram,
  closeCampaign: closeCampaignProgram,
  copyCampaign: copyCampaignProgram,
  readUiState: readUiStateProgram,
  writeUiState: writeUiStateProgram,
  readMonthlyReports: readMonthlyReportsProgram,
  readTurnSummaries: readTurnSummariesProgram,
  resolveTurn: resolveTurnProgram,
  answerDecision: answerDecisionProgram,
  submitBattleResult: submitBattleResultProgram,
  startPlayerBattle: startPlayerBattleProgram,
  advancePlayerBattle: advancePlayerBattleProgram,
  finishPlayerBattle: finishPlayerBattleProgram,
  submitOfferResponse: submitOfferResponseProgram,
  abandonPendingTurn: abandonPendingTurnProgram,
  readPendingTurn: readPendingTurnProgram,
  loadCampaign: loadCampaignProgram,
  loadRecentCampaign: loadRecentCampaignProgram,
  listRecentCampaigns: listRecentCampaignsProgram,
  removeRecentCampaign: removeRecentCampaignProgram,
  listCampaigns: listCampaignsProgram,
  verifyCampaign: verifyCampaignProgram,
  replayCampaign: replayCampaignProgram,
  recoverCampaign: recoverCampaignProgram,
  generateBattle: generateBattleProgram,
  resolveBattle: resolveBattleProgram,
  resolveTacticalBattle: resolveTacticalBattleProgram,
  replayBattleBoundary: replayBattleBoundaryProgram,
  seedCampaignBattleDrill: seedCampaignBattleDrillProgram,
};

export function createCampaignCommandDispatcher(
  handlers: Partial<CommandHandlers>,
  getRuntime: () => ManagedRuntime.ManagedRuntime<CommandEnv, never>,
): (command: string, payload: unknown) => Promise<BridgeResult<unknown>> {
  return async (command, payload) => {
    const program = Effect.gen(function* () {
      const parsedCommand = Schema.decodeUnknownResult(CommandNameSchema)(command);
      if (Result.isFailure(parsedCommand)) {
        return yield* new UnknownCommand({ command });
      }
      const name = parsedCommand.success;
      const handler = handlers[name];
      if (handler === undefined) {
        return yield* new NotImplemented({ command: name });
      }
      return yield* runCommandHandler(name, handler, payload);
    });

    const exit = await getRuntime().runPromiseExit(program);
    return projectCommandExit(exit);
  };
}

let commandRuntimeSingleton: ManagedRuntime.ManagedRuntime<CommandEnv, never> | undefined;

export function getDefaultCommandRuntime(): ManagedRuntime.ManagedRuntime<CommandEnv, never> {
  commandRuntimeSingleton ??= ManagedRuntime.make(desktopMainLayer());
  return commandRuntimeSingleton;
}

export const dispatchCampaignCommand = createCampaignCommandDispatcher(
  commandHandlers,
  getDefaultCommandRuntime,
);
