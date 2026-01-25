import { Scalar } from '@scalar/hono-api-reference';

import packageJSON from '../../package.json';

import type { AppOpenAPI } from './types';

export default function configureOpenAPI(app: AppOpenAPI) {
  app.doc('/api/doc', {
    openapi: '3.2.0',
    info: {
      version: packageJSON.version,
      title: 'SESnoop API',
    },
  });

  app.get(
    '/api/reference',
    Scalar({
      url: '/api/doc',
      theme: 'saturn',
      layout: 'modern',
      defaultHttpClient: {
        targetKey: 'js',
        clientKey: 'fetch',
      },
    }),
  );
}
