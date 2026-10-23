import { campaignNationHue } from "../../../content/presentationContent.js";
import type { NationRailRow } from "../nation-rail-state.js";

const FADE_MASK = "linear-gradient(to right, #000 0%, #000 25%, transparent 100%)";

export function NationSwatch({ row }: { readonly row: NationRailRow }) {
  const url = row.flagUrl;
  if (url !== null) {
    return (
      <img
        src={url}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 h-full w-28 object-cover opacity-70"
        style={{ maskImage: FADE_MASK, WebkitMaskImage: FADE_MASK }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 left-0 flex w-28 items-center pl-3 opacity-70 text-[12px] font-semibold"
      style={{
        backgroundColor: `hsl(${campaignNationHue(row.nationId)} 45% 35%)`,
        color: "#fff",
        maskImage: FADE_MASK,
        WebkitMaskImage: FADE_MASK,
      }}
    >
      {row.name.slice(0, 1)}
    </span>
  );
}
