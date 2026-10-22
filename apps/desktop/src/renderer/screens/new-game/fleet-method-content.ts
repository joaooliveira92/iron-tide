import type { FleetMethodArtworkId } from "../../content/fleetMethodArtworkManifest.js";

export interface FleetMethodCardContent {
  readonly id: FleetMethodArtworkId;
  readonly title: string;
  readonly tagline: string;
  readonly description: string;
  readonly note: string | null;
}

export const FLEET_METHOD_CARDS: readonly FleetMethodCardContent[] = [
  {
    id: "generated",
    title: "Inherit an Existing Navy",
    tagline: "Recommended for your first campaign",
    description:
      "Start with an operational-but-aging navy and modernize it as you play, rather than designing a fleet from scratch.",
    note: null,
  },
  {
    id: "disabled",
    title: "Build the Legacy Fleet Manually",
    tagline: "Design your own starting navy",
    description:
      "Automatic generation is switched off — construction of your starting fleet is left entirely to you.",
    note: "Detailed fleet construction isn't available yet — this mode is fully selectable, but the build interface is future work.",
  },
  {
    id: "historical",
    title: "Curated Historical-Inspired Fleet",
    tagline: "Balanced, nation-tailored navy",
    description:
      "A balanced, nation- and era-tailored navy labeled as historically inspired — generated for you, not hand-built.",
    note: null,
  },
];
