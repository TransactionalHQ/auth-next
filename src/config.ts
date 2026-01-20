/**
 * Transactional Auth Next - Configuration
 */

import type { TransactionalAuthConfig } from './types';

let globalConfig: TransactionalAuthConfig | null = null;

/**
 * Initialize the Transactional Auth SDK with your configuration.
 * Call this once in your application, typically in a layout or middleware.
 */
export function initTransactionalAuth(config: TransactionalAuthConfig): void {
  globalConfig = {
    ...config,
    scope: config.scope || 'openid profile email',
    cookieName: config.cookieName || 'transactional_session',
    cookieOptions: {
      secure: config.cookieOptions?.secure ?? process.env.NODE_ENV === 'production',
      sameSite: config.cookieOptions?.sameSite ?? 'lax',
      maxAge: config.cookieOptions?.maxAge ?? 7 * 24 * 60 * 60, // 7 days
    },
  };
}

/**
 * Get the current configuration.
 * Throws if not initialized.
 */
export function getConfig(): TransactionalAuthConfig {
  if (!globalConfig) {
    // Try to read from environment variables
    const domain = process.env.TRANSACTIONAL_AUTH_DOMAIN || process.env.NEXT_PUBLIC_TRANSACTIONAL_AUTH_DOMAIN;
    const clientId = process.env.TRANSACTIONAL_AUTH_CLIENT_ID || process.env.NEXT_PUBLIC_TRANSACTIONAL_AUTH_CLIENT_ID;
    const clientSecret = process.env.TRANSACTIONAL_AUTH_CLIENT_SECRET;
    const baseUrl = process.env.TRANSACTIONAL_AUTH_BASE_URL || process.env.NEXT_PUBLIC_APP_URL;

    if (domain && clientId) {
      globalConfig = {
        domain,
        clientId,
        clientSecret,
        baseUrl,
        scope: 'openid profile email',
        cookieName: 'transactional_session',
        cookieOptions: {
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 7 * 24 * 60 * 60,
        },
      };
      return globalConfig;
    }

    throw new Error(
      'Transactional Auth not initialized. Call initTransactionalAuth() or set environment variables.'
    );
  }
  return globalConfig;
}

/**
 * Check if the SDK is initialized.
 */
export function isInitialized(): boolean {
  return globalConfig !== null;
}
