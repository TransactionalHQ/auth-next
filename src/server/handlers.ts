/**
 * Transactional Auth Next - Route Handlers
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextRequest, NextResponse } from 'next/server';
import * as jose from 'jose';
import { getConfig } from '../config';
import type { Session, LoginOptions, LogoutOptions } from '../types';

/**
 * Generate a random string for PKCE and state.
 */
function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let result = '';
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < length; i++) {
    result += chars[randomValues[i] % chars.length];
  }
  return result;
}

/**
 * Generate PKCE code verifier and challenge.
 */
async function generatePKCE(): Promise<{ verifier: string; challenge: string }> {
  const verifier = generateRandomString(64);
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const challenge = Buffer.from(hash)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  return { verifier, challenge };
}

/**
 * Handle login request - redirects to auth server.
 *
 * @example
 * ```ts
 * // app/api/auth/login/route.ts
 * import { handleLogin } from '@usetransactional/auth-next/server';
 *
 * export const GET = handleLogin;
 * ```
 */
export function handleLogin(options?: LoginOptions) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const config = getConfig();
    const { verifier, challenge } = await generatePKCE();
    const state = generateRandomString(32);

    const returnTo = options?.returnTo ||
      request.nextUrl.searchParams.get('returnTo') ||
      '/';

    // Store PKCE verifier and state in cookies
    const cookieStore = await cookies();
    cookieStore.set('transactional_pkce_verifier', verifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 300, // 5 minutes
      path: '/',
    });
    cookieStore.set('transactional_auth_state', JSON.stringify({ state, returnTo }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 300,
      path: '/',
    });

    // Build authorization URL
    const authUrl = new URL(`https://${config.domain}/authorize`);
    authUrl.searchParams.set('client_id', config.clientId);
    authUrl.searchParams.set('redirect_uri', `${config.baseUrl}/api/auth/callback`);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', config.scope || 'openid profile email');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('code_challenge', challenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    if (options?.connection) {
      authUrl.searchParams.set('connection', options.connection);
    }
    if (options?.loginHint) {
      authUrl.searchParams.set('login_hint', options.loginHint);
    }
    if (config.audience) {
      authUrl.searchParams.set('audience', config.audience);
    }

    return NextResponse.redirect(authUrl.toString());
  };
}

/**
 * Handle callback from auth server - exchanges code for tokens.
 *
 * @example
 * ```ts
 * // app/api/auth/callback/route.ts
 * import { handleCallback } from '@usetransactional/auth-next/server';
 *
 * export const GET = handleCallback;
 * ```
 */
export function handleCallback() {
  return async (request: NextRequest): Promise<NextResponse> => {
    const config = getConfig();
    const searchParams = request.nextUrl.searchParams;

    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      const errorDescription = searchParams.get('error_description') || error;
      return NextResponse.redirect(
        `${config.baseUrl}/auth/error?error=${encodeURIComponent(errorDescription)}`
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(`${config.baseUrl}/auth/error?error=missing_code_or_state`);
    }

    // Verify state and get PKCE verifier
    const cookieStore = await cookies();
    const stateCookie = cookieStore.get('transactional_auth_state');
    const verifierCookie = cookieStore.get('transactional_pkce_verifier');

    if (!stateCookie?.value || !verifierCookie?.value) {
      return NextResponse.redirect(`${config.baseUrl}/auth/error?error=missing_state_cookie`);
    }

    const storedState = JSON.parse(stateCookie.value) as { state: string; returnTo: string };

    if (storedState.state !== state) {
      return NextResponse.redirect(`${config.baseUrl}/auth/error?error=state_mismatch`);
    }

    // Exchange code for tokens
    const tokenResponse = await fetch(`https://${config.domain}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: config.clientId,
        ...(config.clientSecret ? { client_secret: config.clientSecret } : {}),
        code,
        redirect_uri: `${config.baseUrl}/api/auth/callback`,
        code_verifier: verifierCookie.value,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}));
      console.error('Token exchange failed:', errorData);
      return NextResponse.redirect(`${config.baseUrl}/auth/error?error=token_exchange_failed`);
    }

    const tokens = await tokenResponse.json();

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
      refreshToken: tokens.refresh_token,
      idToken: tokens.id_token,
      expiresAt: Math.floor(Date.now() / 1000) + tokens.expires_in,
    };

    // Store session in cookie
    cookieStore.set(
      config.cookieName || 'transactional_session',
      Buffer.from(JSON.stringify(session)).toString('base64'),
      {
        httpOnly: true,
        secure: config.cookieOptions?.secure ?? process.env.NODE_ENV === 'production',
        sameSite: config.cookieOptions?.sameSite ?? 'lax',
        maxAge: config.cookieOptions?.maxAge ?? 7 * 24 * 60 * 60,
        path: '/',
      }
    );

    // Clean up PKCE cookies
    cookieStore.delete('transactional_pkce_verifier');
    cookieStore.delete('transactional_auth_state');

    return NextResponse.redirect(`${config.baseUrl}${storedState.returnTo || '/'}`);
  };
}

/**
 * Handle logout request.
 *
 * @example
 * ```ts
 * // app/api/auth/logout/route.ts
 * import { handleLogout } from '@usetransactional/auth-next/server';
 *
 * export const GET = handleLogout;
 * ```
 */
export function handleLogout(options?: LogoutOptions) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const config = getConfig();
    const cookieStore = await cookies();

    // Get the ID token for logout
    const sessionCookie = cookieStore.get(config.cookieName || 'transactional_session');
    let idToken: string | undefined;

    if (sessionCookie?.value) {
      try {
        const session = JSON.parse(
          Buffer.from(sessionCookie.value, 'base64').toString('utf-8')
        ) as Session;
        idToken = session.idToken;
      } catch {
        // Ignore
      }
    }

    // Clear session cookie
    cookieStore.delete(config.cookieName || 'transactional_session');

    const returnTo = options?.returnTo ||
      request.nextUrl.searchParams.get('returnTo') ||
      config.baseUrl || '/';

    // Redirect to auth server logout endpoint
    const logoutUrl = new URL(`https://${config.domain}/session/end`);
    logoutUrl.searchParams.set('post_logout_redirect_uri', returnTo);
    if (idToken) {
      logoutUrl.searchParams.set('id_token_hint', idToken);
    }

    return NextResponse.redirect(logoutUrl.toString());
  };
}

/**
 * Handle getting current session (API route).
 *
 * @example
 * ```ts
 * // app/api/auth/session/route.ts
 * import { handleSession } from '@usetransactional/auth-next/server';
 *
 * export const GET = handleSession;
 * ```
 */
export function handleSession() {
  return async (): Promise<NextResponse> => {
    const config = getConfig();
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(config.cookieName || 'transactional_session');

    if (!sessionCookie?.value) {
      return NextResponse.json({ session: null });
    }

    try {
      const session = JSON.parse(
        Buffer.from(sessionCookie.value, 'base64').toString('utf-8')
      ) as Session;

      // Check if expired
      if (session.expiresAt < Date.now() / 1000) {
        return NextResponse.json({ session: null });
      }

      // Return session without sensitive tokens
      return NextResponse.json({
        session: {
          user: session.user,
          expiresAt: session.expiresAt,
        },
      });
    } catch {
      return NextResponse.json({ session: null });
    }
  };
}
