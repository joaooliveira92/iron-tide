import { useMemo } from "react";
import { Activity, RefreshCw } from "lucide-react";

import { PageHeader } from "../../components/shared/PageHeader.js";
import { Badge } from "../../components/ui/badge.js";
import { Button } from "../../components/ui/button.js";
import { Spinner } from "../../components/ui/spinner.js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs.js";
import type { SetPrimaryAction } from "../../shell/primary-action.js";
import { usePrimaryAction } from "../../shell/usePrimaryAction.js";
import { BattleArenaTab } from "./components/BattleArenaTab.js";
import { ErrorAlert } from "./components/ErrorAlert.js";
import { StrategicOverviewTab } from "./components/StrategicOverviewTab.js";
import { TurnReportTab } from "./components/TurnReportTab.js";
import { useSimulationScreen } from "./hooks/useSimulationScreen.js";

export interface SimulationScreenProps {
  readonly sessionId: string;
  readonly onPrimaryActionChange: SetPrimaryAction;
  readonly campaignRevision?: number;
  readonly onMonthCommitted?: () => void;
}

export function SimulationScreen({
  sessionId,
  onPrimaryActionChange,
  campaignRevision,
  onMonthCommitted,
}: SimulationScreenProps) {
  const {
    loading,
    error,
    activeTab,
    playerNationId,
    submarinePools,
    minePressure,
    landTargetDamage,
    commitResult,
    battleManifest,
    autoResolution,
    tacticalOutcome,
    battleLoading,
    battleError,
    setActiveTab,
    loadSnapshotData,
    handleAdvanceTurn,
    handleGenerateBattle,
    handleAutoResolve,
    handleTacticalResolve,
  } = useSimulationScreen(sessionId, { campaignRevision, onMonthCommitted });

  const primaryAction = useMemo(
    () => ({
      label: loading ? "Processing turn…" : "Advance Turn (1 Month)",
      disabled: loading,
      onTrigger: handleAdvanceTurn,
    }),
    [loading, handleAdvanceTurn],
  );
  usePrimaryAction(primaryAction, onPrimaryActionChange);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Activity}
        title="Strategic Turn & Simulation Desk"
        description="Advance campaign months, inspect turn events, balance ledgers, and resolve battles."
        actions={
          <Button variant="outline" size="sm" onClick={loadSnapshotData} disabled={loading}>
            {loading ? <Spinner className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh View
          </Button>
        }
      />

      {error !== null && <ErrorAlert message={error} />}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Strategic Overview</TabsTrigger>
          <TabsTrigger value="report">
            Turn Report
            {commitResult !== null && (
              <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-[11px]">
                new
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="battle">Battle Arena</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <StrategicOverviewTab
            submarinePools={submarinePools}
            minePressure={minePressure}
            landTargetDamage={landTargetDamage}
          />
        </TabsContent>

        <TabsContent value="report">
          <TurnReportTab commitResult={commitResult} />
        </TabsContent>

        <TabsContent value="battle">
          <BattleArenaTab
            battleManifest={battleManifest}
            battleLoading={battleLoading}
            battleError={battleError}
            autoResolution={autoResolution}
            tacticalOutcome={tacticalOutcome}
            playerNationId={playerNationId}
            onGenerateBattle={handleGenerateBattle}
            onAutoResolve={handleAutoResolve}
            onTacticalResolve={handleTacticalResolve}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
