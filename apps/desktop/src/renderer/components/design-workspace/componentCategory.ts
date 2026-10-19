import type { ComponentCategory } from "@bluewave/ship-design";
import type { LucideIcon } from "lucide-react";
import {
  BedDouble,
  Bomb,
  CircleDot,
  Cog,
  Crosshair,
  Fan,
  Flame,
  Fuel,
  Layers,
  LifeBuoy,
  Package,
  Plane,
  Radar,
  Radio,
  RadioTower,
  Rocket,
  Ship,
  Shield,
  Target,
  Telescope,
  Waves,
  Wrench,
  Zap,
} from "lucide-react";

export interface ComponentCategoryMeta {
  /** The lucide icon that stands for the category. */
  readonly icon: LucideIcon;
  /** One line explaining what the category is, for a select option's secondary text. */
  readonly description: string;
}

const CATEGORY_META = {
  HULL_FORM: { icon: Ship, description: "Hull shape and form." },
  MATERIAL: { icon: Layers, description: "Structural material." },
  BOILER: { icon: Flame, description: "Steam-raising boiler." },
  ENGINE: { icon: Cog, description: "Propulsion engine." },
  SHAFT_PROPELLER: { icon: Fan, description: "Shafting and propeller." },
  FUEL_BUNKER: { icon: Fuel, description: "Coal or oil bunkerage." },
  GENERATOR: { icon: Zap, description: "Auxiliary electrical generation." },
  MAIN_GUN: { icon: Crosshair, description: "Main-battery gun." },
  SECONDARY_GUN: { icon: Target, description: "Secondary and light gun." },
  TERTIARY_GUN: { icon: Target, description: "Light anti-torpedo-boat gun." },
  DUAL_PURPOSE_GUN: { icon: Crosshair, description: "Dual-purpose gun: surface and air." },
  AA_WEAPON: { icon: Target, description: "Anti-aircraft weapon." },
  TORPEDO_TUBE: { icon: Rocket, description: "Torpedo tube." },
  MINE_GEAR: { icon: Bomb, description: "Mines and minelaying gear." },
  AIRCRAFT_FACILITY: { icon: Plane, description: "Aviation facility." },
  MISSILE_LAUNCHER: { icon: Rocket, description: "Guided-missile launcher." },
  MOUNT: { icon: CircleDot, description: "Weapon mount." },
  MAGAZINE: { icon: Package, description: "Shell and charge magazine." },
  AMMUNITION: { icon: Bomb, description: "Projectiles and charges." },
  ARMOUR_SCHEME: { icon: Shield, description: "Armour protection scheme." },
  UNDERWATER_PROTECTION: { icon: Waves, description: "Underwater protection." },
  DIRECTOR: { icon: Telescope, description: "Fire-control director." },
  RANGEFINDER: { icon: Telescope, description: "Optical rangefinder." },
  RADAR: { icon: Radar, description: "Radio detection and ranging." },
  SONAR: { icon: Radio, description: "Underwater detection." },
  COMMS: { icon: RadioTower, description: "Wireless and signals." },
  SPECIAL_EQUIPMENT: { icon: Wrench, description: "Funnels, ventilation and special equipment." },
  DAMAGE_CONTROL: { icon: LifeBuoy, description: "Pumps, flooding and firefighting gear." },
  ACCOMMODATION: { icon: BedDouble, description: "Crew living space." },
} as const satisfies Record<ComponentCategory, ComponentCategoryMeta>;

const FALLBACK: ComponentCategoryMeta = { icon: Package, description: "Ship component." };

/** The icon and one-line description for a component's category; an unknown category falls back. */
export function componentCategoryMeta(category: string): ComponentCategoryMeta {
  return (CATEGORY_META as Record<string, ComponentCategoryMeta>)[category] ?? FALLBACK;
}
