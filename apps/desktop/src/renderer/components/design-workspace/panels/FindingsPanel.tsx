import { useState } from "react";
import type {
  DraftEdit,
  Finding,
  Severity,
  SuggestedFix,
  WorkshopView,
} from "@bluewave/ship-design";
import { CircleCheck, Crosshair, Lightbulb, OctagonX, TriangleAlert } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../../ui/accordion.js";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "../../ui/alert.js";
import { Badge } from "../../ui/badge.js";
import { Button } from "../../ui/button.js";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../../ui/hover-card.js";
import { SlateBody, SlateFacts, SlateHeader } from "../../ui/slate.js";
import { cn } from "../../../lib/utils.js";
import { formatExplanation } from "../../../lib/presentation-format/index.js";
import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";
import { Panel } from "./Panel.js";
import { findingAttrs } from "../selection/navigation.js";
import type { BoardFinding } from "../validation/boardFindings.js";
import {
  CLASS_LABEL,
  CLASS_OF,
  FINDING_CLASSES,
  SEVERITY_ORDER,
  SEVERITY_STYLE,
  type FindingClass,
} from "../validation/severity.js";
import { plural } from "../plural.js";

function RuleEvidence({ f }: { readonly f: Finding }) {
  const format = usePresentationFormat();
  const inputs = Object.entries(f.evidence.inputs);
  return (
    <HoverCard>
      <HoverCardTrigger
        delay={100}
        closeDelay={100}
        render={<button type="button" />}
        className="cursor-help text-xs text-muted-foreground underline decoration-dotted underline-offset-2"
      >
        Rule {f.id}
      </HoverCardTrigger>
      <HoverCardContent side="top" className="w-72">
        <SlateHeader title="Evidence" />
        <SlateBody>
          <SlateFacts
            rows={[
              { label: "Formula", value: f.evidence.formulaId },
              { label: "Computed value", value: format.count(f.evidence.value) },
              { label: "Limit", value: format.count(f.evidence.threshold) },
            ]}
          />
          {inputs.length > 0 && (
            <SlateFacts
              className="border-t border-border/60 pt-2"
              rows={inputs.map(([k, v]) => ({ label: k, value: format.count(v) }))}
            />
          )}
        </SlateBody>
      </HoverCardContent>
    </HoverCard>
  );
}

