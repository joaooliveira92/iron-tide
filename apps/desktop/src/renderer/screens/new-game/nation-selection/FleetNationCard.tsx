import { Check } from "lucide-react";
import { useMemo, useState } from "react";
import type { CardPalette } from "@/components/card-deck/index.js";
import type { PlayableSlotCountryId } from "@/content/nationAssetManifest.js";
import { getCountryCode, getCountryName, resolveNationShip } from "./fleetDispatchUtils.js";

export type FleetNationCardVariant = "focused" | "idle";

type CardChrome = {
  readonly shellClass: string;
  readonly footerClass: string;
  readonly borderColor: (palette: CardPalette) => string;
  readonly accentShadow: (palette: CardPalette) => string | undefined;
};

const CARD_CHROME: Record<FleetNationCardVariant, CardChrome> = {
  focused: {
    shellClass:
      "shadow-[0_0_0_1px_color-mix(in_srgb,var(--color-admiralty-accent)_20%,transparent)]",
    footerClass: "bg-admiralty-surface/35 backdrop-blur-md",
    borderColor: () => "var(--color-admiralty-accent)",
    accentShadow: (palette) => `0 0 18px ${palette.accent}`,
  },
  idle: {
    shellClass: "",
    footerClass: "bg-admiralty-surface/55",
    borderColor: (palette) => palette.border,
    accentShadow: () => undefined,
  },
};

interface FleetNationCardProps {
  countryId: PlayableSlotCountryId;
  palette: CardPalette;
  variant: FleetNationCardVariant;
  listboxId: string;
}

export function FleetNationCard({
  countryId,
  palette,
  variant,
  listboxId,
}: FleetNationCardProps): React.JSX.Element {
  const [imageFailed, setImageFailed] = useState(false);
  const chrome = CARD_CHROME[variant];
  const countryName = getCountryName(countryId);
  const countryCode = getCountryCode(countryId);
  const shipAsset = useMemo(() => resolveNationShip(countryId), [countryId]);
  const showImage = shipAsset !== null && !imageFailed;

  return (
    <div
      id={`${listboxId}-option-${countryId}`}
      role="option"
      tabIndex={-1}
      aria-label={countryName}
      aria-selected={variant === "focused"}
      style={{ background: palette.background, borderColor: chrome.borderColor(palette) }}
      className={`
        absolute inset-0 h-full w-full select-none overflow-hidden rounded-[1.15rem] border
        ${chrome.shellClass}
      `}
    >
      {showImage ? (
        <img
          src={shipAsset.url}
          alt={shipAsset.label}
          draggable={false}
          onError={() => setImageFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div
          aria-label={`${countryName} naval vessel unavailable`}
          role="img"
          className="absolute inset-0 flex items-center justify-center bg-admiralty-surface-raised"
        >
          <span
            aria-hidden="true"
            className="font-display text-5xl font-black tracking-[0.16em] text-admiralty-ink-muted"
          >
            {countryCode}
          </span>
        </div>
      )}

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-admiralty-surface/75 via-admiralty-surface/5 to-admiralty-surface/85"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.10] mix-blend-overlay"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(255,255,255,0.22) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255,255,255,0.22) 1px, transparent 1px)
          `,
          backgroundSize: "26px 26px",
        }}
      />

      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 z-10 h-1.5"
        style={{ backgroundColor: palette.accent, boxShadow: chrome.accentShadow(palette) }}
      />

      {variant === "focused" && (
        <span aria-hidden="true" className="fleet-dispatch-activate-glow" />
      )}

      <div
        className={`absolute inset-x-0 bottom-0 z-20 min-h-[4.8rem] border-t border-admiralty-ink/20 px-5 py-3 text-admiralty-ink ${chrome.footerClass}`}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-base font-black uppercase tracking-wide sm:text-lg">
              {countryName}
            </p>
            <p className="mt-0.5 font-display text-[0.6rem] uppercase tracking-[0.16em] text-admiralty-ink/60">
              Fleet silhouette registry
            </p>
          </div>

          <CardStatus variant={variant} />
        </div>
      </div>
    </div>
  );
}

function CardStatus({ variant }: { variant: FleetNationCardVariant }) {
  if (variant === "idle") {
    return (
      <span className="shrink-0 font-display text-[0.58rem] uppercase tracking-wider text-admiralty-ink/65">
        Select
      </span>
    );
  }
  return (
    <span className="fleet-dispatch-badge-pop flex shrink-0 items-center gap-1.5 rounded bg-admiralty-accent px-2.5 py-1 font-display text-[0.7rem] font-black uppercase tracking-wider text-admiralty-accent-foreground">
      <Check className="h-3 w-3" aria-hidden="true" />
      Active
    </span>
  );
}
