import type { DesignDraft, WorkshopView } from "@bluewave/ship-design";
import type { PlanModel } from "../planModel.js";
import type { Flat, SolidPaths, Tone } from "./iso.js";

export type Fill = "paper" | "face" | "ink" | "boot" | "under";

export interface AnatomySolid {
  readonly paths: SolidPaths;
  readonly tone: Tone;
  readonly crease: Tone | "none";
  readonly fill: Fill;
  readonly flat: boolean;
}

export interface AnatomyLine {
  readonly d: string;
  readonly tone: Tone | "ink";
  readonly dotted?: boolean;
  readonly heavy?: boolean;
}

export interface AnatomyDot {
  readonly x: number;
  readonly y: number;
  readonly r: number;
  readonly tone: Tone;
}

export interface AnatomyInk {
  readonly d: string;
  readonly tone?: "ink" | "glass" | "shadow";
}

export interface AnatomyPart {
  readonly id: string;
  readonly label: string;
  readonly solids: readonly AnatomySolid[];
  readonly inks: readonly AnatomyInk[];
  readonly lines: readonly AnatomyLine[];
  readonly dots: readonly AnatomyDot[];
  readonly halo?: string;
}

export interface AnatomyAnchor {
  readonly at: Flat;
  readonly radius: number;
}

export interface AnatomyShip {
  readonly width: number;
  readonly height: number;
  readonly label: string;
  readonly azimuth: number;
  readonly parts: readonly AnatomyPart[];
  readonly anchors: ReadonlyMap<string, AnatomyAnchor>;
  readonly facts: ReadonlyMap<string, string>;
}

export interface AnatomyInput {
  readonly draft: DesignDraft;
  readonly view: WorkshopView;
  readonly model: Pick<
    PlanModel,
    | "form"
    | "frame"
    | "superstructure"
    | "placedFunnels"
    | "visualMounts"
    | "targets"
    | "entryOf"
    | "mountNames"
    | "look"
  >;
  readonly azimuth: number;
  readonly width?: number;
  readonly height?: number;
}

export interface Reach {
  readonly bow: number;
  readonly stern: number;
}

export interface PartDraft {
  id: string;
  label: string;
  solids: AnatomySolid[];
  inks: AnatomyInk[];
  lines: AnatomyLine[];
  dots: AnatomyDot[];
  halo?: string;
}

export interface AnchorDraft {
  at: Flat;
  radius: number;
}
