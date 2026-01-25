import { z } from '@hono/zod-openapi';
import { relations, sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

import { SOURCE_COLORS } from '../lib/constants';

const timestampMs = (name: string) =>
  integer(name, { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`);

const timestampMsNullable = (name: string) => integer(name, { mode: 'timestamp_ms' });

export const tasks = sqliteTable('tasks', {
  id: integer({ mode: 'number' }).primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  done: integer({ mode: 'boolean' }).notNull().default(false),
});

export const sources = sqliteTable(
  'sources',
  {
    id: integer({ mode: 'number' }).primaryKey({ autoIncrement: true }),
    name: text().notNull(),
    token: text().notNull(),
    color: text().notNull(),
    retention_days: integer({ mode: 'number' }),
    created_at: timestampMs('created_at'),
    updated_at: timestampMs('updated_at'),
  },
  (table) => ({
    tokenUnique: uniqueIndex('sources_token_unique').on(table.token),
  }),
);

export const messages = sqliteTable(
  'messages',
  {
    id: integer({ mode: 'number' }).primaryKey({ autoIncrement: true }),
    source_id: integer({ mode: 'number' })
      .notNull()
      .references(() => sources.id, { onDelete: 'cascade' }),
    ses_message_id: text().notNull(),
    source_email: text(),
    subject: text(),
    sent_at: timestampMsNullable('sent_at'),
    mail_metadata: text({ mode: 'json' })
      .notNull()
      .default(sql`'{}'`),
    events_count: integer({ mode: 'number' }).notNull().default(0),
    created_at: timestampMs('created_at'),
    updated_at: timestampMs('updated_at'),
  },
  (table) => ({
    sesMessageIdUnique: uniqueIndex('messages_ses_message_id_unique').on(table.ses_message_id),
    sentAtIndex: index('messages_sent_at_index').on(table.sent_at),
    sourceEmailIndex: index('messages_source_email_index').on(table.source_email),
  }),
);

export const webhooks = sqliteTable(
  'webhooks',
  {
    id: integer({ mode: 'number' }).primaryKey({ autoIncrement: true }),
    sns_message_id: text().notNull(),
    sns_type: text().notNull(),
    sns_timestamp: timestampMsNullable('sns_timestamp').notNull(),
    raw_payload: text({ mode: 'json' })
      .notNull()
      .default(sql`'{}'`),
    processed_at: timestampMsNullable('processed_at'),
    created_at: timestampMs('created_at'),
    updated_at: timestampMs('updated_at'),
  },
  (table) => ({
    snsMessageIdUnique: uniqueIndex('webhooks_sns_message_id_unique').on(table.sns_message_id),
    processedAtIndex: index('webhooks_processed_at_index').on(table.processed_at),
  }),
);

export const events = sqliteTable(
  'events',
  {
    id: integer({ mode: 'number' }).primaryKey({ autoIncrement: true }),
    message_id: integer({ mode: 'number' })
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    webhook_id: integer({ mode: 'number' }).references(() => webhooks.id, {
      onDelete: 'set null',
    }),
    event_type: text().notNull(),
    recipient_email: text().notNull(),
    event_at: timestampMsNullable('event_at').notNull(),
    ses_message_id: text().notNull(),
    event_data: text({ mode: 'json' })
      .notNull()
      .default(sql`'{}'`),
    raw_payload: text({ mode: 'json' })
      .notNull()
      .default(sql`'{}'`),
    bounce_type: text(),
    created_at: timestampMs('created_at'),
    updated_at: timestampMs('updated_at'),
  },
  (table) => ({
    dedupeUnique: uniqueIndex('events_dedupe_unique').on(
      table.ses_message_id,
      table.event_type,
      table.recipient_email,
      table.event_at,
    ),
    eventTypeIndex: index('events_event_type_index').on(table.event_type),
    recipientEmailIndex: index('events_recipient_email_index').on(table.recipient_email),
    eventAtIndex: index('events_event_at_index').on(table.event_at),
    bounceTypeIndex: index('events_bounce_type_index').on(table.bounce_type),
  }),
);

export const sourcesRelations = relations(sources, ({ many }) => ({
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  source: one(sources, {
    fields: [messages.source_id],
    references: [sources.id],
  }),
  events: many(events),
}));

export const eventsRelations = relations(events, ({ one }) => ({
  message: one(messages, {
    fields: [events.message_id],
    references: [messages.id],
  }),
  webhook: one(webhooks, {
    fields: [events.webhook_id],
    references: [webhooks.id],
  }),
}));

export const webhooksRelations = relations(webhooks, ({ many }) => ({
  events: many(events),
}));

const retentionDaysSchema = z.preprocess(
  (value) => (value === null ? undefined : value),
  z.number().int().positive().optional(),
);

export const selectSourcesSchema = z.object({
  id: z.number(),
  name: z.string(),
  token: z.string(),
  color: z.enum(SOURCE_COLORS),
  retention_days: z.number().int().positive().nullable(),
  created_at: z.number(),
  updated_at: z.number(),
});

export type Source = z.infer<typeof selectSourcesSchema>;

export const insertSourcesSchema = z.object({
  name: z.string().min(1).max(200),
  color: z.enum(SOURCE_COLORS).optional(),
  retention_days: retentionDaysSchema,
});

export const patchSourcesSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  color: z.enum(SOURCE_COLORS).optional(),
  retention_days: retentionDaysSchema.optional(),
});

// Zod schemas for tasks (manually defined for better type inference)
export const selectTasksSchema = z.object({
  id: z.number(),
  name: z.string(),
  done: z.boolean(),
});

export type Task = z.infer<typeof selectTasksSchema>;

export const insertTasksSchema = z.object({
  name: z.string().min(1).max(500),
  done: z.boolean(),
});

export const patchTasksSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  done: z.boolean().optional(),
});
