export interface DebugModeEnv {
  readonly flag: string | undefined;
}

export function isDebugMode(env: DebugModeEnv): boolean {
  return env.flag === "true";
}
