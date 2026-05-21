import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

mkdirSync('screenshots/RAQ-MAND-EM064', { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

page.on('response', (res) => {
  if (res.status() >= 400) {
    console.log('HTTP_ERR:', res.status(), res.url());
  }
});

// Go to auth page, inspect form
await page.goto('http://localhost:3001/auth', { waitUntil: 'networkidle', timeout: 30000 });
await page.screenshot({ path: 'screenshots/RAQ-MAND-EM064/inspect-auth.png' });

// List all input fields
const inputs = await page.locator('input').all();
console.log('Input count:', inputs.length);
for (const inp of inputs) {
  const type = await inp.getAttribute('type');
  const name = await inp.getAttribute('name');
  const placeholder = await inp.getAttribute('placeholder');
  console.log('Input:', { type, name, placeholder });
}

// List all buttons
const buttons = await page.locator('button').all();
for (const btn of buttons) {
  const text = await btn.textContent();
  const type = await btn.getAttribute('type');
  console.log('Button:', { type, text: text?.trim() });
}

await browser.close();
console.log('DONE');