function FindingItem({
  bf,
  onShowOnShip,
}: {
  readonly bf: BoardFinding;
  readonly onShowOnShip: (f: BoardFinding) => void;
}) {
  const f = bf.finding;
  const { Icon, tone, badge } = SEVERITY_STYLE[f.severity];
  return (
    <AccordionItem
      value={bf.key}
      className="rounded-lg border px-3 not-last:border-b"
      {...findingAttrs(bf)}
    >
      <AccordionTrigger className="gap-2 py-2.5 text-left font-normal hover:no-underline">
        <Icon aria-hidden="true" className={cn("size-4 shrink-0", tone)} />
        <span className="flex flex-1 items-start gap-2">
          <Badge variant={badge} className="shrink-0">
            {f.severity}
          </Badge>
          <span>{formatExplanation(f.what)}</span>
        </span>
      </AccordionTrigger>
      <AccordionContent className="pt-0 pb-3 pl-6">
        <div className="space-y-1.5 text-sm">
          <p>
            <strong>Why:</strong>{" "}
            <span className="text-muted-foreground">{formatExplanation(f.why)}</span>
          </p>
          <p>
            <strong>Consequence:</strong>{" "}
            <span className="text-muted-foreground">{formatExplanation(f.consequence)}</span>
          </p>
          {f.remedies.length > 0 && (
            <div>
              <strong>Ways to fix it:</strong>
              <ul className="ml-5 list-disc text-muted-foreground">
                {f.remedies.map((r) => (
                  <li key={r.id}>{formatExplanation(r.description)}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <RuleEvidence f={f} />
            {bf.entities.length > 0 && (
              <Button size="sm" variant="outline" onClick={() => onShowOnShip(bf)}>
                <Crosshair aria-hidden="true" className="mr-1 size-3.5" />
                Show on ship
              </Button>
            )}
            {bf.association === "inferred" && (
              <span className="text-xs text-muted-foreground italic">
                Ship link inferred from wording
              </span>
            )}
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

function FindingGroup({
  klass,
  items,
  onShowOnShip,
}: {
  readonly klass: FindingClass;
  readonly items: readonly BoardFinding[];
  readonly onShowOnShip: (f: BoardFinding) => void;
}) {
  if (items.length === 0) return null;
  return (
    <section aria-label={CLASS_LABEL[klass]} className="space-y-2">
      <h3 className="text-sm font-medium">
        {CLASS_LABEL[klass]} ({items.length})
      </h3>
      <Accordion multiple className="space-y-2" aria-label={`${CLASS_LABEL[klass]} findings`}>
        {items.map((bf) => (
          <FindingItem key={bf.key} bf={bf} onShowOnShip={onShowOnShip} />
        ))}
      </Accordion>
    </section>
  );
}

function Verdict({
  view,
  order,
}: {
  readonly view: WorkshopView;
  readonly order: readonly Severity[];
}) {
  const format = usePresentationFormat();
  const flagged = view.counts.CRITICAL + view.counts.WARNING > 0;
  const variant = !view.valid ? "destructive" : flagged ? "warning" : "success";
  const Icon = !view.valid ? OctagonX : flagged ? TriangleAlert : CircleCheck;
  return (
    <Alert role="status" variant={variant}>
      <Icon aria-hidden="true" />
      <AlertTitle>
        {view.valid
          ? "Design can be submitted."
          : "Design cannot be built: resolve the blocking findings."}
      </AlertTitle>
      <AlertDescription>
        {order
          .map((s) =>
            s === "WARNING" || s === "ADVISORY"
              ? plural(view.counts[s], s.toLowerCase(), undefined, undefined, format)
              : `${view.counts[s]} ${s.toLowerCase()}`,
          )
          .join(", ")}
      </AlertDescription>
    </Alert>
  );
}

function FixSummary({ f }: { readonly f: SuggestedFix }) {
  const format = usePresentationFormat();
  return (
    <>
      Resolves{" "}
      {f.resolved.length === 0
        ? "nothing outright"
        : f.resolved.map((r) => r.split(":")[1]).join(", ")}{" "}
      · blocking {f.countsBefore.BLOCKING} → {f.countsAfter.BLOCKING}, critical{" "}
      {f.countsBefore.CRITICAL} → {f.countsAfter.CRITICAL}, warnings {f.countsBefore.WARNING} →{" "}
      {f.countsAfter.WARNING} · weight {f.totalKgDelta >= 0 ? "+" : ""}
      {format.measurement(f.totalKgDelta, "mass", { maximumFractionDigits: 0 })}
    </>
  );
}

export function FindingsPanel({
  view,
  findings,
  suggest,
  onApply,
  onShowOnShip,
}: {
  readonly view: WorkshopView;
  readonly findings: readonly BoardFinding[];
  readonly onShowOnShip: (f: BoardFinding) => void;
  readonly suggest: () => SuggestedFix[];
  readonly onApply: (e: DraftEdit) => void;
}) {
  const order: readonly Severity[] = SEVERITY_ORDER;
  const total = order.reduce((a, s) => a + view.counts[s], 0);
  const serious = view.counts.BLOCKING + view.counts.CRITICAL + view.counts.WARNING > 0;
  const [fixes, setFixes] = useState<{
    readonly forHash: string;
    readonly list: SuggestedFix[];
  } | null>(null);
  const current = fixes !== null && fixes.forHash === view.compiled.hash ? fixes.list : null;
  return (
    <Panel title="Validation">
      <Verdict view={view} order={order} />
      {total === 0 ? (
        <p className="text-sm text-muted-foreground">No findings.</p>
      ) : (
        <div className="space-y-4">
          {FINDING_CLASSES.map((klass) => (
            <FindingGroup
              key={klass}
              klass={klass}
              items={findings.filter((bf) => CLASS_OF[bf.severity] === klass)}
              onShowOnShip={onShowOnShip}
            />
          ))}
        </div>
      )}
      {serious && (
        <div className="space-y-2 border-t pt-3">
          <Button
            variant="outline"
            onClick={() => setFixes({ forHash: view.compiled.hash, list: suggest() })}
          >
            Suggest fixes
          </Button>
          {current !== null &&
            (current.length === 0 ? (
              <Alert role="status" variant="info">
                <Lightbulb aria-hidden="true" />
                <AlertDescription>
                  No single change improves this design; try changing more than one thing.
                </AlertDescription>
              </Alert>
            ) : (
              <ul className="space-y-2" aria-label="Suggested fixes">
                {current.map((f) => (
                  <li key={formatExplanation(f.description)}>
                    <Alert role={undefined} variant="info">
                      <Lightbulb aria-hidden="true" />
                      <AlertTitle>{formatExplanation(f.description)}</AlertTitle>
                      <AlertDescription className="text-xs">
                        <FixSummary f={f} />
                      </AlertDescription>
                      <AlertAction>
                        <Button size="sm" onClick={() => onApply(f.edit)}>
                          Apply
                        </Button>
                      </AlertAction>
                    </Alert>
                  </li>
                ))}
              </ul>
            ))}
        </div>
      )}
    </Panel>
  );
}
