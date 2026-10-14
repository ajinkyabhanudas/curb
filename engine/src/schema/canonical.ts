export function canonicalize(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) throw new Error(`canonicalize: non-integer number ${value}`);
    if (!Number.isSafeInteger(value)) throw new Error(`canonicalize: unsafe integer ${value}`);
    return value;
  }
  if (Array.isArray(value)) return value.map(sortValue);
  if (typeof value === 'object') {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      throw new Error('canonicalize: unsupported object (only plain objects are allowed)');
    }
    const source = value as Record<string, unknown>;
    // defineProperty, not assignment: assigning "__proto__" would set the prototype and drop the key.
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      if (source[key] === undefined) continue;
      Object.defineProperty(out, key, {
        value: sortValue(source[key]),
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
    return out;
  }
  throw new Error(`canonicalize: unsupported type ${typeof value}`);
}
