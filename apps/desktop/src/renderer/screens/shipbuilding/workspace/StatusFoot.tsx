import { BudgetContextChips } from "../../../shell/BudgetContextChips.js";
import { useCampaignReads } from "../../../shell/CampaignShellContext.js";
import { DesignStatusChip } from "../components/DesignStatusChip.js";
import { EngineeringStatusBar } from "../components/EngineeringStatusBar.js";
import { FlawSlip } from "../components/FlawSlip.js";
import { useShipbuildingActions, useShipbuildingState } from "./WorkspaceContext.js";

export function StatusFoot() {
  const { flaws, readouts, format, status, needsName, view } = useShipbuildingState();
  const { showOnShip, openSection, focusClassName } = useShipbuildingActions();
  const reads = useCampaignReads();
  return (
    <>
      <FlawSlip
        flaws={flaws}
        onShow={(flaw) => showOnShip(flaw.finding)}
        onFix={(flaw) => {
          if (flaw.fix !== null) openSection(flaw.fix.place.section, flaw.fix.place.tab);
        }}
        onReview={() => openSection("review", "findings")}
      />
      <EngineeringStatusBar
        readouts={readouts}
        format={format}
        {...(reads !== null ? { trail: <BudgetContextChips reads={reads} /> } : {})}
        lead={
          <DesignStatusChip
            status={status}
            {...(needsName && view.valid ? { onAction: focusClassName } : {})}
          />
        }
      />
    </>
  );
}
