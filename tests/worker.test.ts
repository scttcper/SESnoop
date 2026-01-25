import { SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

import type { ApiIndexResponse } from '@/lib/types';

describe('api index', () => {
  it('returns the API index payload', async () => {
    const response = await SELF.fetch('http://example.com/api/');
    expect(response.status).toBe(200);
    const json = (await response.json()) as ApiIndexResponse;
    expect(json).toEqual({ name: 'Cloudflare' });
  });
});
