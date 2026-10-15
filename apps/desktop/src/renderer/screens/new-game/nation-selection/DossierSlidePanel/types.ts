import type { LucideIcon } from "lucide-react";

export type AccentColor = "gold" | "red" | "blue";

export interface FlavorSummaryProps {
  icon: LucideIcon;
  label: string;
  text: string;
  accentColor: AccentColor;
}
