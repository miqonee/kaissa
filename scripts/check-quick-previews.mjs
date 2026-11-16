// Frontend-only QA against a local Vite server, with deterministic read-only API fixtures.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const base = process.env.KAISSA_TEST_BASE_URL ?? '';
assert(/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base), 'Use a local preview server');
const { chromium } = await import(process.env.KAISSA_PLAYWRIGHT_MODULE ?? 'playwright');
const output = process.env.KAISSA_QA_OUTPUT ?? '/tmp/kaissa-quick-previews';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.KAISSA_CHROMIUM_PATH ? { executablePath: process.env.KAISSA_CHROMIUM_PATH } : {}) });
const modes = ['team', 'double', 'bughouse', 'crazyhouse', 'crazyhouse-team', 'three-player', 'four-player'];
const errors = [], writes = [];
try {
  for (const touch of [false, true]) {
    const context = await browser.newContext({ hasTouch: touch, isMobile: touch });
    await context.route('**/api/**', route => {
      const request = route.request();
      if (request.method() !== 'GET') writes.push(request.url());
      const path = new URL(request.url()).pathname;
      const body = path === '/api/lobbies' ? { lobbies: modes.map(mode => ({ id: mode, mode, isAuto: true, players: [], timeControl: { kind: 'none' } })) } : path === '/api/auth/me' ? { user: null } : {};
      return route.fulfill({ json: body });
    });
    await context.route('**/socket.io/**', route => route.abort());
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    for (const locale of ['ru', 'en']) {
      for (const width of touch ? [320, 390, 768, 1440] : [320, 390, 768, 1080, 1101, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`${base}/?lang=${locale}`);
        await page.locator('.quick-action:not(:disabled)').waitFor();
        for (const theme of ['light', 'dark']) {
          await page.evaluate(theme => document.documentElement.setAttribute('data-theme', theme), theme);
          for (const mode of modes) {
            const select = page.locator('.mode-select');
            if (await select.isVisible()) {
              await select.selectOption(mode);
              await page.locator('.quick-preview-trigger').click();
            } else {
              const before = await page.locator('.mode-choice.selected input').inputValue();
              await page.locator(`.mode-choice:has(input[value="${mode}"])`).hover();
              await page.locator(`.quick-mode-preview .mode-preview.${mode}`).waitFor();
              assert.equal(await page.locator('.mode-choice.selected input').inputValue(), before, 'hover does not select');
            }
            const card = page.locator('.quick-mode-preview'); await card.waitFor();
            assert(await card.locator(`.mode-preview.${mode}`).isVisible());
            const geometry = await card.evaluate(el => {
              const rect = el.getBoundingClientRect();
              return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: innerWidth, height: innerHeight,
                overflow: document.documentElement.scrollWidth > innerWidth + 1,
                boards: [...el.querySelectorAll('.mode-preview svg')].map(svg => { const b = svg.getBoundingClientRect(); return { left: b.left, right: b.right, width: b.width }; }) };
            });
            assert(!geometry.overflow && geometry.left >= 0 && geometry.right <= geometry.width + 1 && geometry.top >= 0 && geometry.bottom <= geometry.height + 1, JSON.stringify(geometry));
            assert(geometry.boards.length && geometry.boards.every(b => b.width > 0 && b.left >= geometry.left && b.right <= geometry.right + 1), `${mode}: board overflow`);
            if (mode === 'double' && locale === 'ru' && [390, 1440].includes(width)) await page.screenshot({ path: `${output}/${touch ? 'touch' : 'mouse'}-${width}-${theme}.png` });
            if (touch) await card.locator('button').click(); else await page.keyboard.press('Escape');
            await card.waitFor({ state: 'hidden' });
            await page.mouse.move(0, 0);
          }
        }
      }
    }
    if (!touch) {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(base); await page.locator('.quick-action:not(:disabled)').waitFor();
      await page.locator('.quick-rules').focus(); await page.keyboard.press('Tab');
      await page.locator('.quick-mode-preview').waitFor();
      await page.keyboard.press('ArrowRight');
      assert.equal(await page.locator('.mode-choice.selected input').inputValue(), 'double');
      await page.keyboard.press('Escape'); await page.locator('.quick-mode-preview').waitFor({ state: 'hidden' });
      // Repeated hover can be entered without flickering; resize hides stale radio anchors.
      await page.locator('.mode-choice:has(input[value="bughouse"])').hover();
      await page.locator('.quick-mode-preview').waitFor(); await page.locator('.quick-mode-preview').hover();
      await page.waitForTimeout(250); assert(await page.locator('.quick-mode-preview').isVisible());
      await page.setViewportSize({ width: 390, height: 900 }); await page.locator('.quick-mode-preview').waitFor({ state: 'hidden' });
    }
    await context.close();
  }
  assert.deepEqual(writes, [], 'Preview must not start/join a game');
  assert.deepEqual(errors, []);
  console.log('PASS: 7 modes, RU/EN, light/dark, mouse/touch, 320–1440px; keyboard, dismissal, resize, geometry; no API writes.');
} finally { await browser.close(); }
