import {
  BOUNCE_TYPES,
  DATE_RANGE_VALUES,
  DEFAULT_DATE_RANGE,
  EVENT_TYPE_VALUES,
  type BounceType,
  type DateRangeValue,
  type EventType,
} from '../../shared/event-filters';

export { BOUNCE_TYPES, DATE_RANGE_VALUES, DEFAULT_DATE_RANGE };
export type { BounceType, DateRangeValue, EventType };

export const EVENT_TYPES = EVENT_TYPE_VALUES;

export const DEFAULT_EVENT_TYPES: readonly EventType[] = ['Send'];

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
