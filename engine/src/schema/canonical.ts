export function canonicalize(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) throw new Error(`canonicalize: non-integer number ${value}`);
    return value;
  }
  if (Array.isArray(value)) return value.map(sortValue);
  if (typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      if (source[key] === undefined) continue;
      out[key] = sortValue(source[key]);
    }
    return out;
  }
  throw new Error(`canonicalize: unsupported type ${typeof value}`);
}
