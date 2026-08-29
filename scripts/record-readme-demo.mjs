/**
 * Records the landing-page morph demo into a webm for the README GIF.
 * Run from repo root: NODE_PATH=node_modules/.pnpm/playwright@1.62.1/node_modules node scripts/record-readme-demo.mjs
 */
import { chromium } from '../node_modules/.pnpm/playwright@1.62.1/node_modules/playwright/index.mjs';
import { mkdirSync } from 'node:fs';

const OUT_DIR = '/tmp/ramka-readme-demo';
mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1180, height: 740 },
  recordVideo: { dir: OUT_DIR, size: { width: 1180, height: 740 } },
  colorScheme: 'light',
});
const page = await context.newPage();

await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

// Bring the gallery fully into view, comfortably inset from the edges.
const gallery = page.locator('.columns-2').first();
await gallery.scrollIntoViewIfNeeded();
await page.mouse.wheel(0, -60);
await page.waitForTimeout(1500);

const triggers = page.locator('.columns-2 button');
console.log('tile count:', await triggers.count());

// Open the cross-aspect plane tile (wide tile -> tall portrait morph).
await triggers.nth(3).click();
await page.waitForTimeout(1900);

// Swipe through two slides.
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(1400);
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(1600);

// Close: morph back to the tile.
await page.keyboard.press('Escape');
await page.waitForTimeout(1700);

// Second opening from a different tile to show it's every tile, then close.
await triggers.nth(0).click();
await page.waitForTimeout(1900);
await page.keyboard.press('Escape');
await page.waitForTimeout(1800);

await context.close();
const video = await page.video().path();
console.log('video:', video);
await browser.close();
