import { QueryClient, QueryCache } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      gcTime: 5 * 60_000,
      retry: (failureCount, error: any) => {
        if (error?.response?.status === 401) return false
        return failureCount < 3
      },
    },
  },
  queryCache: new QueryCache({
    onError: (error, query) => {
      // Logic for global error handling can go here (e.g. toasts)
      // For now we will just log it
      console.error('Background error:', error)
    },
  }),
})
