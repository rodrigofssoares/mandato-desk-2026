/**
 * Ciclo 1 EM050: reproduz queixa "não vejo em nenhuma aba".
 * Loga via formulário e captura sidebar.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join } from 'path';

const BASE = 'http://localhost:3003';
const EMAIL = 'admin@mandatodesk.com';
const SENHA = 'QA-Temp-2026!';

const OUT = decodeURIComponent(
  new URL('../screenshots/qa-RAQ-MAND-EM050-ciclo1/', import.meta.url).pathname
).replace(/^\/([A-Za-z]:)/, '$1').replace(/\//g, '\\');
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1366, height: 800 } });
const page = await ctx.newPage();
const consoleMsgs = [];
page.on('console', (m) => consoleMsgs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => consoleMsgs.push(`[pageerror] ${e.message}`));

console.log('1) Abrindo /auth');
await page.goto(`${BASE}/auth`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

console.log('2) Preenchendo formulário');
await page.fill('input[type="email"]', EMAIL);
await page.fill('input[type="password"]', SENHA);

console.log('3) Clicando Entrar');
const [resp] = await Promise.all([
  page.waitForResponse((r) => r.url().includes('/auth/v1/token'), { timeout: 15000 }).catch(() => null),
  page.click('button[type="submit"]'),
]);
if (resp) console.log('   auth/v1/token →', resp.status());

await page.waitForTimeout(5000);
console.log('   URL após login:', page.url());
await page.screenshot({ path: join(OUT, '00-pos-login.png'), fullPage: false });

if (page.url().includes('/auth')) {
  console.log('   Ainda em /auth — possível que a tela mude após hidratação. Aguardando mais 5s.');
  await page.waitForTimeout(5000);
  console.log('   URL:', page.url());
  await page.screenshot({ path: join(OUT, '00b-pos-login.png'), fullPage: false });
}

console.log('4) Navegando para raiz e tirando screenshot da sidebar');
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(4000);
await page.screenshot({ path: join(OUT, '01-sidebar.png'), fullPage: false });

const linkRel = page.locator('a[href="/relatorios"]');
const count = await linkRel.count();
console.log(`   /relatorios count: ${count}`);

const itensSidebar = await page.locator('a[href]:has(svg)').allInnerTexts();
console.log('   Itens com link+ícone:', JSON.stringify(itensSidebar));

console.log('5) Navegando direto pra /relatorios');
await page.goto(`${BASE}/relatorios`, { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
await page.screenshot({ path: join(OUT, '02-pagina-relatorios.png'), fullPage: true });
const tituloRel = await page.locator('h1, h2, [data-eyebrow]').filter({ hasText: /Relatórios/i }).count();
const acessoNegado = await page.locator('text=/Acesso restrito/i').count();
console.log(`   Título: ${tituloRel}, AcessoRestrito: ${acessoNegado}, URL: ${page.url()}`);

console.log('\n=== Console errors ===');
consoleMsgs.filter((m) => m.startsWith('[error]') || m.startsWith('[pageerror]')).slice(-15).forEach((m) => console.log(m));

await browser.close();
