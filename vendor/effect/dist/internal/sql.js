import { Clock } from "../Clock.js";
import * as Context from "../Context.js";
import { TracerTimingEnabled } from "./references.js";
/**
 * The transaction service of the innermost transaction started with
 * `SqlClient.makeWithTransaction`. `SqlResolver` reads it to find that
 * transaction when the request's context has no `SqlClient` for it. Removing
 * the service from a context also hides the transaction from this lookup.
 *
 * @internal
 */
export const CurrentTransactionService = /*#__PURE__*/Context.Reference("effect/sql/CurrentTransactionService", {
  defaultValue: () => undefined
});
/**
 * The clock to measure connection wait time with, or `undefined` without span
 * timing, when the span has no start time to measure from.
 *
 * @internal
 */
export const waitClock = fiber => fiber.getRef(TracerTimingEnabled) ? fiber.getRef(Clock) : undefined;
/**
 * Records the time from the span's start to the connection hand-off as
 * `db.client.connection.wait_time_ms`.
 *
 * @internal
 */
export const recordConnectionWait = (span, clock) => span.attribute("db.client.connection.wait_time_ms", Number(clock.currentTimeNanosUnsafe() - span.status.startTime) / 1e6);
//# sourceMappingURL=sql.js.map