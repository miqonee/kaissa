// Optional browser QA. Use an isolated local server/database; Playwright is external to the app.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const base = process.env.KAISSA_TEST_BASE_URL ?? '';
assert(/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base), 'Use a local preview server');
const { chromium } = await import(process.env.KAISSA_PLAYWRIGHT_MODULE ?? 'playwright');
const output = process.env.KAISSA_QA_OUTPUT ?? '/tmp/kaissa-mode-previews';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true,
  ...(process.env.KAISSA_CHROMIUM_PATH ? { executablePath: process.env.KAISSA_CHROMIUM_PATH } : {}),
});
const errors = [];
const modes = ['team', 'double', 'bughouse', 'crazyhouse', 'crazyhouse-team', 'three-player', 'four-player'];
async function chooseQuickMode(page, mode) {
  const scope = page.locator('.quick-play');
  if (await scope.locator('.mode-select').isVisible()) await scope.locator('.mode-select').selectOption(mode);
  else await scope.locator(`.mode-choice:has(input[value="${mode}"])`).click();
  assert.equal(await scope.locator('.mode-choice.selected input').inputValue(), mode);
  const sizes = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth }));
  assert(sizes.width <= sizes.viewport + 1, `${mode}: quick mode row overflows: ${JSON.stringify(sizes)}`);
}
async function choose(page, scope, mode) {
  await scope.locator('.mode-trigger').click();
  await scope.locator(`.mode-option[data-mode="${mode}"]`).click();
  await scope.locator('.mode-popup').waitFor({ state: 'hidden' });
  await scope.locator('.mode-trigger').hover();
  await scope.locator('.mode-popup.preview-only').waitFor();
  const bounds = await scope.locator('.mode-preview').evaluate(el => {
    const preview = el.getBoundingClientRect();
    const detail = el.closest('.mode-detail').getBoundingClientRect();
    return [...el.querySelectorAll('svg')].map(svg => {
      const board = svg.getBoundingClientRect();
      return { width: board.width, left: board.left, right: board.right,
        previewLeft: preview.left, previewRight: preview.right, detailLeft: detail.left, detailRight: detail.right };
    });
  });
  assert(bounds.length > 0, mode + ': board preview is present');
  for (const b of bounds) {
    assert(b.width > 0 && b.left >= b.previewLeft - 1 && b.right <= b.previewRight + 1 &&
      b.left >= b.detailLeft - 1 && b.right <= b.detailRight + 1, `${mode}: board escapes its card: ${JSON.stringify(b)}`);
  }
  const sizes = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth }));
  assert(sizes.width <= sizes.viewport + 1, `${mode}: page overflows: ${JSON.stringify(sizes)}`);
  await page.mouse.move(0, 0);
  await scope.locator('.mode-popup').waitFor({ state: 'hidden' });
}
try {
  const context = await browser.newContext({ ignoreHTTPSErrors: process.env.KAISSA_QA_IGNORE_HTTPS_ERRORS === 'true' });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  for (const locale of ['ru', 'en']) {
    await page.goto(base + (locale === 'en' ? '/?lang=en' : '/'), { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    if (process.env.KAISSA_QA_REQUIRE_FONTS === 'true') {
      assert(await page.evaluate(() => ['Spectral', 'IBM Plex Sans', 'IBM Plex Mono'].every(name => [...document.fonts].some(font => font.family === name && font.status === 'loaded'))), 'Brand fonts must be loaded for visual review');
    }
    for (const width of [320, 390, 640, 768, 1080, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const mode of modes) await chooseQuickMode(page, mode);
      await chooseQuickMode(page, 'double');
      await page.locator('.table-create-actions button').click();
      const modal = page.locator('.create-modal');
      await modal.waitFor();
      for (const mode of modes) await choose(page, modal, mode);
      await choose(page, modal, 'double');
      if (locale === 'ru' && [390, 1440].includes(width)) await page.screenshot({ path: `${output}/create-${width}.png` });
      await modal.locator('.modal-close').click();
    }
  }
  assert.deepEqual(errors, []);
  console.log('OK: all 7 quick mode buttons/native options and creation previews work in RU/EN at 320/390/640/768/1080/1440 px; no page overflow or browser errors.');
} finally { await browser.close(); }
