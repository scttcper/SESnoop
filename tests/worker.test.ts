import { describe, expect, it } from 'vitest';

import type { ApiIndexResponse } from '@/lib/types';

import { server } from './helpers/harness';

describe('api index', () => {
  it('returns the API index payload', async () => {
    const response = await server.fetch('http://example.com/api/');
    expect(response.status).toBe(200);
    const json = (await response.json()) as ApiIndexResponse;
    expect(json).toEqual({ name: 'SESnoop' });
  });
});
