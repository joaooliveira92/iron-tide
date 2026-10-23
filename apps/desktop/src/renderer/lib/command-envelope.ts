export interface CommandStamp {
  readonly expectedRevision: number;
  readonly transportRequestId: string;
}

export interface CommandEnvelope extends CommandStamp {
  readonly sessionId: string;
}

export type TransportIdSource = (prefix: string) => string;

let transportCounter = 0;

export function createTransportRequestId(prefix: string): string {
  transportCounter++;
  return `${prefix}-${Date.now().toString(36)}-${transportCounter}`;
}

export function stampCommand(
  prefix: string,
  expectedRevision: number,
  nextId: TransportIdSource = createTransportRequestId,
): CommandStamp {
  return { expectedRevision, transportRequestId: nextId(prefix) };
}

export function envelopeOf(sessionId: string, stamp: CommandStamp): CommandEnvelope {
  return {
    sessionId,
    expectedRevision: stamp.expectedRevision,
    transportRequestId: stamp.transportRequestId,
  };
}

export interface MissingRequiredId {
  readonly _tag: "MissingRequiredId";
  readonly field: string;
}

export type RequiredIds<Field extends string> =
  | { readonly _tag: "Ready"; readonly ids: Record<Field, string> }
  | MissingRequiredId;

export function requireIds<Field extends string>(
  candidates: Record<Field, string | null | undefined>,
): RequiredIds<Field> {
  const ids = {} as Record<Field, string>;
  for (const field of Object.keys(candidates) as Field[]) {
    const value = candidates[field];
    if (value === null || value === undefined || value === "") {
      return { _tag: "MissingRequiredId", field };
    }
    ids[field] = value;
  }
  return { _tag: "Ready", ids };
}
