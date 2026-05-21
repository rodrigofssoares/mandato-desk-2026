/**
 * Validação visual rápida ciclo 1 EM050.
 * Confirma que as rotas Board, Dashboard e Relatórios renderizam sem erro de console
 * (redireciona pra /auth quando deslogado, mas pelo menos detectamos quebras).
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join } from 'path';

const BASE = 'http://localhost:3003';
const OUT = decodeURIComponent(
  new URL('../screenshots/qa-RAQ-MAND-EM050-ciclo1/', import.meta.url).pathname
).replace(/^\/([A-Za-z]:)/, '$1').replace(/\//g, '\\');
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1366, height: 800 } });
const page = await ctx.newPage();

const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`[console] ${m.text()}`);
});
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

const rotas = ['/', '/board', '/relatorios', '/auth'];
for (const rota of rotas) {
  console.log(`Navegando: ${rota}`);
  await page.goto(`${BASE}${rota}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const fname = `vis-${rota.replace(/[^a-z0-9]/gi, '_') || 'root'}.png`;
  await page.screenshot({ path: join(OUT, fname), fullPage: false });
  console.log(`   URL final: ${page.url()}`);
}

console.log('\n=== Erros de runtime ===');
if (errors.length === 0) {
  console.log('NENHUM');
} else {
  errors.forEach((e) => console.log(e));
}
await browser.close();
