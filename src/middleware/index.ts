/**
 * Transactional Auth Next - Middleware
 */

import { NextRequest, NextResponse } from 'next/server';
import type { Session } from '../types';

export interface AuthMiddlewareConfig {
  /** Cookie name for session (defaults to 'transactional_session') */
  cookieName?: string;
  /** Paths that require authentication (glob patterns) */
  protectedPaths?: string[];
  /** Paths that are always public (glob patterns) */
  publicPaths?: string[];
  /** Where to redirect unauthenticated users (defaults to '/api/auth/login') */
  loginUrl?: string;
  /** Callback to handle unauthorized access */
  onUnauthorized?: (request: NextRequest) => NextResponse | Promise<NextResponse>;
}

/**
 * Create authentication middleware for Next.js.
 *
 * @example
 * ```ts
 * // middleware.ts
 * import { createAuthMiddleware } from '@usetransactional/auth-next/middleware';
 *
 * export default createAuthMiddleware({
 *   protectedPaths: ['/dashboard/*', '/settings/*'],
 *   publicPaths: ['/', '/about', '/api/public/*'],
 * });
 *
 * export const config = {
 *   matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
 * };
 * ```
 */
export function createAuthMiddleware(config: AuthMiddlewareConfig = {}) {
  const {
    cookieName = 'transactional_session',
    protectedPaths = [],
    publicPaths = [],
    loginUrl = '/api/auth/login',
    onUnauthorized,
  } = config;

  return async (request: NextRequest): Promise<NextResponse> => {
    const { pathname } = request.nextUrl;

    // Check if path matches any public patterns
    if (isPathMatch(pathname, publicPaths)) {
      return NextResponse.next();
    }

    // Check if path matches any protected patterns
    const isProtected = protectedPaths.length === 0 || isPathMatch(pathname, protectedPaths);

    if (!isProtected) {
      return NextResponse.next();
    }

    // Check for session cookie
    const sessionCookie = request.cookies.get(cookieName);

    if (!sessionCookie?.value) {
      return handleUnauthorized(request, loginUrl, onUnauthorized);
    }

    try {
      // Decode and validate session
      const session = JSON.parse(
        Buffer.from(sessionCookie.value, 'base64').toString('utf-8')
      ) as Session;

      // Check if expired
      if (session.expiresAt < Date.now() / 1000) {
        return handleUnauthorized(request, loginUrl, onUnauthorized);
      }

      // Add user info to request headers for downstream use
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-auth-user-id', session.user.sub);
      if (session.user.email) {
        requestHeaders.set('x-auth-user-email', session.user.email);
      }

      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });
    } catch {
      return handleUnauthorized(request, loginUrl, onUnauthorized);
    }
  };
}

/**
 * Check if a path matches any of the given patterns.
 */
function isPathMatch(pathname: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(pathname);
  });
}

/**
 * Handle unauthorized access.
 */
async function handleUnauthorized(
  request: NextRequest,
  loginUrl: string,
  onUnauthorized?: (request: NextRequest) => NextResponse | Promise<NextResponse>
): Promise<NextResponse> {
  if (onUnauthorized) {
    return onUnauthorized(request);
  }

  const url = new URL(loginUrl, request.url);
  url.searchParams.set('returnTo', request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

/**
 * Helper to protect API routes.
 *
 * @example
 * ```ts
 * // app/api/protected/route.ts
 * import { withAuth } from '@usetransactional/auth-next/middleware';
 *
 * export const GET = withAuth(async (request, session) => {
 *   return Response.json({ user: session.user });
 * });
 * ```
 */
export function withAuth<T extends unknown[]>(
  handler: (request: NextRequest, session: Session, ...args: T) => Response | Promise<Response>,
  options?: { cookieName?: string }
) {
  const cookieName = options?.cookieName || 'transactional_session';

  return async (request: NextRequest, ...args: T): Promise<Response> => {
    const sessionCookie = request.cookies.get(cookieName);

    if (!sessionCookie?.value) {
      return Response.json(
        { error: { code: 'unauthorized', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    try {
      const session = JSON.parse(
        Buffer.from(sessionCookie.value, 'base64').toString('utf-8')
      ) as Session;

      if (session.expiresAt < Date.now() / 1000) {
        return Response.json(
          { error: { code: 'unauthorized', message: 'Session expired' } },
          { status: 401 }
        );
      }

      return handler(request, session, ...args);
    } catch {
      return Response.json(
        { error: { code: 'unauthorized', message: 'Invalid session' } },
        { status: 401 }
      );
    }
  };
}
