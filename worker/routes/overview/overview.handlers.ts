import { and, count, countDistinct, desc, eq, sql } from 'drizzle-orm';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import * as HttpStatusPhrases from 'stoker/http-status-phrases';

import { createDb } from '../../db';
import { events, sources } from '../../db/schema';
import { EVENT_TYPES, EVENT_TYPE_VALUES } from '../../lib/constants';
import { resolveBounceReason, toRecord } from '../../lib/event-payload';
import type { AppRouteHandler } from '../../lib/types';

import type { GetRoute } from './overview.routes';

type EventType = (typeof EVENT_TYPE_VALUES)[number];

const eventCount = (eventType: EventType) =>
  count(sql`case when ${eq(events.event_type, eventType)} then 1 end`);

const uniqueEventCount = (eventType: EventType) =>
  countDistinct(
    sql`case when ${eq(events.event_type, eventType)} then ${events.recipient_email} || '|' || ${events.message_id} end`,
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

  const [source] = await db.select({ id: sources.id }).from(sources).where(eq(sources.id, id));

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
    eq(events.source_id, source.id),
    sql`${events.event_at} >= ${startMs}`,
    sql`${events.event_at} <= ${endMs}`,
  );

  const todayRange = {
    start: startOfDayUtc(new Date()),
    end: endOfDayUtc(new Date()),
  };
  const todayStartMs = todayRange.start.getTime();
  const todayEndMs = todayRange.end.getTime();

  const [rangeTotals] = await db
    .select({
      sent: eventCount(EVENT_TYPES.send),
      delivered: eventCount(EVENT_TYPES.delivery),
      bounced: eventCount(EVENT_TYPES.bounce),
      complaints: eventCount(EVENT_TYPES.complaint),
      opens: eventCount(EVENT_TYPES.open),
      clicks: eventCount(EVENT_TYPES.click),
      unique_emails: countDistinct(sql`lower(${events.recipient_email})`),
      unique_opens: uniqueEventCount(EVENT_TYPES.open),
      unique_clicks: uniqueEventCount(EVENT_TYPES.click),
    })
    .from(events)
    .where(rangeFilter);

  const [lastEvent] = await db
    .select({
      event_at: events.event_at,
    })
    .from(events)
    .where(eq(events.source_id, source.id))
    .orderBy(desc(events.event_at))
    .limit(1);

  const [{ sent_today }] = await db
    .select({
      sent_today: eventCount(EVENT_TYPES.send),
    })
    .from(events)
    .where(
      and(
        eq(events.source_id, source.id),
        sql`${events.event_at} >= ${todayStartMs}`,
        sql`${events.event_at} <= ${todayEndMs}`,
      ),
    );

  const dayExpr = sql<string>`strftime('%Y-%m-%d', ${events.event_at} / 1000, 'unixepoch')`;

  const dailyRows = await db
    .select({
      day: dayExpr,
      sent: eventCount(EVENT_TYPES.send),
      delivered: eventCount(EVENT_TYPES.delivery),
      bounced: eventCount(EVENT_TYPES.bounce),
      unique_opens: uniqueEventCount(EVENT_TYPES.open),
      unique_recipients: countDistinct(sql`lower(${events.recipient_email})`),
    })
    .from(events)
    .where(rangeFilter)
    .groupBy(dayExpr);

  const sent = rangeTotals.sent;
  const delivered = rangeTotals.delivered;
  const bounced = rangeTotals.bounced;
  const complaints = rangeTotals.complaints;
  const opens = rangeTotals.opens;
  const eventMix = Object.fromEntries(
    EVENT_TYPE_VALUES.map((eventType) => [eventType, 0]),
  ) as Record<EventType, number>;
  eventMix.Send = sent;
  eventMix.Delivery = delivered;
  eventMix.Bounce = bounced;
  eventMix.Complaint = complaints;
  eventMix.Open = opens;
  eventMix.Click = rangeTotals.clicks;

  let bounceEvents: Array<{
    event_data: unknown;
    bounce_type: string | null;
    recipient_email: string;
  }> = [];

  if (bounced > 0) {
    bounceEvents = await db
      .select({
        event_data: events.event_data,
        bounce_type: events.bounce_type,
        recipient_email: events.recipient_email,
      })
      .from(events)
      .where(and(rangeFilter, eq(events.event_type, EVENT_TYPES.bounce)));
  }

  const dailyMap = new Map(dailyRows.map((row) => [row.day, row]));
  type DailyMetric = 'sent' | 'delivered' | 'bounced' | 'unique_opens' | 'unique_recipients';
  const series = (metric: DailyMetric) => dayKeys.map((day) => dailyMap.get(day)?.[metric] ?? 0);

  const chart = {
    days: dayKeys,
    sent: series('sent'),
    delivered: series('delivered'),
    bounced: series('bounced'),
    unique_opens: series('unique_opens'),
    unique_recipients: series('unique_recipients'),
  };

  const { unique_emails, unique_opens, unique_clicks } = rangeTotals;
  const bounceRate = rate(bounced, sent);
  const complaintRate = rate(complaints, sent);
  const openRate = rate(unique_opens, delivered);
  const clickRate = rate(unique_clicks, delivered);
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
    bounce_rate: bounceRate,
    complaint_rate: complaintRate,
    open_rate: openRate,
    click_rate: clickRate,
  };

  const activity = {
    last_event_at: lastEvent?.event_at?.getTime() ?? null,
  };

  const reasonCounts = new Map<string, number>();
  const bounceTypeCounts = new Map<string, number>();
  const domainCounts = new Map<string, number>();

  for (const row of bounceEvents) {
    const reason = resolveBounceReason(toRecord(row.event_data), row.bounce_type);
    reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);

    if (row.bounce_type) {
      bounceTypeCounts.set(row.bounce_type, (bounceTypeCounts.get(row.bounce_type) ?? 0) + 1);
    }

    const domain = row.recipient_email.split('@').at(1)?.trim().toLowerCase();
    if (domain) {
      domainCounts.set(domain, (domainCounts.get(domain) ?? 0) + 1);
    }
  }

  const topReasons = [...reasonCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, reasonCount]) => ({
      label,
      count: reasonCount,
      percentage: rate(reasonCount, bounced),
    }));

  const topDomains = [...domainCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, domainCount]) => ({
      label,
      count: domainCount,
      percentage: rate(domainCount, bounced),
    }));

  return c.json(
    {
      source_id: source.id,
      range: {
        from: formatDay(start),
        to: formatDay(end),
      },
      metrics,
      activity,
      event_mix: eventMix,
      chart,
      bounce_breakdown: [...bounceTypeCounts.entries()].map(([bounce_type, bounceCount]) => ({
        bounce_type,
        count: bounceCount,
      })),
      failure_insights: {
        top_reasons: topReasons,
        top_domains: topDomains,
      },
    },
    HttpStatusCodes.OK,
  );
};
