import { createRouter } from '../../lib/create-app'

import * as handlers from './messages.handlers'
import * as routes from './messages.routes'

const router = createRouter()
  .openapi(routes.getOne, handlers.getOne)

export default router
