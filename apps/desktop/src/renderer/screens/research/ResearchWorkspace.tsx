import { useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import { CANONICAL_RESEARCH_FIELD_IDS } from "@bluewave/campaign-engine";
import { cn } from "../../lib/utils.js";
import { useScreenHeaderHost } from "../../shell/screen-header.js";
import { usePresentationFormat } from "../../shell/usePresentationFormat.js";
import { EngineeringStatusBar } from "../shipbuilding/components/EngineeringStatusBar.js";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../components/ui/dialog.js";
import { Button } from "../../components/ui/button.js";
import { Archive, BookOpen } from "lucide-react";
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
import { TECH_STATUS } from "./components/tech-status.js";
import type { FieldWeightOption } from "./research-field-priorities.js";
import { researchReadouts } from "./research-readouts.js";
import type { ResearchViewModel } from "./research-view-model.js";

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
  const [briefingOpen, setBriefingOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [techModalOpen, setTechModalOpen] = useState(false);

  const field = vm.fields.find((f) => f.fieldId === selectedFieldId) ?? vm.fields[0]!;
  const selectedTech = selectedTechId === null ? undefined : vm.technologies.get(selectedTechId);
  const highCapReached = vm.highCount >= vm.highCap;
  const readouts = useMemo(() => researchReadouts(vm, format), [vm, format]);

  const selectField = (fieldId: string) => {
    setSelectedFieldId(fieldId);
    setSelectedTechId(null);
  };

  const selectTech = (techId: string) => {
    if (techId === selectedTechId && techModalOpen) {
      setTechModalOpen(false);
    } else {
      setSelectedTechId(techId);
      setTechModalOpen(true);
    }
  };

  const onTechModalChange = (open: boolean) => {
    setTechModalOpen(open);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      if (canSubmit && !busy) onSubmit();
    }
  };

  const hosted = useScreenHeaderHost();

  return (
    <div
      data-testid="research-workspace"
      onKeyDown={onKeyDown}
      className={cn(
        "grid h-[calc(100svh-var(--chrome-top,0px)-var(--chrome-bottom,0px)-2rem)] min-h-[30rem] overflow-hidden rounded-lg border bg-background/95",
        hosted ? "grid-rows-[auto_minmax(0,1fr)_auto]" : "grid-rows-[auto_auto_minmax(0,1fr)_auto]",
      )}
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
        extras={
          <>
            {commandExtras}
            <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
              <DialogTrigger
                render={
                  <Button variant="ghost" size="sm" type="button">
                    <Archive aria-hidden="true" className="size-4" />
                    <span className="hidden sm:inline">Archive</span>
                  </Button>
                }
              />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Archive aria-hidden="true" className="size-5 text-primary" />
                    Technology Archive
                  </DialogTitle>
                  <DialogDescription>
                    Every technology discovered so far, by field.
                  </DialogDescription>
                </DialogHeader>
                <DialogBody>
                  <ArchivePanel fields={vm.fields} />
                </DialogBody>
              </DialogContent>
            </Dialog>
          </>
        }
      />
      {notice !== null ? (
        <div className="border-b px-3 py-2">
          <ResearchNotice submitted={submitted} notice={notice} />
        </div>
      ) : (
        <div />
      )}
      <div className="grid min-h-0 grid-cols-[16rem_minmax(0,1fr)]">
        <nav aria-label="Research fields" className="flex min-h-0 flex-col border-r bg-muted/20">
          <div className="themed-scrollbar min-h-0 flex-1 overflow-y-auto">
            <FieldMap
              fields={vm.fields}
              selectedFieldId={field.fieldId}
              highCapReached={highCapReached}
              highCap={vm.highCap}
              busy={busy}
              onSelect={selectField}
              onSetWeight={onSetFieldWeight}
            />
          </div>

          <div className="border-t px-3 py-2.5 space-y-2">
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="text-muted-foreground">Monthly budget</span>
              <span className="font-medium tabular-nums">{format.count(vm.budget.monthly)}</span>
            </div>
            <div className="relative h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none",
                  vm.budget.lowSpending ? "bg-amber-500" : "bg-primary",
                )}
                style={{ width: `${vm.budget.utilizationPct}%` }}
              />
            </div>
            <div className="flex justify-between text-[0.6875rem] text-muted-foreground tabular-nums">
              <span>0</span>
              <span>Floor {format.count(vm.budget.floor)}</span>
              <span>Cap {format.count(vm.budget.cap)}</span>
            </div>
            <Dialog open={briefingOpen} onOpenChange={setBriefingOpen}>
              <DialogTrigger
                render={
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    className="w-full justify-start gap-1.5 text-xs"
                  >
                    <BookOpen aria-hidden="true" className="size-3.5" />
                    How research works
                  </Button>
                }
              />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <BookOpen aria-hidden="true" className="size-5 text-primary" />
                    Research briefing
                  </DialogTitle>
                  <DialogDescription>
                    The monthly budget, and how research turns it into technologies.
                  </DialogDescription>
                </DialogHeader>
                <DialogBody>
                  <BriefingPanel budget={vm.budget} />
                </DialogBody>
              </DialogContent>
            </Dialog>
          </div>
        </nav>

        <section aria-label="Technology chart" className="flex min-h-0 min-w-0 flex-col">
          <div className="shrink-0 border-b bg-muted/15 px-3 py-1.5">
            <AllocationSpectrum
              fields={vm.fields}
              totals={vm.totals}
              budget={vm.budget.monthly}
              selectedFieldId={field.fieldId}
              onSelect={selectField}
            />
          </div>
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
      </div>

      {selectedTech !== undefined && (
        <Dialog open={techModalOpen} onOpenChange={onTechModalChange}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selectedTech.label}</DialogTitle>
              <DialogDescription>{`${field.label} · ${TECH_STATUS[selectedTech.status].label}`}</DialogDescription>
            </DialogHeader>
            <DialogBody>
              <TechnologyDetail tech={selectedTech} fieldLabel={field.label} showHeading={false} />
            </DialogBody>
          </DialogContent>
        </Dialog>
      )}

      <EngineeringStatusBar readouts={readouts} format={format} />
    </div>
  );
}
