const BASE_DETONATION_BP = 8_000;

const DETONATION_STRUCTURAL_DAMAGE = 50_000;
const DETONATION_FLOTATION_DAMAGE = 30_000;

const DETONATION_OUTCOMES = new Set(["FULL_PENETRATION", "CRITICAL_PENETRATION"]);

const MAGAZINE_ZONE_TYPES = new Set([
  "MAGAZINE",
  "SHELL_ROOM",
  "PROPELLANT_MAGAZINE",
  "AMMUNITION_HOLD",
]);

export interface MagazineHazardInput {
  hasMagazineInZone: boolean;
  penetrationOutcome: string;
  hitZoneType: string;
}

export interface MagazineHazardResult {
  magazineDetonated: boolean;
  structuralDamage: number;
  flotationDamage: number;
  hazardType: string;
}

export function isMagazineZoneType(hitZoneType: string): boolean {
  return MAGAZINE_ZONE_TYPES.has(hitZoneType);
}

export function evaluateMagazineHazard(
  input: MagazineHazardInput,
  keyedRng: (stream: string) => number,
): MagazineHazardResult {
  const { hasMagazineInZone, penetrationOutcome, hitZoneType } = input;

  if (!hasMagazineInZone) {
    return {
      magazineDetonated: false,
      structuralDamage: 0,
      flotationDamage: 0,
      hazardType: "NONE",
    };
  }

  if (!MAGAZINE_ZONE_TYPES.has(hitZoneType)) {
    return {
      magazineDetonated: false,
      structuralDamage: 0,
      flotationDamage: 0,
      hazardType: "NONE",
    };
  }

  if (!DETONATION_OUTCOMES.has(penetrationOutcome)) {
    return {
      magazineDetonated: false,
      structuralDamage: 0,
      flotationDamage: 0,
      hazardType: "NONE",
    };
  }

  const draw = keyedRng("battle/ship/damage/magazine");
  const drawBp = Math.floor(draw * 10_000);

  const magazineDetonated = drawBp < BASE_DETONATION_BP;

  if (!magazineDetonated) {
    return {
      magazineDetonated: false,
      structuralDamage: 0,
      flotationDamage: 0,
      hazardType: "NONE",
    };
  }

  return {
    magazineDetonated: true,
    structuralDamage: DETONATION_STRUCTURAL_DAMAGE,
    flotationDamage: DETONATION_FLOTATION_DAMAGE,
    hazardType: "MAGAZINE_DETONATION",
  };
}
