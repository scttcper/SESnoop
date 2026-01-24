import {
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
} from '@tanstack/react-router'

import App from './App'
import DashboardPage from './pages/Dashboard'
import EventsPage from './pages/Events'
import MessageDetailPage from './pages/MessageDetail'

const RootLayout = () => (
  <div className="flex flex-col min-h-screen font-sans selection:bg-white/20">
    <nav className="sticky top-0 z-50 w-full border-b border-white/10 bg-[#0B0C0E]/80 backdrop-blur-md supports-[backdrop-filter]:bg-[#0B0C0E]/60">
      <div className="flex h-14 items-center px-4 md:px-6 max-w-7xl mx-auto w-full">
        <div className="mr-8 flex items-center space-x-2">
          <span className="font-display font-bold text-lg tracking-tight">
            SESnoop
          </span>
        </div>
        <div className="flex items-center space-x-6 text-sm font-medium">
          <Link
            to="/dashboard"
            className="text-white/60 transition-colors hover:text-white [&.active]:text-white"
          >
            Dashboard
          </Link>
          <Link
            to="/events"
            className="text-white/60 transition-colors hover:text-white [&.active]:text-white"
          >
            Events
          </Link>
          <Link
            to="/sources"
            className="text-white/60 transition-colors hover:text-white [&.active]:text-white"
          >
            Sources
          </Link>
          <Link
            to="/setup"
            className="text-white/60 transition-colors hover:text-white [&.active]:text-white"
          >
            Setup
          </Link>
        </div>
      </div>
    </nav>
    <main className="flex-1 max-w-7xl mx-auto w-full">
      <Outlet />
    </main>
  </div>
)

const SetupPage = () => (
  <div className="container max-w-2xl mx-auto py-12 px-4">
    <header className="mb-10">
      <p className="text-sm text-blue-400 font-medium mb-2">Setup guidance</p>
      <h1 className="text-3xl font-display font-bold tracking-tight">Connect SES + SNS</h1>
    </header>
    <section className="rounded-xl border border-white/10 bg-white/[0.02] p-6 md:p-8">
      <h2 className="text-xl font-semibold mb-4">Where to start</h2>
      <p className="text-white/60 leading-relaxed mb-6">
        Setup instructions are specific to each source. Visit the Sources page,
        select a source, then open the Setup tab to get the exact webhook URL
        and SNS configuration values.
      </p>
      <Link 
        to="/sources"
        className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-white/10 text-white hover:bg-white/20 border border-white/10 h-10 px-4 py-2 shadow-sm"
      >
        Go to sources
      </Link>
    </section>
  </div>
)

const rootRoute = createRootRoute({
  component: RootLayout,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: DashboardPage,
})

const sourcesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sources',
  component: App,
})

const eventsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/events',
  component: EventsPage,
})

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dashboard',
  component: DashboardPage,
})

const messageDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/messages/$sesMessageId',
  component: MessageDetailPage,
})

const setupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/setup',
  component: SetupPage,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  sourcesRoute,
  eventsRoute,
  dashboardRoute,
  messageDetailRoute,
  setupRoute,
])

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
