import { queryOptions, skipToken } from '@tanstack/react-query';

import type { Source } from '../../worker/db/schema';
import type {
  EventCounts,
  EventResponse,
  EventRow,
} from '../../worker/routes/events/events.routes';
import type { MessageDetail } from '../../worker/routes/messages/messages.routes';
import type { OverviewResponse } from '../../worker/routes/overview/overview.routes';
import type { SetupInfo } from '../../worker/routes/sources/sources.routes';

export type {
  EventCounts,
  EventResponse,
  EventRow,
  MessageDetail,
  OverviewResponse,
  SetupInfo,
  Source,
};

export const sourcesQueryOptions = queryOptions({
  queryKey: ['sources'],
  queryFn: async () => {
    const response = await fetch('/api/sources');
    if (!response.ok) {
      throw new Error('Failed to load sources');
    }
    return (await response.json()) as Source[];
  },
});

export const sourceSetupQueryOptions = (sourceId: number | null | undefined) =>
  queryOptions({
    queryKey: ['sources', sourceId, 'setup'],
    queryFn: sourceId
      ? async () => {
          const response = await fetch(`/api/sources/${sourceId}/setup`);
          if (!response.ok) {
            throw new Error('Failed to load setup instructions');
          }
          return (await response.json()) as SetupInfo;
        }
      : skipToken,
  });

export const overviewQueryOptions = (sourceId: number | null | undefined) =>
  queryOptions({
    queryKey: ['sources', sourceId, 'overview'],
    queryFn: sourceId
      ? async () => {
          const response = await fetch(`/api/sources/${sourceId}/overview`);
          if (!response.ok) {
            throw new Error('Failed to load overview');
          }
          return (await response.json()) as OverviewResponse;
        }
      : skipToken,
  });

export const eventsQueryOptions = (
  sourceId: number | null | undefined,
  params: string, // passed as pre-built query string for now to match existing logic
) =>
  queryOptions({
    queryKey: ['events', sourceId, params],
    queryFn: sourceId
      ? async () => {
          const response = await fetch(`/api/sources/${sourceId}/events?${params}`);
          if (!response.ok) {
            throw new Error('Failed to load events');
          }
          return (await response.json()) as EventResponse;
        }
      : skipToken,
  });

export const messageQueryOptions = (
  sourceId: number | null | undefined,
  sesMessageId: string | null | undefined,
) =>
  queryOptions({
    queryKey: ['messages', sourceId, sesMessageId],
    queryFn:
      sourceId && sesMessageId
        ? async () => {
            const response = await fetch(`/api/sources/${sourceId}/messages/${sesMessageId}`);
            if (!response.ok) {
              throw new Error('Failed to load message');
            }
            return (await response.json()) as MessageDetail;
          }
        : skipToken,
  });

// Mutation functions
export const createSourceFn = async (payload: {
  name: string;
  color: string;
  retention_days?: number;
}) => {
  const response = await fetch('/api/sources', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error('Failed to create source');
  }
  return (await response.json()) as Source;
};

export const updateSourceFn = async ({
  id,
  payload,
}: {
  id: number;
  payload: { name: string; color: string; retention_days?: number };
}) => {
  const response = await fetch(`/api/sources/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error('Failed to update source');
  }
  return response.json();
};

export const deleteSourceFn = async (id: number) => {
  const response = await fetch(`/api/sources/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete source');
  }
  return response.json(); // assuming it returns something or empty
};
