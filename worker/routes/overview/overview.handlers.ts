import { and, count, countDistinct, desc, eq, gt, gte, isNotNull, lte, ne, sql } from 'drizzle-orm';
import { unionAll } from 'drizzle-orm/sqlite-core';
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

type BounceInsightBucket = 'type' | 'reason' | 'domain';

const MS_PER_UTC_DAY = 86_400_000;
const dayBucketExpr = sql<number>`cast(${events.event_at} / ${sql.raw(String(MS_PER_UTC_DAY))} as integer)`;

const eventCount = (eventType: EventType) =>
  sql<number>`coalesce(sum(${eq(events.event_type, eventType)}), 0)`;

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
  const dayKeys = buildDayRange(start, end);

  const rangeFilter = and(
    eq(events.source_id, id),
    gte(events.event_at, start),
    lte(events.event_at, end),
  );

  const todayRange = {
    start: startOfDayUtc(now),
    end: endOfDayUtc(now),
  };

  const bounceFilter = and(rangeFilter, eq(events.event_type, EVENT_TYPES.bounce));
  const bounceEvents = db.$with('bounce_events').as(
    db
      .select({
        event_data: events.event_data,
        bounce_type: events.bounce_type,
        recipient_email: events.recipient_email,
      })
      .from(events)
      .where(bounceFilter),
  );
  const bounceDiagnosticExpr = sql<string | null>`(
    select json_extract(value, '$.diagnosticCode')
    from json_each(${bounceEvents.event_data}, '$.bouncedRecipients')
    where json_extract(value, '$.diagnosticCode') is not null
      and json_extract(value, '$.diagnosticCode') <> ''
    limit 1
  )`;
  const bounceReasonExpr = sql<string>`coalesce(
    nullif(json_extract(${bounceEvents.event_data}, '$.bounceSubType'), ''),
    nullif(json_extract(${bounceEvents.event_data}, '$.bounceType'), ''),
    nullif(${bounceEvents.bounce_type}, ''),
    nullif(${bounceDiagnosticExpr}, ''),
    'Unknown'
  )`;
  const recipientDomainExpr = sql<string>`lower(trim(substr(
    ${bounceEvents.recipient_email},
    instr(${bounceEvents.recipient_email}, '@') + 1
  )))`;
  const bounceInsightRowsQuery = unionAll(
    db
      .with(bounceEvents)
      .select({
        bucket: sql<BounceInsightBucket>`'type'`,
        label: sql<string>`${bounceEvents.bounce_type}`,
        count: count(),
      })
      .from(bounceEvents)
      .where(and(isNotNull(bounceEvents.bounce_type), ne(bounceEvents.bounce_type, '')))
      .groupBy(bounceEvents.bounce_type),
    db
      .select({
        bucket: sql<BounceInsightBucket>`'reason'`,
        label: bounceReasonExpr,
        count: count(),
      })
      .from(bounceEvents)
      .groupBy(bounceReasonExpr),
    db
      .select({
        bucket: sql<BounceInsightBucket>`'domain'`,
        label: recipientDomainExpr,
        count: count(),
      })
      .from(bounceEvents)
      .where(gt(sql<number>`instr(${bounceEvents.recipient_email}, '@')`, 0))
      .groupBy(recipientDomainExpr),
  );

  // Anchor each rate to one send/delivery per message and normalized recipient.
  // Outcomes may arrive after the selected range, and are counted through now.
  const rateRowsQuery = db.all<{
    day_bucket: number;
    event_type: string;
    total: number;
    opened: number;
    clicked: number;
    bounced: number;
    complained: number;
  }>(sql`
    with cohorts as (
      select message_id, lower(trim(recipient_email)) as recipient_email,
        event_type, min(event_at) as event_at
      from events
      where source_id = ${id} and event_type in ('Send', 'Delivery')
      group by message_id, lower(trim(recipient_email)), event_type
      having min(event_at) >= ${start.getTime()} and min(event_at) <= ${end.getTime()}
    )
    select cast(cohorts.event_at / ${sql.raw(String(MS_PER_UTC_DAY))} as integer) as day_bucket,
      cohorts.event_type, count(*) as total,
      sum(exists(select 1 from events outcome where outcome.message_id = cohorts.message_id
        and outcome.source_id = ${id} and lower(trim(outcome.recipient_email)) = cohorts.recipient_email
        and outcome.event_type = 'Open' and outcome.event_at >= cohorts.event_at and outcome.event_at <= ${now.getTime()})) as opened,
      sum(exists(select 1 from events outcome where outcome.message_id = cohorts.message_id
        and outcome.source_id = ${id} and lower(trim(outcome.recipient_email)) = cohorts.recipient_email
        and outcome.event_type = 'Click' and outcome.event_at >= cohorts.event_at and outcome.event_at <= ${now.getTime()})) as clicked,
      sum(exists(select 1 from events outcome where outcome.message_id = cohorts.message_id
        and outcome.source_id = ${id} and lower(trim(outcome.recipient_email)) = cohorts.recipient_email
        and outcome.event_type = 'Bounce' and outcome.event_at >= cohorts.event_at and outcome.event_at <= ${now.getTime()})) as bounced,
      sum(exists(select 1 from events outcome where outcome.message_id = cohorts.message_id
        and outcome.source_id = ${id} and lower(trim(outcome.recipient_email)) = cohorts.recipient_email
        and outcome.event_type = 'Complaint' and outcome.event_at >= cohorts.event_at and outcome.event_at <= ${now.getTime()})) as complained
    from cohorts
    group by day_bucket, cohorts.event_type
  `);

  const [
    sourceRows,
    rangeTotalRows,
    lastEventRows,
    sentTodayRows,
    dailyRows,
    bounceInsightRows,
    rateRows,
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
          gte(events.event_at, todayRange.start),
          lte(events.event_at, todayRange.end),
        ),
      ),
    db
      .select({
        day_bucket: dayBucketExpr,
        sent: eventCount(EVENT_TYPES.send),
        delivered: eventCount(EVENT_TYPES.delivery),
        bounced: eventCount(EVENT_TYPES.bounce),
        unique_opens: uniqueEventCount(EVENT_TYPES.open),
        unique_recipients: countDistinct(sql`lower(${events.recipient_email})`),
      })
      .from(events)
      .where(rangeFilter)
      .groupBy(dayBucketExpr),
    bounceInsightRowsQuery,
    rateRowsQuery,
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

  const dailyMap = new Map(
    dailyRows.map((row) => [formatDay(new Date(row.day_bucket * MS_PER_UTC_DAY)), row]),
  );
  type DailyMetric = 'sent' | 'delivered' | 'bounced' | 'unique_opens' | 'unique_recipients';
  const series = (metric: DailyMetric) => dayKeys.map((day) => dailyMap.get(day)?.[metric] ?? 0);

  const deliveryRates = new Map<number, number>();
  const bounceRates = new Map<number, number>();
  const rateTotals = { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, complained: 0 };
  for (const row of rateRows) {
    if (row.event_type === EVENT_TYPES.delivery) {
      rateTotals.delivered += row.total;
      rateTotals.opened += row.opened;
      rateTotals.clicked += row.clicked;
      deliveryRates.set(row.day_bucket, rate(row.opened, row.total));
    } else {
      rateTotals.sent += row.total;
      rateTotals.bounced += row.bounced;
      rateTotals.complained += row.complained;
      bounceRates.set(row.day_bucket, rate(row.bounced, row.total));
    }
  }
  const dailyRate = (values: Map<number, number>) =>
    dayKeys.map((day) => values.get(Date.parse(day) / MS_PER_UTC_DAY) ?? 0);

  const chart = {
    days: dayKeys,
    sent: series('sent'),
    delivered: series('delivered'),
    bounced: series('bounced'),
    unique_opens: series('unique_opens'),
    unique_recipients: series('unique_recipients'),
    open_rate: dailyRate(deliveryRates),
    bounce_rate: dailyRate(bounceRates),
  };

  const { unique_emails, unique_opens, unique_clicks } = rangeTotals;
  const bounceRate = rate(rateTotals.bounced, rateTotals.sent);
  const complaintRate = rate(rateTotals.complained, rateTotals.sent);
  const openRate = rate(rateTotals.opened, rateTotals.delivered);
  const clickRate = rate(rateTotals.clicked, rateTotals.delivered);
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
    opened_deliveries: rateTotals.opened,
    clicked_deliveries: rateTotals.clicked,
    bounce_rate: bounceRate,
    complaint_rate: complaintRate,
    open_rate: openRate,
    click_rate: clickRate,
  };

  const activity = {
    last_event_at: lastEvent?.event_at?.getTime() ?? null,
  };

  const bounceBreakdownRows: Array<{ bounce_type: string; count: number }> = [];
  const reasonCounts = new Map<string, number>();
  const domainCounts = new Map<string, number>();

  for (const row of bounceInsightRows) {
    if (row.bucket === 'type') {
      bounceBreakdownRows.push({
        bounce_type: row.label,
        count: row.count,
      });
      continue;
    }

    if (row.bucket === 'reason') {
      const reason = formatReasonLabel(row.label);
      reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + row.count);
      continue;
    }

    domainCounts.set(row.label, (domainCounts.get(row.label) ?? 0) + row.count);
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
      bounce_breakdown: bounceBreakdownRows,
      failure_insights: {
        top_reasons: topReasons,
        top_domains: topDomains,
      },
    },
    HttpStatusCodes.OK,
  );
};
