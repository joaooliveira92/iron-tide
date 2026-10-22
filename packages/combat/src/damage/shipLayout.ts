import { type ArmorQualityFamily, type ArmorZoneType } from "./armorModel.js";

export interface CompartmentDef {
  id: string;
  zMinMm: number;
  zMaxMm: number;
  xMinMm: number;
  xMaxMm: number;
  altitudeMinMm: number;
  altitudeMaxMm: number;
}

export interface ArmorZoneDef {
  id: string;
  zoneType: ArmorZoneType;
  thicknessUm: number;
  qualityFamily: ArmorQualityFamily;
  slopeDeg: number;
}
