/** The plan tools and their state, kept apart from the toolbar that renders them. */
export type PlanToolMode = "off" | "place" | "move";

export interface PlanTool {
  readonly mode: PlanToolMode;
  /** Component to place (place mode). */
  readonly componentId: string;
  /** Fitting to move (move mode). */
  readonly instanceId: string;
}

export const IDLE_TOOL: PlanTool = {
  mode: "off",
  componentId: "",
  instanceId: "",
};
