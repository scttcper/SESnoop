import configureOpenAPI from './lib/configure-open-api'
import createApp from './lib/create-app'
import index from './routes/index.route'
import events from './routes/events/events.index'
import messages from './routes/messages/messages.index'
import sources from './routes/sources/sources.index'
import tasks from './routes/tasks/tasks.index'
import webhooks from './routes/webhooks/webhooks.index'

const app = createApp()

configureOpenAPI(app)

const routes = [index, tasks, sources, events, messages] as const

routes.forEach((route) => {
  app.route('/api', route)
})

app.route('/', webhooks)

export type AppType = typeof routes[number]

export default app
