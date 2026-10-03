import { z } from 'zod';

// Plain query strings instead of the router's JSON encoding:
// `?period=30&event_types=Send&event_types=Bounce` rather than `?period=%2230%22`.
// An empty array is written as `key=` so it stays distinct from a missing key.

// Links shared before this format JSON-encoded values like `"30"` and `["Send"]`.
const parseLegacyValue = (value: string): unknown => {
  if (!value.startsWith('"') && !value.startsWith('[')) {
    return value;
  }
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
};

export const parseSearch = (searchStr: string): Record<string, unknown> => {
  const params = new URLSearchParams(searchStr.startsWith('?') ? searchStr.slice(1) : searchStr);
  const result: Record<string, unknown> = {};
  for (const key of new Set(params.keys())) {
    const values = params.getAll(key);
    result[key] = values.length > 1 ? values : parseLegacyValue(values[0] ?? '');
  }
  return result;
};

export const stringifySearch = (search: Record<string, unknown>): string => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (value === undefined || value === null) {
      continue;
    }
    if (Array.isArray(value)) {
      if (value.length === 0) {
        params.append(key, '');
      }
      for (const item of value) {
        params.append(key, String(item));
      }
      continue;
    }
    params.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
  }
  // `:` and `,` are valid in a query string; leaving them readable keeps tags like
  // `category:subscription` legible.
  const searchStr = params.toString().replaceAll('%3A', ':').replaceAll('%2C', ',');
  return searchStr ? `?${searchStr}` : '';
};

/** Accepts a repeated key, a single value, or an empty `key=` as an array. */
export const searchArray = <T extends z.ZodType>(item: T) =>
  z.union([z.array(item), z.literal(''), item]).transform((value): Array<z.output<T>> => {
    if (value === '') {
      return [];
    }
    return Array.isArray(value) ? value : [value as z.output<T>];
  });
