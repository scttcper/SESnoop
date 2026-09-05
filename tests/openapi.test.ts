import { describe, expect, it } from 'vitest';

import type { OpenApiDocument } from '@/lib/types';

import { server } from './helpers/harness';

describe('openapi docs', () => {
  it('serves an OpenAPI document', async () => {
    const response = await server.fetch('http://example.com/api/doc');
    expect(response.status).toBe(200);
    const json = (await response.json()) as OpenApiDocument;
    expect(json.openapi).toBe('3.2.0');
    expect(json.info?.title).toBe('SESnoop API');
  });
});
