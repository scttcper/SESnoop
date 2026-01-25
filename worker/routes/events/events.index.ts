import { createRouter } from '../../lib/create-app';

import * as handlers from './events.handlers';
import * as routes from './events.routes';

const router = createRouter().openapi(routes.list, handlers.list);

export default router;
