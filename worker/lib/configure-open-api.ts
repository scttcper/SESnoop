import { apiReference } from '@scalar/hono-api-reference';

import packageJSON from '../../package.json';

import type { AppOpenAPI } from './types';

export default function configureOpenAPI(app: AppOpenAPI) {
  app.doc('/api/doc', {
    openapi: '3.0.0',
    info: {
      version: packageJSON.version,
      title: 'SESnoop API',
    },
  });

  app.get(
    '/api/reference',
    apiReference({
      theme: 'kepler',
      layout: 'classic',
      defaultHttpClient: {
        targetKey: 'js',
        clientKey: 'fetch',
      },
      spec: {
        url: '/api/doc',
      },
    } as Parameters<typeof apiReference>[0]),
  );
}
