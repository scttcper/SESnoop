import { SELF } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'

describe('openapi docs', () => {
  it('serves an OpenAPI document', async () => {
    const response = await SELF.fetch('http://example.com/api/doc')
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.openapi).toBe('3.0.0')
    expect(json.info?.title).toBe('SESnoop API')
  })
})
