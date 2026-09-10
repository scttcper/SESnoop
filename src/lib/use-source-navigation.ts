import { useNavigate, useLocation } from '@tanstack/react-router';

export function useSourceAwareNavigation() {
  const location = useLocation();
  const navigate = useNavigate();

  const switchSource = (newSourceId: string) => {
    const currentPath = location.pathname;
    const match = currentPath.match(/^\/s\/([^/]+)(.*)/);

    if (currentPath === '/' || currentPath === '/dashboard' || match?.[2] === '/dashboard') {
      navigate({
        to: '/s/$sourceId/dashboard',
        params: { sourceId: newSourceId },
        search: { period: location.search.period ?? '30' },
      });
    } else if (match) {
      navigate({ to: `/s/${newSourceId}${match[2] || '/events'}` });
    } else {
      navigate({ to: '/s/$sourceId/events', params: { sourceId: newSourceId } });
    }
  };

  return { switchSource };
}
