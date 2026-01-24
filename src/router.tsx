import {
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
} from '@tanstack/react-router'

import App from './App'
import EventsPage from './pages/Events'

const RootLayout = () => (
  <div className="shell">
    <nav className="nav">
      <div className="nav-brand">
        <span className="nav-title">Sessy</span>
        <span className="nav-subtitle">Sources</span>
      </div>
      <div className="nav-links">
        <Link className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} to="/events">
          Events
        </Link>
        <Link
          className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          to="/sources"
        >
          Sources
        </Link>
        <Link
          className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          to="/setup"
        >
          Setup
        </Link>
      </div>
    </nav>
    <Outlet />
  </div>
)

const SetupPage = () => (
  <div className="app">
    <header className="topbar">
      <div>
        <p className="eyebrow">Setup guidance</p>
        <h1>Connect SES + SNS</h1>
      </div>
    </header>
    <section className="panel">
      <h2>Where to start</h2>
      <p className="muted">
        Setup instructions are specific to each source. Visit the Sources page,
        select a source, then open the Setup tab to get the exact webhook URL
        and SNS configuration values.
      </p>
      <Link className="button primary" to="/sources">
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
  component: EventsPage,
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

const setupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/setup',
  component: SetupPage,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  sourcesRoute,
  eventsRoute,
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
