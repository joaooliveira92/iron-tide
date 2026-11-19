import { useBridge } from "./bridge-context.js";
import {
  invalidateQuery,
  readQuery,
  type ReadQueryName,
  type ReadQueryValue,
  type ReadResult,
} from "./read-queries.js";
import { useStoreLifecycle } from "./use-store-lifecycle.js";

export interface UseReadOptions {
  readonly enabled?: boolean;
  readonly refreshToken?: number;
}

export function useRead<Name extends ReadQueryName>(
  query: Name,
  sessionId: string,
  revision: number | null,
  options: UseReadOptions = {},
): ReadResult<ReadQueryValue<Name>> {
  const client = useBridge()?.campaign;
  const enabled = options.enabled ?? true;
  const refreshToken = options.refreshToken ?? 0;

  const [state] = useStoreLifecycle<ReadResult<ReadQueryValue<Name>>>(
    () => ({ status: "loading" }),
    (target) => {
      if (!enabled) return;
      let active = true;
      if (refreshToken > 0) invalidateQuery(client, query, sessionId);
      void readQuery(client, query, sessionId, revision).then((read) => {
        if (active) target.set(read);
      });
      return () => {
        active = false;
      };
    },
    [client, query, sessionId, revision, enabled, refreshToken],
  );

  return state;
}
