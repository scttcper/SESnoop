import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { parseSearch, searchArray, stringifySearch } from '../src/lib/search-params';

describe('search params', () => {
  it('writes plain values and repeats keys for arrays', () => {
    expect(
      stringifySearch({ period: 30, event_types: ['Send', 'Bounce'], search: undefined }),
    ).toBe('?period=30&event_types=Send&event_types=Bounce');
    expect(stringifySearch({})).toBe('');
  });

  it('leaves tag separators readable', () => {
    expect(stringifySearch({ tags: ['category:a,b'], search: 'a&b' })).toBe(
      '?tags=category:a,b&search=a%26b',
    );
    expect(parseSearch('?tags=category:a,b')).toEqual({ tags: 'category:a,b' });
  });

  it('keeps an empty array distinct from a missing key', () => {
    expect(stringifySearch({ event_types: [] })).toBe('?event_types=');
    expect(parseSearch('?event_types=')).toEqual({ event_types: '' });
  });

  it('round-trips through the array schema', () => {
    const schema = z.object({ tags: searchArray(z.string()) });
    const parse = (search: Record<string, unknown>) =>
      schema.parse(parseSearch(stringifySearch(search)));

    expect(parse({ tags: ['category:subscription', 'a,b'] }).tags).toEqual([
      'category:subscription',
      'a,b',
    ]);
    expect(parse({ tags: ['only'] }).tags).toEqual(['only']);
    expect(parse({ tags: [] }).tags).toEqual([]);
  });

  it('reads links written with the old JSON encoding', () => {
    expect(parseSearch('?period=%2230%22&event_types=%5B%22Send%22%5D&page=2')).toEqual({
      period: '30',
      event_types: ['Send'],
      page: '2',
    });
  });
});
