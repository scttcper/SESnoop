import type { QueryClient } from '@tanstack/react-query';
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  HeadContent,
  Scripts,
  lazyRouteComponent,
  redirect,
  stripSearchParams,
} from '@tanstack/react-router';
import { zodValidator } from '@tanstack/zod-adapter';
import { Suspense } from 'react';
import { z } from 'zod';

import { BOUNCE_TYPES, DATE_RANGE_VALUES, EVENT_TYPE_VALUES } from '../shared/event-filters';

import { AuthError, sessionQueryOptions } from './lib/auth';
import {
  DASHBOARD_PERIODS,
  DEFAULT_DASHBOARD_PERIOD,
  DEFAULT_DATE_RANGE,
  DEFAULT_EVENT_TYPES,
  DEFAULT_PAGE,
} from './lib/constants';
import {
  eventsQueryOptions,
  messageQueryOptions,
  overviewPeriodQueryOptions,
  sourceSetupQueryOptions,
  sourcesQueryOptions,
} from './lib/queries';
import { queryClient } from './lib/query-client';
import { parseSearch, searchArray, stringifySearch } from './lib/search-params';
import { readStoredSourceId } from './lib/use-active-source';
import { formatShortMessageId } from './lib/utils';

const AppLayout = lazyRouteComponent(() => import('./components/layout/AppLayout'), 'AppLayout');
const DashboardPage = lazyRouteComponent(() => import('./pages/Dashboard'));
const EventsPage = lazyRouteComponent(() => import('./pages/Events'));
const LoginPage = lazyRouteComponent(() => import('./pages/Login'));
const MessageDetailPage = lazyRouteComponent(() => import('./pages/MessageDetail'));
const NewSourcePage = lazyRouteComponent(() => import('./pages/NewSource'));
const SourcesPage = lazyRouteComponent(() => import('./pages/Sources'));
const SourceSettingsPage = lazyRouteComponent(() => import('./pages/SourceSettings'));
const SourceSetupPage = lazyRouteComponent(() => import('./pages/SourceSetup'));

const RootLayout = () => (
  <>
    <HeadContent />
    <Suspense fallback={<div className="p-8 text-white/50">Loading...</div>}>
      <Outlet />
    </Suspense>
    <Scripts />
  </>
);

const rootRoute = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      {
        title: 'SESnoop',
      },
    ],
  }),
  component: RootLayout,
});

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'app',
  component: AppLayout,
  beforeLoad: async ({ context, location }) => {
    try {
      const session = await context.queryClient.fetchQuery(sessionQueryOptions);
      if (!session.enabled) {
        return;
      }
    } catch (error) {
      if (error instanceof AuthError) {
        const redirectTo = location.href;
        throw redirect({
          to: '/login',
          search: {
            redirect: redirectTo,
          },
        });
      }
      throw error;
    }
  },
  // The navbar source switcher needs sources on every page.
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(sourcesQueryOptions);
  },
});

const loginSearchSchema = z.object({
  redirect: z.string().catch('').default(''),
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  validateSearch: zodValidator(loginSearchSchema),
  component: LoginPage,
  head: () => ({
    meta: [{ title: 'Login | SESnoop' }],
  }),
});

const dashboardSearchSchema = z.object({
  period: z.coerce
    .number()
    .pipe(z.union(DASHBOARD_PERIODS.map((period) => z.literal(period))))
    .catch(DEFAULT_DASHBOARD_PERIOD)
    .default(DEFAULT_DASHBOARD_PERIOD),
});

// `/` and `/dashboard` open the last viewed source, falling back to the first one.
const redirectToSourceDashboard = async (client: QueryClient) => {
  const sources = await client.ensureQueryData(sourcesQueryOptions);
  const storedSourceId = readStoredSourceId();
  const source = sources.find((item) => item.id === storedSourceId) ?? sources[0];
  if (!source) {
    throw redirect({ to: '/sources' });
  }
  throw redirect({ to: '/s/$sourceId/dashboard', params: { sourceId: source.id } });
};

const indexRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/',
  beforeLoad: ({ context }) => redirectToSourceDashboard(context.queryClient),
});

const dashboardRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/dashboard',
  beforeLoad: ({ context }) => redirectToSourceDashboard(context.queryClient),
});

const sourcesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/sources',
  component: SourcesPage,
  head: () => ({
    meta: [{ title: 'Sources | SESnoop' }],
  }),
});

const newSourceRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/sources/new',
  component: NewSourcePage,
  head: () => ({
    meta: [{ title: 'New source | SESnoop' }],
  }),
});

const sourceMonitorRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 's/$sourceId',
  params: {
    parse: ({ sourceId }) => ({ sourceId: z.coerce.number().int().positive().parse(sourceId) }),
    stringify: ({ sourceId }) => ({ sourceId: String(sourceId) }),
  },
  onError: () => {
    throw redirect({ to: '/sources' });
  },
});

