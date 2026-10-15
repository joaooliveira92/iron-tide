import { useState } from "react";
import { Terminal } from "lucide-react";
import { PageHeader } from "../../components/shared/PageHeader.js";
import { Badge } from "../../components/ui/badge.js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs.js";
import { AstInspector } from "./components/AstInspector.js";
import { EngineAuditInspector } from "./components/EngineAuditInspector.js";
import { TelemetryInspector } from "./components/TelemetryInspector.js";
import { useAstInspector } from "./hooks/useAstInspector.js";
import { useEngineAuditInspector } from "./hooks/useEngineAuditInspector.js";
import { useTelemetryInspector } from "./hooks/useTelemetryInspector.js";

export interface DebuggingScreenProps {
  readonly sessionId: string;
}

export function DebuggingScreen({ sessionId }: DebuggingScreenProps) {
  const [activeTab, setActiveTab] = useState("ast");
  const ast = useAstInspector(sessionId);
  const telemetry = useTelemetryInspector();
  const engineAudit = useEngineAuditInspector();

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Terminal}
        title="Debugging, AST & Wide Event Telemetry"
        description="Audit the campaign compiler records, inspect deterministic RNG decisions, and trace user action Wide Events."
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="ast">AST Inspector</TabsTrigger>
          <TabsTrigger value="audit">Engine Audit</TabsTrigger>
          <TabsTrigger value="telemetry">
            Wide Event Telemetry
            {telemetry.events.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-[11px]">
                {telemetry.events.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ast">
          <AstInspector
            records={ast.filteredRecords}
            searchTerm={ast.searchTerm}
            selectedRecord={ast.selectedRecord}
            copied={ast.copied}
            searchRef={ast.searchRef}
            onSearchChange={ast.setSearchTerm}
            onSelectRecord={ast.setSelectedRecord}
            onCopy={ast.copyRecord}
          />
        </TabsContent>

        <TabsContent value="audit">
          <EngineAuditInspector
            audits={engineAudit.audits}
            selectedAudit={engineAudit.selectedAudit}
            onSelectAudit={engineAudit.setSelectedAudit}
            onCloseAudit={() => engineAudit.setSelectedAudit(null)}
            onClearAudits={engineAudit.clearAudits}
          />
        </TabsContent>

        <TabsContent value="telemetry">
          <TelemetryInspector
            events={telemetry.events}
            filteredEvents={telemetry.filteredEvents}
            eventSearchTerm={telemetry.eventSearchTerm}
            outcomeFilter={telemetry.outcomeFilter}
            selectedEvent={telemetry.selectedEvent}
            onEventSearchChange={telemetry.setEventSearchTerm}
            onOutcomeFilterChange={telemetry.setOutcomeFilter}
            onSelectEvent={telemetry.setSelectedEvent}
            onCloseEvent={() => telemetry.setSelectedEvent(null)}
            onClearEvents={telemetry.clearEvents}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
