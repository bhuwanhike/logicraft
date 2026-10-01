# LogiCraft

Fleet and shipment tracking workspace. Spring Boot API with PostgreSQL and a
React + TypeScript dashboard.

## Layout

```
backend/logicraft   Spring Boot 3.2 API (Java 17, Flyway, JdbcTemplate)
frontend            React 19 + Vite dashboard (TypeScript)
```

## Running it

The API needs PostgreSQL. Flyway applies every migration under
`backend/logicraft/src/main/resources/db/migration` on startup; the schema and
seed data are defined there, so there is nothing to import by hand.

```bash
cd backend/logicraft
mvn spring-boot:run          # http://localhost:8080/api/v1
```

```bash
cd frontend
npm install
npm run dev                  # http://localhost:5173
```

Both halves read their settings from the environment, so nothing about a
deployment is hardcoded. The backend reads a local `.env` (copy
`backend/logicraft/.env.example`) and the dashboard reads `frontend/.env` (copy
`frontend/.env.example`). Real environment variables take precedence over both,
so the same build runs anywhere — full reference under "Environment variables".

`JWT_SECRET` has no default: the API refuses to start without it, rather than
signing tokens with a secret that is in the repository. Generate one with
`openssl rand -hex 32`.

## Environment variables

### Backend (`backend/logicraft/.env`)

| Variable | Default | Notes |
| --- | --- | --- |
| `DB_URL` | composed from the parts below | Full JDBC URL; overrides `DB_HOST`/`DB_PORT`/`DB_NAME`/`DB_URL_PARAMS` |
| `DATABASE_URL` | *(unset)* | `postgres://` URL injected by Render/Railway/Heroku; used only when neither `DB_URL` nor `DB_HOST` is set |
| `DB_HOST` | `localhost` | |
| `DB_PORT` | `5432` | |
| `DB_NAME` | `logicraft` | |
| `DB_USER` | `postgres` | |
| `DB_PASSWORD` | *(required)* | No default; the app fails to start without it |
| `DB_URL_PARAMS` | *(empty)* | Appended to the URL, e.g. `?sslmode=require` |
| `DB_POOL_MAX_SIZE` | `10` | Hikari pool size; keep at or below the database's limit |
| `DB_POOL_MIN_IDLE` | `2` | |
| `JWT_SECRET` | *(required)* | No default; at least 32 bytes |
| `JWT_EXPIRATION_MS` | `86400000` | 24 hours |
| `PORT` | `8080` | |
| `API_CONTEXT_PATH` | `/api/v1` | Must match the path in the frontend's `VITE_API_BASE` |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173,http://localhost:3000` | Comma-separated; never `*`. Matched exactly, so scheme, host and port all count |
| `JPA_SHOW_SQL` | `false` | Logs every statement with bound values |
| `LOG_LEVEL_ROOT` | `INFO` | |
| `LOG_LEVEL_APP` | `INFO` | |
| `FLYWAY_ENABLED` | `true` | |

### Frontend (`frontend/.env`)

| Variable | Default | Notes |
| --- | --- | --- |
| `VITE_API_BASE` | `/api/v1` | Path or absolute URL the client prefixes to every request |
| `VITE_GOOGLE_MAPS_API_KEY` | *(empty)* | Browser key; restrict by HTTP referrer |
| `VITE_GOOGLE_MAPS_MAP_ID` | *(empty)* | Only for styled / `AdvancedMarkerElement` markers |
| `VITE_DEV_PORT` | `5173` | Dev server only |
| `VITE_DEV_API_TARGET` | `http://localhost:8080` | Dev proxy target |

The API base follows Vite's per-mode env files, so local and deployed use the
same variable name with different values:

- `frontend/.env` (Git-ignored) holds the local value, `/api/v1`, which the dev
  server proxies to `VITE_DEV_API_TARGET`. It is created from `.env.example`.
