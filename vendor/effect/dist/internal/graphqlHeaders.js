import * as Headers from "../http/Headers.js";
import * as Result from "../Result.js";
import * as Schema from "../Schema.js";
import * as SchemaGetter from "../SchemaGetter.js";
// Keep headers branded at runtime while encoding only their string entries.
export const HeadersSchema = /*#__PURE__*/Schema.Record(Schema.String, Schema.String).pipe(/*#__PURE__*/Schema.decodeTo(/*#__PURE__*/Schema.declare(Headers.isHeaders), {
  decode: /*#__PURE__*/SchemaGetter.transform(Headers.fromInput),
  encode: /*#__PURE__*/SchemaGetter.transform(headers => ({
    ...headers
  }))
}));
/**
 * Parses a `Retry-After` header value, either whole seconds or an HTTP date,
 * into a `Duration` measured from `now` (epoch milliseconds). Anything else,
 * such as `1.5` or `-1`, yields `undefined`.
 */
export const parseRetryAfter = (value, now) => {
  if (value === undefined) return undefined;
  const retryAfter = Headers.parseRetryAfter(value);
  return Result.isSuccess(retryAfter) ? Headers.retryAfterDelay(retryAfter.success, now) : undefined;
};
//# sourceMappingURL=graphqlHeaders.js.map