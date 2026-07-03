import { z } from '@hono/zod-openapi';
import * as HttpStatusPhrases from 'stoker/http-status-phrases';

import {
  BOUNCE_TYPES,
  EVENT_TYPE_VALUES,
  type BounceType,
  type EventType,
} from '../../shared/event-filters';

export { BOUNCE_TYPES, EVENT_TYPE_VALUES };
export type { BounceType, EventType };

export const ZOD_ERROR_MESSAGES = {
  REQUIRED: 'Required',
  EXPECTED_NUMBER: 'Invalid input: expected number, received NaN',
  NO_UPDATES: 'No updates provided',
  EXPECTED_STRING: 'Invalid input: expected string, received undefined',
};

export const ZOD_ERROR_CODES = {
  INVALID_UPDATES: 'invalid_updates',
};

export const notFoundSchema = z.object({
  message: z.string().openapi({ example: HttpStatusPhrases.NOT_FOUND }),
});

export const EVENT_TYPES = {
  send: 'Send',
  delivery: 'Delivery',
  bounce: 'Bounce',
  complaint: 'Complaint',
  reject: 'Reject',
  delivery_delay: 'DeliveryDelay',
  rendering_failure: 'RenderingFailure',
  subscription: 'Subscription',
  open: 'Open',
  click: 'Click',
} as const satisfies Record<string, EventType>;

export const SOURCE_COLORS = [
  'purple',
  'blue',
  'cyan',
  'green',
  'red',
  'orange',
  'yellow',
  'gray',
] as const;

export const DEFAULT_SOURCE_COLOR = 'blue' as const;
