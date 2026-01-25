import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  HeadContent,
  Scripts,
  redirect,
} from '@tanstack/react-router';
import { fallback, zodValidator } from '@tanstack/zod-adapter';
import { z } from 'zod';

import { AppLayout } from './components/layout/AppLayout';
import { AuthError, getSession } from './lib/auth';
import { DEFAULT_DATE_RANGE, DEFAULT_PAGE } from './lib/constants';
import DashboardPage from './pages/Dashboard';
import EventsPage from './pages/Events';
import LoginPage from './pages/Login';
import MessageDetailPage from './pages/MessageDetail';
import SourcesPage from './pages/Sources';
import SourceSettingsPage from './pages/SourceSettings';
import SourceSetupPage from './pages/SourceSetup';

const RootLayout = () => (
  <>
    <HeadContent />
    <Outlet />
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
      const session = await getSession();
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
  redirect: fallback(z.string(), '').default(''),
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

const indexRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/',
  component: DashboardPage,
  head: () => ({
    meta: [{ title: 'Dashboard | SESnoop' }],
  }),
});

const dashboardRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/dashboard',
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

const eventsSearchSchema = z.object({
  search: fallback(z.string(), '').default(''),
  event_types: fallback(z.array(z.string()), []).default([]),
  bounce_types: fallback(z.array(z.string()), []).default([]),
  date_range: fallback(z.string(), DEFAULT_DATE_RANGE).default(DEFAULT_DATE_RANGE),
  from: fallback(z.string(), '').default(''),
  to: fallback(z.string(), '').default(''),
  page: fallback(z.number(), DEFAULT_PAGE).default(DEFAULT_PAGE),
});

export type EventsSearchParams = z.infer<typeof eventsSearchSchema>;

const sourceEventsRoute = createRoute({
  getParentRoute: () => sourceMonitorRoute,
  path: 'events',
  validateSearch: zodValidator(eventsSearchSchema),
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
  component: DashboardPage,
  head: () => ({
    meta: [{ title: `Dashboard | SESnoop` }],
  }),
});

const messageDetailSearchSchema = z.object({
  sourceId: z.number().optional().catch(undefined),
  search: z.string().optional().catch(undefined),
  event_types: z.array(z.string()).optional().catch(undefined),
  bounce_types: z.array(z.string()).optional().catch(undefined),
  date_range: z.string().optional().catch(undefined),
  from: z.string().optional().catch(undefined),
  to: z.string().optional().catch(undefined),
  page: z.number().optional().catch(undefined),
});

export type MessageDetailSearchParams = z.infer<typeof messageDetailSearchSchema>;

const messageDetailRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/messages/$sesMessageId',
  validateSearch: zodValidator(messageDetailSearchSchema),
  component: MessageDetailPage,
  head: ({ params }) => ({
    meta: [{ title: `Message ${params.sesMessageId} | SESnoop` }],
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
    ]),
    messageDetailRoute,
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