- `frontend/.env.production` is **committed** and holds the deployed API URL.
  `vite build` loads it automatically, so the deploy needs no extra
  configuration. A real environment variable set on the build host (for example
  a Render static site's Environment settings) overrides it for one deployment.

`frontend/.env.production` is loaded only for `vite build`; `vite dev` and
Vitest use `.env` (or its fallback), so a local checkout never calls production.
This is the trap to know about when working locally: a bundle from
`npm run build` — or a browser tab left open on `npm run preview` — talks to the
deployed API, not to your machine, so the local auth endpoints look missing.

The dev proxy drops the `Origin` header on the way to the backend. A browser
sends its own origin, `changeOrigin` only rewrites `Host`, and the API's CORS
filter answers an unlisted origin with a bare `403` and no body. That would
otherwise make login fail as soon as the dev server is not on the exact
host:port in `CORS_ALLOWED_ORIGINS` — a second instance on `:5174`, or the LAN
address Vite prints on startup.

`VITE_*` values are compiled into the bundle, so changing one needs a rebuild.
To repoint an existing build without rebuilding, edit the deployed
`dist/config.js` instead: it runs before the app bundle and its values win. See
`frontend/public/config.js`. It is public — never put a secret there.

## Tests

```bash
cd frontend
npm run check                # typecheck, then the full Vitest suite
npm run test:coverage        # with the V8 coverage report
npm run test:watch           # re-runs on change
```

```bash
cd backend/logicraft
mvn test
```

### What the frontend suite covers

`vitest.config.ts` restricts coverage to the code where a regression shows up as
a wrong value rather than a crash — the formatters, the table, the Maps loader
and the API client:

| Area | File | What it protects |
| --- | --- | --- |
| Formatting | `src/components/workspace/__tests__/format.test.tsx` | `formatKm`, status labels, `asNode`, `Meter`, `format()` |
| Table | `src/components/common/__tests__/SortableTable.test.tsx` | column rendering of real API payloads, paging, `[object Object]` regressions |
| Maps loader | `src/services/__tests__/googleMaps.test.ts` | singleton behaviour under concurrent callers, key classification, `importLibrary` |
| Map markers | `src/components/common/__tests__/mapMarkers.test.ts` | WGS84 positioning, popup escaping |
| API client | `src/services/__tests__/api.test.ts` | URL building, error shapes, array serialisation |
| Auth client | `src/services/__tests__/auth.test.ts` | signup/login requests, session storage, `AuthError` codes, token-less legacy sessions |
| Auth | `src/components/auth/__tests__/auth.constants.test.ts` | validation rules |
| Signup page | `src/components/auth/__tests__/SignupForm.test.tsx` | the demo panel shows the seeded account but prefills nothing that must fail |
| Route guards | `src/__tests__/routeGuards.test.tsx` | `RequireAuth` gates the workspace, `AuthRoute` keeps a signed-in user off the forms |
| Dev proxy | `src/__tests__/devProxy.test.ts` | the proxy drops `Origin`, so local dev does not depend on the CORS allow list |
| Config | `src/__tests__/config.test.ts` | runtime-override precedence, build-time fallback, blank handling |
| Hooks | `src/hooks/__tests__/useUi.test.tsx` | sorting, debounce, disclosure, outside-click |

`src/test/fixtures/apiPayloads.ts` holds responses captured from a running
backend, so the table tests assert against the shapes the API actually returns
rather than hand-written guesses. Regenerate them with `npm run test:fixtures`
against a live backend after an API change.

### What the backend suite covers

The controllers build SQL by string concatenation and bind every value as a
parameter, so the tests assert the statement and the bound arguments rather than
a result set. `RecordingJdbcTemplate` records statements instead of executing
them, which means the suite runs without PostgreSQL.

| Area | What it protects |
| --- | --- |
| `GenericControllerTest` | column aliases matching the keys the UI reads, workspace scoping, every filter, pagination bounds, `PgArray`/`PGobject` unwrapping |
| `ShipmentControllerTest` | driver/vehicle fallback labels, timestamp normalisation, the single-query milestone load, filters shared with the count endpoint |
| `MetricsControllerTest` | summary shape, delta windows, range parsing, every series key |
| `AuthControllerTest` | signup uniqueness, bcrypt storage, role mapping, and the shared failure for every bad login |
| `JwtTokenProviderTest` | expiry, tampered payloads, foreign keys, unsigned `alg: none` tokens, weak secrets |
| `SecurityConfigTest` | CORS origins and methods, `CORS_ALLOWED_ORIGINS` wiring, wildcard rejection, password hashing |

The alias test is the one worth knowing about. A projection that reverts to
Postgres column labels (`odometer_km` rather than `odometerKm`) throws nothing
anywhere — the field just renders an em-dash and the page looks half-populated.
It asserts every alias in every projection is lowerCamelCase, and that any alias
with a capital in it is quoted so Postgres does not fold it to lower case.

## Authentication

`POST /api/v1/auth/signup` and `POST /api/v1/auth/login` live in
`com.logicraft.auth`. Signup hashes the password with bcrypt, derives a unique
username from the email, assigns the role the signup form selected, and returns
a signed JWT. Login matches the email (or username) case-insensitively and
refuses a wrong password, an unknown account and a deactivated account with the
same response, so the endpoint cannot be used to discover which emails have
accounts.

Both endpoints answer a failure with `{ "error": ..., "code": ... }`; the client
maps `duplicate-email` (409) and `invalid-credentials` (401) onto the form's
error states. The session the client keeps is `{ id, name, email, company, role,
token, startedAt }`, and the token is sent as a bearer token on workspace
requests. The login page's demo credentials (`demo@logicraft.io` /
`LogiCraft2026`) are seeded with a real bcrypt hash by `V10`.

