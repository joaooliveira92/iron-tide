import type { CompiledDesignVersion } from "./state.js";
import type { TradeDutyDesign } from "./tradeProtection.js";

function aswLevelOf(design: CompiledDesignVersion): number {
  let level = 0;
  for (const capability of design.capabilities ?? []) {
    if (capability.kind === "asw_attack") level = Math.max(level, capability.level);
  }
  return level;
}

export function tradeDutyDesigns(
  designs: ReadonlyMap<string, CompiledDesignVersion>,
): ReadonlyMap<string, TradeDutyDesign> {
  const result = new Map<string, TradeDutyDesign>();
  for (const [id, design] of designs) {
    const aswLevel = aswLevelOf(design);
    result.set(id, {
      hullType: design.hullType,
      normalizedSpeedUms: Number(design.normalizedSpeedUms),
      ...(design.shortRange === true ? { shortRange: true as const } : {}),
      ...(aswLevel > 0 ? { aswLevel } : {}),
    });
  }
  return result;
}
