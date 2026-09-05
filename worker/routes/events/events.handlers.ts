import { and, asc, count, desc, eq, gte, inArray, lte, sql, type SQL } from 'drizzle-orm';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import * as HttpStatusPhrases from 'stoker/http-status-phrases';

import {
  parseEventListQuery,
  type EventType,
  type SelectedTag,
} from '../../../shared/event-filters';
import { createDb } from '../../db';
import { events, messages, messageTags, sources } from '../../db/schema';
import type { AppRouteHandler } from '../../lib/types';

import type { ListRoute } from './events.routes';

const buildEventSearchFilter = (search: string) => {
  if (!search) {
    return;
  }
  const normalized = `%${search.toLowerCase()}%`;
  return sql`(
    lower(${events.recipient_email}) like ${normalized}
    or exists (
      select 1
      from ${messages}
      where ${messages.id} = ${events.message_id}
        and lower(${messages.subject}) like ${normalized}
    )
  )`;
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

export const list: AppRouteHandler<ListRoute> = async (c) => {
  const db = createDb(c.env);
  const { id } = c.req.valid('param');
  const query = c.req.valid('query');

  const [source] = await db
    .select({ id: sources.id })
    .from(sources)
    .where(eq(sources.id, id))
    .limit(1);

  if (!source) {
    return c.json(
      {
        message: HttpStatusPhrases.NOT_FOUND,
      },
      HttpStatusCodes.NOT_FOUND,
    );
  }

  const {
    search,
    eventTypes,
    bounceTypes,
    selectedTags,
    page,
    perPage,
    range: { start, end },
  } = parseEventListQuery(query);

  const baseFilters = filterSql([
    eq(events.source_id, source.id),
    buildEventSearchFilter(search),
    start ? gte(events.event_at, start) : undefined,
    end ? lte(events.event_at, end) : undefined,
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

  const pagedEvents = db.$with('paged_events').as(
    db
      .select({
        id: events.id,
        event_type: events.event_type,
        recipient_email: events.recipient_email,
        event_at: events.event_at,
        message_id: events.message_id,
        bounce_type: events.bounce_type,
      })
      .from(events)
      .where(and(...listFilters))
      .orderBy(desc(events.event_at))
      .limit(perPage)
      .offset((page - 1) * perPage),
  );

  const [totalRows, rows, countRows, tagCountRows] = await Promise.all([
    db
      .select({ total: count() })
      .from(events)
      .where(and(...listFilters)),
    db
      .with(pagedEvents)
      .select({
        id: pagedEvents.id,
        event_type: pagedEvents.event_type,
        recipient_email: pagedEvents.recipient_email,
        event_at: pagedEvents.event_at,
        message_id: pagedEvents.message_id,
        ses_message_id: messages.ses_message_id,
        bounce_type: pagedEvents.bounce_type,
        message_subject: messages.subject,
      })
      .from(pagedEvents)
      .innerJoin(messages, eq(pagedEvents.message_id, messages.id))
      .orderBy(desc(pagedEvents.event_at)),
    db
      .select({
        event_type: events.event_type,
        bounce_type: events.bounce_type,
        count: count(),
      })
      .from(events)
      .where(and(...baseFilters))
      .groupBy(events.event_type, events.bounce_type),
    db
      .select({
        key: messageTags.key,
        value: messageTags.value,
        count: count(),
      })
      .from(events)
      .innerJoin(
        messageTags,
        and(
          eq(messageTags.message_id, events.message_id),
          eq(messageTags.source_id, events.source_id),
        ),
      )
      .where(and(eq(messageTags.source_id, source.id), ...nonTagListFilters))
      .groupBy(messageTags.key, messageTags.value),
  ]);

  const [{ total }] = totalRows;

  const rowMessageIds = [...new Set(rows.map((row) => row.message_id))];
  const rowTags =
    rowMessageIds.length > 0
      ? (
          await Promise.all(
            Array.from({ length: Math.ceil(rowMessageIds.length / 99) }, (_, index) =>
              db
                .select({
                  message_id: messageTags.message_id,
                  key: messageTags.key,
                  value: messageTags.value,
                })
                .from(messageTags)
                .where(
                  and(
                    eq(messageTags.source_id, source.id),
                    inArray(
                      messageTags.message_id,
                      rowMessageIds.slice(index * 99, (index + 1) * 99),
                    ),
                  ),
                )
                .orderBy(asc(messageTags.key), asc(messageTags.value)),
            ),
          )
        ).flat()
      : [];

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
      data: rows.map(({ message_id, event_type, ...row }) => ({
        ...row,
        event_type: event_type as EventType,
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
