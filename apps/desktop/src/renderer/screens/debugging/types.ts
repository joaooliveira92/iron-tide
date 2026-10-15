import type { CompiledDesignVersion } from "@bluewave/campaign-engine";

export interface CompiledRecord {
  readonly id: string;
  readonly kind: string;
  readonly data: CompiledDesignVersion;
}

export type OutcomeFilter = "all" | "success" | "rejected";
