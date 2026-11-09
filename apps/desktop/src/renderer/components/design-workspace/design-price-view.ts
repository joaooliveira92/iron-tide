import { useMemo } from "react";
import { designPrice, type DesignPrice, type WorkshopView } from "@bluewave/ship-design";
import { useCampaignReads } from "../../shell/CampaignShellContext.js";
import { usePresentationFormat } from "../../shell/usePresentationFormat.js";
import type { PresentationFormat } from "../../lib/presentation-format/index.js";
import { useDesignState } from "./DesignWorkspaceContext.js";

export interface DesignPriceView {
  readonly price: DesignPrice;
  readonly unitsText: string;
  readonly unitSizeText: string;
  readonly upkeepText: string;
  readonly treasuryText: string | null;
  readonly overBudgetText: string | null;
}

export type DesignPriceSource = Pick<
  WorkshopView["forecast"],
  "costMicro" | "monthlyMaintenanceMicro"
>;

export function designPriceView(
  forecast: DesignPriceSource,
  treasuryUnitMicro: number,
  treasuryUnits: number | null,
  format: PresentationFormat,
): DesignPriceView {
  const price = designPrice({
    costMicro: forecast.costMicro,
    monthlyMaintenanceMicro: forecast.monthlyMaintenanceMicro,
    treasuryUnitMicro,
    freeTreasuryUnits: treasuryUnits,
  });
  const unitsText = `${format.count(price.treasuryUnits)} ${price.treasuryUnits === 1 ? "unit" : "units"}`;
  const fit = price.treasury;
  return {
    price,
    unitsText,
    unitSizeText: `${format.moneyFromMicro(treasuryUnitMicro)} each`,
    upkeepText: format.moneyFromMicro(price.monthlyUpkeepMicro),
    treasuryText:
      fit === null ? null : `${unitsText} of ${format.count(fit.freeUnits)} in the treasury`,
    overBudgetText:
      fit !== null && fit.overBudget
        ? `Over budget: ${format.count(fit.shortfallUnits)} ${fit.shortfallUnits === 1 ? "unit" : "units"} more than the treasury holds`
        : null,
  };
}

export function useTreasuryUnits(): number | null {
  const reads = useCampaignReads();
  const projection = reads?.projection;
  return projection?.status === "ready" ? projection.value.economy.treasury : null;
}

export function useDesignPriceView(): DesignPriceView {
  const {
    view,
    content: { treasuryUnitMicro },
  } = useDesignState();
  const format = usePresentationFormat();
  const treasury = useTreasuryUnits();
  return useMemo(
    () => designPriceView(view.forecast, treasuryUnitMicro, treasury, format),
    [view.forecast, treasuryUnitMicro, treasury, format],
  );
}
