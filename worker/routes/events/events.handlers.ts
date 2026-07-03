import { and, asc, count, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import * as HttpStatusPhrases from 'stoker/http-status-phrases';

import { createDb } from '../../db';
import { events, messages, messageTags, sources } from '../../db/schema';
import { BOUNCE_TYPES, EVENT_TYPE_VALUES } from '../../lib/constants';
import type { AppRouteHandler } from '../../lib/types';

import type { ListRoute } from './events.routes';

const DEFAULT_PER_PAGE = 50;
const MAX_PER_PAGE = 200;
type EventType = (typeof EVENT_TYPE_VALUES)[number];
type BounceType = (typeof BOUNCE_TYPES)[number];
type SelectedTag = { key: string; value: string; label: string };

const parseCsv = (value?: string) =>
  value
    ?.split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0) ?? [];

const parseTags = (value?: string): SelectedTag[] => {
  const seen = new Set<string>();
  const tags: SelectedTag[] = [];

  for (const entry of parseCsv(value)) {
    const separatorIndex = entry.indexOf(':');
    if (separatorIndex <= 0) {
      continue;
    }
    const key = entry.slice(0, separatorIndex).trim();
    const tagValue = entry.slice(separatorIndex + 1).trim();
    if (!key || !tagValue) {
      continue;
    }
    const label = `${key}:${tagValue}`;
    if (seen.has(label)) {
      continue;
    }
    seen.add(label);
    tags.push({ key, value: tagValue, label });
  }

  return tags;
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

const resolveDateRange = (preset?: string, from?: string, to?: string) => {
  const fromDate = parseDateInput(from);
  const toDate = parseDateInput(to);

  if (fromDate || toDate) {
    const start = fromDate ? startOfDayUtc(fromDate) : null;
    const end = toDate ? endOfDayUtc(toDate) : null;
    return { start, end };
  }

  const now = new Date();
  switch (preset) {
    case 'today': {
      const start = startOfDayUtc(now);
      return { start, end: endOfDayUtc(now) };
    }
    case 'yesterday': {
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      return { start: startOfDayUtc(yesterday), end: endOfDayUtc(yesterday) };
    }
    case 'last_7_days': {
      const start = startOfDayUtc(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000));
      return { start, end: endOfDayUtc(now) };
    }
    case 'last_45_days': {
      const start = startOfDayUtc(new Date(now.getTime() - 44 * 24 * 60 * 60 * 1000));
      return { start, end: endOfDayUtc(now) };
    }
    case 'last_90_days': {
      const start = startOfDayUtc(new Date(now.getTime() - 89 * 24 * 60 * 60 * 1000));
      return { start, end: endOfDayUtc(now) };
    }
    case 'all_time': {
      return { start: null, end: null };
    }
    case 'last_30_days':
    default: {
      const start = startOfDayUtc(new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000));
      return { start, end: endOfDayUtc(now) };
    }
  }
};

const buildSearchFilter = (search?: string) => {
  if (!search) {
    return;
  }
  const normalized = `%${search.trim().toLowerCase()}%`;
  return sql`(lower(${events.recipient_email}) like ${normalized} or lower(${messages.subject}) like ${normalized})`;
};

const buildTagFilter = (sourceId: number, tag: SelectedTag) =>
  sql`exists (
    select 1
    from ${messageTags}
    where ${messageTags.source_id} = ${sourceId}
      and ${messageTags.key} = ${tag.key}
      and ${messageTags.value} = ${tag.value}
      and ${messageTags.message_id} = ${events.message_id}
  )`;

const filterSql = (items: Array<SQL | undefined | null>): SQL[] =>
  items.filter((item): item is SQL => item != null);

const isEventType = (value: string): value is EventType =>
  EVENT_TYPE_VALUES.includes(value as EventType);

const isBounceType = (value: string): value is BounceType =>
  BOUNCE_TYPES.includes(value as BounceType);

