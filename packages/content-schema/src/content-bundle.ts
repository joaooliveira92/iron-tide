import { Schema } from "effect";

import {
  AmmunitionPatternSchema,
  GunFamilySchema,
  GunModelSchema,
  GunMountSchema,
} from "./armament.js";
import { AreaSchema } from "./area.js";
import { EventSchema } from "./event.js";
import {
  CampaignConstructionSchema,
  CampaignDesignSchema,
  CampaignDiplomacySchema,
  CampaignDivisionSchema,
  CampaignEconomySchema,
  CampaignFleetSchema,
  CampaignResearchSchema,
} from "./campaign.js";
import { PackManifestSchema, RulesetManifestSchema } from "./manifest.js";
import { NationNavalProfileSchema } from "./naval-profile.js";
import { NationSchema } from "./nation.js";
import { PortSchema } from "./port.js";
import { PresentationContentSchema } from "./presentation.js";
import { PossessionSchema } from "./possession.js";
import { ReferenceDesignSchema } from "./reference-design.js";
import { RouteEdgeSchema } from "./route.js";
import { UiCatalogueSchema } from "./ui-catalogue.js";
import {
  PropulsionPlantSchema,
  ShipComponentWithSourceSchema,
  ShipHullFormSchema,
} from "./ship-component.js";
import { CompiledPartModelSchema, ReferenceDesignLoadoutSchema } from "./ship-parts.js";
import { TechnologyPrerequisiteChainSchema } from "./technology.js";

const ShipBuildingCatalogueSchema = Schema.Struct({
  components: Schema.Array(ShipComponentWithSourceSchema),
  plants: Schema.Array(PropulsionPlantSchema),
  hullForms: Schema.Array(ShipHullFormSchema),
  balance: Schema.Unknown,
  navalProfiles: Schema.Array(NationNavalProfileSchema),
  armament: Schema.Struct({
    gunFamilies: Schema.Array(GunFamilySchema),
    gunModels: Schema.Array(GunModelSchema),
    gunMounts: Schema.Array(GunMountSchema),
    ammunition: Schema.Array(AmmunitionPatternSchema),
  }),
  referenceDesigns: Schema.Array(ReferenceDesignSchema),
  partModel: Schema.optional(CompiledPartModelSchema),
  designLoadouts: Schema.optional(Schema.Array(ReferenceDesignLoadoutSchema)),
});

export const CampaignCollectionsSchema = Schema.Struct({
  fleets: Schema.Array(CampaignFleetSchema),
  economies: Schema.Array(CampaignEconomySchema),
  constructions: Schema.Array(CampaignConstructionSchema),
  diplomacy: Schema.Array(CampaignDiplomacySchema),
  research: Schema.Array(CampaignResearchSchema),
  designs: Schema.Array(CampaignDesignSchema),
  divisions: Schema.optional(Schema.Array(CampaignDivisionSchema)),
  events: Schema.optional(Schema.Array(EventSchema)),
});

export type CampaignCollections = typeof CampaignCollectionsSchema.Type;

export const ContentBundleSchema = Schema.Struct({
  generatedBy: Schema.String,
  manifest: PackManifestSchema,
  rulesets: Schema.Array(RulesetManifestSchema),
  nations: Schema.Array(NationSchema),
  areas: Schema.Array(AreaSchema),
  routes: Schema.Array(RouteEdgeSchema),
  possessions: Schema.Array(PossessionSchema),
  ports: Schema.Array(PortSchema),
  technologies: Schema.Array(TechnologyPrerequisiteChainSchema),
  shipBuilding: Schema.optional(ShipBuildingCatalogueSchema),
  campaign: Schema.optional(CampaignCollectionsSchema),
  presentation: Schema.optional(PresentationContentSchema),
  ui: Schema.optional(UiCatalogueSchema),
});

export type CompiledContentBundle = typeof ContentBundleSchema.Type;
