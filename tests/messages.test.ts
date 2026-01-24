import { SELF } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'

import type { MessageDetail } from '@/routes/messages/messages.routes'
import { insertEvent, insertMessage, insertSource, resetDb } from './helpers/db'

const firstEventAt = Date.UTC(2025, 0, 1, 8, 0, 0)
const secondEventAt = Date.UTC(2025, 0, 1, 9, 0, 0)

beforeEach(async () => {
  await resetDb()
  await insertSource({ id: 1, name: 'Alpha', token: 'alpha-token' })
  await insertMessage({
    id: 1,
    source_id: 1,
    ses_message_id: 'ses-1',
    subject: 'Hello world',
    source_email: 'sender@example.com',
    mail_metadata: {
      destination: ['a@example.com', 'b@example.com'],
      tags: {
        campaign: ['spring'],
        'ses:configuration-set': 'ignore-me',
      },
    },
    events_count: 2,
  })
  await insertEvent({
    message_id: 1,
    event_type: 'Delivery',
    recipient_email: 'a@example.com',
    event_at: firstEventAt,
    ses_message_id: 'ses-1',
  })
  await insertEvent({
    message_id: 1,
    event_type: 'Open',
    recipient_email: 'a@example.com',
    event_at: secondEventAt,
    ses_message_id: 'ses-1',
  })
})

describe('messages routes', () => {
  it('returns a message with events', async () => {
    const response = await SELF.fetch(
      'http://example.com/api/sources/1/messages/ses-1'
    )
    expect(response.status).toBe(200)
    const json = (await response.json()) as MessageDetail
    expect(json.ses_message_id).toBe('ses-1')
    expect(json.destination_emails).toEqual(['a@example.com', 'b@example.com'])
    expect(json.tags).toEqual(['campaign:spring'])
    expect(json.events).toHaveLength(2)
    expect(json.events[0]?.event_at).toBe(secondEventAt)
  })

  it('returns 404 for missing messages', async () => {
    const response = await SELF.fetch(
      'http://example.com/api/sources/1/messages/unknown'
    )
    expect(response.status).toBe(404)
  })

  it('returns 422 for invalid params', async () => {
    const response = await SELF.fetch(
      'http://example.com/api/sources/nope/messages/ses-1'
    )
    expect(response.status).toBe(422)
  })
})
