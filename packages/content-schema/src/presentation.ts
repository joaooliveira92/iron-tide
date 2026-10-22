import { Schema } from "effect";

import { ProvenanceSchema } from "./provenance.js";

const HexColorSchema = Schema.String.check(Schema.isPattern(/^#[0-9A-Fa-f]{6}$/)).annotate({
  description: "CSS hex color, e.g. #C8102E",
});

export const NationCoordinatesSchema = Schema.Struct({
  lat: Schema.Finite,
  lng: Schema.Finite,
  label: Schema.NonEmptyString,
}).annotate({ description: "Approximate capital/centroid coordinates for the globe" });

export const NationFlavorSchema = Schema.Struct({
  name: Schema.NonEmptyString,
  economy: Schema.NonEmptyString,
  military: Schema.NonEmptyString,
  diplomacy: Schema.NonEmptyString,
}).annotate({ description: "Static presentation-only flavor text for a playable nation" });

export const NationDossierSchema = Schema.Struct({
  appointmentTitle: Schema.String,
  doctrine: Schema.String,
  strategicRegions: Schema.String,
  budgetCategory: Schema.String,
  shipbuildingCapacity: Schema.String,
  researchStrengths: Schema.String,
  researchWeaknesses: Schema.String,
  nationalCharacteristics: Schema.String,
  likelyRivals: Schema.Array(Schema.String),
  difficulty: Schema.Literals([1, 2, 3, 4, 5]),
}).annotate({ description: "Presentation-only nation-confirmation dossier fields" });

export const NationPresentationRecordSchema = Schema.Struct({
  countryId: Schema.NonEmptyString.annotate({
    description: "Stable presentation country id, e.g. 'gb' (ADR-0003)",
  }),
  nationId: Schema.NonEmptyString.annotate({
    description: "The game's nation-record id this presentation belongs to, e.g. 'uk'",
  }),
  code: Schema.NonEmptyString.annotate({ description: "Display code, e.g. 'GBR'" }),
  markerColour: HexColorSchema,
  coordinates: NationCoordinatesSchema,
  flavor: NationFlavorSchema,
  dossier: NationDossierSchema,
  provenance: Schema.optional(ProvenanceSchema),
}).annotate({ description: "One playable nation's complete presentation record" });

export const RegionSchema = Schema.Struct({
  id: Schema.NonEmptyString,
  label: Schema.NonEmptyString,
});

export const RegionGroupingSchema = Schema.Struct({
  regions: Schema.Array(RegionSchema).annotate({ description: "Display order is the array order" }),
  areaRegion: Schema.Record(Schema.String, Schema.String).annotate({
    description: "Production-pack area id -> display region id",
  }),
});

export const MapJoinSchema = Schema.Struct({
  campaignAreaToFixture: Schema.Record(Schema.String, Schema.String).annotate({
    description: "Campaign (production-pack) area id -> fixture map area id",
  }),
  nationHue: Schema.Record(Schema.String, Schema.Finite).annotate({
    description: "Campaign nation id -> OKLCH hue for the live overlay",
  }),
  nationLabel: Schema.Record(Schema.String, Schema.String).annotate({
    description: "Campaign nation id -> display label",
  }),
  nationHomeArea: Schema.Record(Schema.String, Schema.String).annotate({
    description: "Campaign nation id -> home-waters campaign area id",
  }),
});

export const PresentationContentSchema = Schema.Struct({
  nations: Schema.Array(NationPresentationRecordSchema),
  regions: RegionGroupingSchema,
  mapJoin: MapJoinSchema,
  provenance: Schema.optional(ProvenanceSchema),
}).annotate({ description: "The compiled presentation corpus" });

export type NationCoordinates = typeof NationCoordinatesSchema.Type;
export type NationFlavor = typeof NationFlavorSchema.Type;
export type NationDossier = typeof NationDossierSchema.Type;
export type NationPresentationRecord = typeof NationPresentationRecordSchema.Type;
export type Region = typeof RegionSchema.Type;
export type RegionGrouping = typeof RegionGroupingSchema.Type;
export type MapJoin = typeof MapJoinSchema.Type;
export type PresentationContent = typeof PresentationContentSchema.Type;
