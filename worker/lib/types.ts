import type { OpenAPIHono, RouteConfig, RouteHandler } from '@hono/zod-openapi'

export interface AppBindings {
  Bindings: {
    DB: D1Database
    SNS_DISABLE_SIGNATURE_VERIFY?: string
    DB_DISABLE_TRANSACTIONS?: string
    HTTP_AUTH_USERNAME?: string
    HTTP_AUTH_PASSWORD?: string
  }
}

export type AppOpenAPI = OpenAPIHono<AppBindings>

export type AppRouteHandler<R extends RouteConfig> = RouteHandler<R, AppBindings>

export type ApiIndexResponse = {
  name: string
}

export type OpenApiDocument = {
  openapi: string
  info?: {
    title?: string
    version?: string
  }
}

export type ValidationErrorResponse = {
  success: boolean
  error: {
    name: string
    issues: Array<{
      code: string
      path: Array<string | number>
      message?: string
    }>
  }
}
