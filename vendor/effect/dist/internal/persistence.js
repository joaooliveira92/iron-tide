/** @internal */
export const sqlCleanupBatchSize = 1000;
/**
 * Percent-encodes `%` and `:` so the result contains no `:` and distinct inputs
 * stay distinct.
 *
 * @internal
 */
export const escapeKeySegment = segment => segment.replace(/%/g, "%25").replace(/:/g, "%3A");
/**
 * Key prefix for a persistence store. The store id is escaped so the namespace
 * always ends at its first `:`, and distinct store / key pairs never collide.
 *
 * @internal
 */
export const storeNamespace = storeId => `${escapeKeySegment(storeId)}:`;
/** @internal */
export const escapeRedisGlob = pattern => pattern.replace(/[\\*?[\]]/g, "\\$&");
//# sourceMappingURL=persistence.js.map