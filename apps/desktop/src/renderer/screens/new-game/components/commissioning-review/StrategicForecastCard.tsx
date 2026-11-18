import { Anchor } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { GlassCard } from "../../../../components/ui/glass-card.js";
import type { StrategicForecast } from "../../new-game-commissioning-review-screen-state.js";
import { FORECAST_ICONS } from "../commissioning-review-icons.js";
import { SectionBadge } from "./SectionBadge.js";

export function StrategicForecastCard({ forecast }: { readonly forecast: StrategicForecast }) {
  return (
    <GlassCard glassVariant="liquid-refract">
      <section className="flex flex-col gap-4 p-4">
        <header className="flex items-center gap-2">
          <SectionBadge icon={FORECAST_ICONS.heading} />
          <h2 className="text-sm font-semibold">
            Strategic forecast — {forecast.appointmentTitle}
          </h2>
        </header>

        <div className="grid gap-3 sm:grid-cols-3">
          <ForecastFact icon={FORECAST_ICONS.doctrine} label="Doctrine" text={forecast.doctrine} />
          <ForecastFact
            icon={FORECAST_ICONS.strategicRegions}
            label="Strategic regions"
            text={forecast.strategicRegions}
          />
          <ForecastFact
            icon={FORECAST_ICONS.nationalCharacteristics}
            label="National character"
            text={forecast.nationalCharacteristics}
          />
        </div>

        <div>
          <p className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            <FORECAST_ICONS.expectedPressures
              className="h-3.5 w-3.5 flex-none text-admiralty-accent"
              aria-hidden="true"
            />
            Expected pressures
          </p>
          <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {forecast.expectedPressures.map((pressure) => (
              <li key={pressure} className="flex items-start gap-2 text-sm text-muted-foreground">
                <Anchor
                  className="mt-0.5 h-3.5 w-3.5 flex-none text-admiralty-accent/80"
                  aria-hidden="true"
                />
                {pressure}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </GlassCard>
  );
}

function ForecastFact({
  icon: Icon,
  label,
  text,
}: {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly text: string;
}) {
  return (
    <article className="rounded-lg border border-border/60 bg-admiralty-surface-raised/40 p-3">
      <div className="mb-1.5 flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 flex-none text-admiralty-accent" aria-hidden="true" />
        <h3 className="font-display text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </h3>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">{text}</p>
    </article>
  );
}
