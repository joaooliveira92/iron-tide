import type { LucideIcon } from "lucide-react";
import { Anchor, Plane, Sailboat, Ship, Waves } from "lucide-react";

const SHIP_TYPE_ICONS: Record<string, LucideIcon> = {
  battleship: Anchor,
  battlecruiser: Anchor,
  cruiser: Ship,
  destroyer: Sailboat,
  "pre-dreadnought": Anchor,
  "armoured cruiser": Ship,
  "protected cruiser": Ship,
  corvette: Sailboat,
  "armed merchant cruiser": Ship,
  submarine: Waves,
  carrier: Plane,
  BB: Anchor,
  B: Anchor,
  CA: Ship,
  CL: Ship,
  DD: Sailboat,
  KE: Sailboat,
  AMC: Ship,
};

export function shipTypeIcon(shipType: string): LucideIcon {
  return SHIP_TYPE_ICONS[shipType] ?? Ship;
}
