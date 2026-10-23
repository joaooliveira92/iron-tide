import { Info, Minus, Plus } from "lucide-react";

import { Button } from "../../../components/ui/button.js";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "../../../components/ui/hover-card.js";
import { cn } from "../../../lib/utils.js";
import type { BudgetKnob } from "../budget-policy-view-model.js";

const THUMB =
  "[&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:bg-background [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:transition-transform hover:[&::-webkit-slider-thumb]:scale-110 active:[&::-webkit-slider-thumb]:scale-125";
const TRACK =
  "[&::-webkit-slider-runnable-track]:h-8 [&::-webkit-slider-runnable-track]:bg-transparent";
const THUMB_PX = 16;

export interface DialSliderProps {
  readonly knob: BudgetKnob;
  readonly onChange: (value: number) => void;
}

function fraction(value: number, min: number, max: number): number {
  return max > min ? Math.min(1, Math.max(0, (value - min) / (max - min))) : 0;
}

export function DialSlider({ knob, onChange }: DialSliderProps) {
  const at = fraction(knob.value, knob.min, knob.max);
  const applied = fraction(knob.applied, knob.min, knob.max);
  const nudge = (direction: 1 | -1) =>
    onChange(Math.min(knob.max, Math.max(knob.min, knob.value + direction * knob.step)));
  const offset = (f: number) => `calc(${f * 100}% + ${(0.5 - f) * THUMB_PX}px)`;

  return (
    <div className="group/dial space-y-2" data-changed={knob.changed}>
      <div className="flex items-start justify-between gap-3">
        <HoverCard>
          <HoverCardTrigger
            delay={0}
            closeDelay={0}
            render={<button type="button" />}
            className="-mx-1 flex items-center gap-1.5 rounded px-1 text-sm outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
          >
            {knob.label}
            <Info aria-hidden="true" className="size-3.5 text-muted-foreground" />
          </HoverCardTrigger>
          <HoverCardContent side="left" align="start" className="w-72">
            <div className="space-y-2">
              <div className="font-medium">{knob.label}</div>
              <p className="text-xs text-muted-foreground">{knob.about}</p>
              <dl className="space-y-0.5 border-t pt-2">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">In force</dt>
                  <dd className="tabular-nums">{knob.appliedDisplay}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Range</dt>
                  <dd className="tabular-nums">
                    {knob.min} to {knob.max}
                  </dd>
                </div>
              </dl>
            </div>
          </HoverCardContent>
        </HoverCard>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Decrease ${knob.ariaLabel.toLowerCase()}`}
            disabled={knob.value <= knob.min}
            onClick={() => nudge(-1)}
          >
            <Minus aria-hidden="true" />
          </Button>
          <span className="min-w-14 text-center text-lg font-medium tabular-nums">
            {knob.display}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Increase ${knob.ariaLabel.toLowerCase()}`}
            disabled={knob.value >= knob.max}
            onClick={() => nudge(1)}
          >
            <Plus aria-hidden="true" />
          </Button>
        </div>
      </div>
      <div className="relative h-8">
        <div className="absolute inset-x-2 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-muted ring-1 ring-border" />
        <div
          className="absolute left-2 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-primary"
          style={{ width: `calc((100% - ${THUMB_PX}px) * ${at})` }}
        />
        <div
          aria-hidden="true"
          title={`In force: ${knob.appliedDisplay}`}
          className="absolute top-1/2 h-4 w-px -translate-y-1/2 bg-foreground/70"
          style={{ left: offset(applied) }}
        />
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute -top-6 -translate-x-1/2 rounded bg-popover px-1.5 py-0.5 text-xs tabular-nums text-popover-foreground opacity-0 shadow-md ring-1 ring-foreground/10 transition-opacity",
            "group-hover/dial:opacity-100 group-focus-within/dial:opacity-100",
          )}
          style={{ left: offset(at) }}
        >
          {knob.display}
        </span>
        <input
          type="range"
          aria-label={knob.ariaLabel}
          aria-valuetext={knob.display}
          className={cn(
            "absolute inset-0 h-8 w-full cursor-pointer appearance-none bg-transparent outline-none focus-visible:[&::-webkit-slider-thumb]:ring-2 focus-visible:[&::-webkit-slider-thumb]:ring-ring",
            THUMB,
            TRACK,
          )}
          min={knob.min}
          max={knob.max}
          step={knob.step}
          value={knob.value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      </div>
      <div className="flex justify-between gap-3 text-xs text-muted-foreground">
        <span>{knob.caption}</span>
        {knob.changed && <span className="shrink-0 tabular-nums">was {knob.appliedDisplay}</span>}
      </div>
    </div>
  );
}
