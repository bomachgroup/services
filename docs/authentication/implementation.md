# Shared Browser Authentication

Services is an independently deployed Vite application composed under the React OS host at `/services/*`. The default React OS app owns browser login and the shared session flow. Services does not own a login form or exchange credentials with a parent window.

## Requests and session

Services calls same-origin `/api/v1/*` endpoints with `credentials: 'include'` and `cache: 'no-store'`. Unsafe requests include `X-Bomach-Request: browser`. On a `401`, the shared API client coalesces one `POST /auth/browser/refresh` attempt and retries the original request at most once. Browser access and refresh cookies remain HttpOnly, host-only, and inaccessible to application JavaScript. The integrated experience keeps these requests on the current Bomach host, so cookies are scoped to the shared OS hostname.

The API base is fixed to `/api/v1`; browser query parameters and referrer-based origin detection cannot override it. In the composed host, `/api/*` is routed by the default React OS project to the configured staging or production backend. Backend-relative `/media/*` document and image URLs are also routed through that backend instead of falling into the root SPA.

## Identity and authorization

The bootstrap preserves the existing Services contract:

1. `GET /auth/me` loads the authenticated staff identity.
2. `GET /roles/employees/{user_id}` loads the staff role and permission map.
3. Existing role normalization and permission mapping determine visible destinations; backend endpoints continue to enforce authorization.

Services redirects signed-out sessions to the root app's `/login` with a sanitized `/services/*` return target. When running under `bomach-os-test.vercel.app` or `bomach-os.vercel.app`, login stays on that current host rather than using a build-time production origin. The root login owner runs the existing password, two-factor, reset, and expiry flows. Return targets are retained through login, two-factor verification, and password reset, then checked against the user's permissions before navigation. Logout revokes and clears the shared browser session, then returns to root login.

## Local development and deployment

Run the root and Services Vite development servers separately. For the shared host, open Services at `http://localhost:5174/services`; the production build creates both a standalone root bundle and a prefixed `dist/services` bundle. The backend must allow the exact local browser origin in `BOMACH_WEB_AUTH_ORIGINS`. Keep API mocks disabled for an end-to-end sign-in test; mock handlers do not emulate the shared HttpOnly cookie session. Services does not use bearer tokens, localStorage token storage, Flutter `embed` query parameters, or token `postMessage` handling.

Configure the backend with exact browser origins for each environment, retaining any other intentional origins:

```env
# Test backend environment
BOMACH_WEB_AUTH_ORIGINS=https://bomach-os-test.vercel.app

# Production backend environment
BOMACH_WEB_AUTH_ORIGINS=https://bomach-os.vercel.app
```

Configure `VITE_BOMACH_OS_ORIGIN` for the standalone Services deployment to the canonical OS host. On the composed Bomach host, Services derives the root login/switcher origin from the current browser host so Preview remains on test and Production remains on production. The OS project uses ordinary external rewrites to preserve `/services` and sends `/api/*` to the environment-specific backend. Validate the Services build and its `/services` assets before routing the OS Preview host; then test nested-route refreshes, API routing, cookie attributes, 2FA, reset, expiry, logout, and permission-filtered switching before enabling the production rewrite.
