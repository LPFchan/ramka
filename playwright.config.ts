import { defineConfig, devices } from '@playwright/test';

/**
 * Browser tests for the things jsdom cannot run.
 *
 * The unit suite covers state machines and prop plumbing, but every animation
 * and gesture path — View Transitions, the Web Animations API, real pointer
 * events with velocity — is invisible to it. jsdom has no compositor, so a
 * regression in a morph or a pinch ships silently.
 *
 * Deliberately pointed at the production build rather than `next dev`. The docs
 * app sets `reactStrictMode`, which double-invokes effects in development, and
 * effects are where the engines are warmed and the animations started. The
 * production build is also what consumers get.
 *
 * That choice costs access to the `/debug/*` pages, which call `notFound()`
 * outside development and include a self-verifying audit panel. Worth
 * revisiting as a separate development-mode project if those checks earn their
 * keep; the attribute assertions here do not need them.
 */

// Not 3000: `next dev` lives there, and a suite that fights the developer's own
// server for a port either reuses it by accident or kills it.
const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3100);

export default defineConfig({
  testDir: './e2e',
  // Animations are the thing under test, so a stray `.only` left in a spec
  // would quietly stop covering them.
  forbidOnly: !!process.env.CI,
  // A flaky animation test is worse than none: it trains everyone to re-run
  // until green. Failures here should be reproducible, so no retries.
  retries: 0,
  // Morphs are timing-sensitive, and parallel workers on a shared CI core
  // stretch frame budgets enough to change what a test sees.
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  timeout: 30_000,
  expect: {
    // Generous relative to a 360ms morph, but the machine may be busy building.
    timeout: 10_000,
  },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Both engines Playwright ships now have the View Transition API, so this
    // is not a fallback arm — it is a second real morph implementation. Worth
    // running: the two differ on scroll-snap rounding and on how much of a
    // gesture reaches the scroller, which is where the library's own
    // platform-specific workarounds live.
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      // Gestures Playwright can only drive in Chromium. Excluded as a directory
      // rather than with `test.skip(browserName !== 'chromium')`, because a
      // skipped test still leaves WebKit unable to launch a browser for whatever
      // runs next — it surfaces as a segfault on an unrelated spec, which is a
      // memorably bad afternoon.
      testIgnore: '**/chromium-only/**',
    },
  ],
  webServer: {
    // `start` serves the existing build; the build itself is a prerequisite,
    // because doing it here would hide a stale `dist/` behind a passing run.
    command: `pnpm --filter docs start --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
