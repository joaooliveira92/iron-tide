export const ARMAMENT_BP_ONE = 10_000 as const;

export class ArmamentArithmeticOverflow extends Error {
  readonly _tag = "ArmamentArithmeticOverflow";
  constructor(
    readonly label: string,
    readonly value: bigint,
  ) {
    super(`armament arithmetic overflow in ${label}: ${value.toString()}`);
    this.name = "ArmamentArithmeticOverflow";
  }
}

export class ArmamentArithmeticInput extends Error {
  readonly _tag = "ArmamentArithmeticInput";
  constructor(
    readonly detail: string,
    readonly value: number,
  ) {
    super(`${detail}: ${String(value)}`);
    this.name = "ArmamentArithmeticInput";
  }
}

export type ArmamentArithmeticFailure = ArmamentArithmeticOverflow | ArmamentArithmeticInput;

export type ArmamentArithmeticResult<A> =
  | { readonly ok: true; readonly value: A }
  | { readonly ok: false; readonly failure: ArmamentArithmeticFailure };

export function isSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value);
}

const succeeded = <A>(value: A): ArmamentArithmeticResult<A> => ({ ok: true, value });

const failed = (failure: ArmamentArithmeticFailure): ArmamentArithmeticResult<never> => ({
  ok: false,
  failure,
});

function toSafeInt(value: bigint, label: string): ArmamentArithmeticResult<number> {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
    return failed(new ArmamentArithmeticOverflow(label, value));
  }
  return succeeded(Number(value));
}

export function composeBpMultipliers(factors: readonly number[]): ArmamentArithmeticResult<number> {
  if (factors.length === 0) return succeeded(ARMAMENT_BP_ONE);
  let numerator = 1n;
  for (const factor of factors) {
    if (!Number.isSafeInteger(factor) || factor < 0) {
      return failed(
        new ArmamentArithmeticInput(
          "armament basis-point factor must be a non-negative safe integer",
          factor,
        ),
      );
    }
    numerator *= BigInt(factor);
  }
  const denominator = BigInt(ARMAMENT_BP_ONE) ** BigInt(factors.length - 1);
  const rounded = (2n * numerator + denominator) / (2n * denominator);
  return toSafeInt(rounded, "composeBpMultipliers");
}

export function scaleByBp(value: number, factorBp: number): ArmamentArithmeticResult<number> {
  if (!Number.isSafeInteger(value) || value < 0) {
    return failed(
      new ArmamentArithmeticInput(
        "armament scale value must be a non-negative safe integer",
        value,
      ),
    );
  }
  if (!Number.isSafeInteger(factorBp) || factorBp < 0) {
    return failed(
      new ArmamentArithmeticInput(
        "armament scale factor must be a non-negative safe integer",
        factorBp,
      ),
    );
  }
  const numerator = BigInt(value) * BigInt(factorBp);
  const denominator = BigInt(ARMAMENT_BP_ONE);
  const rounded = (2n * numerator + denominator) / (2n * denominator);
  return toSafeInt(rounded, "scaleByBp");
}
