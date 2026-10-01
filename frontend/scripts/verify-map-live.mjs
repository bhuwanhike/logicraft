/**
 * Live Google Maps check.
 *
 * The SDK's own verdict on a key is invisible to curl: the bootstrap script
 * carries no activation result, so a bad key still returns HTTP 200 and only
 * fails inside the page. This loads the real dashboard in Chromium and reports
 * what the SDK did — console errors, the auth-failure hook, Google's network
 * traffic, and whether any tiles or pins actually painted.
 *
 * Requires the dev server and API running:
 *   npm run dev            (http://localhost:5173)
 *   ./mvnw spring-boot:run (http://localhost:8080)
 *
 * Exits non-zero when the map fails to paint, which makes it usable in CI or a
 * post-deploy check once the key's referrer list allows the host.
 *
 *   npm run verify:map-live
 */
import { chromium } from 'playwright';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const APP_URL = process.env.MAP_TEST_URL ?? 'http://localhost:5173/dashboard';
const SCREENSHOT = process.env.MAP_TEST_SCREENSHOT ?? 'map-live.png';
const SETTLE_MS = Number(process.env.MAP_TEST_SETTLE_MS ?? 9000);

/** Never print the key; only whether one is configured. */
function keyIsConfigured() {
  const envFile = new URL('../.env', import.meta.url);
  if (!existsSync(envFile)) return false;
  const line = readFileSync(envFile, 'utf8')
    .split('\n')
    .find((l) => l.startsWith('VITE_GOOGLE_MAPS_API_KEY='));
  return Boolean(line && line.slice(line.indexOf('=') + 1).trim());
}

if (!keyIsConfigured()) {
  console.error('No VITE_GOOGLE_MAPS_API_KEY in .env — the map falls back to MapCanvas.');
  process.exit(1);
}

/**
 * Uses Playwright's own browser when it is installed. A bare `npm i` leaves the
 * headless shell absent even though a full Chromium is cached, so fall back to
 * whatever revision is present rather than failing with a version-number error.
 */
function cachedChromium() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const cache = join(homedir(), '.cache', 'ms-playwright');
  if (!existsSync(cache)) return undefined;
  for (const entry of readdirSync(cache)) {
    if (!entry.startsWith('chromium')) continue;
    for (const rel of [
      'chrome-linux64/chrome',
      'chrome-linux/chrome',
      'chrome-mac/Chromium.app/Contents/MacOS/Chromium',
      'chrome-win/chrome.exe'
    ]) {
      const candidate = join(cache, entry, rel);
      if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
    }
  }
  return undefined;
}

const executablePath = cachedChromium();
const browser = await chromium.launch({
  executablePath,
  args: ['--no-sandbox', '--disable-dev-shm-usage']
});
if (!executablePath) {
  console.log(`browser: playwright default (cached browser at ${join(homedir(), '.cache', 'ms-playwright')})`);
} else {
  console.log(`browser: ${executablePath.replace(homedir(), '~')}`);
}

const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

const consoleLines = [];
const googleRequests = [];
const failedRequests = [];
const googleErrors = [];

const isGoogle = (url) => /googleapis\.com|google\.com\/maps|khms/.test(url);

page.on('console', (msg) => {
  const text = msg.text();
  if (/google|maps|ApiNot|Referer|Invalid|billing|Billing|tile/i.test(text)) {
    consoleLines.push(`[${msg.type()}] ${text}`);
  }
});
page.on('pageerror', (err) => consoleLines.push(`[pageerror] ${err.message}`));
page.on('request', (req) => {
  if (isGoogle(req.url())) googleRequests.push(req.method());
});
page.on('requestfailed', (req) => {
  if (isGoogle(req.url())) {
    failedRequests.push({ url: req.url().slice(0, 160), error: req.failure()?.errorText });
  }
});
page.on('response', async (res) => {
  if (!isGoogle(res.url()) || res.status() < 400) return;
  let body = '';
  try {
    body = (await res.text()).slice(0, 300);
  } catch {
    /* body already consumed or blocked */
  }
  googleErrors.push({ url: res.url().slice(0, 160), status: res.status(), body });
});

/** The loader installs this global; capture it before the app boots. */
await page.addInitScript(() => {
  window.__authFailures = [];
  window.logicraftAuthFailure = (reason) => window.__authFailures.push(reason);
});

console.log(`\n=== loading ${APP_URL} ===`);
await page.goto(APP_URL, { waitUntil: 'networkidle', timeout: 45000 }).catch((e) => {
  console.log(`  goto failed: ${e.message}`);
});

// Tiles arrive asynchronously after the SDK resolves.
await page.waitForTimeout(SETTLE_MS);

const state = await page.evaluate(() => {
  const surface = document.querySelector('.map-surface');
  const tiles = document.querySelectorAll('.map-surface canvas, .map-surface img').length;
  const empty = document.querySelector('.map-empty');
  return {
    surface: surface ? `${surface.offsetWidth}x${surface.offsetHeight}` : null,
    tileNodes: tiles,
    markers: surface ? Number(surface.dataset.markerCount ?? -1) : -1,
    emptyVisible: Boolean(empty),
    emptyText: empty ? empty.innerText.replace(/\s+/g, ' ').slice(0, 200) : null,
    googleReady: Boolean(window.google?.maps?.Map),
    importLibrary: typeof window.google?.maps?.importLibrary,
    authFailures: window.__authFailures ?? []
  };
});

await page.screenshot({ path: SCREENSHOT });
await browser.close();

console.log('\n=== map state ===');
console.log(JSON.stringify(state, null, 2));
console.log(`\ngoogle requests: ${googleRequests.length}`);
console.log('\n=== google console ===');
console.log(consoleLines.length ? consoleLines.join('\n') : '  (none)');
console.log('\n=== failed google requests ===');
console.log(failedRequests.length ? JSON.stringify(failedRequests.slice(0, 6), null, 2) : '  (none)');
console.log('\n=== google http errors ===');
console.log(googleErrors.length ? JSON.stringify(googleErrors.slice(0, 6), null, 2) : '  (none)');
console.log(`\nscreenshot: ${SCREENSHOT}`);

const problems = [];
if (!state.surface) problems.push('no .map-surface element — the map panel did not render');
if (state.tileNodes === 0) problems.push('no tiles painted — the map is blank');
if (state.markers < 0) problems.push('no data-marker-count on the map surface');
if (state.markers === 0) problems.push('no markers were placed — active trips are missing from the map');
if (state.authFailures.length) problems.push(`SDK rejected the key: ${state.authFailures.join(', ')}`);
if (state.emptyVisible) problems.push(`map shows its empty state: ${state.emptyText}`);
if (failedRequests.length) problems.push(`${failedRequests.length} google request(s) failed`);
if (googleErrors.length) problems.push(`${googleErrors.length} google request(s) returned 4xx/5xx`);
if (consoleLines.some((l) => l.startsWith('[pageerror]'))) problems.push('page threw an error');

if (problems.length) {
  console.log(`\nFAIL\n  - ${problems.join('\n  - ')}`);
  process.exit(1);
}
console.log(`\nOK  tiles: ${state.tileNodes}, markers: ${state.markers}, surface: ${state.surface}`);