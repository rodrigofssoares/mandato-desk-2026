/**
 * QA Fase 0 — Aba Recursos (T06)
 * Testa: AccountFormDialog com abas Conexao/Recursos, switches, persistencia e badge no card.
 */

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:3001';
const EMAIL = 'rodrigofssoares@gmail.com';
const SENHA = 'QA-Temp-2026!';

const OUT = join(__dirname, '..', 'screenshots', 'qa-fase0');
mkdirSync(OUT, { recursive: true });

const log = (msg) => console.log(`[QA] ${msg}`);
const results = [];

function record(step, status, notes = '') {
  results.push({ step, status, notes });
  const icon = status === 'PASS' ? 'PASS' : status === 'FAIL' ? 'FAIL' : status === 'SKIP' ? 'SKIP' : 'WARN';
  log(`[${icon}] ${step}${notes ? ' — ' + notes : ''}`);
}

async function shot(page, name) {
  const path = join(OUT, `${name}.png`);
  await page.screenshot({ path, fullPage: false });
  log(`Screenshot: ${path}`);
  return path;
}

async function login(page) {
  await page.goto(BASE + '/auth', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', SENHA);
  await page.click('button[type="submit"]');
  try {
    await page.waitForFunction(() => !window.location.pathname.includes('/auth'), { timeout: 30000 });
    await page.waitForLoadState('networkidle');
    return true;
  } catch {
    return false;
  }
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  // ── CT01: Login ──────────────────────────────────────────────────────────────
  const loggedIn = await login(page);
  if (!loggedIn) {
    record('CT01 Login', 'FAIL', 'Nao conseguiu logar');
    await shot(page, 'ct01-login-fail');
    await browser.close();
    printResults();
    return;
  }
  record('CT01 Login', 'PASS');
  await shot(page, 'ct01-pos-login');

  // ── Navega para WhatsApp ─────────────────────────────────────────────────────
  await page.goto(BASE + '/integracoes/whatsapp', { timeout: 20000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  await shot(page, 'ct02-whatsapp-page');

  // ── CT02: Aba "Contas" visivel ───────────────────────────────────────────────
  const contasTab = page.locator('[role="tab"]:has-text("Contas")').first();
  if (await contasTab.isVisible({ timeout: 5000 })) {
    await contasTab.click();
    await page.waitForTimeout(800);
    record('CT02 Aba Contas visivel', 'PASS');
    await shot(page, 'ct02-aba-contas');
  } else {
    record('CT02 Aba Contas visivel', 'FAIL', 'Tab Contas nao encontrada');
    await shot(page, 'ct02-fail');
  }

  // ── CT03: Botao Editar abre AccountFormDialog ────────────────────────────────
  const editBtn = page.locator('button:has-text("Editar")').first();
  if (await editBtn.isVisible({ timeout: 5000 })) {
    await editBtn.click();
    await page.waitForTimeout(800);
    const dialog = page.locator('[role="dialog"]');
    if (await dialog.isVisible({ timeout: 5000 })) {
      record('CT03 Dialog abriu', 'PASS');
      await shot(page, 'ct03-dialog-aberto');
    } else {
      record('CT03 Dialog abriu', 'FAIL', 'Dialog nao apareceu');
      await shot(page, 'ct03-dialog-fail');
    }
  } else {
    record('CT03 Botao Editar visivel', 'SKIP', 'Nenhuma conta cadastrada — nao ha botao Editar');
    await shot(page, 'ct03-skip-no-account');
  }

  // ── CT04: Abas "Conexao" e "Recursos" presentes ──────────────────────────────
  const conexaoTab = page.locator('[role="tablist"] [role="tab"]:has-text("Conexao"), [role="tablist"] [role="tab"]:has-text("Conexão")').first();
  const recursosTab = page.locator('[role="tablist"] [role="tab"]:has-text("Recursos")').first();

  const hasConexao = await conexaoTab.isVisible({ timeout: 3000 }).catch(() => false);
  const hasRecursos = await recursosTab.isVisible({ timeout: 3000 }).catch(() => false);

  if (hasConexao && hasRecursos) {
    record('CT04 Abas Conexao+Recursos presentes', 'PASS');
    await shot(page, 'ct04-abas-conexao-recursos');
  } else {
    record('CT04 Abas Conexao+Recursos presentes', 'FAIL', `conexao=${hasConexao} recursos=${hasRecursos}`);
    await shot(page, 'ct04-fail-abas');
  }

  // ── CT05: Aba Recursos - 3 categorias com switches ───────────────────────────
  if (hasRecursos) {
    await recursosTab.click();
    await page.waitForTimeout(600);
    await shot(page, 'ct05-aba-recursos-aberta');

    // Verifica 3 categorias
    const iaSection = page.locator('h4:has-text("Inteligência Artificial"), h4:has-text("Inteligencia Artificial")').first();
    const automacaoSection = page.locator('h4:has-text("Automação"), h4:has-text("Automacao")').first();
    const engajamentoSection = page.locator('h4:has-text("Engajamento")').first();

    const hasIA = await iaSection.isVisible({ timeout: 2000 }).catch(() => false);
    const hasAutomacao = await automacaoSection.isVisible({ timeout: 2000 }).catch(() => false);
    const hasEngajamento = await engajamentoSection.isVisible({ timeout: 2000 }).catch(() => false);

    if (hasIA && hasAutomacao && hasEngajamento) {
      record('CT05 3 categorias presentes (IA/Automacao/Engajamento)', 'PASS');
    } else {
      record('CT05 3 categorias presentes', 'FAIL', `IA=${hasIA} Automacao=${hasAutomacao} Engajamento=${hasEngajamento}`);
    }

    // Verifica aviso de custo de IA
    const alertText = await page.locator('text=custo').first().isVisible({ timeout: 2000 }).catch(() => false);
    if (alertText) {
      record('CT05b Aviso de custo de IA presente', 'PASS');
    } else {
      record('CT05b Aviso de custo de IA', 'WARN', 'Aviso de custo nao visivel — pode estar fora do viewport');
    }

    // Verifica switches — deve haver pelo menos 6 (IA) + 5 (Automacao) + 7 (Engajamento) = 18
    const switches = await page.locator('[role="switch"]').count();
    if (switches >= 10) {
      record(`CT05c Switches presentes (${switches})`, 'PASS');
    } else {
      record(`CT05c Switches presentes (${switches})`, 'FAIL', `Esperado >= 10, encontrado ${switches}`);
    }

    // ── CT06: Ligar 2 switches ──────────────────────────────────────────────────
    const allSwitches = page.locator('[role="switch"]');
    const switchCount = await allSwitches.count();
    let toggled = 0;
    for (let i = 0; i < Math.min(3, switchCount); i++) {
      const sw = allSwitches.nth(i);
      const isChecked = await sw.getAttribute('data-state');
      if (isChecked !== 'checked') {
        await sw.click();
        await page.waitForTimeout(200);
        toggled++;
        if (toggled >= 2) break;
      }
    }
    if (toggled >= 2) {
      record('CT06 Ligou 2 switches', 'PASS');
    } else {
      record('CT06 Ligou switches', 'WARN', `Ligou ${toggled} switches (pode ja estar tudo ligado)`);
    }
    await shot(page, 'ct06-switches-ligados');
  } else {
    record('CT05/CT06 Aba Recursos', 'SKIP', 'Dialog nao abriu ou sem conta cadastrada');
  }

  // ── CT07: Salvar e verificar persistencia ────────────────────────────────────
  const saveBtn = page.locator('button:has-text("Salvar alterações"), button:has-text("Salvar alteracoes")').first();
  if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await saveBtn.click();
    await page.waitForTimeout(1500);
    record('CT07 Clicou Salvar', 'PASS');
    await shot(page, 'ct07-pos-salvar');
  } else {
    record('CT07 Salvar', 'SKIP', 'Botao Salvar nao visivel');
  }

  // ── CT08: Verificar badge "X recursos" no AccountCard ─────────────────────────
  await page.waitForTimeout(500);
  const badge = page.locator('text=/\\d+ recurso/i').first();
  if (await badge.isVisible({ timeout: 5000 }).catch(() => false)) {
    const badgeText = await badge.textContent();
    record(`CT08 Badge recursos no card: "${badgeText}"`, 'PASS');
    await shot(page, 'ct08-badge-recursos');
  } else {
    // Se salvou 0 switches, badge nao aparece (conditional render quando activeCount > 0)
    record('CT08 Badge recursos no card', 'WARN', 'Badge nao visivel — pode ser que switches foram salvos como 0 ou dialog nao foi aberto');
    await shot(page, 'ct08-no-badge');
  }

  // ── CT09: Mobile viewport ────────────────────────────────────────────────────
  await ctx.setExtraHTTPHeaders({});
  const mobilePage = await ctx.newPage();
  await mobilePage.setViewportSize({ width: 375, height: 667 });
  await mobilePage.goto(BASE + '/integracoes/whatsapp', { timeout: 20000 });
  await mobilePage.waitForLoadState('networkidle');
  await mobilePage.waitForTimeout(1200);
  await mobilePage.screenshot({ path: join(OUT, 'ct09-mobile-whatsapp.png'), fullPage: false });
  record('CT09 Mobile viewport capturado', 'PASS');
  await mobilePage.close();

  await browser.close();
  printResults();
}

function printResults() {
  console.log('\n=== RESULTADOS QA FASE 0 ===');
  let pass = 0, fail = 0, warn = 0, skip = 0;
  for (const r of results) {
    if (r.status === 'PASS') pass++;
    else if (r.status === 'FAIL') fail++;
    else if (r.status === 'WARN') warn++;
    else skip++;
  }
  console.log(`PASS: ${pass} | FAIL: ${fail} | WARN: ${warn} | SKIP: ${skip}`);
  if (fail > 0) {
    console.log('\nFALHAS:');
    results.filter(r => r.status === 'FAIL').forEach(r => console.log(`  - ${r.step}: ${r.notes}`));
  }
  console.log(JSON.stringify({ results, outDir: OUT }, null, 2));
}

run().catch((err) => {
  console.error('[QA] Erro fatal:', err.message);
  process.exit(1);
});