const eventFilterSearchSchema = z.object({
  search: z.coerce.string().catch('').default(''),
  // An empty list means every event type.
  event_types: searchArray(z.enum(EVENT_TYPE_VALUES))
    .catch([...DEFAULT_EVENT_TYPES])
    .default([...DEFAULT_EVENT_TYPES]),
  bounce_types: searchArray(z.enum(BOUNCE_TYPES)).catch([]).default([]),
  tags: searchArray(z.coerce.string()).catch([]).default([]),
  date_range: z.enum(DATE_RANGE_VALUES).catch(DEFAULT_DATE_RANGE).default(DEFAULT_DATE_RANGE),
  from: z.string().catch('').default(''),
  to: z.string().catch('').default(''),
  page: z.coerce.number().int().positive().catch(DEFAULT_PAGE).default(DEFAULT_PAGE),
});

export type EventsSearchParams = z.infer<typeof eventFilterSearchSchema>;

const eventFilterDefaults = {
  search: '',
  event_types: [...DEFAULT_EVENT_TYPES],
  bounce_types: [],
  tags: [],
  date_range: DEFAULT_DATE_RANGE,
  from: '',
  to: '',
  page: DEFAULT_PAGE,
} satisfies EventsSearchParams;

const sourceEventsRoute = createRoute({
  getParentRoute: () => sourceMonitorRoute,
  path: 'events',
  validateSearch: zodValidator(eventFilterSearchSchema),
  search: { middlewares: [stripSearchParams(eventFilterDefaults)] },
  loaderDeps: ({ search }) => search,
  loader: ({ context, params, deps }) => {
    void context.queryClient.prefetchQuery(eventsQueryOptions(params.sourceId, deps));
  },
  component: EventsPage,
  head: () => ({
    meta: [{ title: `Events | SESnoop` }],
  }),
});

const sourceSettingsRoute = createRoute({
  getParentRoute: () => sourceMonitorRoute,
  path: 'settings',
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(sourcesQueryOptions);
  },
  component: SourceSettingsPage,
  head: () => ({
    meta: [{ title: `Settings | SESnoop` }],
  }),
});

const sourceSetupRoute = createRoute({
  getParentRoute: () => sourceMonitorRoute,
  path: 'setup',
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(sourceSetupQueryOptions(params.sourceId));
  },
  component: SourceSetupPage,
  head: () => ({
    meta: [{ title: `Setup | SESnoop` }],
  }),
});

const sourceDashboardRoute = createRoute({
  getParentRoute: () => sourceMonitorRoute,
  path: 'dashboard',
  validateSearch: zodValidator(dashboardSearchSchema),
  search: { middlewares: [stripSearchParams({ period: DEFAULT_DASHBOARD_PERIOD })] },
  loaderDeps: ({ search }) => ({ period: search.period }),
  loader: ({ context, params, deps }) => {
    void context.queryClient.prefetchQuery(
      overviewPeriodQueryOptions(params.sourceId, deps.period),
    );
  },
  component: DashboardPage,
  head: () => ({
    meta: [{ title: `Dashboard | SESnoop` }],
  }),
});

const sourceMessageDetailRoute = createRoute({
  getParentRoute: () => sourceMonitorRoute,
  path: 'messages/$sesMessageId',
  // Carries the event filters so "Back to events" returns to the same list.
  validateSearch: zodValidator(eventFilterSearchSchema),
  search: { middlewares: [stripSearchParams(eventFilterDefaults)] },
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(
      messageQueryOptions(params.sourceId, params.sesMessageId),
    );
  },
  component: MessageDetailPage,
  head: ({ params }) => ({
    meta: [{ title: `Message ${formatShortMessageId(params.sesMessageId)} | SESnoop` }],
  }),
});

const eventsRedirectRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/events',
  beforeLoad: () => {
    throw redirect({ to: '/sources' });
  },
});

const setupRedirectRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/setup',
  beforeLoad: () => {
    throw redirect({ to: '/sources' });
  },
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  appRoute.addChildren([
    indexRoute,
    dashboardRoute,
    sourcesRoute,
    newSourceRoute,
    sourceMonitorRoute.addChildren([
      sourceEventsRoute,
      sourceSettingsRoute,
      sourceSetupRoute,
      sourceDashboardRoute,
      sourceMessageDetailRoute,
    ]),
    eventsRedirectRoute,
    setupRedirectRoute,
  ]),
]);

export const router = createRouter({
  routeTree,
  context: { queryClient },
  parseSearch,
  stringifySearch,
  defaultPreload: 'intent',
  // React Query owns caching, so the router always runs loaders and lets queries dedupe.
  defaultPreloadStaleTime: 0,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