## Verification scripts

These need a running backend and frontend; they drive a real browser.

```bash
npm run verify:hero           # hero scene animation timeline
npm run verify:map-live       # Google Maps tiles, markers, and auth failures
```

`verify:map-live` writes a screenshot next to the frontend directory and exits
non-zero if the map did not load, so it works as a post-deploy smoke check.

## Deployment notes

- **Set `JWT_SECRET`.** It has no default and the app will not start without it.
  Generate one with `openssl rand -hex 32` and keep it out of the repository.
- **Set `CORS_ALLOWED_ORIGINS`** to the origin(s) that actually serve the
  dashboard. It never includes `*`: credentials are allowed, and a wildcard
  would let any site make authenticated calls as the user.
- **Set the database variables**, or a single `DB_URL` if the provider hands you
  one. Add `DB_URL_PARAMS=?sslmode=require` for a managed database that requires
  TLS.

  On Render, create a PostgreSQL instance and link it to the web service. Render
  then injects `DATABASE_URL`, which the app reads automatically — no host or
  password needs copying. Set `DB_USER`/`DB_PASSWORD` only if you want to
  override the credentials in that URL. If you instead copy the connection
  details by hand, use the **Internal Database URL** (the external one is for
  connections from outside Render), and set `DB_HOST`, `DB_PORT`, `DB_NAME`,
  `DB_USER`, `DB_PASSWORD` individually. A bare `DB_URL` must use the
  `jdbc:postgresql://` scheme.
- **Set `VITE_API_BASE`** for the deployed frontend. The committed
  `frontend/.env.production` carries it, so the build works from the repository;
  override it in the static site's Environment settings to point one deployment
  elsewhere. It must include the `/api/v1` context path.
- If the dashboard and API are served from the same origin behind a reverse
  proxy, leave `VITE_API_BASE=/api/v1` and no CORS entry is needed for it.
- The Google Maps key is a browser key. Restrict it to the production origins
  that serve the dashboard, and to the Maps JavaScript API.
- `frontend/.env` and `backend/logicraft/.env` are Git-ignored. Do not commit a
  real key or secret.
- `/reports/**` is permitted in the security config but has no controller
  behind it yet, so those paths return 404.
