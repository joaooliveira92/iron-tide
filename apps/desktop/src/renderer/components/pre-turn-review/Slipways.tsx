import { Anchor, FlaskConical, Hammer } from "lucide-react";

import type { PlayerProjectionEconomy } from "@bluewave/campaign-engine";

import { cn } from "../../lib/utils.js";
import type { PresentationFormat } from "../../lib/presentation-format/index.js";
import { SlateFacts, SlateHeader, SlateMeter, percentString } from "../ui/slate.js";
import { formatOptional } from "../preTurnReviewFormat.js";
import type { PipelineProject } from "../preTurnReviewModel.js";
import { Dossier } from "../ui/dossier.js";

const MAX_SHOWN_PROJECTS = 4;

function statusLabel(status: string): string {
  const spaced = status.toLowerCase().replaceAll("_", " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function ProjectRow({
  project,
  format,
}: {
  readonly project: PipelineProject;
  readonly format: PresentationFormat;
}) {
  const remaining = Math.max(0, project.totalWork - project.completedWork);
  return (
    <li>
      <Dossier
        side="left"
        icon={<Hammer className="size-3" />}
        title={project.className}
        aside={
          <span className="font-display text-sm font-semibold tabular-nums">
            {percentString(project.progress)}
          </span>
        }
        foot={
          project.nearCompletion
            ? "On the final stretch. It may leave the slipway within a month or two."
            : "Work is paid for as it is absorbed each month."
        }
        triggerProps={{
          className:
            "group block w-full space-y-1.5 rounded-md px-2 py-1.5 text-left outline-none hover:bg-admiralty-accent/8 focus-visible:ring-2 focus-visible:ring-ring",
          "aria-label": `${project.className}, ${percentString(project.progress)} built`,
        }}
        trigger={
          <>
            <span className="flex items-baseline justify-between gap-2">
              <span className="truncate text-xs font-medium">{project.className}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {project.nearCompletion ? (
                  <span className="font-medium text-admiralty-accent">Nearly done</span>
                ) : (
                  percentString(project.progress)
                )}
              </span>
            </span>
            <SlateMeter
              fraction={project.progress}
              fill={project.nearCompletion ? "bg-admiralty-accent" : "bg-admiralty-signal/80"}
            />
          </>
        }
      >
        <SlateMeter
          fraction={project.progress}
          fill={project.nearCompletion ? "bg-admiralty-accent" : "bg-admiralty-signal/80"}
          className="h-2"
        />
        <SlateFacts
          rows={[
            { label: "Class", value: project.shipType },
            { label: "Status", value: statusLabel(project.status) },
            { label: "Work done", value: format.count(project.completedWork) },
            { label: "Work remaining", value: format.count(remaining) },
            { label: "Already paid for", value: format.count(project.paidWork) },
          ]}
        />
      </Dossier>
    </li>
  );
}

function ResearchRow({
  economy,
  spend,
  loading,
  format,
}: {
  readonly economy: PlayerProjectionEconomy | null;
  readonly spend: number | null;
  readonly loading: boolean;
  readonly format: PresentationFormat;
}) {
  const cap = economy?.researchCap ?? 0;
  const requested = economy?.researchRequested ?? 0;
  const fraction = cap > 0 && spend !== null ? spend / cap : 0;
  const unfunded = economy?.researchUnfundedReason;
  const reason =
    unfunded === "NO_ELIGIBLE_RESEARCH_FIELD"
      ? "No field is open to research, so the budget goes unspent."
      : unfunded === "ABOVE_CAP"
        ? "The budget asked for is above the cap, so only the capped amount is spent."
        : "Research is funded as requested.";
  return (
    <Dossier
      side="left"
      icon={<FlaskConical className="size-3" />}
      title="Research"
      foot={reason}
      triggerProps={{
        className:
          "group block w-full space-y-1.5 rounded-md px-2 py-1.5 text-left outline-none hover:bg-admiralty-accent/8 focus-visible:ring-2 focus-visible:ring-ring",
        "aria-label": `Research spending: ${formatOptional(spend, loading, format.money)}`,
      }}
      trigger={
        <>
          <span className="flex items-baseline justify-between gap-2">
            <span className="text-xs font-medium">Research</span>
            <span className="text-xs tabular-nums text-muted-foreground">
              {formatOptional(spend, loading, format.money)}{" "}
              <span className="opacity-70">a month</span>
            </span>
          </span>
          <SlateMeter
            fraction={fraction}
            mark={cap > 0 ? requested / cap : undefined}
            fill={unfunded === undefined ? "bg-admiralty-signal/80" : "bg-warning"}
          />
        </>
      }
    >
      <SlateMeter
        fraction={fraction}
        mark={cap > 0 ? requested / cap : undefined}
        fill={unfunded === undefined ? "bg-admiralty-signal/80" : "bg-warning"}
        className="h-2"
      />
      <SlateFacts
        rows={[
          { label: "Being spent", value: spend === null ? "—" : format.money(spend) },
          { label: "Budget requested", value: format.money(requested) },
          { label: "Monthly cap", value: format.money(cap) },
        ]}
      />
    </Dossier>
  );
}

export function Slipways({
  pipeline,
  economy,
  constructionCount,
  expectedCompletions,
  researchSpend,
  loading,
  format,
}: {
  readonly pipeline: readonly PipelineProject[];
  readonly economy: PlayerProjectionEconomy | null;
  readonly constructionCount: number | null;
  readonly expectedCompletions: number | null;
  readonly researchSpend: number | null;
  readonly loading: boolean;
  readonly format: PresentationFormat;
}) {
  const shown = pipeline.slice(0, MAX_SHOWN_PROJECTS);
  const hidden = pipeline.length - shown.length;
  return (
    <section aria-label="Shipyards and research" className="min-w-0">
      <SlateHeader
        icon={<Anchor className="size-3" />}
        title="On the slipways"
        aside={
          <span className="text-xs tabular-nums text-muted-foreground">
            {formatOptional(constructionCount, loading, format.count)} building
            {" · "}
            <span
              className={cn(
                expectedCompletions !== null && expectedCompletions > 0 && "text-admiralty-accent",
              )}
            >
              {formatOptional(expectedCompletions, loading, format.count)} nearly done
            </span>
          </span>
        }
      />
      <div className="px-2 py-2">
        {shown.length === 0 ? (
          <p className="px-2 py-2 text-xs text-muted-foreground">
            {loading ? "Reading the slipways…" : "No ships are being built."}
          </p>
        ) : (
          <ul className="space-y-0.5">
            {shown.map((project) => (
              <ProjectRow key={project.id} project={project} format={format} />
            ))}
          </ul>
        )}
        {hidden > 0 && (
          <p className="px-2 pt-1 text-xs text-muted-foreground">
            and {format.count(hidden)} more in the yards
          </p>
        )}
        <div className="mt-1 border-t border-dashed border-border/70 pt-1">
          <ResearchRow economy={economy} spend={researchSpend} loading={loading} format={format} />
        </div>
      </div>
    </section>
  );
}
