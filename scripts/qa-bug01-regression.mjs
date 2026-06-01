import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

mkdirSync('screenshots/RAQ-MAND-EM064', { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

const consoleMessages = [];
page.on('console', (msg) => {
  consoleMessages.push({ type: msg.type(), text: msg.text() });
});
page.on('pageerror', (err) => {
  consoleMessages.push({ type: 'pageerror', text: err.message });
});

// ---- Login ----
await page.goto('http://localhost:3001/auth', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForSelector('input[type=email]', { timeout: 10000 });
await page.fill('input[type=email]', 'rodrigofssoares@gmail.com');
await page.fill('input[type=password]', 'QA-Temp-2026!');
await page.click('button[type=submit]');

// Wait for redirect away from /auth — poll URL
let waited = 0;
while (page.url().includes('/auth') && waited < 15000) {
  await page.waitForTimeout(500);
  waited += 500;
}
console.log('Logged in, URL:', page.url());

// ---- Navigate to settings/nav-ordem ----
await page.goto('http://localhost:3001/settings?tab=nav-ordem', { waitUntil: 'networkidle', timeout: 20000 });
await page.waitForTimeout(5000);

const maxDepthBefore = consoleMessages.filter((m) => m.text.includes('Maximum update depth'));
console.log('MAX_DEPTH_COUNT_BEFORE_DRAG:', maxDepthBefore.length);
if (maxDepthBefore.length > 0) {
  console.log('MAX_DEPTH_MSGS_BEFORE:', JSON.stringify(maxDepthBefore, null, 2));
}

const warningsAndErrors = consoleMessages.filter((m) => m.type === 'warning' || m.type === 'error');
console.log('WARNINGS_AND_ERRORS_COUNT:', warningsAndErrors.length);
if (warningsAndErrors.length > 0) {
  console.log('WARNINGS_AND_ERRORS:', JSON.stringify(warningsAndErrors, null, 2));
}

await page.screenshot({ path: 'screenshots/RAQ-MAND-EM064/09-pos-fix-bug01-before-drag.png', fullPage: false });
console.log('Screenshot before drag captured');

// ---- Drag first item to last position ----
const draggables = await page.locator('[aria-label^="Reordenar"]').all();
console.log('Draggable count:', draggables.length);

if (draggables.length >= 2) {
  const first = draggables[0];
  const last = draggables[draggables.length - 1];
  const firstBox = await first.boundingBox();
  const lastBox = await last.boundingBox();
  console.log('First box:', JSON.stringify(firstBox));
  console.log('Last box:', JSON.stringify(lastBox));

  if (firstBox && lastBox) {
    await page.mouse.move(firstBox.x + firstBox.width / 2, firstBox.y + firstBox.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(300);
    await page.mouse.move(lastBox.x + lastBox.width / 2, lastBox.y + lastBox.height / 2 + 20, { steps: 20 });
    await page.waitForTimeout(300);
    await page.mouse.up();
    await page.waitForTimeout(2000);
    console.log('Drag completed');
  }
} else {
  console.log('WARNING: Not enough draggable items found');
}

const maxDepthAfter = consoleMessages.filter((m) => m.text.includes('Maximum update depth'));
console.log('MAX_DEPTH_COUNT_AFTER_DRAG:', maxDepthAfter.length);
if (maxDepthAfter.length > 0) {
  console.log('MAX_DEPTH_MSGS_AFTER:', JSON.stringify(maxDepthAfter, null, 2));
}

const allWarningsAfter = consoleMessages.filter((m) => m.type === 'warning' || m.type === 'error');
console.log('TOTAL_WARNINGS_ERRORS_AFTER_DRAG:', allWarningsAfter.length);

// Final screenshot
await page.screenshot({ path: 'screenshots/RAQ-MAND-EM064/09-pos-fix-bug01.png', fullPage: false });
console.log('Final screenshot captured at screenshots/RAQ-MAND-EM064/09-pos-fix-bug01.png');

console.log('--- ALL CONSOLE MESSAGES ---');
console.log(JSON.stringify(consoleMessages, null, 2));

await browser.close();
console.log('DONE');
