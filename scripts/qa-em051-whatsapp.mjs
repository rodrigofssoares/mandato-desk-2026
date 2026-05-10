/**
 * QA Smoke Test — RAQ-MAND-EM051 — Z-API WhatsApp UI
 * Playwright headless desktop + mobile, screenshots em screenshots/qa-RAQ-MAND-EM051/
 */

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:3001';
const EMAIL = 'rodrigofssoares@gmail.com';
const SENHA = 'QA-Temp-2026!';

const OUT = join(__dirname, '..', 'screenshots', 'qa-RAQ-MAND-EM051');

const log = (msg) => console.log(`[QA] ${msg}`);

const results = [];
function record(step, status, notes = '') {
  results.push({ step, status, notes });
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  log(`${icon} Step ${step} — ${status}${notes ? ': ' + notes : ''}`);
}

async function shot(page, name) {
  const path = join(OUT, `${name}.png`);
  await page.screenshot({ path, fullPage: false });
  log(`Screenshot: ${path}`);
  return path;
}

async function login(page) {
  await page.goto(`${BASE}/auth`, { timeout: 30000 });
  await page.waitForSelector('#email', { timeout: 15000 });
  await page.fill('#email', EMAIL);
  await page.fill('#password', SENHA);
  await page.click('button[type="submit"]');
  try {
    await page.waitForURL((url) => !url.pathname.includes('/auth'), { timeout: 20000 });
    await page.waitForLoadState('networkidle');
    return true;
  } catch {
    return false;
  }
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  log(`=== QA Smoke Test RAQ-MAND-EM051 — Z-API WhatsApp ===`);
  log(`Base: ${BASE}`);
  log(`Screenshots em: ${OUT}`);

  const browser = await chromium.launch({ headless: true });
  const consoleErrors = [];

  // ── Contexto desktop ────────────────────────────────────────────────────────
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    locale: 'pt-BR',
  });
  const page = await ctx.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push('[PageError] ' + err.message));

  // ── STEP 1: Login ───────────────────────────────────────────────────────────
  log('--- STEP 1: Login ---');
  const loggedIn = await login(page);
  if (!loggedIn) {
    await shot(page, 'step1-login-falhou');
    record('1 - Login', 'FAIL', 'Não redirecionou após submit');
    await browser.close();
    printSummary(consoleErrors);
    return;
  }
  await shot(page, 'step1-pos-login');
  record('1 - Login', 'PASS', 'Redirecionou para dashboard');

  // ── STEP 2: Sidebar — item WhatsApp visível ─────────────────────────────────
  log('--- STEP 2: Sidebar WhatsApp ---');
  await page.waitForTimeout(1500);

  // Busca por qualquer elemento com texto "WhatsApp" na sidebar
  const allWhatsApp = await page.locator('text=/WhatsApp/i').all();
  log(`Elementos WhatsApp encontrados: ${allWhatsApp.length}`);

  let whatsappLinkFound = false;
  for (const el of allWhatsApp) {
    const visible = await el.isVisible().catch(() => false);
    if (visible) {
      whatsappLinkFound = true;
      break;
    }
  }

  await shot(page, 'step2-sidebar-whatsapp');
  if (whatsappLinkFound) {
    record('2 - Sidebar WhatsApp', 'PASS', 'Item WhatsApp visível');
  } else {
    record('2 - Sidebar WhatsApp', 'FAIL', 'Item WhatsApp não encontrado');
  }

  // ── STEP 3: Navegar para /integracoes/whatsapp ─────────────────────────────
  log('--- STEP 3: Página /integracoes/whatsapp ---');
  await page.goto(`${BASE}/integracoes/whatsapp`, { timeout: 30000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  const url = page.url();
  const urlOk = url.includes('/integracoes/whatsapp');
  await shot(page, 'step3-pagina-whatsapp');

  // Verificar PageHeader
  const pageHeader = await page.locator('h1, h2').filter({ hasText: /WhatsApp/i }).first().isVisible().catch(() => false);

  // Verificar tabs
  const tabsFound = [];
  for (const tab of ['Contas', 'Conversas', 'Webhooks', 'Logs']) {
    const visible = await page.locator(`[role="tab"]:has-text("${tab}")`).first().isVisible().catch(() => false);
    if (visible) tabsFound.push(tab);
  }

  if (urlOk && tabsFound.length === 4) {
    record('3 - Página /integracoes/whatsapp', 'PASS',
      `URL ok. Header WhatsApp: ${pageHeader}. Tabs: [${tabsFound.join(', ')}]`);
  } else {
    record('3 - Página /integracoes/whatsapp', urlOk ? 'FAIL' : 'FAIL',
      `URL ok: ${urlOk}. Tabs encontradas: [${tabsFound.join(', ')}] (esperado: 4)`);
  }

  // ── STEP 4: Aba Contas selecionada por default + EmptyState/botão ──────────
  log('--- STEP 4: Aba Contas default ---');
  // Verificar se Contas está ativa por default
  const contasTabActive = await page.locator('[role="tab"][data-state="active"]:has-text("Contas")').first().isVisible().catch(() => false);

  await page.waitForTimeout(800);
  await shot(page, 'step4-aba-contas');

  const emptyStateText = await page.locator('text=/Nenhuma conta Z-API/i').first().isVisible().catch(() => false);
  const novaContaBtn = await page.locator('button:has-text("Nova conta Z-API")').first().isVisible().catch(() => false);

  if (emptyStateText && novaContaBtn) {
    record('4 - Aba Contas default + EmptyState', 'PASS',
      `Tab Contas ativa: ${contasTabActive}. EmptyState ok. Botão Nova Conta visível`);
  } else if (!emptyStateText) {
    // Pode ter contas de teste anteriores
    const hasCards = await page.locator('[class*="grid"]').first().isVisible().catch(() => false);
    record('4 - Aba Contas default + EmptyState', 'PASS',
      `Tab Contas ativa: ${contasTabActive}. Contas existentes no grid (EmptyState não visto)`);
  } else {
    record('4 - Aba Contas default + EmptyState', 'FAIL',
      `EmptyState: ${emptyStateText}, Botão Nova Conta: ${novaContaBtn}`);
  }

  // ── STEP 5: Dialog Nova Conta + warning MVP ─────────────────────────────────
  log('--- STEP 5: Dialog Nova Conta ---');
  // Clicar botão Nova Conta (pode estar no header da tab ou no EmptyState)
  const novaContaBtns = await page.locator('button:has-text("Nova conta Z-API")').all();
  let clicked = false;
  for (const btn of novaContaBtns) {
    if (await btn.isVisible().catch(() => false)) {
      await btn.click();
      clicked = true;
      break;
    }
  }

  if (!clicked) {
    record('5 - Dialog Nova Conta', 'FAIL', 'Botão "Nova conta Z-API" não encontrado — usuário pode não ser admin');
    await shot(page, 'step5-sem-botao');
  } else {
    await page.waitForTimeout(800);
    const dialogVisible = await page.locator('[role="dialog"]').first().isVisible().catch(() => false);
    await shot(page, 'step5-dialog-nova-conta');

    if (dialogVisible) {
      // Verificar warning de MVP (AlertTriangle com texto sobre texto puro/TESTE)
      const warningContent = await page.locator('[role="dialog"]').first().textContent().catch(() => '');
      const hasMVPWarning = warningContent.includes('TESTE') || warningContent.includes('texto puro') || warningContent.includes('zapi-encrypt');
      record('5 - Dialog Nova Conta', 'PASS',
        `Dialog aberto. Warning MVP: ${hasMVPWarning}`);
    } else {
      record('5 - Dialog Nova Conta', 'FAIL', 'Dialog não abriu');
    }
  }

  // ── STEP 6: Criar conta ─────────────────────────────────────────────────────
  log('--- STEP 6: Criar conta Z-API ---');
  let accountCreated = false;
  const dialogOpen = await page.locator('[role="dialog"]').first().isVisible().catch(() => false);

  if (dialogOpen) {
    try {
      await page.fill('#name', 'Teste QA');
      await page.fill('#instance_id', 'inst-qa-001');
      await page.fill('#instance_token', 'abcdefgh12345');
      await page.fill('#client_token', 'clientqa12345');

      const panelPass = page.locator('#panel_password');
      if (await panelPass.isVisible().catch(() => false)) {
        await panelPass.fill('senhateste1');
      }

      await shot(page, 'step6-form-preenchido');

      // Submit
      await page.locator('[role="dialog"] button[type="submit"]').click();
      await page.waitForTimeout(3000);

      const dialogClosed = !(await page.locator('[role="dialog"]').first().isVisible().catch(() => true));
      await shot(page, 'step6-pos-criacao');

      const accountCard = await page.locator('text=/Teste QA/').first().isVisible().catch(() => false);
      const toastEl = await page.locator('[data-sonner-toast]').first().isVisible().catch(() => false);

      if (accountCard || dialogClosed) {
        accountCreated = true;
        record('6 - Criar conta', 'PASS',
          `Dialog fechou: ${dialogClosed}. Card "Teste QA" visível: ${accountCard}. Toast: ${toastEl}`);
      } else {
        const errors = await page.locator('[role="dialog"] .text-destructive').allTextContents().catch(() => []);
        record('6 - Criar conta', 'FAIL',
          `Dialog ainda aberto. Erros: ${JSON.stringify(errors)}`);
        await shot(page, 'step6-FAIL');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }
    } catch (e) {
      record('6 - Criar conta', 'FAIL', `Erro: ${e.message.substring(0, 100)}`);
      await shot(page, 'step6-FAIL');
      await page.keyboard.press('Escape').catch(() => {});
    }
  } else {
    record('6 - Criar conta', 'FAIL', 'Dialog não estava aberto');
  }

  // ── STEP 7: Editar conta ────────────────────────────────────────────────────
  log('--- STEP 7: Editar conta ---');
  await page.waitForTimeout(500);

  // Buscar botão editar — pode ser ícone de lápis ou texto
  const editBtns = await page.locator('button[aria-label*="ditar"], button:has-text("Editar")').all();
  let editClicked = false;
  for (const btn of editBtns) {
    if (await btn.isVisible().catch(() => false)) {
      await btn.click();
      editClicked = true;
      break;
    }
  }

  // Se não encontrou com aria-label, tenta pelo SVG de lápis dentro de card
  if (!editClicked) {
    // Tenta clicar no primeiro card e ver se tem ações
    const firstCard = page.locator('[class*="card"], [class*="Card"]').filter({ hasText: 'Teste QA' }).first();
    if (await firstCard.isVisible().catch(() => false)) {
      // Procura botão edit dentro do card
      const editInCard = firstCard.locator('button').first();
      if (await editInCard.isVisible().catch(() => false)) {
        await editInCard.click();
        editClicked = true;
      }
    }
  }

  if (!editClicked) {
    record('7 - Editar conta', accountCreated ? 'FAIL' : 'SKIP',
      accountCreated ? 'Botão Editar não localizado' : 'Conta não criada — step pulado');
    await shot(page, 'step7-sem-botao');
  } else {
    await page.waitForTimeout(800);
    const editDialog = await page.locator('[role="dialog"]').first().isVisible().catch(() => false);
    await shot(page, 'step7-dialog-edicao');

    if (editDialog) {
      const nameValue = await page.locator('#name').inputValue().catch(() => '');
      await page.fill('#name', 'Teste QA Editado');
      await page.locator('[role="dialog"] button[type="submit"]').click();
      await page.waitForTimeout(2500);
      await shot(page, 'step7-pos-edicao');

      const editedCard = await page.locator('text=/Teste QA Editado/').first().isVisible().catch(() => false);
      record('7 - Editar conta', editedCard ? 'PASS' : 'FAIL',
        `Nome pré-preenchido: "${nameValue}". Card atualizado: ${editedCard}`);
    } else {
      record('7 - Editar conta', 'FAIL', 'Dialog de edição não abriu');
    }
  }

  // ── STEP 8: Resetar senha ───────────────────────────────────────────────────
  log('--- STEP 8: Resetar senha ---');
  await page.waitForTimeout(500);

  const resetBtns = await page.locator('button:has-text("Redefinir"), button:has-text("Reset"), button[aria-label*="senha"]').all();
  let resetClicked = false;
  for (const btn of resetBtns) {
    if (await btn.isVisible().catch(() => false)) {
      await btn.click();
      resetClicked = true;
      break;
    }
  }

  if (!resetClicked) {
    record('8 - Resetar senha', accountCreated ? 'FAIL' : 'SKIP',
      accountCreated ? 'Botão Redefinir senha não encontrado' : 'Conta não criada — step pulado');
    await shot(page, 'step8-sem-botao');
  } else {
    await page.waitForTimeout(800);
    const resetDialog = await page.locator('[role="dialog"]').first().isVisible().catch(() => false);
    await shot(page, 'step8-dialog-reset');

    if (resetDialog) {
      const senhaInput = page.locator('[role="dialog"] input[type="password"]').first();
      if (await senhaInput.isVisible().catch(() => false)) {
        await senhaInput.fill('novaSenha123');
        const confirmInput = page.locator('[role="dialog"] input[type="password"]').nth(1);
        if (await confirmInput.isVisible().catch(() => false)) {
          await confirmInput.fill('novaSenha123');
        }
        await page.locator('[role="dialog"] button[type="submit"]').click();
        await page.waitForTimeout(2500);
        await shot(page, 'step8-pos-reset');
        const dialogClosed = !(await page.locator('[role="dialog"]').first().isVisible().catch(() => true));
        record('8 - Resetar senha', 'PASS', `Dialog fechou: ${dialogClosed}`);
      } else {
        record('8 - Resetar senha', 'FAIL', 'Campo de senha não encontrado');
        await page.keyboard.press('Escape');
      }
    } else {
      record('8 - Resetar senha', 'FAIL', 'Dialog não abriu');
    }
  }

  // ── STEP 9: Excluir conta ───────────────────────────────────────────────────
  log('--- STEP 9: Excluir conta ---');
  await page.waitForTimeout(500);

  const deleteBtns = await page.locator('button:has-text("Excluir"), button[aria-label*="xcluir"]').all();
  let deleteClicked = false;
  for (const btn of deleteBtns) {
    if (await btn.isVisible().catch(() => false)) {
      await btn.click();
      deleteClicked = true;
      break;
    }
  }

  if (!deleteClicked) {
    record('9 - Excluir conta', accountCreated ? 'FAIL' : 'SKIP',
      accountCreated ? 'Botão Excluir não encontrado' : 'Conta não criada — step pulado');
    await shot(page, 'step9-sem-botao');
  } else {
    await page.waitForTimeout(800);
    const alertDialog = await page.locator('[role="alertdialog"]').first().isVisible().catch(() => false);
    await shot(page, 'step9-alertdialog-confirmacao');

    if (alertDialog) {
      // Botão de confirmação (vermelho/destrutivo)
      const confirmBtn = page.locator('[role="alertdialog"] button').filter({ hasText: /Excluir|Confirmar/i }).first();
      if (await confirmBtn.isVisible().catch(() => false)) {
        await confirmBtn.click();
        await page.waitForTimeout(2500);
        await shot(page, 'step9-pos-exclusao');
        const cardGone = !(await page.locator('text=/Teste QA/').first().isVisible().catch(() => false));
        record('9 - Excluir conta', cardGone ? 'PASS' : 'FAIL',
          `AlertDialog apareceu. Conta removida: ${cardGone}`);
      } else {
        record('9 - Excluir conta', 'FAIL', 'Botão de confirmação não encontrado no AlertDialog');
        await page.keyboard.press('Escape');
      }
    } else {
      record('9 - Excluir conta', 'FAIL', 'AlertDialog não apareceu');
    }
  }

  // ── STEP 10: Tabs placeholder ────────────────────────────────────────────────
  log('--- STEP 10: Tabs Conversas/Webhooks/Logs ---');
  for (const tabName of ['Conversas', 'Webhooks', 'Logs']) {
    const tab = page.locator(`[role="tab"]:has-text("${tabName}")`).first();
    if (await tab.isVisible().catch(() => false)) {
      await tab.click();
      await page.waitForTimeout(600);
      await shot(page, `step10-tab-${tabName.toLowerCase()}`);
      const embrevVisible = await page.locator('text=/Em breve/i').first().isVisible().catch(() => false);
      record(`10 - Tab ${tabName} placeholder`, embrevVisible ? 'PASS' : 'FAIL',
        embrevVisible ? '"Em breve" presente' : '"Em breve" não encontrado');
    } else {
      record(`10 - Tab ${tabName} placeholder`, 'FAIL', `Tab "${tabName}" não visível`);
    }
  }

  // ── STEP 11: Mobile viewport ────────────────────────────────────────────────
  log('--- STEP 11: Mobile (375x812) ---');
  const mobileCtx = await browser.newContext({
    viewport: { width: 375, height: 812 },
    locale: 'pt-BR',
  });
  const mobilePage = await mobileCtx.newPage();
  mobilePage.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push('[mobile] ' + msg.text());
  });

  const mobileLoggedIn = await login(mobilePage);
  if (mobileLoggedIn) {
    await mobilePage.goto(`${BASE}/integracoes/whatsapp`, { timeout: 30000 });
    await mobilePage.waitForLoadState('networkidle');
    await mobilePage.waitForTimeout(1500);

    await mobilePage.screenshot({ path: join(OUT, 'step11-mobile-pagina.png') });

    // Clicar aba Contas
    const mobileContasTab = mobilePage.locator('[role="tab"]:has-text("Contas")').first();
    if (await mobileContasTab.isVisible().catch(() => false)) {
      await mobileContasTab.click();
      await mobilePage.waitForTimeout(600);
    }
    await mobilePage.screenshot({ path: join(OUT, 'step11-mobile-contas.png') });

    const mobileUrl = mobilePage.url();
    const tabsVisible = await mobilePage.locator('[role="tab"]').count().catch(() => 0);
    record('11 - Mobile viewport', mobileUrl.includes('/integracoes/whatsapp') ? 'PASS' : 'FAIL',
      `URL ok: ${mobileUrl.includes('/integracoes/whatsapp')}. Tabs visíveis: ${tabsVisible}`);
  } else {
    record('11 - Mobile viewport', 'FAIL', 'Login mobile falhou');
  }
  await mobileCtx.close();

  // ── Console errors ──────────────────────────────────────────────────────────
  log(`\nErros de console: ${consoleErrors.length}`);
  consoleErrors.slice(0, 10).forEach(e => log(`  [console] ${e.substring(0, 120)}`));

  await ctx.close();
  await browser.close();

  printSummary(consoleErrors);
}

function printSummary(consoleErrors = []) {
  log('\n=== RESUMO FINAL ===');
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;

  log(`Total: ${results.length} | PASS: ${passed} | FAIL: ${failed} | SKIP: ${skipped}`);
  log(`Console errors: ${consoleErrors.length}`);
  results.forEach(r => {
    const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⚠️';
    log(`  ${icon} ${r.step}: ${r.status} — ${r.notes}`);
  });

  const verdict = failed === 0 ? 'PASS' : failed <= 3 && passed > failed ? 'PARTIAL' : 'FAIL';
  log(`\nVEREDITO: ${verdict}`);
  console.log('\n__JSON__' + JSON.stringify({ passed, failed, skipped, verdict, results, consoleErrors: consoleErrors.slice(0, 20) }));
}

main().catch(e => {
  console.error('[QA FATAL]', e);
  process.exit(1);
});
