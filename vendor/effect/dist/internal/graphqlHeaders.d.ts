import type * as Duration from "../Duration.ts";
import * as Headers from "../http/Headers.ts";
import * as Schema from "../Schema.ts";
export declare const HeadersSchema: Schema.decodeTo<Schema.declare<Headers.Headers, Headers.Headers>, Schema.$Record<Schema.String, Schema.String>, never, never>;
/**
 * Parses a `Retry-After` header value, either whole seconds or an HTTP date,
 * into a `Duration` measured from `now` (epoch milliseconds). Anything else,
 * such as `1.5` or `-1`, yields `undefined`.
 */
export declare const parseRetryAfter: (value: string | undefined, now: number) => Duration.Duration | undefined;
//# sourceMappingURL=graphqlHeaders.d.ts.map