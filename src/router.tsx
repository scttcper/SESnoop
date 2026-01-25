import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  HeadContent,
  Scripts,
  redirect,
} from '@tanstack/react-router';
import { z } from 'zod';

import { AppLayout } from './components/layout/AppLayout';
import DashboardPage from './pages/Dashboard';
import EventsPage from './pages/Events';
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

const sourceEventsRoute = createRoute({
  getParentRoute: () => sourceMonitorRoute,
  path: 'events',
  validateSearch: (search) => {
    return z
      .object({
        search: z.string().optional(),
        event_types: z
          .union([z.string(), z.array(z.string())])
          .transform((val) => (Array.isArray(val) ? val : val ? [val] : []))
          .optional(),
        bounce_types: z
          .union([z.string(), z.array(z.string())])
          .transform((val) => (Array.isArray(val) ? val : val ? [val] : []))
          .optional(),
        date_range: z.string().optional().catch('last_30_days'),
        from: z.string().optional(),
        to: z.string().optional(),
        page: z.number().optional().catch(1),
      })
      .parse(search);
  },
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

const messageDetailRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/messages/$sesMessageId',
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