export const list: AppRouteHandler<ListRoute> = async (c) => {
  const db = createDb(c.env);
  const { id } = c.req.valid('param');
  const query = c.req.valid('query');

  const [source] = await db.select({ id: sources.id }).from(sources).where(eq(sources.id, id));

  if (!source) {
    return c.json(
      {
        message: HttpStatusPhrases.NOT_FOUND,
      },
      HttpStatusCodes.NOT_FOUND,
    );
  }

  const eventTypes = parseCsv(query.event_types).filter(isEventType);
  const bounceTypes = parseCsv(query.bounce_types).filter(isBounceType);
  const selectedTags = parseTags(query.tags);

  const page = Math.max(Number(query.page ?? 1), 1);
  const perPage = Math.min(Math.max(Number(query.per_page ?? DEFAULT_PER_PAGE), 1), MAX_PER_PAGE);

  const { start, end } = resolveDateRange(query.date_range, query.from, query.to);
  const startMs = start ? start.getTime() : null;
  const endMs = end ? end.getTime() : null;

  const baseFilters = filterSql([
    eq(events.source_id, source.id),
    buildSearchFilter(query.search),
    startMs ? sql`${events.event_at} >= ${startMs}` : undefined,
    endMs ? sql`${events.event_at} <= ${endMs}` : undefined,
  ]);

  const listFilters = filterSql([
    ...baseFilters,
    eventTypes.length > 0 ? inArray(events.event_type, eventTypes) : undefined,
    bounceTypes.length > 0 ? inArray(events.bounce_type, bounceTypes) : undefined,
    ...selectedTags.map((tag) => buildTagFilter(source.id, tag)),
  ]);

  const nonTagListFilters = filterSql([
    ...baseFilters,
    eventTypes.length > 0 ? inArray(events.event_type, eventTypes) : undefined,
    bounceTypes.length > 0 ? inArray(events.bounce_type, bounceTypes) : undefined,
  ]);

  const [{ total }] = await db
    .select({ total: count() })
    .from(events)
    .innerJoin(messages, eq(events.message_id, messages.id))
    .where(and(...listFilters));

  const rows = await db
    .select({
      id: events.id,
      event_type: events.event_type,
      recipient_email: events.recipient_email,
      event_at: events.event_at,
      message_id: messages.id,
      ses_message_id: messages.ses_message_id,
      bounce_type: events.bounce_type,
      message_subject: messages.subject,
    })
    .from(events)
    .innerJoin(messages, eq(events.message_id, messages.id))
    .where(and(...listFilters))
    .orderBy(desc(events.event_at))
    .limit(perPage)
    .offset((page - 1) * perPage);

  const rowMessageIds = [...new Set(rows.map((row) => row.message_id))];
  const rowTags =
    rowMessageIds.length > 0
      ? await db
          .select({
            message_id: messageTags.message_id,
            key: messageTags.key,
            value: messageTags.value,
          })
          .from(messageTags)
          .where(
            and(
              eq(messageTags.source_id, source.id),
              inArray(messageTags.message_id, rowMessageIds),
            ),
          )
          .orderBy(asc(messageTags.key), asc(messageTags.value))
      : [];

  const countRows = await db
    .select({
      event_type: events.event_type,
      bounce_type: events.bounce_type,
      count: count(),
    })
    .from(events)
    .innerJoin(messages, eq(events.message_id, messages.id))
    .where(and(...baseFilters))
    .groupBy(events.event_type, events.bounce_type);

  const tagCountRows = await db
    .select({
      key: messageTags.key,
      value: messageTags.value,
      count: count(),
    })
    .from(events)
    .innerJoin(messages, eq(events.message_id, messages.id))
    .innerJoin(messageTags, eq(messageTags.message_id, messages.id))
    .where(and(eq(messageTags.source_id, source.id), ...nonTagListFilters))
    .groupBy(messageTags.key, messageTags.value);

  const totalPages = Math.max(Math.ceil(total / perPage), 1);
  const eventTypeCounts: Record<string, number> = {};
  const bounceTypeCounts: Record<string, number> = {};
  const tagCounts: Record<string, number> = {};
  const tagsByMessageId = new Map<number, Array<{ key: string; value: string; label: string }>>();

  for (const tag of rowTags) {
    const messageTag = { key: tag.key, value: tag.value, label: `${tag.key}:${tag.value}` };
    const tags = tagsByMessageId.get(tag.message_id);
    if (tags) {
      tags.push(messageTag);
    } else {
      tagsByMessageId.set(tag.message_id, [messageTag]);
    }
  }

  for (const row of countRows) {
    eventTypeCounts[row.event_type] = (eventTypeCounts[row.event_type] ?? 0) + row.count;
    if (row.bounce_type) {
      bounceTypeCounts[row.bounce_type] = (bounceTypeCounts[row.bounce_type] ?? 0) + row.count;
    }
  }

  for (const row of tagCountRows) {
    tagCounts[`${row.key}:${row.value}`] = row.count;
  }

  return c.json(
    {
      data: rows.map(({ message_id, ...row }) => ({
        ...row,
        event_at: row.event_at.getTime(),
        tags: tagsByMessageId.get(message_id) ?? [],
      })),
      pagination: {
        page,
        per_page: perPage,
        total,
        total_pages: totalPages,
      },
      counts: {
        event_types: eventTypeCounts,
        bounce_types: bounceTypeCounts,
        tags: tagCounts,
      },
    },
    HttpStatusCodes.OK,
  );
};
