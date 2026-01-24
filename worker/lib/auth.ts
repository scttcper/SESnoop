import type { MiddlewareHandler } from 'hono'
import * as HttpStatusCodes from 'stoker/http-status-codes'

import type { AppBindings } from './types'

const textEncoder = new TextEncoder()

const timingSafeEqual = (left: string, right: string) => {
  const leftBytes = textEncoder.encode(left)
  const rightBytes = textEncoder.encode(right)
  const length = Math.max(leftBytes.length, rightBytes.length)
  let diff = leftBytes.length ^ rightBytes.length

  for (let i = 0; i < length; i += 1) {
    diff |= (leftBytes[i] ?? 0) ^ (rightBytes[i] ?? 0)
  }

  return diff === 0
}

const parseBasicAuth = (value: string) => {
  const [scheme, encoded] = value.split(' ')
  if (!scheme || scheme.toLowerCase() !== 'basic' || !encoded) {
    return null
  }
  try {
    const decoded = atob(encoded)
    const separatorIndex = decoded.indexOf(':')
    if (separatorIndex === -1) {
      return null
    }
    return {
      username: decoded.slice(0, separatorIndex),
      password: decoded.slice(separatorIndex + 1),
    }
  } catch {
    return null
  }
}

const unauthorized = (realm = 'SESnoop') =>
  new Response('Unauthorized', {
    status: HttpStatusCodes.UNAUTHORIZED,
    headers: {
      'WWW-Authenticate': `Basic realm="${realm}"`,
    },
  })

export const basicAuth = (): MiddlewareHandler<AppBindings> => async (c, next) => {
  if (c.req.path.startsWith('/webhooks')) {
    return next()
  }

  const username = c.env.HTTP_AUTH_USERNAME
  const password = c.env.HTTP_AUTH_PASSWORD
  if (!username || !password) {
    return next()
  }

  const header = c.req.header('Authorization')
  const parsed = header ? parseBasicAuth(header) : null
  const candidateUser = parsed?.username ?? ''
  const candidatePass = parsed?.password ?? ''

  const userMatch = timingSafeEqual(candidateUser, username)
  const passMatch = timingSafeEqual(candidatePass, password)

  if (!userMatch || !passMatch) {
    return unauthorized()
  }

  return next()
}
