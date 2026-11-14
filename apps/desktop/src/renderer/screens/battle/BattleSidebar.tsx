import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs.js";
import { translate } from "../../lib/strings.js";
import {
  useBattleActions,
  useBattleMeta,
  useBattleState,
} from "./session/battle-session-contexts.js";
import { CombatLogPanel } from "./tactical/CombatLogPanel.js";
import { OrderOfBattle } from "./tactical/OrderOfBattle.js";
import { UnitCommandPanel } from "./tactical/UnitCommandPanel.js";

export function BattleSidebar() {
  const state = useBattleState();
  const actions = useBattleActions();
  const meta = useBattleMeta();
  const { view } = state;
  if (view === null) return null;
  return (
    <aside className="flex min-h-0 flex-col gap-2 overflow-y-auto">
      <div className="min-h-[14rem] flex-1 overflow-auto rounded border border-border p-2">
        <Tabs defaultValue="oob">
          <TabsList variant="line" aria-label={translate("tactical.tabs.label")}>
            <TabsTrigger value="oob">{translate("tactical.tabs.oob")}</TabsTrigger>
            <TabsTrigger value="log">{translate("tactical.tabs.log")}</TabsTrigger>
            {view.objectives.length > 0 && (
              <TabsTrigger value="objectives">{translate("tactical.tabs.objectives")}</TabsTrigger>
            )}
          </TabsList>
          <TabsContent value="oob">
            <OrderOfBattle
              view={view}
              locale={meta.locale}
              orderFor={state.orderFor}
              setOrder={actions.setOrder}
              selectedShipId={state.selectedShipId}
              selectedDivisionId={state.selectedDivisionId}
              onSelectShip={actions.selectShip}
              onSelectDivision={actions.selectDivision}
            />
          </TabsContent>
          <TabsContent value="log">
            <CombatLogPanel entries={state.entries} onSelectShip={actions.selectShip} />
          </TabsContent>
          {view.objectives.length > 0 && (
            <TabsContent value="objectives">
              <ul data-testid="battle-objectives" className="list-disc space-y-1 pl-4 text-xs">
                {view.objectives.map((objective) => (
                  <li key={objective}>{objective}</li>
                ))}
              </ul>
            </TabsContent>
          )}
        </Tabs>
      </div>
      <div className="shrink-0">
        <UnitCommandPanel
          view={view}
          locale={meta.locale}
          selectedShipId={state.selectedShipId}
          orderFor={state.orderFor}
          acceptedOrders={state.acceptedOrders}
          setOrder={actions.setOrder}
          releaseCourse={actions.releaseCourse}
          onPreviewCourse={actions.previewCourse}
        />
      </div>
    </aside>
  );
}
