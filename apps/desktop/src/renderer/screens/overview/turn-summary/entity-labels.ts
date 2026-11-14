import {
  entityLabelKey,
  type EntityReferenceDto,
  type TurnMessageDto,
} from "../../../../shared/turn-message-contract.js";
import {
  nationIdToCountryId,
  nationPresentationOrNull,
} from "../../../content/presentationContent.js";

export type EntityLabeler = (ref: EntityReferenceDto) => string | null;

export const NO_ENTITY_LABELS: EntityLabeler = () => null;

function nationLabel(nationId: string): string | null {
  const countryId = nationIdToCountryId(nationId);
  return countryId === null ? null : (nationPresentationOrNull(countryId)?.flavor.name ?? null);
}

const ENTITY_TYPE_LABELS: Readonly<Record<EntityReferenceDto["type"], string>> = {
  ship: "Ship",
  shipClass: "Ship class",
  nation: "Nation",
  region: "Region",
  technology: "Technology",
  constructionProject: "Construction project",
  battle: "Battle",
  formation: "Formation",
};

export function effectTargetLabel(ref: EntityReferenceDto, labeler: EntityLabeler): string {
  return labeler(ref) ?? ENTITY_TYPE_LABELS[ref.type];
}

export function resolveInterpolation(
  message: TurnMessageDto,
  labeler: EntityLabeler,
): TurnMessageDto["interpolation"] {
  const namesById = new Map<string, string>();
  for (const ref of [...message.subjectRefs, ...message.effectRefs.map((e) => e.target)]) {
    const label = labeler(ref);
    if (label !== null) namesById.set(ref.id, label);
  }
  const resolved: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(message.interpolation)) {
    if (typeof value !== "string") {
      resolved[key] = value;
      continue;
    }
    const nation = key === "nationId" ? labeler({ type: "nation", id: value }) : null;
    resolved[key] = namesById.get(value) ?? nation ?? value;
  }
  return resolved;
}

export function createEntityLabeler(input: {
  readonly labels: Readonly<Record<string, string>>;
  readonly regionName: (id: string) => string | null;
}): EntityLabeler {
  return (ref) => {
    switch (ref.type) {
      case "nation":
        return nationLabel(ref.id);
      case "region":
        return input.regionName(ref.id);
      default:
        return input.labels[entityLabelKey(ref)] ?? null;
    }
  };
}
