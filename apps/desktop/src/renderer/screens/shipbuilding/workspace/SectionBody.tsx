import type { ReactNode } from "react";
import { useDesignState } from "../../../components/design-workspace/DesignWorkspaceContext.js";
import { mountNameMap } from "../../../components/design-workspace/batteryView.js";
import { technologyMonths } from "../../../components/design-workspace/useDesignSession.js";
import { BriefPanel } from "../../../components/design-workspace/panels/BriefPanel.js";
import { FindingsPanel } from "../../../components/design-workspace/panels/FindingsPanel.js";
import { ForecastPanel } from "../../../components/design-workspace/panels/ForecastPanel.js";
import { HullPanel } from "../../../components/design-workspace/panels/HullPanel.js";
import { LedgerPanel } from "../../../components/design-workspace/panels/LedgerPanel.js";
import { MetricsPanel } from "../../../components/design-workspace/panels/MetricsPanel.js";
import { PlacementsPanel } from "../../../components/design-workspace/panels/PlacementsPanel.js";
import { RebuildPanel } from "../../../components/design-workspace/panels/RebuildPanel.js";
import { RevisionPanel } from "../../../components/design-workspace/panels/RevisionPanel.js";
import { SubmitPanel } from "../../../components/design-workspace/panels/SubmitPanel.js";
import { TopsidePanel } from "../../../components/design-workspace/panels/TopsidePanel.js";
import { AluminiumSuperstructurePanel } from "../components/AluminiumSuperstructurePanel.js";
import { AntiAircraftPanel } from "../components/AntiAircraftPanel.js";
import { ArmamentEditor } from "../components/ArmamentEditor.js";
import { ColonialServicePanel } from "../components/ColonialServicePanel.js";
import { DesignIdentity } from "../components/DesignIdentity.js";
import { MachineryEditor } from "../components/MachineryEditor.js";
import { NotAvailable } from "../components/NotAvailable.js";
import { OverviewPanel } from "../components/OverviewPanel.js";
import { ProtectionEditor } from "../components/ProtectionEditor.js";
import { SystemsPanel } from "../components/SystemsPanel.js";
import { formatExplanation } from "../../../../shared/explanation-text.js";
import { armamentEntries } from "../armament.js";
import { categoriesOf, type InspectorPlace } from "../design-sections.js";
import { addSystemEdit } from "../systems-view.js";
import { TAB_BATTERY, tabLabel } from "./inspector-place.js";
import {
  useShipbuildingActions,
  useShipbuildingMeta,
  useShipbuildingState,
} from "./WorkspaceContext.js";

