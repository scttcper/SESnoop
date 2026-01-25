import { eq } from 'drizzle-orm';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import * as HttpStatusPhrases from 'stoker/http-status-phrases';

import { createDb } from '../../db';
import { sources } from '../../db/schema';
import {
  DEFAULT_SOURCE_COLOR,
  SOURCE_COLORS,
  ZOD_ERROR_CODES,
  ZOD_ERROR_MESSAGES,
} from '../../lib/constants';
import { runRetentionCleanupForSource } from '../../lib/retention';
import type { AppRouteHandler } from '../../lib/types';

import type {
  CleanupRoute,
  CreateRoute,
  GetOneRoute,
  ListRoute,
  PatchRoute,
  RemoveRoute,
  SetupRoute,
} from './sources.routes';

const MAX_TOKEN_ATTEMPTS = 5;

type SourceColor = (typeof SOURCE_COLORS)[number];

type DbSource = {
  id: number;
  name: string;
  token: string;
  color: string;
  retention_days: number | null;
  created_at: Date;
  updated_at: Date;
};

const serializeSource = (source: DbSource) => ({
  id: source.id,
  name: source.name,
  token: source.token,
  color: source.color as SourceColor,
  retention_days: source.retention_days,
  created_at: source.created_at.getTime(),
  updated_at: source.updated_at.getTime(),
});

const isUniqueConstraintError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }
  return /unique/i.test(error.message);
};

const toSlug = (value: string): string => {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.length > 0 ? slug : 'source';
};

export const list: AppRouteHandler<ListRoute> = async (c) => {
  const db = createDb(c.env);
  const sourcesList = await db.query.sources.findMany();
  return c.json(sourcesList.map(serializeSource));
};

export const create: AppRouteHandler<CreateRoute> = async (c) => {
  const db = createDb(c.env);
  const payload = c.req.valid('json');
  const color = payload.color ?? DEFAULT_SOURCE_COLOR;
  const retentionDays = payload.retention_days ?? undefined;

  for (let attempt = 0; attempt < MAX_TOKEN_ATTEMPTS; attempt += 1) {
    const token = crypto.randomUUID();
    try {
      const [inserted] = await db
        .insert(sources)
        .values({
          name: payload.name,
          token,
          color,
          retention_days: retentionDays,
        })
        .returning();
      return c.json(serializeSource(inserted), HttpStatusCodes.OK);
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }
    }
  }

  return c.json(
    { message: 'Failed to create a unique token' },
    HttpStatusCodes.INTERNAL_SERVER_ERROR,
  );
};

export const getOne: AppRouteHandler<GetOneRoute> = async (c) => {
  const db = createDb(c.env);
  const { id } = c.req.valid('param');
  const source = await db.query.sources.findFirst({
    where(fields, operators) {
      return operators.eq(fields.id, id);
    },
  });

  if (!source) {
    return c.json(
      {
        message: HttpStatusPhrases.NOT_FOUND,
      },
      HttpStatusCodes.NOT_FOUND,
    );
  }

  return c.json(serializeSource(source), HttpStatusCodes.OK);
};

export const patch: AppRouteHandler<PatchRoute> = async (c) => {
  const db = createDb(c.env);
  const { id } = c.req.valid('param');
  const updates = c.req.valid('json');

  if (Object.keys(updates).length === 0) {
    return c.json(
      {
        success: false,
        error: {
          issues: [
            {
              code: ZOD_ERROR_CODES.INVALID_UPDATES,
              path: [],
              message: ZOD_ERROR_MESSAGES.NO_UPDATES,
            },
          ],
          name: 'ZodError',
        },
      },
      HttpStatusCodes.UNPROCESSABLE_ENTITY,
    );
  }

  const [source] = await db
    .update(sources)
    .set({
      ...updates,
      updated_at: new Date(),
    })
    .where(eq(sources.id, id))
    .returning();

  if (!source) {
    return c.json(
      {
        message: HttpStatusPhrases.NOT_FOUND,
      },
      HttpStatusCodes.NOT_FOUND,
    );
  }

  return c.json(serializeSource(source), HttpStatusCodes.OK);
};

export const remove: AppRouteHandler<RemoveRoute> = async (c) => {
  const db = createDb(c.env);
  const { id } = c.req.valid('param');
  const deleted = await db.delete(sources).where(eq(sources.id, id)).returning({ id: sources.id });

  if (deleted.length === 0) {
    return c.json(
      {
        message: HttpStatusPhrases.NOT_FOUND,
      },
      HttpStatusCodes.NOT_FOUND,
    );
  }

  return c.body(null, HttpStatusCodes.NO_CONTENT);
};

export const setup: AppRouteHandler<SetupRoute> = async (c) => {
  const db = createDb(c.env);
  const { id } = c.req.valid('param');
  const source = await db.query.sources.findFirst({
    where(fields, operators) {
      return operators.eq(fields.id, id);
    },
  });

  if (!source) {
    return c.json(
      {
        message: HttpStatusPhrases.NOT_FOUND,
      },
      HttpStatusCodes.NOT_FOUND,
    );
  }

  const slug = toSlug(source.name);
  const configurationSetName = `sesnoop-${slug}-config`;
  const snsTopicName = `sesnoop-${slug}-sns`;
  const origin = new URL(c.req.url).origin;
  const webhookUrl = `${origin}/api/webhooks/${source.token}`;

  const steps = [
    `Create an SNS topic named "${snsTopicName}".`,
    `Create or choose an SES configuration set named "${configurationSetName}".`,
    `Add an HTTPS subscription to the SNS topic using "${webhookUrl}".`,
    'In SES, add an Event Destination that publishes delivery, bounce, complaint, reject, delivery delay, rendering failure, open, click, and subscription events to the SNS topic.',
  ];

  return c.json(
    {
      source: serializeSource(source),
      configuration_set_name: configurationSetName,
      sns_topic_name: snsTopicName,
      webhook_url: webhookUrl,
      steps,
    },
    HttpStatusCodes.OK,
  );
};

export const cleanup: AppRouteHandler<CleanupRoute> = async (c) => {
  const db = createDb(c.env);
  const { id } = c.req.valid('param');
  const source = await db.query.sources.findFirst({
    where(fields, operators) {
      return operators.eq(fields.id, id);
    },
  });

  if (!source) {
    return c.json(
      {
        message: HttpStatusPhrases.NOT_FOUND,
      },
      HttpStatusCodes.NOT_FOUND,
    );
  }

  const result = await runRetentionCleanupForSource(c.env, {
    id: source.id,
    retention_days: source.retention_days,
  });

  return c.json(result, HttpStatusCodes.OK);
};
