import {
  Anchor,
  Bomb,
  Cog,
  Crosshair,
  Factory,
  FlaskConical,
  Fish,
  Navigation2,
  PencilRuler,
  Plane,
  PlaneTakeoff,
  Radar,
  Rocket,
  Ship,
  ShieldCheck,
  Target,
  type LucideIcon,
} from "lucide-react";

const FIELD_ICONS: Readonly<Record<string, LucideIcon>> = {
  HULL_CONSTRUCTION: Ship,
  MACHINERY: Cog,
  SHIP_DESIGN: PencilRuler,
  GUNNERY: Crosshair,
  FIRE_CONTROL: Target,
  TORPEDOES: Navigation2,
  SUBMARINES: Fish,
  MINES_AND_ASW: Bomb,
  AVIATION: Plane,
  CARRIER_OPERATIONS: PlaneTakeoff,
  RADAR_AND_ELECTRONICS: Radar,
  MISSILES: Rocket,
  AMPHIBIOUS_OPERATIONS: Anchor,
  INFRASTRUCTURE: Factory,
  DAMAGE_CONTROL: ShieldCheck,
};

export function fieldIcon(fieldId: string): LucideIcon {
  return FIELD_ICONS[fieldId] ?? FlaskConical;
}
