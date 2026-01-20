/**
 * Transactional Auth Next
 *
 * Next.js SDK for Transactional Auth - OpenID Connect authentication
 * with full support for App Router, Server Components, and Middleware.
 *
 * ## Installation
 *
 * ```bash
 * npm install transactional-auth-next
 * ```
 *
 * ## Quick Start
 *
 * ### 1. Set environment variables
 *
 * ```env
 * TRANSACTIONAL_AUTH_DOMAIN=auth.usetransactional.com
 * TRANSACTIONAL_AUTH_CLIENT_ID=your-client-id
 * TRANSACTIONAL_AUTH_CLIENT_SECRET=your-client-secret
 * TRANSACTIONAL_AUTH_BASE_URL=http://localhost:3000
 * ```
 *
 * ### 2. Create API routes
 *
 * ```ts
 * // app/api/auth/[...auth]/route.ts
 * import { handleLogin, handleCallback, handleLogout, handleSession } from 'transactional-auth-next/server';
 *
 * export const GET = async (request, { params }) => {
 *   const route = params.auth[0];
 *   switch (route) {
 *     case 'login': return handleLogin()(request);
 *     case 'callback': return handleCallback()(request);
 *     case 'logout': return handleLogout()(request);
 *     case 'session': return handleSession()(request);
 *     default: return new Response('Not found', { status: 404 });
 *   }
 * };
 * ```
 *
 * ### 3. Add provider to layout
 *
 * ```tsx
 * // app/layout.tsx
 * import { TransactionalAuthProvider } from 'transactional-auth-next/client';
 *
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         <TransactionalAuthProvider>
 *           {children}
 *         </TransactionalAuthProvider>
 *       </body>
 *     </html>
 *   );
 * }
 * ```
 *
 * ### 4. Use in components
 *
 * Server Component:
 * ```tsx
 * import { getSession } from 'transactional-auth-next/server';
 *
 * export default async function Page() {
 *   const session = await getSession();
 *   return <div>Hello, {session?.user.name}</div>;
 * }
 * ```
 *
 * Client Component:
 * ```tsx
 * 'use client';
 * import { useAuth } from 'transactional-auth-next/client';
 *
 * export function LoginButton() {
 *   const { user, login, logout } = useAuth();
 *   return user
 *     ? <button onClick={() => logout()}>Logout</button>
 *     : <button onClick={() => login()}>Login</button>;
 * }
 * ```
 */

// Configuration
export { initTransactionalAuth, getConfig, isInitialized } from './config';

// Types
export type {
  TransactionalAuthConfig,
  TransactionalAuthUser,
  Session,
  LoginOptions,
  LogoutOptions,
} from './types';
