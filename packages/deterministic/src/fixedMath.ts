export function integerRoot(x: bigint, n: number): bigint {
  if (x < 0n) throw new RangeError("integerRoot: x must be >= 0");
  if (!Number.isInteger(n) || n < 1) throw new RangeError("integerRoot: n must be an integer >= 1");
  if (x < 2n || n === 1) return x;
  const nb = BigInt(n);
  const bits = x.toString(2).length;
  let r = 1n << BigInt(Math.ceil(bits / n));
  for (;;) {
    const next = ((nb - 1n) * r + x / r ** (nb - 1n)) / nb;
    if (next >= r) return r;
    r = next;
  }
}

export function powRational(x: bigint, p: number, q: number): bigint {
  if (!Number.isInteger(p) || p < 0) throw new RangeError("powRational: p must be an integer >= 0");
  if (p === 0) return 1n;
  return integerRoot(x ** BigInt(p), q);
}
