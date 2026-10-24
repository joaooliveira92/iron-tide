import { useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import { CANONICAL_RESEARCH_FIELD_IDS } from "@bluewave/campaign-engine";
import { usePresentationFormat } from "../../shell/usePresentationFormat.js";
import { EngineeringStatusBar } from "../shipbuilding/components/EngineeringStatusBar.js";
import { Inspector } from "../shipbuilding/components/Inspector.js";
import {
  AllocationSpectrum,
  ArchivePanel,
  BriefingPanel,
  FieldHeader,
  FieldMap,
  ResearchCommandBar,
  ResearchNotice,
  TechnologyChart,
  TechnologyDetail,
} from "./components/index.js";
import type { FieldWeightOption } from "./research-field-priorities.js";
import { researchReadouts } from "./research-readouts.js";
import type { ResearchViewModel } from "./research-view-model.js";

const TABS = [
  { id: "briefing", label: "Briefing" },
  { id: "technology", label: "Technology" },
  { id: "archive", label: "Archive" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export interface ResearchWorkspaceProps {
  readonly vm: ResearchViewModel;
  readonly busy: boolean;
  readonly canSubmit: boolean;
  readonly submitted: boolean;
  readonly notice: string | null;
  readonly commandExtras?: ReactNode;
  readonly onSetFieldWeight: (fieldId: string, weight: FieldWeightOption) => void;
  readonly onRevert: () => void;
  readonly onSubmit: () => void;
}

function initialField(vm: ResearchViewModel): string {
  const busiest = vm.fields.reduce((best, f) =>
    f.projectedPoints > best.projectedPoints ? f : best,
  );
  return busiest.projectedPoints > 0 ? busiest.fieldId : (CANONICAL_RESEARCH_FIELD_IDS[0] ?? "");
}

export function ResearchWorkspace({
  vm,
  busy,
  canSubmit,
  submitted,
  notice,
  commandExtras,
  onSetFieldWeight,
  onRevert,
  onSubmit,
}: ResearchWorkspaceProps) {
  const format = usePresentationFormat();
  const [selectedFieldId, setSelectedFieldId] = useState(() => initialField(vm));
  const [selectedTechId, setSelectedTechId] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("briefing");

  const field = vm.fields.find((f) => f.fieldId === selectedFieldId) ?? vm.fields[0]!;
  const selectedTech = selectedTechId === null ? undefined : vm.technologies.get(selectedTechId);
  const highCapReached = vm.highCount >= vm.highCap;
  const readouts = useMemo(() => researchReadouts(vm, format), [vm, format]);

  const selectField = (fieldId: string) => {
    setSelectedFieldId(fieldId);
    setSelectedTechId(null);
  };

  const selectTech = (techId: string) => {
    setSelectedTechId(techId);
    setTab("technology");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      if (canSubmit && !busy) onSubmit();
    }
  };

  const breadcrumb =
    tab === "technology" && selectedTech !== undefined
      ? ["Research", field.label, selectedTech.label]
      : ["Research", TABS.find((t) => t.id === tab)?.label ?? ""];

  return (
    <div
      data-testid="research-workspace"
      onKeyDown={onKeyDown}
      className="grid h-[calc(100svh-var(--chrome-top,0px)-var(--chrome-bottom,0px)-4rem)] min-h-[30rem] grid-rows-[auto_auto_minmax(0,1fr)_auto] overflow-hidden rounded-lg border bg-background/95"
    >
      <ResearchCommandBar
        highCount={vm.highCount}
        highCap={vm.highCap}
        highCountValid={vm.highCountValid}
        dirty={vm.dirty}
        busy={busy}
        canSubmit={canSubmit}
        onRevert={onRevert}
        onSubmit={onSubmit}
        extras={commandExtras}
      />
      {notice !== null ? (
        <div className="border-b px-3 py-2">
          <ResearchNotice submitted={submitted} notice={notice} />
        </div>
      ) : (
        <div />
      )}
      <div className="grid min-h-0 grid-cols-[3.5rem_minmax(0,1fr)_20rem] xl:grid-cols-[15rem_minmax(0,1fr)_22rem]">
        <FieldMap
          fields={vm.fields}
          selectedFieldId={field.fieldId}
          highCapReached={highCapReached}
          highCap={vm.highCap}
          busy={busy}
          onSelect={selectField}
          onSetWeight={onSetFieldWeight}
        />
        <section aria-label="Technology chart" className="flex min-h-0 min-w-0 flex-col">
          <AllocationSpectrum
            fields={vm.fields}
            totals={vm.totals}
            budget={vm.budget.monthly}
            selectedFieldId={field.fieldId}
            onSelect={selectField}
          />
          <FieldHeader
            field={field}
            highCapReached={highCapReached}
            highCap={vm.highCap}
            busy={busy}
            onSetWeight={(weight) => onSetFieldWeight(field.fieldId, weight)}
          />
          <div className="min-h-0 flex-1">
            <TechnologyChart
              key={field.fieldId}
              field={field}
              selectedTechId={selectedTechId}
              onSelectTech={selectTech}
            />
          </div>
        </section>
        <Inspector
          title="Research"
          breadcrumb={breadcrumb}
          tabs={TABS}
          tab={tab}
          onTab={(next) => setTab(next as TabId)}
        >
          {tab === "briefing" && <BriefingPanel budget={vm.budget} />}
          {tab === "technology" &&
            (selectedTech === undefined ? (
              <p className="text-sm text-muted-foreground">
                Choose a technology on the chart to see its cost, prerequisites, and odds of being
                drawn.
              </p>
            ) : (
              <TechnologyDetail tech={selectedTech} fieldLabel={field.label} />
            ))}
          {tab === "archive" && <ArchivePanel fields={vm.fields} />}
        </Inspector>
      </div>
      <EngineeringStatusBar readouts={readouts} />
    </div>
  );
}
