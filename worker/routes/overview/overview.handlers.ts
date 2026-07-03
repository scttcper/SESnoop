import { and, count, countDistinct, desc, eq, sql } from 'drizzle-orm';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import * as HttpStatusPhrases from 'stoker/http-status-phrases';

import {
  buildDayRange,
  endOfDayUtc,
  formatDay,
  resolveDateRange,
  startOfDayUtc,
} from '../../../shared/event-filters';
import { createDb } from '../../db';
import { events, sources } from '../../db/schema';
import { EVENT_TYPES, EVENT_TYPE_VALUES, type EventType } from '../../lib/constants';
import { formatReasonLabel } from '../../lib/event-payload';
import type { AppRouteHandler } from '../../lib/types';

import type { GetRoute } from './overview.routes';

const eventCount = (eventType: EventType) =>
  count(sql`case when ${eq(events.event_type, eventType)} then 1 end`);

const uniqueEventCount = (eventType: EventType) =>
  countDistinct(
    sql`case when ${eq(events.event_type, eventType)} then ${events.recipient_email} || '|' || ${events.message_id} end`,
  );

const rate = (numerator: number, denominator: number) =>
  denominator ? numerator / denominator : 0;

export const get: AppRouteHandler<GetRoute> = async (c) => {
  const db = createDb(c.env);
  const { id } = c.req.valid('param');
  const { from, to } = c.req.valid('query');

  const now = new Date();
  const resolvedRange = resolveDateRange({ from, to, now, fillMissingCustomBounds: true });
  const start = resolvedRange.start ?? startOfDayUtc(now);
  const end = resolvedRange.end ?? endOfDayUtc(now);
  const startMs = start.getTime();
  const endMs = end.getTime();
  const dayKeys = buildDayRange(start, end);

  const rangeFilter = and(
    eq(events.source_id, id),
    sql`${events.event_at} >= ${startMs}`,
    sql`${events.event_at} <= ${endMs}`,
  );

  const todayRange = {
    start: startOfDayUtc(now),
    end: endOfDayUtc(now),
  };
  const todayStartMs = todayRange.start.getTime();
  const todayEndMs = todayRange.end.getTime();

  const dayExpr = sql<string>`strftime('%Y-%m-%d', ${events.event_at} / 1000, 'unixepoch')`;
  const bounceFilter = and(rangeFilter, eq(events.event_type, EVENT_TYPES.bounce));
  const bounceDiagnosticExpr = sql<string | null>`(
    select json_extract(value, '$.diagnosticCode')
    from json_each(${events.event_data}, '$.bouncedRecipients')
    where json_extract(value, '$.diagnosticCode') is not null
      and json_extract(value, '$.diagnosticCode') <> ''
    limit 1
  )`;
  const bounceReasonExpr = sql<string>`coalesce(
    nullif(json_extract(${events.event_data}, '$.bounceSubType'), ''),
    nullif(json_extract(${events.event_data}, '$.bounceType'), ''),
    nullif(${events.bounce_type}, ''),
    nullif(${bounceDiagnosticExpr}, ''),
    'Unknown'
  )`;
  const recipientDomainExpr = sql<string>`lower(trim(substr(
    ${events.recipient_email},
    instr(${events.recipient_email}, '@') + 1
  )))`;

  const [
    sourceRows,
    rangeTotalRows,
    lastEventRows,
    sentTodayRows,
    dailyRows,
    bounceBreakdownRows,
    reasonRows,
    topDomainRows,
  ] = await Promise.all([
    db.select({ id: sources.id }).from(sources).where(eq(sources.id, id)).limit(1),
    db
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
      .where(rangeFilter),
    db
      .select({
        event_at: events.event_at,
      })
      .from(events)
      .where(eq(events.source_id, id))
      .orderBy(desc(events.event_at))
      .limit(1),
    db
      .select({
        sent_today: eventCount(EVENT_TYPES.send),
      })
      .from(events)
      .where(
        and(
          eq(events.source_id, id),
          sql`${events.event_at} >= ${todayStartMs}`,
          sql`${events.event_at} <= ${todayEndMs}`,
        ),
      ),
    db
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
      .groupBy(dayExpr),
    db
      .select({
        bounce_type: events.bounce_type,
        count: count(),
      })
      .from(events)
      .where(
        and(bounceFilter, sql`${events.bounce_type} is not null`, sql`${events.bounce_type} <> ''`),
      )
      .groupBy(events.bounce_type),
    db
      .select({
        reason: bounceReasonExpr,
        count: count(),
      })
      .from(events)
      .where(bounceFilter)
      .groupBy(bounceReasonExpr),
    db
      .select({
        domain: recipientDomainExpr,
        count: count(),
      })
      .from(events)
      .where(and(bounceFilter, sql`instr(${events.recipient_email}, '@') > 0`))
      .groupBy(recipientDomainExpr)
      .orderBy(desc(count()))
      .limit(5),
  ]);

  const [source] = sourceRows;

  if (!source) {
    return c.json(
      {
        message: HttpStatusPhrases.NOT_FOUND,
      },
      HttpStatusCodes.NOT_FOUND,
    );
  }

  const [rangeTotals] = rangeTotalRows;
  const [lastEvent] = lastEventRows;
  const [{ sent_today }] = sentTodayRows;

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

  for (const row of reasonRows) {
    const reason = formatReasonLabel(row.reason);
    reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + row.count);
  }

  const topReasons = [...reasonCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, reasonCount]) => ({
      label,
      count: reasonCount,
      percentage: rate(reasonCount, bounced),
    }));

  const topDomains = topDomainRows.map((row) => ({
    label: row.domain,
    count: row.count,
    percentage: rate(row.count, bounced),
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
      bounce_breakdown: bounceBreakdownRows
        .filter((row): row is { bounce_type: string; count: number } => row.bounce_type != null)
        .map((row) => ({
          bounce_type: row.bounce_type,
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
