import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type DossierSectionId = "economy" | "military" | "diplomacy";

export interface DossierSection {
  id: DossierSectionId;
  label: string;
  text: ReactNode;
  icon: LucideIcon;
  accent: "gold" | "red" | "blue";
}
