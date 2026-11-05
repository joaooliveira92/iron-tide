import { treasuryCostUnits } from "./cost.js";
import { studyTerms, type StudyBalance, type StudyTerms } from "./study.js";

export interface DesignPriceInput {
  readonly costMicro: number;
  readonly monthlyMaintenanceMicro: number;
  readonly treasuryUnitMicro: number;
  readonly study?: { readonly balance: StudyBalance; readonly derived: boolean } | null;
  readonly freeTreasuryUnits?: number | null;
}

export interface DesignTreasuryFit {
  readonly freeUnits: number;
  readonly remainingUnits: number;
  readonly shortfallUnits: number;
  readonly overBudget: boolean;
}

export interface DesignPrice {
  readonly costMicro: number;
  readonly treasuryUnits: number;
  readonly monthlyUpkeepMicro: number;
  readonly studyMonths: number | null;
  readonly studyCost: number | null;
  readonly study: StudyTerms | null;
  readonly treasury: DesignTreasuryFit | null;
}

export function designPrice(input: DesignPriceInput): DesignPrice {
  const treasuryUnits = treasuryCostUnits(input.costMicro, input.treasuryUnitMicro);
  const study =
    input.study === undefined || input.study === null
      ? null
      : studyTerms(treasuryUnits, input.study.derived, input.study.balance);
  const free = input.freeTreasuryUnits;
  const treasury: DesignTreasuryFit | null =
    free === undefined || free === null
      ? null
      : {
          freeUnits: free,
          remainingUnits: free - treasuryUnits,
          shortfallUnits: Math.max(0, treasuryUnits - free),
          overBudget: treasuryUnits > free,
        };
  return {
    costMicro: input.costMicro,
    treasuryUnits,
    monthlyUpkeepMicro: input.monthlyMaintenanceMicro,
    studyMonths: study === null ? null : study.finalStudyWork,
    studyCost: study === null ? null : study.finalStudyCost,
    study,
    treasury,
  };
}
