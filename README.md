# @usetransactional/auth-next

[![npm version](https://badge.fury.io/js/%40usetransactional%2Fauth-next.svg)](https://www.npmjs.com/package/@usetransactional/auth-next)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Next.js SDK for Transactional Auth - OpenID Connect authentication with full support for App Router, Server Components, and Middleware.

## Installation

```bash
npm install @usetransactional/auth-next
# or
yarn add @usetransactional/auth-next
# or
pnpm add @usetransactional/auth-next
```

## Quick Start

### 1. Set Environment Variables

```env
TRANSACTIONAL_AUTH_DOMAIN=auth.usetransactional.com
TRANSACTIONAL_AUTH_CLIENT_ID=your-client-id
TRANSACTIONAL_AUTH_CLIENT_SECRET=your-client-secret
TRANSACTIONAL_AUTH_BASE_URL=http://localhost:3000
```

### 2. Create API Routes

Create a catch-all route handler for authentication:

```ts
// app/api/auth/[...auth]/route.ts
import {
  handleLogin,
  handleCallback,
  handleLogout,
  handleSession,
} from '@usetransactional/auth-next/server';
import { NextRequest } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { auth: string[] } }
) {
  const route = params.auth[0];

  switch (route) {
    case 'login':
      return handleLogin()(request);
    case 'callback':
      return handleCallback()(request);
    case 'logout':
      return handleLogout()(request);
    case 'session':
      return handleSession()(request);
    default:
      return new Response('Not found', { status: 404 });
  }
}
```

### 3. Add Provider to Layout

```tsx
// app/layout.tsx
import { TransactionalAuthProvider } from '@usetransactional/auth-next/client';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <TransactionalAuthProvider>{children}</TransactionalAuthProvider>
      </body>
    </html>
  );
}
```

### 4. Use in Components

**Server Component:**

```tsx
// app/page.tsx
import { getSession, getUser } from '@usetransactional/auth-next/server';

export default async function Page() {
  const session = await getSession();

  if (!session) {
    return <p>Not logged in</p>;
  }

  return (
    <div>
      <h1>Welcome, {session.user.name}</h1>
      <p>Email: {session.user.email}</p>
    </div>
  );
}
```

**Client Component:**

```tsx
// components/login-button.tsx
'use client';

import { useAuth } from '@usetransactional/auth-next/client';

export function LoginButton() {
  const { user, isLoading, login, logout } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (user) {
    return (
      <div>
        <span>Hello, {user.name}</span>
        <button onClick={() => logout()}>Logout</button>
      </div>
    );
  }

  return <button onClick={() => login()}>Login</button>;
}
```

## Protecting Routes with Middleware

```ts
// middleware.ts
import { createAuthMiddleware } from '@usetransactional/auth-next/middleware';

export default createAuthMiddleware({
  protectedPaths: ['/dashboard/*', '/settings/*', '/api/protected/*'],
  publicPaths: ['/', '/about', '/api/public/*'],
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

## Protecting API Routes

```ts
// app/api/protected/route.ts
import { withAuth } from '@usetransactional/auth-next/middleware';
import { NextRequest } from 'next/server';

export const GET = withAuth(async (request, session) => {
  return Response.json({
    message: 'This is protected data',
    user: session.user,
  });
});
```

## API Reference

### Server Functions (`@usetransactional/auth-next/server`)

#### `getSession()`

Get the current session in a Server Component.

```tsx
const session = await getSession();
// session?.user, session?.accessToken, session?.expiresAt
```

#### `getUser()`

Get the current user in a Server Component.

```tsx
const user = await getUser();
// user?.sub, user?.email, user?.name
```

#### `getAccessToken()`

Get the access token for API calls.

```tsx
const token = await getAccessToken();
```

#### `isAuthenticated()`

Check if user is authenticated.

```tsx
const authenticated = await isAuthenticated();
```

#### Route Handlers

- `handleLogin(options?)` - Redirects to auth server
- `handleCallback()` - Handles OAuth callback
- `handleLogout(options?)` - Logs out user
- `handleSession()` - Returns current session as JSON

### Client Functions (`@usetransactional/auth-next/client`)

#### `TransactionalAuthProvider`

Wrap your app to provide auth context.

```tsx
<TransactionalAuthProvider initialSession={session}>
  {children}
</TransactionalAuthProvider>
```

#### `useAuth()`

Hook for auth state and methods.

```tsx
const { user, isLoading, isAuthenticated, login, logout, refreshSession } = useAuth();
```

#### `useUser()`

Hook for just user data.

```tsx
const { user, isLoading } = useUser();
```

### Middleware (`@usetransactional/auth-next/middleware`)

#### `createAuthMiddleware(config)`

Create Next.js middleware for route protection.

```ts
createAuthMiddleware({
  protectedPaths: ['/dashboard/*'],
  publicPaths: ['/'],
  loginUrl: '/api/auth/login',
  onUnauthorized: (request) => NextResponse.redirect('/login'),
});
```

#### `withAuth(handler, options?)`

Protect individual API routes.

```ts
export const GET = withAuth(async (request, session) => {
  // session is guaranteed to exist
  return Response.json({ user: session.user });
});
```

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TRANSACTIONAL_AUTH_DOMAIN` | Yes | Auth domain |
| `TRANSACTIONAL_AUTH_CLIENT_ID` | Yes | Client ID |
| `TRANSACTIONAL_AUTH_CLIENT_SECRET` | Server-side | Client secret |
| `TRANSACTIONAL_AUTH_BASE_URL` | Yes | Your app URL |

### Programmatic Configuration

```ts
import { initTransactionalAuth } from '@usetransactional/auth-next';

initTransactionalAuth({
  domain: 'auth.usetransactional.com',
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  baseUrl: 'http://localhost:3000',
  scope: 'openid profile email',
  audience: 'https://api.example.com',
  cookieName: 'my_session',
  cookieOptions: {
    secure: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60,
  },
});
```

## TypeScript

Full TypeScript support with exported types:

```ts
import type {
  TransactionalAuthConfig,
  TransactionalAuthUser,
  Session,
  LoginOptions,
  LogoutOptions,
} from '@usetransactional/auth-next';
```

## Documentation

Full documentation is available at [usetransactional.com/docs/auth](https://usetransactional.com/docs/auth)

## License

MIT
