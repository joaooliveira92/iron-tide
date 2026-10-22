import { campaignNationHue } from "../../../content/presentationContent.js";
import type { NationRailRow } from "../nation-rail-state.js";

export function NationSwatch({ row }: { readonly row: NationRailRow }) {
  const url = row.flagUrl;
  if (url !== null) {
    return (
      <img
        src={url}
        alt=""
        aria-hidden="true"
        className="h-5 w-7 shrink-0 rounded-sm border object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-5 w-7 shrink-0 items-center justify-center rounded-sm border text-[12px] font-semibold"
      style={{ backgroundColor: `hsl(${campaignNationHue(row.nationId)} 45% 35%)`, color: "#fff" }}
    >
      {row.name.slice(0, 1)}
    </span>
  );
}
