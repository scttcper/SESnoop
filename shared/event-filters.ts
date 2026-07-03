export const EVENT_TYPE_VALUES = [
  'Send',
  'Delivery',
  'Open',
  'Click',
  'Bounce',
  'Complaint',
  'DeliveryDelay',
  'Reject',
  'RenderingFailure',
  'Subscription',
] as const;

export type EventType = (typeof EVENT_TYPE_VALUES)[number];

export const BOUNCE_TYPES = ['Permanent', 'Transient', 'Undetermined'] as const;

export type BounceType = (typeof BOUNCE_TYPES)[number];

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
export const DEFAULT_EVENTS_PAGE = 1;
export const DEFAULT_EVENTS_PER_PAGE = 50;
export const MAX_EVENTS_PER_PAGE = 200;

export type SelectedTag = { key: string; value: string; label: string };

export type ResolvedDateRange = {
  start: Date | null;
  end: Date | null;
};

export type EventListQueryInput = {
  search?: string;
  event_types?: string;
  bounce_types?: string;
  tags?: string;
  date_range?: DateRangeValue;
  from?: string;
  to?: string;
  page?: number | string;
  per_page?: number | string;
};

export type ParsedEventListQuery = {
  search: string;
  eventTypes: EventType[];
  bounceTypes: BounceType[];
  selectedTags: SelectedTag[];
  page: number;
  perPage: number;
  range: ResolvedDateRange;
};

export type EventsQueryParams = {
  search?: string;
  event_types?: readonly string[];
  bounce_types?: readonly string[];
  tags?: readonly string[];
  date_range?: string;
  from?: string;
  to?: string;
  page?: number;
  per_page?: number;
};

const normalizeLookupKey = (value: string) => value.trim().toLowerCase().replaceAll(/\s+/g, ' ');

const EVENT_TYPE_BY_KEY = new Map<string, EventType>([
  ...EVENT_TYPE_VALUES.map((eventType) => [normalizeLookupKey(eventType), eventType] as const),
  ['rendering failure', 'RenderingFailure'],
]);

const BOUNCE_TYPE_BY_KEY = new Map<string, BounceType>(
  BOUNCE_TYPES.map((bounceType) => [normalizeLookupKey(bounceType), bounceType]),
);

export const normalizeEventType = (value: unknown): EventType | null => {
  if (typeof value !== 'string') {
    return null;
  }
  return EVENT_TYPE_BY_KEY.get(normalizeLookupKey(value)) ?? null;
};

export const normalizeBounceType = (value: unknown): BounceType | null => {
  if (typeof value !== 'string') {
    return null;
  }
  return BOUNCE_TYPE_BY_KEY.get(normalizeLookupKey(value)) ?? null;
};

export const isEventType = (value: string): value is EventType => normalizeEventType(value) != null;

export const isBounceType = (value: string): value is BounceType =>
  normalizeBounceType(value) != null;

export const isDateRangeValue = (value: string): value is DateRangeValue =>
  DATE_RANGE_VALUES.includes(value as DateRangeValue);

export const parseCsv = (value?: string) =>
  value
    ?.split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0) ?? [];

export const parseTags = (value?: string): SelectedTag[] => {
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

export const startOfDayUtc = (value: Date) =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));

export const endOfDayUtc = (value: Date) =>
  new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 23, 59, 59, 999),
  );

export const parseDateInput = (value?: string) => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const isValidDateInput = (value: string) => parseDateInput(value) != null;

export const resolveDateRange = ({
  preset,
  from,
  to,
  now = new Date(),
  fillMissingCustomBounds = false,
}: {
  preset?: DateRangeValue;
  from?: string;
  to?: string;
  now?: Date;
  fillMissingCustomBounds?: boolean;
}): ResolvedDateRange => {
  const fromDate = parseDateInput(from);
  const toDate = parseDateInput(to);

  if (fromDate || toDate) {
    const start = fromDate
      ? startOfDayUtc(fromDate)
      : fillMissingCustomBounds
        ? startOfDayUtc(now)
        : null;
    const end = toDate ? endOfDayUtc(toDate) : fillMissingCustomBounds ? endOfDayUtc(now) : null;
    return { start, end };
  }

  switch (preset) {
    case 'today': {
      return { start: startOfDayUtc(now), end: endOfDayUtc(now) };
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
    case 'custom':
    case 'last_30_days':
    default: {
      const start = startOfDayUtc(new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000));
      return { start, end: endOfDayUtc(now) };
    }
  }
};

export const formatDay = (value: Date) => value.toISOString().slice(0, 10);

export const buildDayRange = (start: Date, end: Date) => {
  const days: string[] = [];
  const cursor = startOfDayUtc(start);
  const endDay = startOfDayUtc(end);
  while (cursor <= endDay) {
    days.push(formatDay(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
};

const parsePositiveInt = (value: number | string | undefined, fallback: number) => {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
};

export const parseEventListQuery = (query: EventListQueryInput): ParsedEventListQuery => ({
  search: query.search?.trim() ?? '',
  eventTypes: parseCsv(query.event_types)
    .map(normalizeEventType)
    .filter((eventType): eventType is EventType => eventType != null),
  bounceTypes: parseCsv(query.bounce_types)
    .map(normalizeBounceType)
    .filter((bounceType): bounceType is BounceType => bounceType != null),
  selectedTags: parseTags(query.tags),
  page: parsePositiveInt(query.page, DEFAULT_EVENTS_PAGE),
  perPage: Math.min(parsePositiveInt(query.per_page, DEFAULT_EVENTS_PER_PAGE), MAX_EVENTS_PER_PAGE),
  range: resolveDateRange({
    preset: query.date_range,
    from: query.from,
    to: query.to,
  }),
});

export const buildEventsQueryString = (query: EventsQueryParams) => {
  const params = new URLSearchParams();
  const search = query.search?.trim();
  if (search) {
    params.set('search', search);
  }

  const eventTypes = query.event_types
    ?.map(normalizeEventType)
    .filter((eventType): eventType is EventType => eventType != null);
  if (eventTypes && eventTypes.length > 0) {
    params.set('event_types', eventTypes.join(','));
  }

  const bounceTypes = query.bounce_types
    ?.map(normalizeBounceType)
    .filter((bounceType): bounceType is BounceType => bounceType != null);
  if (bounceTypes && bounceTypes.length > 0) {
    params.set('bounce_types', bounceTypes.join(','));
  }

  if (query.tags && query.tags.length > 0) {
    params.set('tags', query.tags.join(','));
  }

  const dateRange =
    query.date_range && isDateRangeValue(query.date_range) ? query.date_range : null;
  if (dateRange && dateRange !== 'custom') {
    params.set('date_range', dateRange);
  }

  if (dateRange === 'custom' && query.from) {
    params.set('from', query.from);
  }

  if (dateRange === 'custom' && query.to) {
    params.set('to', query.to);
  }

  if (query.page != null) {
    params.set('page', query.page.toString());
  }

  if (query.per_page != null) {
    params.set('per_page', query.per_page.toString());
  }

  return params.toString();
};
