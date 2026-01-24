import { and, desc, eq, inArray, sql, type SQL } from 'drizzle-orm'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import * as HttpStatusPhrases from 'stoker/http-status-phrases'

import type { AppRouteHandler } from '../../lib/types'

import { createDb } from '../../db'
import { events, messages, sources } from '../../db/schema'
import { BOUNCE_TYPES, EVENT_TYPE_VALUES } from '../../lib/constants'

import type { ListRoute } from './events.routes'

const DEFAULT_PER_PAGE = 50
const MAX_PER_PAGE = 200

const parseCsv = (value?: string) =>
  value
    ?.split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0) ?? []

const startOfDayUtc = (value: Date) =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))

const endOfDayUtc = (value: Date) =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 23, 59, 59, 999))

const parseDateInput = (value?: string) => {
  if (!value) {
    return null
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const resolveDateRange = (preset?: string, from?: string, to?: string) => {
  const fromDate = parseDateInput(from)
  const toDate = parseDateInput(to)

  if (fromDate || toDate) {
    const start = fromDate ? startOfDayUtc(fromDate) : null
    const end = toDate ? endOfDayUtc(toDate) : null
    return { start, end }
  }

  const now = new Date()
  switch (preset) {
    case 'today': {
      const start = startOfDayUtc(now)
      return { start, end: endOfDayUtc(now) }
    }
    case 'yesterday': {
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      return { start: startOfDayUtc(yesterday), end: endOfDayUtc(yesterday) }
    }
    case 'last_7_days': {
      const start = startOfDayUtc(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000))
      return { start, end: endOfDayUtc(now) }
    }
    case 'last_45_days': {
      const start = startOfDayUtc(new Date(now.getTime() - 44 * 24 * 60 * 60 * 1000))
      return { start, end: endOfDayUtc(now) }
    }
    case 'last_90_days': {
      const start = startOfDayUtc(new Date(now.getTime() - 89 * 24 * 60 * 60 * 1000))
      return { start, end: endOfDayUtc(now) }
    }
    case 'all_time': {
      return { start: null, end: null }
    }
    case 'last_30_days':
    default: {
      const start = startOfDayUtc(new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000))
      return { start, end: endOfDayUtc(now) }
    }
  }
}

const buildSearchFilter = (search?: string) => {
  if (!search) {
    return undefined
  }
  const normalized = `%${search.trim().toLowerCase()}%`
  return sql`(lower(${events.recipient_email}) like ${normalized} or lower(${messages.subject}) like ${normalized})`
}

const filterSql = (items: (SQL | undefined | null)[]): SQL[] =>
  items.filter((item): item is SQL => item != null)

export const list: AppRouteHandler<ListRoute> = async (c) => {
  const db = createDb(c.env)
  const { id } = c.req.valid('param')
  const query = c.req.valid('query')

  const source = await db.query.sources.findFirst({
    where: eq(sources.id, id),
  })

  if (!source) {
    return c.json(
      {
        message: HttpStatusPhrases.NOT_FOUND,
      },
      HttpStatusCodes.NOT_FOUND
    )
  }

  const eventTypes = parseCsv(query.event_types).filter((value) =>
    EVENT_TYPE_VALUES.includes(value as (typeof EVENT_TYPE_VALUES)[number])
  )
  const bounceTypes = parseCsv(query.bounce_types).filter((value) =>
    BOUNCE_TYPES.includes(value as (typeof BOUNCE_TYPES)[number])
  )

  const page = Math.max(Number(query.page ?? 1), 1)
  const perPage = Math.min(
    Math.max(Number(query.per_page ?? DEFAULT_PER_PAGE), 1),
    MAX_PER_PAGE
  )

  const { start, end } = resolveDateRange(query.date_range, query.from, query.to)
  const startMs = start ? start.getTime() : null
  const endMs = end ? end.getTime() : null

  const baseFilters = filterSql([
    eq(messages.source_id, source.id),
    buildSearchFilter(query.search),
    startMs ? sql`${events.event_at} >= ${startMs}` : undefined,
    endMs ? sql`${events.event_at} <= ${endMs}` : undefined,
  ])

  const listFilters = filterSql([
    ...baseFilters,
    eventTypes.length ? inArray(events.event_type, eventTypes) : undefined,
    bounceTypes.length ? inArray(events.bounce_type, bounceTypes) : undefined,
  ])

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)` })
    .from(events)
    .innerJoin(messages, eq(events.message_id, messages.id))
    .where(and(...listFilters))

  const rows = await db
    .select({
      id: events.id,
      event_type: events.event_type,
      recipient_email: events.recipient_email,
      event_at: events.event_at,
      ses_message_id: events.ses_message_id,
      bounce_type: events.bounce_type,
      message_subject: messages.subject,
    })
    .from(events)
    .innerJoin(messages, eq(events.message_id, messages.id))
    .where(and(...listFilters))
    .orderBy(desc(events.event_at))
    .limit(perPage)
    .offset((page - 1) * perPage)

  const eventTypeCounts = await db
    .select({
      key: events.event_type,
      count: sql<number>`count(*)`,
    })
    .from(events)
    .innerJoin(messages, eq(events.message_id, messages.id))
    .where(and(...baseFilters))
    .groupBy(events.event_type)

  const bounceTypeCounts = await db
    .select({
      key: events.bounce_type,
      count: sql<number>`count(*)`,
    })
    .from(events)
    .innerJoin(messages, eq(events.message_id, messages.id))
    .where(and(...baseFilters, sql`${events.bounce_type} is not null`))
    .groupBy(events.bounce_type)

  const totalPages = Math.max(Math.ceil((total ?? 0) / perPage), 1)

  return c.json(
    {
      data: rows.map((row) => ({
        ...row,
        event_at: row.event_at.getTime(),
      })),
      pagination: {
        page,
        per_page: perPage,
        total: total ?? 0,
        total_pages: totalPages,
      },
      counts: {
        event_types: eventTypeCounts.reduce<Record<string, number>>(
          (acc, entry) => {
            if (entry.key) {
              acc[entry.key] = entry.count ?? 0
            }
            return acc
          },
          {}
        ),
        bounce_types: bounceTypeCounts.reduce<Record<string, number>>(
          (acc, entry) => {
            if (entry.key) {
              acc[entry.key] = entry.count ?? 0
            }
            return acc
          },
          {}
        ),
      },
    },
    HttpStatusCodes.OK
  )
}
