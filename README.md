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

The dashboard reads `VITE_API_BASE_URL` and `VITE_GOOGLE_MAPS_API_KEY` from
`frontend/.env`. Copy `.env.example` to start from the defaults. The Maps key is
a browser key and is expected to be public, but it should be restricted to the
origins that actually serve the app — see "Deployment notes".

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
| Auth | `src/components/auth/__tests__/auth.constants.test.ts` | validation rules |
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
| `JwtTokenProviderTest` | expiry, tampered payloads, foreign keys, unsigned `alg: none` tokens, weak secrets |
| `SecurityConfigTest` | CORS origins and methods, password hashing |

The alias test is the one worth knowing about. A projection that reverts to
Postgres column labels (`odometer_km` rather than `odometerKm`) throws nothing
anywhere — the field just renders an em-dash and the page looks half-populated.
It asserts every alias in every projection is lowerCamelCase, and that any alias
with a capital in it is quoted so Postgres does not fold it to lower case.

## Verification scripts

These need a running backend and frontend; they drive a real browser.

```bash
npm run verify:hero           # hero scene animation timeline
npm run verify:map-live       # Google Maps tiles, markers, and auth failures
```

`verify:map-live` writes a screenshot next to the frontend directory and exits
non-zero if the map did not load, so it works as a post-deploy smoke check.

## Deployment notes

- The Google Maps key is a browser key. Restrict it to the production origins
  that serve the dashboard, and to the Maps JavaScript API.
- `SecurityConfig` allows CORS from `http://localhost:5173` and
  `http://localhost:3000` only. Add the production origin there when deploying;
  nothing else will reach the API from a browser.
- `JwtTokenProvider` falls back to a hardcoded `jwt.secret` when the property is
  unset, and `application.yml` does not set it. Set `jwt.secret` to a random
  value of at least 32 bytes for any deployment — the default is in the source
  and anyone with the repository can mint tokens signed with it. The startup
  check is the key-length rejection in `Keys.hmacShaKeyFor`, which only catches
  a secret that is too *short*, not one that is public.
- `frontend/.env` is Git-ignored. Do not commit a real key.
- `/reports/**` is permitted in the security config but has no controller
  behind it yet, so those paths return 404.
