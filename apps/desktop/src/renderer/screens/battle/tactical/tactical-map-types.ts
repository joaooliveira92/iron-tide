export type NameFilter = "all" | "selected" | "none";

export interface StandingCourse {
  readonly shipId: string;
  readonly headingDeg: number;
}

export interface MapOverlays {
  readonly labels: NameFilter;
  readonly tracks: boolean;
  readonly rings: boolean;
  readonly fire: boolean;
}

export interface CoursePreview {
  readonly shipId: string;
  readonly headingDeg: number;
}

export type OverlayKey = "tracks" | "rings" | "fire";
