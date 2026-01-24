import { SELF } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'

import type { Source } from '@/db/schema'
import type { SetupInfo } from '@/routes/sources/sources.routes'
import type { ValidationErrorResponse } from '@/lib/types'
import { insertSource, resetDb } from './helpers/db'

beforeEach(async () => {
  await resetDb()
})

describe('sources routes', () => {
  it('lists sources', async () => {
    await insertSource({ id: 1, name: 'Alpha', token: 'alpha-token' })

    const response = await SELF.fetch('http://example.com/api/sources')
    expect(response.status).toBe(200)
    const json = (await response.json()) as Source[]
    expect(json).toHaveLength(1)
    expect(json[0]?.name).toBe('Alpha')
  })

  it('creates a source with defaults', async () => {
    const response = await SELF.fetch('http://example.com/api/sources', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'New Source' }),
    })
    expect(response.status).toBe(200)
    const json = (await response.json()) as Source
    expect(json.name).toBe('New Source')
    expect(json.color).toBe('blue')
    expect(json.token).toBeTypeOf('string')
  })

  it('validates source creation payloads', async () => {
    const response = await SELF.fetch('http://example.com/api/sources', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(response.status).toBe(422)
  })

  it('gets a source by id', async () => {
    await insertSource({ id: 1, name: 'Bravo', token: 'bravo-token' })
    const response = await SELF.fetch('http://example.com/api/sources/1')
    expect(response.status).toBe(200)
    const json = (await response.json()) as Source
    expect(json.name).toBe('Bravo')
  })

  it('returns 404 for missing sources', async () => {
    const response = await SELF.fetch('http://example.com/api/sources/999')
    expect(response.status).toBe(404)
  })

  it('returns 422 for invalid source ids', async () => {
    const response = await SELF.fetch('http://example.com/api/sources/nope')
    expect(response.status).toBe(422)
  })

  it('rejects empty source updates', async () => {
    await insertSource({ id: 1, name: 'Charlie', token: 'charlie-token' })
    const response = await SELF.fetch('http://example.com/api/sources/1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(response.status).toBe(422)
    const json = (await response.json()) as ValidationErrorResponse
    expect(json.success).toBe(false)
  })

  it('updates a source', async () => {
    await insertSource({ id: 1, name: 'Delta', token: 'delta-token' })
    const response = await SELF.fetch('http://example.com/api/sources/1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Delta Updated', retention_days: 30 }),
    })
    expect(response.status).toBe(200)
    const json = (await response.json()) as Source
    expect(json.name).toBe('Delta Updated')
    expect(json.retention_days).toBe(30)
  })

  it('deletes a source', async () => {
    await insertSource({ id: 1, name: 'Echo', token: 'echo-token' })
    const response = await SELF.fetch('http://example.com/api/sources/1', {
      method: 'DELETE',
    })
    expect(response.status).toBe(204)
  })

  it('returns setup guidance', async () => {
    await insertSource({ id: 1, name: 'My Source', token: 'tok-1' })
    const response = await SELF.fetch('http://example.com/api/sources/1/setup')
    expect(response.status).toBe(200)
    const json = (await response.json()) as SetupInfo
    expect(json.configuration_set_name).toBe('sesnoop-my-source-config')
    expect(json.sns_topic_name).toBe('sesnoop-my-source-sns')
    expect(json.webhook_url).toBe('http://example.com/webhooks/tok-1')
    expect(json.steps).toHaveLength(4)
  })
})
