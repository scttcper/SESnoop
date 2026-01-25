import { and, eq, sql } from 'drizzle-orm';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import * as HttpStatusPhrases from 'stoker/http-status-phrases';

import { createDb } from '../../db';
import { events, messages, sources } from '../../db/schema';
import type { AppRouteHandler } from '../../lib/types';

import type { GetRoute } from './overview.routes';

const EVENT_TYPES = {
  send: 'Send',
  delivery: 'Delivery',
  bounce: 'Bounce',
  complaint: 'Complaint',
  open: 'Open',
  click: 'Click',
};

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

  const sentRow = await db
    .select({
      sent: sql<number>`sum(case when ${events.event_type} = ${EVENT_TYPES.send} then 1 else 0 end)`,
      delivered: sql<number>`sum(case when ${events.event_type} = ${EVENT_TYPES.delivery} then 1 else 0 end)`,
      bounced: sql<number>`sum(case when ${events.event_type} = ${EVENT_TYPES.bounce} then 1 else 0 end)`,
      complaints: sql<number>`sum(case when ${events.event_type} = ${EVENT_TYPES.complaint} then 1 else 0 end)`,
      opens: sql<number>`sum(case when ${events.event_type} = ${EVENT_TYPES.open} then 1 else 0 end)`,
      clicks: sql<number>`sum(case when ${events.event_type} = ${EVENT_TYPES.click} then 1 else 0 end)`,
    })
    .from(events)
    .innerJoin(messages, eq(events.message_id, messages.id))
    .where(rangeFilter);

  const sentTodayRow = await db
    .select({
      sent_today: sql<number>`sum(case when ${events.event_type} = ${EVENT_TYPES.send} then 1 else 0 end)`,
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

  const uniqueRow = await db
    .select({
      unique_opens: sql<number>`count(distinct case when ${events.event_type} = ${EVENT_TYPES.open} then ${events.recipient_email} || '|' || ${events.ses_message_id} end)`,
      unique_clicks: sql<number>`count(distinct case when ${events.event_type} = ${EVENT_TYPES.click} then ${events.recipient_email} || '|' || ${events.ses_message_id} end)`,
    })
    .from(events)
    .innerJoin(messages, eq(events.message_id, messages.id))
    .where(rangeFilter);

  const dayExpr = sql<string>`strftime('%Y-%m-%d', ${events.event_at} / 1000, 'unixepoch')`;

  const dailyRows = await db
    .select({
      day: dayExpr,
      sent: sql<number>`sum(case when ${events.event_type} = ${EVENT_TYPES.send} then 1 else 0 end)`,
      delivered: sql<number>`sum(case when ${events.event_type} = ${EVENT_TYPES.delivery} then 1 else 0 end)`,
      bounced: sql<number>`sum(case when ${events.event_type} = ${EVENT_TYPES.bounce} then 1 else 0 end)`,
    })
    .from(events)
    .innerJoin(messages, eq(events.message_id, messages.id))
    .where(rangeFilter)
    .groupBy(dayExpr);

  const bounceRows = await db
    .select({
      bounce_type: events.bounce_type,
      count: sql<number>`count(*)`,
    })
    .from(events)
    .innerJoin(messages, eq(events.message_id, messages.id))
    .where(
      and(
        rangeFilter,
        sql`${events.event_type} = ${EVENT_TYPES.bounce}`,
        sql`${events.bounce_type} is not null`,
      ),
    )
    .groupBy(events.bounce_type);

  const dailyMap = new Map<string, { sent: number; delivered: number; bounced: number }>();
  for (const row of dailyRows) {
    if (row.day) {
      dailyMap.set(row.day, {
        sent: row.sent ?? 0,
        delivered: row.delivered ?? 0,
        bounced: row.bounced ?? 0,
      });
    }
  }

  const chart = {
    days: dayKeys,
    sent: dayKeys.map((day) => dailyMap.get(day)?.sent ?? 0),
    delivered: dayKeys.map((day) => dailyMap.get(day)?.delivered ?? 0),
    bounced: dayKeys.map((day) => dailyMap.get(day)?.bounced ?? 0),
  };

  const sent = sentRow[0]?.sent ?? 0;
  const metrics = {
    sent,
    delivered: sentRow[0]?.delivered ?? 0,
    bounced: sentRow[0]?.bounced ?? 0,
    complaints: sentRow[0]?.complaints ?? 0,
    opens: sentRow[0]?.opens ?? 0,
    clicks: sentRow[0]?.clicks ?? 0,
    sent_today: sentTodayRow[0]?.sent_today ?? 0,
    unique_opens: uniqueRow[0]?.unique_opens ?? 0,
    unique_clicks: uniqueRow[0]?.unique_clicks ?? 0,
    bounce_rate: sent ? (sentRow[0]?.bounced ?? 0) / sent : 0,
    complaint_rate: sent ? (sentRow[0]?.complaints ?? 0) / sent : 0,
    open_rate: sent ? (uniqueRow[0]?.unique_opens ?? 0) / sent : 0,
    click_rate: sent ? (uniqueRow[0]?.unique_clicks ?? 0) / sent : 0,
  };

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
          count: row.count ?? 0,
        })),
    },
    HttpStatusCodes.OK,
  );
};
