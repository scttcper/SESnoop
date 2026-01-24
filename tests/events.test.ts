import { SELF } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'

import type { EventResponse } from '@/routes/events/events.routes'
import { insertEvent, insertMessage, insertSource, resetDb } from './helpers/db'

const day = Date.UTC(2025, 0, 1, 12, 0, 0)

beforeEach(async () => {
  await resetDb()
  await insertSource({ id: 1, name: 'Alpha', token: 'alpha-token' })
  await insertMessage({
    id: 1,
    source_id: 1,
    ses_message_id: 'ses-1',
    subject: 'Hello world',
    events_count: 2,
  })
  await insertEvent({
    message_id: 1,
    event_type: 'Delivery',
    recipient_email: 'a@example.com',
    event_at: day,
    ses_message_id: 'ses-1',
  })
  await insertEvent({
    message_id: 1,
    event_type: 'Bounce',
    recipient_email: 'b@example.com',
    event_at: day + 1000,
    ses_message_id: 'ses-1',
    bounce_type: 'Permanent',
  })
})

describe('events routes', () => {
  it('lists events with counts', async () => {
    const response = await SELF.fetch(
      'http://example.com/api/sources/1/events?date_range=all_time'
    )
    expect(response.status).toBe(200)
    const json = (await response.json()) as EventResponse
    expect(json.data).toHaveLength(2)
    expect(json.pagination.total).toBe(2)
    expect(json.counts.event_types.Bounce).toBe(1)
    expect(json.counts.event_types.Delivery).toBe(1)
    expect(json.counts.bounce_types.Permanent).toBe(1)
    expect(json.data[0]?.event_type).toBe('Bounce')
  })

  it('filters events by type', async () => {
    const response = await SELF.fetch(
      'http://example.com/api/sources/1/events?event_types=Bounce&date_range=all_time'
    )
    expect(response.status).toBe(200)
    const json = (await response.json()) as EventResponse
    expect(json.data).toHaveLength(1)
    expect(json.data[0]?.event_type).toBe('Bounce')
  })

  it('returns 404 for missing sources', async () => {
    const response = await SELF.fetch('http://example.com/api/sources/999/events')
    expect(response.status).toBe(404)
  })

  it('returns 422 for invalid source ids', async () => {
    const response = await SELF.fetch('http://example.com/api/sources/nope/events')
    expect(response.status).toBe(422)
  })
})
