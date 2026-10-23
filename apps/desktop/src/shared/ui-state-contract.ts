export interface UiStateFirstMonthInspection {
  readonly status: "not_started" | "in_progress" | "completed" | "dismissed";
  readonly lastCompletedStep: number;
}

export interface UiStateInspectorLayout {
  readonly widthPx: number;
  readonly collapsed: boolean;
}

export const INSPECTOR_MIN_WIDTH_PX = 360;
export const INSPECTOR_MAX_WIDTH_PX = 560;

export interface UiStateTurnMessages {
  readonly pinnedIds: readonly string[];
  readonly readIds: readonly string[];
}

export interface UiState {
  readonly turnNumber: number;
  readonly dismissedFingerprints: readonly string[];
  readonly firstMonthInspection?: UiStateFirstMonthInspection;
  readonly inspector?: UiStateInspectorLayout;
  readonly turnMessages?: UiStateTurnMessages;
}

export interface UiStatePatch {
  readonly dismissedFingerprints?: readonly string[];
  readonly firstMonthInspection?: UiStateFirstMonthInspection;
  readonly inspector?: UiStateInspectorLayout;
  readonly turnMessages?: UiStateTurnMessages;
}

export interface ReadUiStateResult {
  readonly uiState: UiState;
}

export interface WriteUiStateResult {
  readonly uiState: UiState;
}
