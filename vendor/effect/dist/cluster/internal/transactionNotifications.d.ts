import * as Context from "../../Context.ts";
import type * as Effect from "../../Effect.ts";
import type { MalformedMessage, PersistenceError } from "../ClusterError.ts";
export declare const TransactionNotifications: Context.Reference<Effect.Effect<void, MalformedMessage | PersistenceError, never>[] | undefined>;
//# sourceMappingURL=transactionNotifications.d.ts.map