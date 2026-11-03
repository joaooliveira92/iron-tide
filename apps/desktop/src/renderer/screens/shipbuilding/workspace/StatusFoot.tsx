import { DesignStatusChip } from "../components/DesignStatusChip.js";
import { EngineeringStatusBar } from "../components/EngineeringStatusBar.js";
import { FlawSlip } from "../components/FlawSlip.js";
import { useShipbuildingActions, useShipbuildingState } from "./WorkspaceContext.js";

export function StatusFoot() {
  const { flaws, readouts, format, status, needsName, view } = useShipbuildingState();
  const { showOnShip, openSection, focusClassName } = useShipbuildingActions();
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
