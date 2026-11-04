import { BALANCED_ALLOCATION } from "@bluewave/campaign-engine";
import { ArrowDown, ArrowUp, Info, Minus, Target, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "../../components/ui/badge.js";
import { CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card.js";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../../components/ui/hover-card.js";
import { Popover, PopoverContent, PopoverTrigger } from "../../components/ui/popover.js";
import { Progress } from "../../components/ui/progress.js";
import type { ArchetypeConsequence } from "./archetype-consequence.js";
import { archetypeDimensionDescriptor } from "./archetype-dimensions.js";
import { GlassCard } from "@/components/ui/glass-card.js";

export function ArchetypeConsequencePanel({ consequence }: { consequence: ArchetypeConsequence }) {
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

          <div className="grid grid-cols-1 gap-6 @lg:grid-cols-2">
            <Strengths consequence={consequence} />
            <OpportunityCosts consequence={consequence} />
          </div>
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
                <HoverCardContent side="top" variant="tip">
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
