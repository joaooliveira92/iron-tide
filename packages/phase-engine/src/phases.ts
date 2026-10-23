import { aiProcurementPhase } from "./aiProcurement.js";
import { aircraftDevelopmentPhase } from "./aircraft.js";
import { baseLimitsPhase } from "./baseLimits.js";
import { battleGenerationPhase, battleResolutionPhase } from "./battlePhases.js";
import { carrierOperationsPhase } from "./carrier-operations.js";
import { aiPlanningPhase, commandCollectionPhase } from "./commandPhases.js";
import { constructionProcessingPhase } from "./constructionPhase.js";
import { diplomacyPhase } from "./diplomacy.js";
import {
  appropriationPhase,
  maintenancePhase,
  monthlyRevenuePhase,
  obligationPhase,
} from "./economyPhases.js";
import { foreignStationDeploymentPhase } from "./foreignStationDeployment.js";
import { interruptionCheckpoint } from "./interruption.js";
import { MonthPipeline } from "./pipeline.js";
import { presenceMeasurementPhase } from "./presenceMeasurement.js";
import { researchPhase } from "./research.js";
import { sackingPhase } from "./sackingPhase.js";
import { closingValidationPhase, openingValidationPhase } from "./validationPhases.js";
import { weatherGenerationPhase } from "./weatherPhase.js";

export const monthPipeline = MonthPipeline.create(
  [
    openingValidationPhase,
    weatherGenerationPhase,
    monthlyRevenuePhase,
    commandCollectionPhase,
    aiPlanningPhase,
    aiProcurementPhase,
    appropriationPhase,
    maintenancePhase,
    obligationPhase,
    constructionProcessingPhase,
    diplomacyPhase,
    researchPhase,
    aircraftDevelopmentPhase,
    carrierOperationsPhase,
    battleGenerationPhase,
    battleResolutionPhase,
    presenceMeasurementPhase,
    foreignStationDeploymentPhase,
    baseLimitsPhase,
    sackingPhase,
    closingValidationPhase,
  ],
  [interruptionCheckpoint],
);
