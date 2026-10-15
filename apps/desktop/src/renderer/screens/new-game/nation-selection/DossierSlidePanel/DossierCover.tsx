import { type JSX, useEffect, useMemo, useState } from "react";
import type { PlayableSlotCountryId } from "@/content/nationAssetManifest.js";
import { getCountryCode, resolveNationShip } from "./nationArtwork.js";

export function DossierCover({ countryId }: { countryId: PlayableSlotCountryId }): JSX.Element {
  const [imageFailed, setImageFailed] = useState(false);
  const ship = useMemo(() => resolveNationShip(countryId), [countryId]);

  useEffect(() => setImageFailed(false), []);

  return (
    <>
      {ship !== null && !imageFailed ? (
        <img
          src={ship.url}
          alt=""
          aria-hidden="true"
          draggable={false}
          onError={() => setImageFailed(true)}
          className="pointer-events-none absolute inset-0 -z-20 h-full w-full object-cover object-center opacity-25"
        />
      ) : (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-20 flex items-center justify-center bg-[radial-gradient(circle_at_48%_38%,color-mix(in_srgb,var(--color-admiralty-signal)_14%,transparent),color-mix(in_srgb,var(--color-admiralty-surface)_55%,transparent))]"
        >
          <span className="font-display text-7xl font-black tracking-[0.18em] text-admiralty-signal/10">
            {getCountryCode(countryId)}
          </span>
        </div>
      )}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-admiralty-surface/40 via-admiralty-surface/55 to-admiralty-surface/80"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.09]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.22) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.22) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
        }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-admiralty-accent shadow-[0_0_18px_color-mix(in_srgb,var(--color-admiralty-accent)_55%,transparent)]"
      />
    </>
  );
}
