import type { LandTargetDamage, MinePressure, SubmarinePool } from "@bluewave/campaign-engine";

import { Accordion } from "../../../components/ui/accordion.js";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card.js";
import { CoastalDefensesSection } from "./CoastalDefensesSection.js";
import { MinePressureSection } from "./MinePressureSection.js";
import { SubmarinePoolsSection } from "./SubmarinePoolsSection.js";

interface StrategicOverviewTabProps {
  readonly submarinePools: readonly SubmarinePool[];
  readonly minePressure: readonly MinePressure[];
  readonly landTargetDamage: readonly LandTargetDamage[];
}

export function StrategicOverviewTab({
  submarinePools,
  minePressure,
  landTargetDamage,
}: StrategicOverviewTabProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Theater Status</CardTitle>
        <CardDescription className="text-[11px]">
          Submarine deployments, mine pressure, and coastal defense integrity across active
          theaters.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion multiple defaultValue={["subs", "mines", "defenses"]}>
          <SubmarinePoolsSection pools={submarinePools} />
          <MinePressureSection pressure={minePressure} />
          <CoastalDefensesSection targets={landTargetDamage} />
        </Accordion>
      </CardContent>
    </Card>
  );
}
