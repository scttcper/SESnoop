import { SELF } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'

describe('api index', () => {
  it('returns the API index payload', async () => {
    const response = await SELF.fetch('http://example.com/api/')
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json).toEqual({ name: 'Cloudflare' })
  })
})
