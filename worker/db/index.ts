import { drizzle } from 'drizzle-orm/d1';

import type { AppBindings } from '../lib/types';

import * as schema from './schema';

export function createDb(env: AppBindings['Bindings']) {
  const db = drizzle(env.DB, { schema });
  return db;
}
