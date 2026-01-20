/**
 * Transactional Auth Next - Types
 */

export interface TransactionalAuthConfig {
  /** Auth domain (e.g., 'auth.usetransactional.com') */
  domain: string;
  /** Client ID of your application */
  clientId: string;
  /** Client secret (for server-side only) */
  clientSecret?: string;
  /** Base URL of your application */
  baseUrl?: string;
  /** Scopes to request (defaults to 'openid profile email') */
  scope?: string;
  /** API audience for access token */
  audience?: string;
  /** Cookie name for session (defaults to 'transactional_session') */
  cookieName?: string;
  /** Cookie options */
  cookieOptions?: {
    secure?: boolean;
    sameSite?: 'strict' | 'lax' | 'none';
    maxAge?: number;
  };
}

export interface TransactionalAuthUser {
  sub: string;
  email?: string;
  emailVerified?: boolean;
  name?: string;
  givenName?: string;
  familyName?: string;
  picture?: string;
  phoneNumber?: string;
  phoneNumberVerified?: boolean;
}

export interface Session {
  user: TransactionalAuthUser;
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  expiresAt: number;
}

export interface LoginOptions {
  /** Return URL after login */
  returnTo?: string;
  /** Force specific connection */
  connection?: string;
  /** Login hint (pre-fill email) */
  loginHint?: string;
}

export interface LogoutOptions {
  /** Return URL after logout */
  returnTo?: string;
}

export interface CallbackResult {
  session: Session;
  returnTo?: string;
}
