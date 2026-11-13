import {
  entityLabelKey,
  type EntityReferenceDto,
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
