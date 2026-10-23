import { useEffect, useState } from "react";

import { useBridge } from "./bridge-context.js";
import {
  invalidateQuery,
  readQuery,
  type ReadQueryName,
  type ReadQueryValue,
  type ReadResult,
} from "./read-queries.js";

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
  const [state, setState] = useState<ReadResult<ReadQueryValue<Name>>>({ status: "loading" });
  const client = useBridge()?.campaign;
  const enabled = options.enabled ?? true;
  const refreshToken = options.refreshToken ?? 0;

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    if (refreshToken > 0) invalidateQuery(client, query, sessionId);
    void readQuery(client, query, sessionId, revision).then((read) => {
      if (active) setState(read);
    });
    return () => {
      active = false;
    };
  }, [client, query, sessionId, revision, enabled, refreshToken]);

  return state;
}
