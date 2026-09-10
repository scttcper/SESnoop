import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  HeadContent,
  Scripts,
  lazyRouteComponent,
  redirect,
} from '@tanstack/react-router';
import { zodValidator } from '@tanstack/zod-adapter';
import { Suspense } from 'react';
import { z } from 'zod';

import { BOUNCE_TYPES, DATE_RANGE_VALUES, EVENT_TYPE_VALUES } from '../shared/event-filters';

import { AuthError, sessionQueryOptions } from './lib/auth';
import { DEFAULT_DATE_RANGE, DEFAULT_PAGE } from './lib/constants';
import { queryClient } from './lib/query-client';
import { formatShortMessageId } from './lib/utils';

const AppLayout = lazyRouteComponent(() => import('./components/layout/AppLayout'), 'AppLayout');
const DashboardPage = lazyRouteComponent(() => import('./pages/Dashboard'));
const EventsPage = lazyRouteComponent(() => import('./pages/Events'));
const LoginPage = lazyRouteComponent(() => import('./pages/Login'));
const MessageDetailPage = lazyRouteComponent(() => import('./pages/MessageDetail'));
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

const rootRoute = createRootRoute({
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
  beforeLoad: async ({ location }) => {
    try {
      const session = await queryClient.fetchQuery(sessionQueryOptions);
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
    .string()
    .pipe(z.enum(['7', '30', '90']))
    .catch('30')
    .default('30'),
});

const indexRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/',
  validateSearch: zodValidator(dashboardSearchSchema),
  component: DashboardPage,
  head: () => ({
    meta: [{ title: 'Dashboard | SESnoop' }],
  }),
});

const dashboardRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/dashboard',
  validateSearch: zodValidator(dashboardSearchSchema),
  component: DashboardPage,
  head: () => ({
    meta: [{ title: 'Dashboard | SESnoop' }],
  }),
});

const sourcesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/sources',
  component: SourcesPage,
  head: () => ({
    meta: [{ title: 'Sources | SESnoop' }],
  }),
});

// New Source-scoped routes wrapper
const sourceMonitorRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 's/$sourceId',
});

const eventFilterSearchSchema = z.object({
  search: z.string().catch('').default(''),
  event_types: z.array(z.enum(EVENT_TYPE_VALUES)).optional().catch(undefined),
  bounce_types: z.array(z.enum(BOUNCE_TYPES)).catch([]).default([]),
  tags: z.array(z.string()).catch([]).default([]),
  date_range: z.enum(DATE_RANGE_VALUES).catch(DEFAULT_DATE_RANGE).default(DEFAULT_DATE_RANGE),
  from: z.string().catch('').default(''),
  to: z.string().catch('').default(''),
  page: z.coerce.number().int().positive().catch(DEFAULT_PAGE).default(DEFAULT_PAGE),
});

export type EventsSearchParams = z.infer<typeof eventFilterSearchSchema>;

const sourceEventsRoute = createRoute({
  getParentRoute: () => sourceMonitorRoute,
  path: 'events',
  validateSearch: zodValidator(eventFilterSearchSchema),
  component: EventsPage,
  head: () => ({
    meta: [{ title: `Events | SESnoop` }],
  }),
});

const sourceSettingsRoute = createRoute({
  getParentRoute: () => sourceMonitorRoute,
  path: 'settings',
  component: SourceSettingsPage,
  head: () => ({
    meta: [{ title: `Settings | SESnoop` }],
  }),
});

const sourceSetupRoute = createRoute({
  getParentRoute: () => sourceMonitorRoute,
  path: 'setup',
  component: SourceSetupPage,
  head: () => ({
    meta: [{ title: `Setup | SESnoop` }],
  }),
});

const sourceDashboardRoute = createRoute({
  getParentRoute: () => sourceMonitorRoute,
  path: 'dashboard',
  validateSearch: zodValidator(dashboardSearchSchema),
  component: DashboardPage,
  head: () => ({
    meta: [{ title: `Dashboard | SESnoop` }],
  }),
});

export type MessageDetailSearchParams = z.infer<typeof eventFilterSearchSchema>;

const sourceMessageDetailRoute = createRoute({
  getParentRoute: () => sourceMonitorRoute,
  path: 'messages/$sesMessageId',
  validateSearch: zodValidator(eventFilterSearchSchema),
  component: MessageDetailPage,
  head: ({ params }) => ({
    meta: [{ title: `Message ${formatShortMessageId(params.sesMessageId)} | SESnoop` }],
  }),
});

// Legacy redirect for /events -> /sources (so user selects source)
const eventsRedirectRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/events',
  beforeLoad: () => {
    throw redirect({
      to: '/sources',
    });
  },
});

// Legacy global setup redirect might be needed?
// Or just let's remove it if user is fine. User said 'larger refactoring'
// Let's redirect /setup to /sources for now to guide them
const setupRedirectRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/setup',
  beforeLoad: () => {
    throw redirect({
      to: '/sources',
    });
  },
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  appRoute.addChildren([
    indexRoute,
    dashboardRoute,
    sourcesRoute,
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
  defaultPreload: 'intent',
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
