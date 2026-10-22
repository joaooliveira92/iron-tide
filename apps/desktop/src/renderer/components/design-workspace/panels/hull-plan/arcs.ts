import type { MountSide } from "@bluewave/ship-design";

export interface ArcSector {
  readonly instanceId: string;
  readonly beam: "PORT" | "STBD";
  readonly startDeg: number;
  readonly widthDeg: number;
}

export const BEAM_BEARING = { STBD: 90, PORT: 270 } as const;

export const normaliseDeg = (d: number): number => ((d % 360) + 360) % 360;

export function arcSectors(
  instanceId: string,
  side: MountSide | undefined,
  effectiveBeamArcDeg: number | undefined,
): ArcSector[] {
  if (effectiveBeamArcDeg === undefined || !Number.isFinite(effectiveBeamArcDeg)) return [];
  if (effectiveBeamArcDeg <= 0) return [];
  const widthDeg = Math.min(360, effectiveBeamArcDeg);
  const beams: ("PORT" | "STBD")[] =
    side === "PORT" ? ["PORT"] : side === "STBD" ? ["STBD"] : ["STBD", "PORT"];
  return beams.map((beam) => ({
    instanceId,
    beam,
    startDeg: normaliseDeg(BEAM_BEARING[beam] - widthDeg / 2),
    widthDeg,
  }));
}

export function bearingVector(deg: number): { dx: number; dy: number } {
  const r = (deg * Math.PI) / 180;
  return { dx: -Math.cos(r), dy: -Math.sin(r) };
}

export function sectorPath(cx: number, cy: number, r: number, s: ArcSector): string {
  const a = bearingVector(s.startDeg);
  const b = bearingVector(s.startDeg + s.widthDeg);
  const f = (n: number) => n.toFixed(2);
  if (s.widthDeg >= 360) {
    return `M ${f(cx - r)} ${f(cy)} A ${r} ${r} 0 1 1 ${f(cx + r)} ${f(cy)} A ${r} ${r} 0 1 1 ${f(cx - r)} ${f(cy)} Z`;
  }
  return `M ${f(cx)} ${f(cy)} L ${f(cx + a.dx * r)} ${f(cy + a.dy * r)} A ${r} ${r} 0 ${s.widthDeg > 180 ? 1 : 0} 1 ${f(cx + b.dx * r)} ${f(cy + b.dy * r)} Z`;
}
