export type PlanToolMode = "off" | "place" | "move";

export interface PlanTool {
  readonly mode: PlanToolMode;
  readonly componentId: string;
  readonly instanceId: string;
}

export const IDLE_TOOL: PlanTool = {
  mode: "off",
  componentId: "",
  instanceId: "",
};
