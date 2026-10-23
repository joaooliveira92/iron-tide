import type {
  CampaignCommandClient,
  CampaignCommandMap,
  CampaignCommandName,
} from "../../shared/campaign-contract.js";
import {
  BRIDGE_UNAVAILABLE_MESSAGE,
  describeTransportFailure,
  foldBridgeResult,
} from "./bridge-read.js";

export type ReadQueryName = {
  [Name in CampaignCommandName]: CampaignCommandMap[Name]["payload"] extends string ? Name : never;
}[CampaignCommandName];

export type ReadQueryValue<Name extends ReadQueryName> = CampaignCommandMap[Name]["result"];

export type ReadResult<Value> =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly value: Value }
  | { readonly status: "unavailable"; readonly reason: string };

export type SettledRead<Value> = Exclude<ReadResult<Value>, { readonly status: "loading" }>;

interface Slot {
  readonly revision: number;
  readonly settled: Promise<SettledRead<unknown>>;
}

const slotsByClient = new WeakMap<object, Map<string, Slot>>();

function slotsFor(client: object): Map<string, Slot> {
  const existing = slotsByClient.get(client);
  if (existing !== undefined) return existing;
  const created = new Map<string, Slot>();
  slotsByClient.set(client, created);
  return created;
}

function slotKey(sessionId: string, query: ReadQueryName): string {
  return `${sessionId}\u0000${query}`;
}

async function fetchQuery<Name extends ReadQueryName>(
  client: CampaignCommandClient,
  query: Name,
  sessionId: string,
): Promise<SettledRead<ReadQueryValue<Name>>> {
  try {
    return foldBridgeResult(
      await client.execute(query, sessionId as CampaignCommandMap[Name]["payload"]),
    );
  } catch (error) {
    return { status: "unavailable", reason: describeTransportFailure(error) };
  }
}

export function readQuery<Name extends ReadQueryName>(
  client: CampaignCommandClient | undefined,
  query: Name,
  sessionId: string,
  revision: number | null,
): Promise<SettledRead<ReadQueryValue<Name>>> {
  if (client === undefined) {
    return Promise.resolve({ status: "unavailable", reason: BRIDGE_UNAVAILABLE_MESSAGE });
  }
  if (revision === null) return fetchQuery(client, query, sessionId);
  const slots = slotsFor(client);
  const key = slotKey(sessionId, query);
  const existing = slots.get(key);
  if (existing !== undefined && existing.revision === revision) {
    return existing.settled as Promise<SettledRead<ReadQueryValue<Name>>>;
  }
  const settled = fetchQuery(client, query, sessionId).then((read) => {
    if (read.status !== "ready" && slots.get(key)?.settled === settled) slots.delete(key);
    return read;
  });
  slots.set(key, { revision, settled });
  return settled;
}

export function primeQuery<Name extends ReadQueryName>(
  client: CampaignCommandClient,
  query: Name,
  sessionId: string,
  revision: number,
  value: ReadQueryValue<Name>,
): void {
  slotsFor(client).set(slotKey(sessionId, query), {
    revision,
    settled: Promise.resolve({ status: "ready", value }),
  });
}

export function invalidateQuery(
  client: CampaignCommandClient | undefined,
  query: ReadQueryName,
  sessionId: string,
): void {
  if (client === undefined) return;
  slotsFor(client).delete(slotKey(sessionId, query));
}
