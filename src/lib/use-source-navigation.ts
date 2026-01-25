// The current path could be e.g. /s/123/events or /s/123/dashboard
// If we switch source, we want to stay on the same "relative" page
// So we use regex to replace the source ID part of the URL
import { useNavigate, useLocation } from '@tanstack/react-router';

export function useSourceAwareNavigation() {
  const location = useLocation();
  const navigate = useNavigate();

  const switchSource = (newSourceId: string) => {
    const currentPath = location.pathname;

    // Match /s/:sourceId
    const match = currentPath.match(/^\/s\/([^/]+)(.*)/);

    if (match) {
      // match[1] is the old sourceId
      // match[2] is the rest of the path (e.g. "/events" or "/dashboard")
      const subPath = match[2] || '/events'; // default to events if empty
      // Construct new path
      navigate({ to: `/s/${newSourceId}${subPath}` });
    } else {
      // Not currently in a source context, default to dashboard? or events?
      // "dashboard page follows the same flow" -> imply default landing
      // If we are on global /dashboard, maybe we want to go to /s/ID/dashboard?
      if (currentPath === '/dashboard') {
        navigate({ to: `/s/${newSourceId}/dashboard` });
      } else {
        navigate({ to: '/s/$sourceId/events', params: { sourceId: newSourceId } });
      }
    }
  };

  return { switchSource };
}
