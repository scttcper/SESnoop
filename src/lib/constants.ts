/**
 * Shared constants for event types, bounce types, and date range presets.
 * These are used across the router validation and UI components.
 */

// Event types from SES notifications
export const EVENT_TYPES = [
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
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

// Bounce types from SES notifications
export const BOUNCE_TYPES = ['Permanent', 'Transient', 'Undetermined'] as const;

export type BounceType = (typeof BOUNCE_TYPES)[number];

// Date range preset values
export const DATE_RANGE_VALUES = [
  'last_30_days',
  'today',
  'yesterday',
  'last_7_days',
  'last_45_days',
  'last_90_days',
  'all_time',
  'custom',
] as const;

export type DateRangeValue = (typeof DATE_RANGE_VALUES)[number];

export const DEFAULT_DATE_RANGE: DateRangeValue = 'last_30_days';

// Date range presets with display labels
export const DATE_PRESETS: ReadonlyArray<{ value: DateRangeValue; label: string }> = [
  { value: 'last_30_days', label: 'Last 30 days' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last_7_days', label: 'Last 7 days' },
  { value: 'last_45_days', label: 'Last 45 days' },
  { value: 'last_90_days', label: 'Last 90 days' },
  { value: 'all_time', label: 'All time' },
  { value: 'custom', label: 'Custom range' },
];

// Default page number for pagination
export const DEFAULT_PAGE = 1;
