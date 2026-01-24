import * as HttpStatusPhrases from 'stoker/http-status-phrases'
import { createMessageObjectSchema } from 'stoker/openapi/schemas'

export const ZOD_ERROR_MESSAGES = {
  REQUIRED: 'Required',
  EXPECTED_NUMBER: 'Invalid input: expected number, received NaN',
  NO_UPDATES: 'No updates provided',
  EXPECTED_STRING: 'Invalid input: expected string, received undefined',
}

export const ZOD_ERROR_CODES = {
  INVALID_UPDATES: 'invalid_updates',
}

export const notFoundSchema = createMessageObjectSchema(HttpStatusPhrases.NOT_FOUND)

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
} as const

export const EVENT_TYPE_VALUES = [
  'Send',
  'Delivery',
  'Bounce',
  'Complaint',
  'Reject',
  'DeliveryDelay',
  'RenderingFailure',
  'Subscription',
  'Open',
  'Click',
] as const

export const BOUNCE_TYPES = ['Permanent', 'Transient', 'Undetermined'] as const

export const SOURCE_COLORS = [
  'purple',
  'blue',
  'cyan',
  'green',
  'red',
  'orange',
  'yellow',
  'gray',
] as const

export const DEFAULT_SOURCE_COLOR = 'blue' as const
