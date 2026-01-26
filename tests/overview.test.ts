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

describe('open rate and click rate calculations', () => {
  it('calculates open rate using delivered (not sent) as denominator', async () => {
    await resetDb();
    await insertSource({ id: 1, name: 'Test', token: 'token' });

    // Message 1: sent and delivered
    await insertMessage({ id: 1, source_id: 1, ses_message_id: 'ses-1' });
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
      event_type: 'Open',
      recipient_email: 'a@example.com',
      event_at: rangeDate + 2000,
      ses_message_id: 'ses-1',
    });

    // Message 2: sent but bounced (not delivered)
    await insertMessage({ id: 2, source_id: 1, ses_message_id: 'ses-2' });
    await insertEvent({
      message_id: 2,
      event_type: 'Send',
      recipient_email: 'b@example.com',
      event_at: rangeDate,
      ses_message_id: 'ses-2',
    });
    await insertEvent({
      message_id: 2,
      event_type: 'Bounce',
      recipient_email: 'b@example.com',
      event_at: rangeDate + 1000,
      ses_message_id: 'ses-2',
      bounce_type: 'Permanent',
    });

    const response = await SELF.fetch(
      'http://example.com/api/sources/1/overview?from=2025-01-01&to=2025-01-01',
    );
    const json = (await response.json()) as OverviewResponse;

    expect(json.metrics.sent).toBe(2);
    expect(json.metrics.delivered).toBe(1);
    expect(json.metrics.unique_opens).toBe(1);
    // Open rate should be 1/1 = 1.0 (using delivered), not 1/2 = 0.5 (using sent)
    expect(json.metrics.open_rate).toBe(1);
  });

  it('counts multiple opens from the same recipient as one unique open', async () => {
    await resetDb();
    await insertSource({ id: 1, name: 'Test', token: 'token' });
    await insertMessage({ id: 1, source_id: 1, ses_message_id: 'ses-1' });

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
    // Same recipient opens the same email 3 times
    await insertEvent({
      message_id: 1,
      event_type: 'Open',
      recipient_email: 'a@example.com',
      event_at: rangeDate + 2000,
      ses_message_id: 'ses-1',
    });
    await insertEvent({
      message_id: 1,
      event_type: 'Open',
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

    const response = await SELF.fetch(
      'http://example.com/api/sources/1/overview?from=2025-01-01&to=2025-01-01',
    );
    const json = (await response.json()) as OverviewResponse;

    expect(json.metrics.opens).toBe(3); // Total opens
    expect(json.metrics.unique_opens).toBe(1); // Unique opens
    expect(json.metrics.open_rate).toBe(1); // 1 unique open / 1 delivered
  });

  it('counts opens from different recipients as separate unique opens', async () => {
    await resetDb();
    await insertSource({ id: 1, name: 'Test', token: 'token' });
    await insertMessage({ id: 1, source_id: 1, ses_message_id: 'ses-1' });

    // Recipient A
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
      event_type: 'Open',
      recipient_email: 'a@example.com',
      event_at: rangeDate + 2000,
      ses_message_id: 'ses-1',
    });

    // Recipient B
    await insertEvent({
      message_id: 1,
      event_type: 'Send',
      recipient_email: 'b@example.com',
      event_at: rangeDate,
      ses_message_id: 'ses-1',
    });
    await insertEvent({
      message_id: 1,
      event_type: 'Delivery',
      recipient_email: 'b@example.com',
      event_at: rangeDate + 1000,
      ses_message_id: 'ses-1',
    });
    await insertEvent({
      message_id: 1,
      event_type: 'Open',
      recipient_email: 'b@example.com',
      event_at: rangeDate + 2000,
      ses_message_id: 'ses-1',
    });

    const response = await SELF.fetch(
      'http://example.com/api/sources/1/overview?from=2025-01-01&to=2025-01-01',
    );
    const json = (await response.json()) as OverviewResponse;

    expect(json.metrics.delivered).toBe(2);
    expect(json.metrics.unique_opens).toBe(2);
    expect(json.metrics.open_rate).toBe(1); // 2 unique opens / 2 delivered
  });

  it('calculates click rate using delivered as denominator', async () => {
    await resetDb();
    await insertSource({ id: 1, name: 'Test', token: 'token' });

    // Message 1: delivered with click
    await insertMessage({ id: 1, source_id: 1, ses_message_id: 'ses-1' });
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
      event_type: 'Click',
      recipient_email: 'a@example.com',
      event_at: rangeDate + 2000,
      ses_message_id: 'ses-1',
    });

    // Message 2: bounced (no delivery)
    await insertMessage({ id: 2, source_id: 1, ses_message_id: 'ses-2' });
    await insertEvent({
      message_id: 2,
      event_type: 'Send',
      recipient_email: 'b@example.com',
      event_at: rangeDate,
      ses_message_id: 'ses-2',
    });
    await insertEvent({
      message_id: 2,
      event_type: 'Bounce',
      recipient_email: 'b@example.com',
      event_at: rangeDate + 1000,
      ses_message_id: 'ses-2',
      bounce_type: 'Permanent',
    });

    const response = await SELF.fetch(
      'http://example.com/api/sources/1/overview?from=2025-01-01&to=2025-01-01',
    );
    const json = (await response.json()) as OverviewResponse;

    expect(json.metrics.sent).toBe(2);
    expect(json.metrics.delivered).toBe(1);
    expect(json.metrics.unique_clicks).toBe(1);
    // Click rate should be 1/1 = 1.0 (using delivered), not 1/2 = 0.5 (using sent)
    expect(json.metrics.click_rate).toBe(1);
  });

  it('returns zero rates when no emails delivered', async () => {
    await resetDb();
    await insertSource({ id: 1, name: 'Test', token: 'token' });
    await insertMessage({ id: 1, source_id: 1, ses_message_id: 'ses-1' });

    // Only a send event, no delivery
    await insertEvent({
      message_id: 1,
      event_type: 'Send',
      recipient_email: 'a@example.com',
      event_at: rangeDate,
      ses_message_id: 'ses-1',
    });

    const response = await SELF.fetch(
      'http://example.com/api/sources/1/overview?from=2025-01-01&to=2025-01-01',
    );
    const json = (await response.json()) as OverviewResponse;

    expect(json.metrics.sent).toBe(1);
    expect(json.metrics.delivered).toBe(0);
    expect(json.metrics.open_rate).toBe(0);
    expect(json.metrics.click_rate).toBe(0);
  });
});
