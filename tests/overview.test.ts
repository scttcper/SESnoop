import { SELF } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import type { OverviewResponse } from '@/routes/overview/overview.routes';

import { insertEvent, insertMessage, insertSource, resetDb } from './helpers/db';

const rangeDate = Date.UTC(2025, 0, 1, 12, 0, 0);

beforeEach(async () => {
  await resetDb();
  await insertSource({ id: 1, name: 'Alpha', token: 'alpha-token' });
  await insertMessage({
    id: 1,
    source_id: 1,
    ses_message_id: 'ses-1',
    subject: 'Hello world',
    events_count: 6,
  });
  await insertEvent({
    message_id: 1,
    event_type: 'Send',
    recipient_email: 'a@example.com',
    event_at: rangeDate,
    ses_message_id: 'ses-1',
  });
  await insertEvent({
    message_id: 1,
    event_type: 'Delivery',
    recipient_email: 'a@example.com',
    event_at: rangeDate + 1000,
    ses_message_id: 'ses-1',
  });
  await insertEvent({
    message_id: 1,
    event_type: 'Bounce',
    recipient_email: 'a@example.com',
    event_at: rangeDate + 2000,
    ses_message_id: 'ses-1',
    bounce_type: 'Permanent',
  });
  await insertEvent({
    message_id: 1,
    event_type: 'Complaint',
    recipient_email: 'a@example.com',
    event_at: rangeDate + 3000,
    ses_message_id: 'ses-1',
  });
  await insertEvent({
    message_id: 1,
    event_type: 'Open',
    recipient_email: 'a@example.com',
    event_at: rangeDate + 4000,
    ses_message_id: 'ses-1',
  });
  await insertEvent({
    message_id: 1,
    event_type: 'Open',
    recipient_email: 'a@example.com',
    event_at: rangeDate + 5000,
    ses_message_id: 'ses-1',
  });
  await insertEvent({
    message_id: 1,
    event_type: 'Click',
    recipient_email: 'a@example.com',
    event_at: rangeDate + 6000,
    ses_message_id: 'ses-1',
  });
});

describe('overview routes', () => {
  it('returns overview metrics', async () => {
    const response = await SELF.fetch(
      'http://example.com/api/sources/1/overview?from=2025-01-01&to=2025-01-01',
    );
    expect(response.status).toBe(200);
    const json = (await response.json()) as OverviewResponse;
    expect(json.metrics.sent).toBe(1);
    expect(json.metrics.delivered).toBe(1);
    expect(json.metrics.bounced).toBe(1);
    expect(json.metrics.complaints).toBe(1);
    expect(json.metrics.opens).toBe(2);
    expect(json.metrics.clicks).toBe(1);
    expect(json.metrics.unique_opens).toBe(1);
    expect(json.metrics.unique_clicks).toBe(1);
    expect(json.metrics.bounce_rate).toBe(1);
    expect(json.metrics.complaint_rate).toBe(1);
    expect(json.metrics.open_rate).toBe(1);
    expect(json.metrics.click_rate).toBe(1);
    expect(json.chart.days).toEqual(['2025-01-01']);
    expect(json.chart.sent).toEqual([1]);
    expect(json.chart.delivered).toEqual([1]);
    expect(json.chart.bounced).toEqual([1]);
    expect(json.bounce_breakdown).toEqual([{ bounce_type: 'Permanent', count: 1 }]);
    expect(json.failure_insights.top_reasons).toEqual([{ label: 'Permanent', count: 1 }]);
    expect(json.failure_insights.top_domains).toEqual([{ label: 'example.com', count: 1 }]);
  });

  it('returns 404 for missing sources', async () => {
    const response = await SELF.fetch('http://example.com/api/sources/999/overview');
    expect(response.status).toBe(404);
  });

  it('returns 422 for invalid params', async () => {
    const response = await SELF.fetch('http://example.com/api/sources/nope/overview');
    expect(response.status).toBe(422);
  });
});
