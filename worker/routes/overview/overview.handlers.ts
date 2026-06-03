import { and, count, countDistinct, desc, eq, isNotNull, sql } from 'drizzle-orm';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import * as HttpStatusPhrases from 'stoker/http-status-phrases';

import { createDb } from '../../db';
import { events, messages, sources } from '../../db/schema';
import { EVENT_TYPES, EVENT_TYPE_VALUES } from '../../lib/constants';
import type { AppRouteHandler } from '../../lib/types';

import type { GetRoute } from './overview.routes';

type EventType = (typeof EVENT_TYPE_VALUES)[number];

const eventCount = (eventType: EventType) =>
  count(sql`case when ${eq(events.event_type, eventType)} then 1 end`);

const uniqueEventCount = (eventType: EventType) =>
  countDistinct(
    sql`case when ${eq(events.event_type, eventType)} then ${events.recipient_email} || '|' || ${events.ses_message_id} end`,
  );

const rate = (numerator: number, denominator: number) =>
  denominator ? numerator / denominator : 0;

const startOfDayUtc = (value: Date) =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));

const endOfDayUtc = (value: Date) =>
  new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 23, 59, 59, 999),
  );

const parseDateInput = (value?: string) => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const parseJsonRecord = (value: unknown): Record<string, unknown> => {
  if (!value) {
    return {};
  }
  if (typeof value === 'object') {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as Record<string, unknown>;
      return typeof parsed === 'object' && parsed ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
};

const toTrimmedString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const readString = (record: Record<string, unknown>, key: string): string | null =>
  toTrimmedString(record[key]);

const extractBounceDiagnostic = (eventData: Record<string, unknown>): string | null => {
  const recipients = eventData.bouncedRecipients;
  if (!Array.isArray(recipients)) {
    return null;
  }
  for (const recipient of recipients) {
    if (recipient && typeof recipient === 'object') {
      const diagnostic = toTrimmedString((recipient as Record<string, unknown>).diagnosticCode);
      if (diagnostic) {
        return diagnostic;
      }
    }
  }
  return null;
};

const formatReasonLabel = (value: string | null): string => {
  if (!value) {
    return 'Unknown';
  }
  const normalized = value
    .replaceAll('_', ' ')
    .replaceAll(/([a-z])([A-Z])/g, '$1 $2')
    .replaceAll(/\s+/g, ' ')
    .trim();
  if (!normalized) {
    return 'Unknown';
  }
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const resolveBounceReason = (
  eventData: Record<string, unknown>,
  bounceType: string | null,
): string => {
  const reason =
    readString(eventData, 'bounceSubType') ??
    readString(eventData, 'bounceType') ??
    bounceType ??
    extractBounceDiagnostic(eventData);
  return formatReasonLabel(reason);
};

const resolveRange = (from?: string, to?: string) => {
  const parsedFrom = parseDateInput(from);
  const parsedTo = parseDateInput(to);
  if (parsedFrom || parsedTo) {
    const start = parsedFrom ? startOfDayUtc(parsedFrom) : startOfDayUtc(new Date());
    const end = parsedTo ? endOfDayUtc(parsedTo) : endOfDayUtc(new Date());
    return { start, end };
  }
  const today = new Date();
  const start = startOfDayUtc(new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000));
  const end = endOfDayUtc(today);
  return { start, end };
};

const formatDay = (value: Date) => value.toISOString().slice(0, 10);

const buildDayRange = (start: Date, end: Date) => {
  const days: string[] = [];
  const cursor = startOfDayUtc(start);
  const endDay = startOfDayUtc(end);
  while (cursor <= endDay) {
    days.push(formatDay(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
};

export const get: AppRouteHandler<GetRoute> = async (c) => {
  const db = createDb(c.env);
  const { id } = c.req.valid('param');
  const { from, to } = c.req.valid('query');

  const source = await db.query.sources.findFirst({
    where: eq(sources.id, id),
  });

  if (!source) {
    return c.json(
      {
        message: HttpStatusPhrases.NOT_FOUND,
      },
      HttpStatusCodes.NOT_FOUND,
    );
  }

  const { start, end } = resolveRange(from, to);
  const startMs = start.getTime();
  const endMs = end.getTime();
  const dayKeys = buildDayRange(start, end);

  const rangeFilter = and(
    eq(messages.source_id, source.id),
    sql`${events.event_at} >= ${startMs}`,
    sql`${events.event_at} <= ${endMs}`,
  );

  const todayRange = {
    start: startOfDayUtc(new Date()),
    end: endOfDayUtc(new Date()),
  };
  const todayStartMs = todayRange.start.getTime();
  const todayEndMs = todayRange.end.getTime();

  const [eventTotals] = await db
    .select({
      sent: eventCount(EVENT_TYPES.send),
      delivered: eventCount(EVENT_TYPES.delivery),
      bounced: eventCount(EVENT_TYPES.bounce),
      complaints: eventCount(EVENT_TYPES.complaint),
      opens: eventCount(EVENT_TYPES.open),
    })
    .from(events)
    .innerJoin(messages, eq(events.message_id, messages.id))
    .where(rangeFilter);

  const [{ sent_today }] = await db
    .select({
      sent_today: eventCount(EVENT_TYPES.send),
    })
    .from(events)
    .innerJoin(messages, eq(events.message_id, messages.id))
    .where(
      and(
        eq(messages.source_id, source.id),
        sql`${events.event_at} >= ${todayStartMs}`,
        sql`${events.event_at} <= ${todayEndMs}`,
      ),
    );

  const [uniqueTotals] = await db
    .select({
      unique_emails: countDistinct(sql`lower(${events.recipient_email})`),
      unique_opens: uniqueEventCount(EVENT_TYPES.open),
      unique_clicks: uniqueEventCount(EVENT_TYPES.click),
    })
    .from(events)
    .innerJoin(messages, eq(events.message_id, messages.id))
    .where(rangeFilter);

  const dayExpr = sql<string>`strftime('%Y-%m-%d', ${events.event_at} / 1000, 'unixepoch')`;

  const dailyRows = await db
    .select({
      day: dayExpr,
      sent: eventCount(EVENT_TYPES.send),
      delivered: eventCount(EVENT_TYPES.delivery),
      bounced: eventCount(EVENT_TYPES.bounce),
      unique_opens: uniqueEventCount(EVENT_TYPES.open),
    })
    .from(events)
    .innerJoin(messages, eq(events.message_id, messages.id))
    .where(rangeFilter)
    .groupBy(dayExpr);

  const bounceRows = await db
    .select({
      bounce_type: events.bounce_type,
      count: count(),
    })
    .from(events)
    .innerJoin(messages, eq(events.message_id, messages.id))
    .where(
      and(rangeFilter, eq(events.event_type, EVENT_TYPES.bounce), isNotNull(events.bounce_type)),
    )
    .groupBy(events.bounce_type);

  let bounceEvents: Array<{ event_data: unknown; bounce_type: string | null }> = [];
  let domainRows: Array<{ domain: string | null; count: number }> = [];

  if (eventTotals.bounced > 0) {
    bounceEvents = await db
      .select({
        event_data: events.event_data,
        bounce_type: events.bounce_type,
      })
      .from(events)
      .innerJoin(messages, eq(events.message_id, messages.id))
      .where(and(rangeFilter, eq(events.event_type, EVENT_TYPES.bounce)));

    const domainExpr = sql<string>`lower(substr(${events.recipient_email}, instr(${events.recipient_email}, '@') + 1))`;
    const domainCountExpr = count();

    domainRows = await db
      .select({
        domain: domainExpr,
        count: domainCountExpr,
      })
      .from(events)
      .innerJoin(messages, eq(events.message_id, messages.id))
      .where(
        and(
          rangeFilter,
          eq(events.event_type, EVENT_TYPES.bounce),
          sql`instr(${events.recipient_email}, '@') > 0`,
        ),
      )
      .groupBy(domainExpr)
      .orderBy(desc(domainCountExpr))
      .limit(5);
  }

  const dailyMap = new Map(dailyRows.map((row) => [row.day, row]));
  type DailyMetric = 'sent' | 'delivered' | 'bounced' | 'unique_opens';
  const series = (metric: DailyMetric) => dayKeys.map((day) => dailyMap.get(day)?.[metric] ?? 0);

  const chart = {
    days: dayKeys,
    sent: series('sent'),
    delivered: series('delivered'),
    bounced: series('bounced'),
    unique_opens: series('unique_opens'),
  };

  const { sent, delivered, bounced, complaints, opens } = eventTotals;
  const { unique_emails, unique_opens, unique_clicks } = uniqueTotals;
  const metrics = {
    sent,
    delivered,
    bounced,
    complaints,
    opens,
    sent_today,
    unique_emails,
    unique_opens,
    unique_clicks,
    bounce_rate: rate(bounced, sent),
    complaint_rate: rate(complaints, sent),
    open_rate: rate(unique_opens, delivered),
    click_rate: rate(unique_clicks, delivered),
  };

  const reasonCounts = new Map<string, number>();
  for (const row of bounceEvents) {
    const reason = resolveBounceReason(parseJsonRecord(row.event_data), row.bounce_type);
    reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
  }

  const topReasons = [...reasonCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, reasonCount]) => ({ label, count: reasonCount }));

  const topDomains = domainRows
    .map((row) => ({
      label: row.domain?.trim() ?? '',
      count: row.count,
    }))
    .filter((row) => row.label.length > 0);

  return c.json(
    {
      source_id: source.id,
      range: {
        from: formatDay(start),
        to: formatDay(end),
      },
      metrics,
      chart,
      bounce_breakdown: bounceRows
        .filter((row) => row.bounce_type)
        .map((row) => ({
          bounce_type: row.bounce_type ?? 'Unknown',
          count: row.count,
        })),
      failure_insights: {
        top_reasons: topReasons,
        top_domains: topDomains,
      },
    },
    HttpStatusCodes.OK,
  );
};
