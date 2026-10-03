import { useMatchRoute, useNavigate } from '@tanstack/react-router';

/** Switch sources while staying on the equivalent page. */
export function useSourceAwareNavigation() {
  const navigate = useNavigate();
  const matchRoute = useMatchRoute();

  const switchSource = (sourceId: number) => {
    if (matchRoute({ to: '/s/$sourceId/dashboard' })) {
      // Keep the selected period.
      void navigate({ to: '/s/$sourceId/dashboard', params: { sourceId }, search: (prev) => prev });
    } else if (matchRoute({ to: '/s/$sourceId/setup' })) {
      void navigate({ to: '/s/$sourceId/setup', params: { sourceId } });
    } else if (matchRoute({ to: '/s/$sourceId/settings' })) {
      void navigate({ to: '/s/$sourceId/settings', params: { sourceId } });
    } else if (matchRoute({ to: '/s/$sourceId/events' })) {
      // Filters like tags and search may not apply to another source.
      void navigate({ to: '/s/$sourceId/events', params: { sourceId } });
    } else {
      // Pages outside a source and message pages, whose message belongs to the old source.
      void navigate({ to: '/s/$sourceId/dashboard', params: { sourceId } });
    }
  };

  return { switchSource };
}
