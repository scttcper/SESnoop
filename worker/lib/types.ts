import type { OpenAPIHono, RouteConfig, RouteHandler } from '@hono/zod-openapi'

export interface AppBindings {
  Bindings: {
    DB: D1Database
    SNS_DISABLE_SIGNATURE_VERIFY?: string
    DB_DISABLE_TRANSACTIONS?: string
  }
}

export type AppOpenAPI = OpenAPIHono<AppBindings>

export type AppRouteHandler<R extends RouteConfig> = RouteHandler<R, AppBindings>
