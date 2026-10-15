import { BALANCED_ALLOCATION } from "@bluewave/campaign-engine";
import {
  ArrowDown,
  ArrowUp,
  Coins,
  Factory,
  Info,
  Minus,
  ShieldCheck,
  Swords,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Badge } from "../../components/ui/badge.js";
import { CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card.js";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../../components/ui/hover-card.js";
import { Popover, PopoverContent, PopoverTrigger } from "../../components/ui/popover.js";
import { Progress } from "../../components/ui/progress.js";
import { type ArchetypeNumericEffect, type ArchetypeConsequence } from "./archetype-consequence.js";
import { archetypeDimensionDescriptor } from "./archetype-dimensions.js";
import { GlassCard } from "@/components/ui/glass-card.js";

const EFFECT_META: Record<string, { readonly icon: typeof Coins; readonly description: string }> = {
  "Starting treasury": {
    icon: Coins,
    description:
      "A multiplier on the treasury you begin the campaign with, relative to the balanced allocation.",
  },
  "Monthly appropriation": {
    icon: TrendingUp,
    description: "A multiplier on each month's appropriation relative to the balanced baseline.",
  },
  "Shipyard capacity": {
    icon: Factory,
    description: "A multiplier on the construction throughput your shipyards can sustain.",
  },
  "Commander bonus in battle": {
    icon: ShieldCheck,
    description: "A flat bonus to commander effectiveness when battle is resolved.",
  },
  "Doctrine bonus in battle": {
    icon: Swords,
    description: "A flat bonus to doctrine effectiveness when battle is resolved.",
  },
};

export function ArchetypeConsequencePanel({
  consequence,
  compact = false,
}: {
  consequence: ArchetypeConsequence;
  compact?: boolean;
}) {
  // The preview sits in columns of very different widths (the full detail pane, or
  // half of it beside the inline allocator), so its grids respond to the width of
  // the panel itself, not the viewport.
  return (
    <div className="@container">
      <GlassCard glassVariant="liquid-refract">
        <CardHeader className="flex flex-col gap-4 space-y-0 @lg:flex-row @lg:items-start @lg:justify-between">
          <div className="min-w-0 space-y-1.5">
            <CardTitle className="flex items-center gap-2">
              <Target aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span>Consequences</span>
            </CardTitle>

            <CardDescription>How this allocation shapes your campaign.</CardDescription>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Badge variant={consequence.isBalanced ? "outline" : "default"}>
              {consequence.isBalanced ? "Balanced" : "Custom build"}
            </Badge>

            <ScoringPopover consequence={consequence} />
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <DimensionDeltas consequence={consequence} />

          {!compact && <NumericEffects consequence={consequence} />}

          <div className="grid grid-cols-1 gap-6 @lg:grid-cols-2">
            <Strengths consequence={consequence} />
            <OpportunityCosts consequence={consequence} />
          </div>

          {!compact && <Systems consequence={consequence} />}
        </CardContent>
      </GlassCard>
    </div>
  );
}

function DimensionDeltas({ consequence }: { consequence: ArchetypeConsequence }) {
  return (
    <div className="grid grid-cols-1 gap-3 @lg:grid-cols-3">
      {consequence.dimensionDeltas.map((delta) => {
        const Icon = archetypeDimensionDescriptor(delta.dimension).icon;
        const DeltaIcon = delta.delta > 0 ? TrendingUp : delta.delta < 0 ? TrendingDown : Minus;
        const variance =
          delta.delta > 0 ? "default" : delta.delta < 0 ? "destructive" : "secondary";
        return (
          <div key={delta.dimension} className="rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <Icon className="h-4 w-4 text-muted-foreground" />
                {delta.label}
              </span>
              <HoverCard>
                <HoverCardTrigger render={<span className="inline-flex" />}>
                  <Badge variant={variance} className="gap-1">
                    <DeltaIcon className="h-3 w-3" />
                    {delta.delta > 0 ? `+${delta.delta}` : delta.delta}
                  </Badge>
                </HoverCardTrigger>
                <HoverCardContent side="top" className="w-auto max-w-64 px-3 py-1.5 text-xs">
                  {delta.delta > 0
                    ? `${delta.delta} points above balanced`
                    : delta.delta < 0
                      ? `${Math.abs(delta.delta)} points below balanced`
                      : "At the balanced baseline"}
                </HoverCardContent>
              </HoverCard>
            </div>
            <Progress value={(delta.invested / 10) * 100} className="mt-3" />
            <p className="mt-1.5 text-xs text-muted-foreground">
              {delta.invested} pts invested · balanced {delta.balanced}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function NumericEffects({ consequence }: { consequence: ArchetypeConsequence }) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Numerical effects (vs balanced)
      </h4>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {consequence.numericEffects.map((effect) => (
          <EffectTile key={effect.label} effect={effect} />
        ))}
      </div>
    </div>
  );
}

function EffectTile({ effect }: { effect: ArchetypeNumericEffect }) {
  const meta = EFFECT_META[effect.label];
  const Icon = meta?.icon ?? Info;
  return (
    <HoverCard>
      <HoverCardTrigger render={<div />} className="h-full">
        <div className="flex h-full flex-col gap-1 rounded-lg border bg-muted/40 p-3">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-base font-semibold tabular-nums">{effect.value}</span>
          <span className="text-xs text-muted-foreground">{effect.label}</span>
        </div>
      </HoverCardTrigger>
      <HoverCardContent className="w-72">
        <div className="space-y-1.5">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Icon className="h-4 w-4 text-muted-foreground" />
            {effect.label}
          </p>
          <p className="text-xs text-muted-foreground">
            {meta?.description ?? "Effect derived from the engine's model."}
          </p>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

function Strengths({ consequence }: { consequence: ArchetypeConsequence }) {
  return (
    <div>
      <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-600">
        <TrendingUp className="h-3.5 w-3.5" />
        Strengths
      </h4>
      <ul className="space-y-1.5 text-sm">
        {consequence.strengths.length > 0 ? (
          consequence.strengths.map((strength) => (
            <li key={strength} className="flex gap-2">
              <ArrowUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
              {strength}
            </li>
          ))
        ) : (
          <li className="flex gap-2 text-muted-foreground">
            <Minus className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            No dimension above balanced.
          </li>
        )}
      </ul>
    </div>
  );
}

function OpportunityCosts({ consequence }: { consequence: ArchetypeConsequence }) {
  return (
    <div>
      <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-destructive">
        <TrendingDown className="h-3.5 w-3.5" />
        Opportunity costs
      </h4>
      <ul className="space-y-1.5 text-sm">
        {consequence.opportunityCosts.length > 0 ? (
          consequence.opportunityCosts.map((cost) => (
            <li key={cost} className="flex gap-2">
              <ArrowDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
              {cost}
            </li>
          ))
        ) : (
          <li className="flex gap-2 text-muted-foreground">
            <Minus className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Points taken above balanced are unavailable elsewhere.
          </li>
        )}
      </ul>
    </div>
  );
}

function Systems({ consequence }: { consequence: ArchetypeConsequence }) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Systems affected
      </h4>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {consequence.systems.map((system) => (
          <li
            key={system}
            className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm"
          >
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            {system}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ScoringPopover({ consequence }: { consequence: ArchetypeConsequence }) {
  return (
    <Popover>
      <PopoverTrigger
        className="inline-flex items-center rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        aria-label="How scoring works"
      >
        <Info className="h-4 w-4" />
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-2">
          <p className="text-sm font-medium">How scoring works</p>
          {consequence.thresholds.map((threshold) => (
            <p key={threshold} className="text-xs text-muted-foreground">
              {threshold}
            </p>
          ))}
          <p className="text-xs text-muted-foreground">
            Balanced reference: {BALANCED_ALLOCATION.economy} / {BALANCED_ALLOCATION.industry} /{" "}
            {BALANCED_ALLOCATION.combat}.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
