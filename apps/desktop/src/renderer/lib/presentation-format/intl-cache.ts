type PrimitiveOptions = Record<string, string | number | boolean | undefined>;

function cacheKey(locale: string, options: PrimitiveOptions | undefined): string {
  if (options === undefined) return locale;
  const parts: string[] = [];
  for (const name of Object.keys(options).sort()) {
    const value = options[name];
    if (value === undefined) continue;
    parts.push(`${name}=${String(value)}`);
  }
  return parts.length === 0 ? locale : `${locale}|${parts.join(";")}`;
}

const numberFormatters = new Map<string, Intl.NumberFormat>();
const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>();
const listFormatters = new Map<string, Intl.ListFormat>();

export function cachedNumberFormat(
  locale: string,
  options?: Intl.NumberFormatOptions,
): Intl.NumberFormat {
  const key = cacheKey(locale, options as PrimitiveOptions | undefined);
  const existing = numberFormatters.get(key);
  if (existing !== undefined) return existing;
  const created = new Intl.NumberFormat(locale, options);
  numberFormatters.set(key, created);
  return created;
}

export function cachedDateTimeFormat(
  locale: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = cacheKey(locale, options as PrimitiveOptions);
  const existing = dateTimeFormatters.get(key);
  if (existing !== undefined) return existing;
  const created = new Intl.DateTimeFormat(locale, options);
  dateTimeFormatters.set(key, created);
  return created;
}

export function cachedListFormat(locale: string, options: Intl.ListFormatOptions): Intl.ListFormat {
  const key = cacheKey(locale, options as PrimitiveOptions);
  const existing = listFormatters.get(key);
  if (existing !== undefined) return existing;
  const created = new Intl.ListFormat(locale, options);
  listFormatters.set(key, created);
  return created;
}
