import {
  Anchor,
  Handshake,
  Link2Off,
  ShieldCheck,
  ShieldOff,
  Star,
  Swords,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { humanizeId } from "../../../lib/humanize-id.js";
import { cn } from "../../../lib/utils.js";
import { ACTION_BRIEFS, TENSION_TONES } from "../diplomacy-presentation.js";
import type { DiplomacyActionKind, DiplomacyDraftCommand } from "../diplomacy-screen-state.js";
import type { DiplomacyRelationRow } from "../diplomacy-view-model.js";
import { NationFlag } from "./NationFlag.js";
import { TensionGauge } from "./TensionGauge.js";

const ACTION_ICONS: Readonly<Record<DiplomacyActionKind, LucideIcon>> = {
  FormAlliance: Handshake,
  BreakAlliance: Link2Off,
  FormNonAggressionPact: ShieldCheck,
  BreakNonAggressionPact: ShieldOff,
  DeclareBlockade: Anchor,
  DeclareWar: Swords,
  AcceptPeace: Handshake,
};

export interface NationDossierProps {
  readonly row: DiplomacyRelationRow;
  readonly draft: DiplomacyDraftCommand | null;
  readonly busy: boolean;
  readonly onAction: (partnerNationId: string, kind: DiplomacyActionKind) => void;
}

function Card({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <section className="space-y-2.5 rounded-md border p-3">
      <h3 className="text-sm font-medium">{title}</h3>
      {children}
    </section>
  );
}

function Fact({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function ActionButton({
  kind,
  drafted,
  disabled,
  onClick,
}: {
  readonly kind: DiplomacyActionKind;
  readonly drafted: boolean;
  readonly disabled: boolean;
  readonly onClick: () => void;
}) {
  const { label, brief, tone } = ACTION_BRIEFS[kind];
  const Icon = ACTION_ICONS[kind];
  const hostile = tone === "hostile";
  return (
    <button
      type="button"
      aria-pressed={drafted}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-colors",
        "outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
        hostile
          ? "hover:border-destructive/50 hover:bg-destructive/[0.05]"
          : "hover:border-foreground/30 hover:bg-accent",
        drafted &&
          (hostile ? "border-destructive bg-destructive/[0.08]" : "border-primary bg-accent"),
      )}
    >
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-md",
          hostile ? "bg-destructive/10 text-destructive" : "bg-muted text-foreground",
        )}
      >
        <Icon aria-hidden="true" className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{brief}</span>
      </span>
      {drafted && <span className="text-xs font-medium">Drafted</span>}
    </button>
  );
}

export function NationDossier({ row, draft, busy, onAction }: NationDossierProps) {
  const tone = TENSION_TONES[row.band];
  const draftedKind = draft?.partnerNationId === row.partnerNationId ? draft.kind : null;
  const buttons = (kinds: readonly DiplomacyActionKind[]) =>
    kinds.map((kind) => (
      <ActionButton
        key={kind}
        kind={kind}
        drafted={draftedKind === kind}
        disabled={busy}
        onClick={() => onAction(row.partnerNationId, kind)}
      />
    ));
  const diplomatic = row.actions.filter((kind) => ACTION_BRIEFS[kind].tone === "diplomatic");
  const hostile = row.actions.filter((kind) => ACTION_BRIEFS[kind].tone === "hostile");

  return (
    <div className="space-y-3" data-testid="nation-dossier">
      <header className="flex items-center gap-3 px-0.5">
        <NationFlag
          url={row.flagUrl}
          name={row.partnerName}
          className="h-12 w-[4.5rem] rounded border border-border shadow-sm"
        />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-semibold tracking-tight">{row.partnerName}</h2>
          <p
            className={cn(
              "text-sm font-medium",
              row.atWar
                ? "text-destructive"
                : row.allied
                  ? "text-green-700 dark:text-green-400"
                  : "text-muted-foreground",
            )}
          >
            {row.relationLabel}
          </p>
        </div>
        {row.isLikelyRival && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium">
            <Star aria-hidden="true" className="size-3 fill-warning text-warning" />
            Likely rival
          </span>
        )}
      </header>

      <Card title="Tension">
        <div className="flex items-baseline justify-between">
          <span className={cn("text-sm font-semibold", tone.text)}>{humanizeId(row.band)}</span>
          <span className="text-sm tabular-nums text-muted-foreground">{row.tension}/10</span>
        </div>
        <TensionGauge tension={row.tension} band={row.band} size="lg" />
        {row.highTension && (
          <p className="flex items-start gap-1.5 text-xs">
            <TriangleAlert aria-hidden="true" className="mt-px size-3.5 shrink-0 text-warning" />
            Relations with {row.partnerName} are {row.highTensionNote}; war is possible
          </p>
        )}
      </Card>

      {diplomatic.length > 0 && <Card title="Diplomacy">{buttons(diplomatic)}</Card>}
      {hostile.length > 0 && <Card title="Hostile action">{buttons(hostile)}</Card>}

      <Card title="Standing">
        <dl className="space-y-1.5">
          <Fact label="Pact" value={row.nap ? "Non-aggression" : "None"} />
          <Fact label="Stance since" value={row.since} />
          <Fact
            label="Blockades"
            value={row.blockades.length === 0 ? "None" : String(row.blockades.length)}
          />
        </dl>
        {row.blockades.length > 0 && (
          <ul aria-label="Blockades involving this nation" className="space-y-1.5 border-t pt-2.5">
            {row.blockades.map((blockade) => (
              <li key={blockade.key} className="flex items-start gap-2 text-xs">
                <Anchor aria-hidden="true" className="mt-px size-3.5 shrink-0 text-destructive" />
                <span>
                  <span className="font-medium">
                    {blockade.blockaderName} → {blockade.blockadedName}
                  </span>{" "}
                  <span className="text-muted-foreground">
                    in {blockade.areaLabel}, since {blockade.establishedMonth}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