export function SectionBody({ at }: { readonly at: InspectorPlace }) {
  const state = useShipbuildingState();
  const meta = useShipbuildingMeta();
  const actions = useShipbuildingActions();
  const { unlockedTechs } = useDesignState().ctx;
  const {
    draft,
    view,
    content,
    findings,
    flaws,
    batteries,
    month,
    format,
    campaignMonth,
    namePool,
    shipClassName,
    fittings,
    sessionId,
    projects,
    history,
    editCount,
    preset,
    selection,
  } = state;
  const {
    overview,
    machinery,
    protection,
    armament,
    aluminium,
    antiAircraft,
    systems,
    colonial,
    machineryDeltas,
    armourHighlight,
    showSystemsUnavailable,
    selectedInstanceId,
  } = meta;

  function fittingsPanel(place: InspectorPlace): ReactNode {
    const categories = categoriesOf(place);
    const hasFittings =
      [...fittings.values()].some((category) => categories.has(category)) ||
      content.catalogue.some((entry) => categories.has(entry.category));
    if (!hasFittings) return null;
    return (
      <PlacementsPanel
        title={`${tabLabel(place)} fittings`}
        categories={categories}
        names={mountNameMap(batteries)}
        onSelect={(instanceId) => selection.select({ kind: "fitting", instanceId })}
        selectedInstanceId={selectedInstanceId}
      />
    );
  }

  function fittingsOnly(place: InspectorPlace): ReactNode {
    return (
      fittingsPanel(place) ?? (
        <NotAvailable title={`${tabLabel(place)}: not available`}>
          Nothing of this kind can be fitted to this design yet.
        </NotAvailable>
      )
    );
  }

  switch (at.section) {
    case "overview":
      return at.tab === "brief" ? (
        <>
          <DesignIdentity
            month={month}
            months={campaignMonth !== null ? null : technologyMonths(month)}
            onMonth={actions.setMonth}
            names={{
              canSuggest: namePool.length > 0,
              onBrowse: () => actions.setDialog("names"),
              onSuggest: actions.suggestName,
            }}
          />
          <BriefPanel />
        </>
      ) : (
        <>
          {overview !== null && <OverviewPanel model={overview} />}
          <MetricsPanel />
          <LedgerPanel />
          <ForecastPanel />
        </>
      );
    case "hull":
      return at.tab === "stability" ? (
        <TopsidePanel />
      ) : (
        <>
          <HullPanel />
          {aluminium.offered && (
            <AluminiumSuperstructurePanel model={aluminium} edit={actions.edit} />
          )}
          {fittingsPanel(at)}
        </>
      );
    case "machinery":
      return at.tab === "performance" ? (
        <MetricsPanel />
      ) : (
        <>
          {machinery !== null && (
            <MachineryEditor
              errorFor={state.choiceCheck.errorFor}
              model={machinery}
              edit={actions.edit}
              previewDeltas={machineryDeltas ?? undefined}
              recommended={{
                targetSpeedMilliKnots: preset.draft.requirement.requiredSpeedMilliKnots,
                cruiseSpeedMilliKnots: preset.draft.requirement.cruiseSpeedMilliKnots,
                rangeNm: preset.draft.requirement.requiredRangeNm,
              }}
            />
          )}
          {fittingsPanel(at)}
        </>
      );
    case "protection":
      return at.tab === "armour" ? (
        <>
          {protection !== null && (
            <ProtectionEditor
              errorFor={state.choiceCheck.errorFor}
              model={protection}
              edit={actions.edit}
              onSelectRegion={actions.selectArmourRegion}
              selectedRegion={armourHighlight}
            >
              <ProtectionEditor.Coverage />
              <ProtectionEditor.Scheme />
              <ProtectionEditor.Regions />
              <ProtectionEditor.AddRegion />
              <ProtectionEditor.Notes />
            </ProtectionEditor>
          )}
          {fittingsPanel(at)}
        </>
      ) : (
        fittingsOnly(at)
      );
    case "armament": {
      const role = TAB_BATTERY[at.tab];
      if (role === undefined)
        return antiAircraft.offered && at.tab === "other" ? (
          <>
            <AntiAircraftPanel model={antiAircraft} edit={actions.edit} />
            {fittingsPanel(at)}
          </>
        ) : (
          fittingsOnly(at)
        );
      const entries = armament ?? armamentEntries(role, batteries, draft, view, content, format);
      return (
        <>
          <ArmamentEditor
            entries={entries}
            draft={draft}
            content={content}
            findings={findings}
            month={month}
            unlockedTechs={unlockedTechs}
            edit={actions.edit}
            onSelect={selection.select}
            selectedInstanceId={selectedInstanceId}
          >
            <ArmamentEditor.Mounts />
            <ArmamentEditor.Detail />
          </ArmamentEditor>
          {fittingsPanel(at)}
        </>
      );
    }
    case "systems":
      return (
        <>
          {colonial !== null && <ColonialServicePanel model={colonial} edit={actions.edit} />}
          {systems !== null && (
            <SystemsPanel
              groups={systems}
              showUnavailable={showSystemsUnavailable}
              onShowUnavailable={actions.setShowSystemsUnavailable}
              onAdd={(id) => {
                const e = addSystemEdit(id, draft, content);
                if (e) actions.edit(e);
              }}
            />
          )}
          {fittingsPanel(at)}
        </>
      );
    case "review":
      return at.tab === "findings" ? (
        <FindingsPanel
          findings={findings}
          suggest={actions.suggest}
          onShowOnShip={actions.showOnShip}
        />
      ) : at.tab === "rebuild" ? (
        <RebuildPanel sessionId={sessionId} onLoad={actions.loadDraft} dirty={editCount > 0} />
      ) : (
        <>
          {projects.length > 0 && (
            <RevisionPanel
              sessionId={sessionId}
              projects={projects}
              history={history.slice(0, editCount)}
              startDraft={preset.draft}
              onLoad={actions.loadDraft}
              dirty={editCount > 0}
            />
          )}
          {sessionId !== undefined ? (
            <SubmitPanel
              sessionId={sessionId}
              name={shipClassName}
              onNameChange={actions.setShipClassName}
              onRequestName={actions.focusClassName}
              blockers={flaws
                .filter((flaw) => flaw.tier === "blocking")
                .map((flaw) => ({
                  id: flaw.finding.key,
                  text: formatExplanation(flaw.finding.finding.what),
                  actionLabel:
                    flaw.fix !== null
                      ? flaw.fix.label
                      : flaw.showOn !== null
                        ? "Show on ship"
                        : "Open in Findings",
                  onSelect: () => {
                    if (flaw.fix !== null)
                      actions.openSection(flaw.fix.place.section, flaw.fix.place.tab);
                    else if (flaw.showOn !== null) actions.showOnShip(flaw.finding);
                    else actions.openSection("review", "findings");
                  },
                }))}
            />
          ) : (
            <NotAvailable title="Finishing: not available">
              A design is finished into a campaign; open Ship design from a campaign to submit it.
            </NotAvailable>
          )}
        </>
      );
  }
}
