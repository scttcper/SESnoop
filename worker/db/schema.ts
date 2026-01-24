import { z } from '@hono/zod-openapi'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'

import { toZodV4SchemaTyped } from '../lib/zod-utils'

export const tasks = sqliteTable('tasks', {
  id: integer({ mode: 'number' }).primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  done: integer({ mode: 'boolean' }).notNull().default(false),
})

export const selectTasksSchema = toZodV4SchemaTyped(createSelectSchema(tasks))

export const insertTasksSchema = toZodV4SchemaTyped(
  createInsertSchema(tasks, {
    name: (field) => field.min(1).max(500),
  })
    .required({ done: true })
    .omit({ id: true })
)

// @ts-expect-error partial exists on zod v4 type
export const patchTasksSchema = insertTasksSchema.partial()

export const taskIdSchema = z
  .object({
    id: z.coerce.number().int().positive(),
  })
  .openapi({
    param: {
      name: 'id',
      in: 'path',
    },
  })
