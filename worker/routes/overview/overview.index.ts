import { createRouter } from '../../lib/create-app'

import * as handlers from './overview.handlers'
import * as routes from './overview.routes'

const router = createRouter()
  .openapi(routes.get, handlers.get)

export default router
