//packages/random/src/engine.ts
import type { Brand } from "@bluewave/contracts";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { drawFromSeed, splitSeed } from "./seeded-prng.js";

export type RandomSeed = Brand<string, "RandomSeed">;

export interface RandomStream {
  readonly id: string;
  next(): number;
}

class RandomStreamImpl implements RandomStream {
  private counter = 0;

  constructor(
    readonly id: string,
    private seed: string,
  ) {}

  next(): number {
    const subSeed = splitSeed(this.seed, String(this.counter));
    this.counter++;
    return drawFromSeed(subSeed);
  }
}

export class RandomEngine {
  constructor(private masterSeed: string) {}

  stream(domain: string): RandomStream {
    const subSeed = splitSeed(this.masterSeed, domain);
    return new RandomStreamImpl(domain, subSeed);
  }
}

export interface RandomDecision {
  streamId: string;
  entityKey: string;
  phase: string;
  rulesetVersion: string;
  inputHash: string;
  draw: number;
  outcome: string;
  reasonCode: string;
}

export class RandomLedger {
  private decisions: RandomDecision[] = [];

  record(decision: RandomDecision): void {
    this.decisions.push(decision);
  }

  get all(): readonly RandomDecision[] {
    return this.decisions;
  }

  hash(): string {
    return sha256Hex(canonicalSerialize(this.decisions));
  }

  toJSON(): string {
    return canonicalSerialize(this.decisions);
  }
}

export function drawUniform(stream: RandomStream, min: SafeInt, max: SafeInt): SafeInt {
  const f = stream.next();
  const range = SafeInt.sub(max, min);
  const inclusiveRange = SafeInt.add(range, SafeInt.ONE);
  const scaled = Math.floor(f * (inclusiveRange as number));
  return SafeInt.add(min, SafeInt(scaled));
}

export function drawBoolean(stream: RandomStream): boolean {
  return stream.next() < 0.5;
}
