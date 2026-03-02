/**
 * Transactional Auth Next - Server Session Management
 */

import { cookies } from 'next/headers';
import * as jose from 'jose';
import { getConfig } from '../config';
import type { Session, TransactionalAuthUser } from '../types';

/**
 * Get the current session from cookies (Server Component).
 * Returns null if not authenticated.
 *
 * @example
 * ```tsx
 * // app/page.tsx (Server Component)
 * import { getSession } from '@usetransactional/auth-next/server';
 *
 * export default async function Page() {
 *   const session = await getSession();
 *
 *   if (!session) {
 *     return <p>Not logged in</p>;
 *   }
 *
 *   return <p>Hello, {session.user.name}</p>;
 * }
 * ```
 */
export async function getSession(): Promise<Session | null> {
  const config = getConfig();
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(config.cookieName || 'transactional_session');

  if (!sessionCookie?.value) {
    return null;
  }

  try {
    // Decode the session (it's a base64-encoded JSON)
    const sessionData = JSON.parse(
      Buffer.from(sessionCookie.value, 'base64').toString('utf-8')
    ) as Session;

    // Check if session is expired
    if (sessionData.expiresAt < Date.now() / 1000) {
      // Try to refresh if we have a refresh token
      if (sessionData.refreshToken) {
        const newSession = await refreshSession(sessionData.refreshToken);
        if (newSession) {
          return newSession;
        }
      }
      return null;
    }

    return sessionData;
  } catch {
    return null;
  }
}

/**
 * Get the current user from the session (Server Component).
 * Returns null if not authenticated.
 */
export async function getUser(): Promise<TransactionalAuthUser | null> {
  const session = await getSession();
  return session?.user || null;
}

/**
 * Get the access token from the session (Server Component).
 * Returns null if not authenticated.
 */
export async function getAccessToken(): Promise<string | null> {
  const session = await getSession();
  return session?.accessToken || null;
}

/**
 * Check if the user is authenticated (Server Component).
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession();
  return session !== null;
}

/**
 * Refresh the session using the refresh token.
 */
async function refreshSession(refreshToken: string): Promise<Session | null> {
  const config = getConfig();

  try {
    const response = await fetch(`https://${config.domain}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: config.clientId,
        ...(config.clientSecret ? { client_secret: config.clientSecret } : {}),
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      return null;
    }

    const tokens = await response.json();

    // Decode ID token to get user info
    const idToken = jose.decodeJwt(tokens.id_token);

    const session: Session = {
      user: {
        sub: idToken.sub as string,
        email: idToken.email as string | undefined,
        emailVerified: idToken.email_verified as boolean | undefined,
        name: idToken.name as string | undefined,
        givenName: idToken.given_name as string | undefined,
        familyName: idToken.family_name as string | undefined,
        picture: idToken.picture as string | undefined,
      },
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || refreshToken,
      idToken: tokens.id_token,
      expiresAt: Math.floor(Date.now() / 1000) + tokens.expires_in,
    };

    // Update the cookie
    const cookieStore = await cookies();
    cookieStore.set(config.cookieName || 'transactional_session',
      Buffer.from(JSON.stringify(session)).toString('base64'),
      {
        httpOnly: true,
        secure: config.cookieOptions?.secure ?? process.env.NODE_ENV === 'production',
        sameSite: config.cookieOptions?.sameSite ?? 'lax',
        maxAge: config.cookieOptions?.maxAge ?? 7 * 24 * 60 * 60,
        path: '/',
      }
    );

    return session;
  } catch {
    return null;
  }
}
