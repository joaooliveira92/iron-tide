import { cn } from "../../../lib/utils.js";
import { reasonText, worldText } from "../world-situation-copy.js";
import { OUTLOOK_TONE } from "../world-situation-presentation.js";
import type { PowerBrief, PowerOutlook } from "../world-situation.js";
import { NationGlyph } from "./NationGlyph.js";
import { RelationshipStatus } from "./RelationshipStatus.js";

function Section({
  title,
  children,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-1.5">
      <h5 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h5>
      {children}
    </section>
  );
}

const PRESSURE_KEY: Readonly<
  Record<
    PowerOutlook,
    "dossier.pressure.flashpoint" | "dossier.pressure.uncertain" | "dossier.pressure.stable"
  >
> = {
  flashpoint: "dossier.pressure.flashpoint",
  uncertain: "dossier.pressure.uncertain",
  stable: "dossier.pressure.stable",
};

function uniqueInOrder(values: readonly string[]): string[] {
  return [...new Set(values)];
}

export function whyItMatters(power: PowerBrief): string {
  return reasonText(power.reason, {
    power: power.name,
    tension: power.tension,
    holdings: power.sharedHoldings.map((holding) => holding.name),
    theaters: uniqueInOrder(power.sharedHoldings.map((holding) => holding.theaterLabel)),
    theaterCount: power.theaterCount,
  });
}

export function SelectedPowerDossier({ power }: { readonly power: PowerBrief | null }) {
  if (power === null) {
    return (
      <section
        aria-labelledby="world-dossier-heading"
        className="rounded-md border border-dashed border-border p-6"
      >
        <h4 id="world-dossier-heading" className="text-lg font-semibold text-foreground">
          {worldText("dossier.heading")}
        </h4>
        <p className="mt-1 text-sm text-muted-foreground">{worldText("dossier.empty")}</p>
      </section>
    );
  }
  const tone = OUTLOOK_TONE[power.outlook];
  const profile = power.profile;
  return (
    <section
      aria-labelledby="world-dossier-heading"
      className={cn("rounded-md border border-border border-t-2 bg-background/40 p-4", tone.top)}
    >
      <div
        key={power.nationId}
        className="flex flex-col gap-5 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-200"
      >
        <header className="flex items-center gap-3">
          <NationGlyph nationId={power.nationId} name={power.name} className="h-8 w-12" />
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {worldText("dossier.heading")}
            </p>
            <h4 id="world-dossier-heading" className="text-lg font-semibold text-foreground">
              {power.name}
            </h4>
            {profile !== null && profile.officialName !== power.name && (
              <p className="text-sm text-muted-foreground">{profile.officialName}</p>
            )}
          </div>
        </header>

        <Section title={worldText("dossier.whyHeading")}>
          <p className="text-[0.95rem] leading-relaxed text-foreground">{whyItMatters(power)}</p>
        </Section>

        <Section title={worldText("dossier.relationHeading")}>
          <RelationshipStatus power={power} />
        </Section>

        <Section title={worldText("dossier.presenceHeading")}>
          {power.sharedHoldings.length === 0 ? (
            <p className="text-sm text-muted-foreground">{worldText("dossier.presence.none")}</p>
          ) : (
            <ul className="text-sm text-foreground">
              {power.sharedHoldings.map((holding) => (
                <li key={holding.areaId}>
                  {holding.name}
                  <span className="text-muted-foreground"> · {holding.theaterLabel}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {profile === null ? (
          <p className="text-sm text-muted-foreground">{worldText("dossier.noProfile")}</p>
        ) : (
          <>
            <Section title={worldText("dossier.navalHeading")}>
              <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[9.5rem_minmax(0,1fr)]">
                <dt className="text-muted-foreground">{worldText("dossier.naval.budget")}</dt>
                <dd className="text-foreground">{profile.budgetCategory}</dd>
                <dt className="text-muted-foreground">{worldText("dossier.naval.shipbuilding")}</dt>
                <dd className="text-foreground">{profile.shipbuildingCapacity}</dd>
                <dt className="text-muted-foreground">{worldText("dossier.naval.doctrine")}</dt>
                <dd className="text-foreground">{profile.doctrine}</dd>
              </dl>
            </Section>
            <Section title={worldText("dossier.viewHeading")}>
              <p className="text-sm leading-relaxed text-foreground">{profile.diplomacy}</p>
            </Section>
          </>
        )}

        <Section title={worldText("dossier.pressureHeading")}>
          <p className="text-sm text-foreground">{worldText(PRESSURE_KEY[power.outlook])}</p>
          {power.regardsPlayerAsRival && (
            <p className="text-sm text-foreground">
              {worldText("dossier.pressure.rival", { power: power.name })}
            </p>
          )}
        </Section>
      </div>
    </section>
  );
}

export function dossierAnnouncement(
  power: PowerBrief,
  labels: { readonly status: string; readonly attitude: string; readonly outlook: string },
): string {
  return worldText("dossier.announce", { power: power.name, ...labels });
}
