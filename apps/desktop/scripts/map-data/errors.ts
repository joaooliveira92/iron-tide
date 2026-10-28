export class MapDataError extends Error {
  readonly _tag = "MapDataError";
}

export class MapDataIntegrityError extends Error {
  readonly _tag = "MapDataIntegrityError";
}

export class CatalogueError extends Error {
  readonly _tag = "CatalogueError";
}

export class ProtectedFeatureViolation extends Error {
  readonly _tag = "ProtectedFeatureViolation";
  readonly featureId: string;
  readonly level: number | null;
  readonly rule: string;
  constructor(featureId: string, level: number | null, rule: string, detail: string) {
    super(`${featureId} z${level === null ? "-" : level}: ${rule}: ${detail}`);
    this.featureId = featureId;
    this.level = level;
    this.rule = rule;
  }
}
