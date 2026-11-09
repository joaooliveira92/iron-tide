import * as Duration from "../../Duration.js";
import * as Effect from "../../Effect.js";
import * as Base64Url from "../../encoding/Base64Url.js";
import * as Option from "../../Option.js";
import * as Redacted from "../../Redacted.js";
import * as Result from "../../Result.js";
import * as Schema from "../../Schema.js";
import * as JoseError from "../JoseError.js";
/** @internal */
export const fail = reason => Effect.fail(new JoseError.JoseError({
  reason
}));
/** @internal */
export const invalidToken = description => fail(new JoseError.InvalidToken({
  description
}));
/** @internal */
export const invalidKey = (description, cause) => fail(new JoseError.InvalidKey({
  description,
  cause
}));
/** @internal */
export const invalidArgument = (description, cause) => fail(new JoseError.InvalidArgument({
  description,
  cause
}));
/**
 * Maps a failure of an operation on secret material, such as signing or
 * private-key import, to a fixed description. Backend messages and causes may
 * describe the secret, so they are dropped.
 *
 * @internal
 */
export const cryptoFailure = description => _ => new JoseError.JoseError({
  reason: new JoseError.InvalidKey({
    description
  })
});
/**
 * Maps a public-key import failure, keeping the backend diagnostic.
 *
 * @internal
 */
export const publicKeyFailure = error => new JoseError.JoseError({
  reason: new JoseError.InvalidKey({
    description: error.message,
    cause: error
  })
});
/**
 * Schema fields that keep private and symmetric key members out of a public
 * JWK.
 *
 * @internal
 */
export const noPrivateMembers = {
  d: /*#__PURE__*/Schema.optionalKey(Schema.Never),
  p: /*#__PURE__*/Schema.optionalKey(Schema.Never),
  q: /*#__PURE__*/Schema.optionalKey(Schema.Never),
  dp: /*#__PURE__*/Schema.optionalKey(Schema.Never),
  dq: /*#__PURE__*/Schema.optionalKey(Schema.Never),
  qi: /*#__PURE__*/Schema.optionalKey(Schema.Never),
  oth: /*#__PURE__*/Schema.optionalKey(Schema.Never),
  k: /*#__PURE__*/Schema.optionalKey(Schema.Never)
};
/** @internal */
export const hasPrivateMembers = jwk => Object.keys(noPrivateMembers).some(name => Object.hasOwn(jwk, name));
/** @internal */
export const utf8 = text => new TextEncoder().encode(text);
/** @internal */
export const reveal = token => Redacted.isRedacted(token) ? Redacted.value(token) : token;
/**
 * Checks unpadded base64url, including the unused bits in the final character.
 *
 * @internal
 */
export const isCanonicalSegment = segment => {
  if (/[^A-Za-z0-9_-]/.test(segment)) return false;
  const remainder = segment.length % 4;
  const last = segment.charAt(segment.length - 1);
  return remainder === 0 || (remainder === 2 ? "AQgw".includes(last) : remainder === 3 && "AEIMQUYcgkosw048".includes(last));
};
/**
 * Decodes canonical unpadded base64url.
 *
 * @internal
 */
export const decodeSegment = segment => {
  if (!isCanonicalSegment(segment)) return undefined;
  const decoded = Base64Url.decode(segment);
  return Result.isSuccess(decoded) ? decoded.success : undefined;
};
/** @internal */
export const parseJsonObject = bytes => {
  try {
    const value = JSON.parse(new TextDecoder("utf-8", {
      fatal: true
    }).decode(bytes));
    return typeof value === "object" && value !== null && !Array.isArray(value) ? value : undefined;
  } catch {
    return undefined;
  }
};
/**
 * Splits a compact serialization into exactly `count` segments.
 *
 * @internal
 */
export const split = (token, count) => {
  const parts = reveal(token).split(".");
  return parts.length === count ? Effect.succeed(parts) : invalidToken(`A compact serialization must have ${count} segments`);
};
/**
 * Decodes a protected header. Parameters in `unsupported` change how the
 * token is processed, so they are rejected rather than ignored.
 *
 * @internal
 */
export const decodeHeader = (segment, decode, unsupported) => {
  const bytes = decodeSegment(segment);
  const json = bytes === undefined ? undefined : parseJsonObject(bytes);
  if (json === undefined) return invalidToken("The protected header is not a base64url JSON object");
  for (const name of unsupported) {
    if (Object.hasOwn(json, name)) return invalidToken(`The ${name} header parameter is not supported`);
  }
  return Option.match(decode(json), {
    onNone: () => invalidToken("The protected header has unsupported or malformed parameters"),
    onSome: Effect.succeed
  });
};
/**
 * Base64url-encodes a protected header. Fixed parameters come first and
 * cannot be overridden by additional parameters.
 *
 * @internal
 */
export const encodeHeader = (fixed, kid, header, unsupported) => {
  for (const name of unsupported) {
    if (header !== undefined && Object.hasOwn(header, name)) {
      return invalidArgument(`The ${name} header parameter is not supported`);
    }
  }
  const {
    kid: headerKid,
    ...rest
  } = header ?? {};
  const value = {
    ...fixed,
    kid: headerKid ?? kid,
    ...rest,
    ...fixed
  };
  try {
    return Effect.succeed(Base64Url.encode(JSON.stringify(value)));
  } catch {
    return invalidArgument("The protected header is not JSON serializable");
  }
};
/**
 * Reads a finite, non-negative duration in milliseconds.
 *
 * @internal
 */
export const millis = (name, input) => {
  const value = hasInvalidComponent(input) ? Option.none() : Option.map(Duration.fromInput(input), Duration.toMillis);
  return Option.isSome(value) && Number.isFinite(value.value) && value.value >= 0 ? Effect.succeed(value.value) : invalidArgument(`${name} must be a finite, non-negative duration`);
};
// `Duration` reads NaN as zero in every input form, and components that are
// not finite or overflow on conversion add up to NaN. Either would silently
// disable a bound.
const hasInvalidComponent = input => {
  if (typeof input === "number") return Number.isNaN(input);
  if (typeof input !== "object" || Duration.isDuration(input)) return false;
  if (Array.isArray(input)) return input.some(component => !Number.isFinite(component));
  return Object.entries(input).some(([unit, component]) => typeof component === "number" && (!Number.isFinite(component) || !Number.isFinite(Duration.toMillis({
    [unit]: component
  }))));
};
//# sourceMappingURL=compact.js.map