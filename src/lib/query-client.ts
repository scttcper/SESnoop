import { QueryClient, QueryCache } from '@tanstack/react-query';

import { AuthError, redirectToLogin } from './auth';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      gcTime: 5 * 60_000,
      retry: (failureCount, error: unknown) => {
        if (error instanceof AuthError) {
          return false;
        }
        return failureCount < 3;
      },
    },
  },
  queryCache: new QueryCache({
    onError: (error, _query) => {
      if (error instanceof AuthError) {
        redirectToLogin();
        return;
      }
      // Logic for global error handling can go here (e.g. toasts)
      // For now we will just log it
      console.error('Background error:', error);
    },
  }),
});
