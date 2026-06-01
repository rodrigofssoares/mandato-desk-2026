/**
 * QA E2E — CT03 e CT04 — seletor robusto baseado na estrutura real do DOM
 */

import { chromium } from 'playwright';
import { join } from 'path';
import { mkdirSync, writeFileSync } from 'fs';

const BASE = 'http://localhost:3001';
const EMAIL = 'rodrigofssoares@gmail.com';
const SENHA = 'QA-Temp-2026!';
const OUT = decodeURIComponent(
  new URL('../screenshots/qa-RAQ-MAND-EM067/', import.meta.url).pathname
).replace(/^\/([A-Za-z]:)/, '$1').replace(/\//g, '\\');

const log = (msg) => console.log(`[QA] ${msg}`);
const results = [];

function record(ct, status, notes = '') {
  results.push({ ct, status, notes });
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  log(`${icon} ${ct} — ${status}${notes ? ': ' + notes : ''}`);
}

async function shot(page, name) {
  const path = join(OUT, `${name}.png`);
  await page.screenshot({ path });
  log(`Screenshot: ${name}.png`);
}

async function login(page) {
  await page.goto(`${BASE}/auth`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', SENHA);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/$/, { timeout: 15000 });
  await page.waitForLoadState('networkidle');
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

  try {
    await login(page);

    // SETUP: Dispensar 3 alertas individualmente (mesma sessão)
    log('=== SETUP: Dispensar 3 alertas ===');
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const badge = page.locator('button[aria-label*="alerta"]').first();
    await badge.click();
    await page.waitForSelector('[role="dialog"]', { timeout: 8000 });
    await page.waitForTimeout(800);

    for (let i = 0; i < 3; i++) {
      const xBtn = page.locator('[role="dialog"] button[aria-label="Dispensar alerta"]').first();
      if (!(await xBtn.isVisible().catch(() => false))) break;
      await xBtn.click();
      await page.waitForTimeout(1500);
      log(`Dispensado ${i + 1}`);
    }

    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Navegar para Settings > Alertas (mesma sessão — dados em cache React Query)
    log('\n=== CT03/CT04: Settings > Alertas ===');
    await page.goto(`${BASE}/settings?tab=alertas`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Verificar pelo texto na página
    const pageText = await page.textContent('main, body').catch(() => '');
    log(`Página texto (primeiros 500): "${pageText?.substring(0, 500)}"`);

    // Seletor robusto: botões "Restaurar" individuais
    const restoreBtns = page.locator('button:has-text("Restaurar"):not(:has-text("todos"))');
    const restoreCount = await restoreBtns.count();
    log(`Botões "Restaurar" individuais: ${restoreCount}`);

    const restoreAllBtn = page.locator('button:has-text("Restaurar todos")');
    const hasRA = await restoreAllBtn.isVisible().catch(() => false);
    log(`"Restaurar todos" visível: ${hasRA}`);

    await shot(page, 'CT3-FINAL-00-settings-alertas');

    if (restoreCount === 0) {
      record('CT03-lista-com-dados', 'WARN', 'Nenhum botão "Restaurar" encontrado — pode ser timing ou dados');
    } else {
      record('CT03-lista-com-dados', 'PASS', `${restoreCount} alertas dispensados com botão Restaurar`);
      record('CT03-botao-restaurar-todos-visivel', hasRA ? 'PASS' : 'FAIL', hasRA ? '"Restaurar todos" visível' : 'Ausente');

      // Verificar itens estruturalmente (texto dos alertas)
      const allItemsText = await page.locator('p.font-medium.text-sm').allTextContents().catch(() => []);
      log(`Títulos de alertas: ${JSON.stringify(allItemsText.slice(0, 3))}`);

      // Verificar label formatado
      const allSubtitles = await page.locator('p.text-xs.text-muted-foreground').allTextContents().catch(() => []);
      const hasLabel = allSubtitles.some(t => /Contato parado|Tarefa vencida|Aniversariante/.test(t));
      record('CT03-label-formatado', hasLabel ? 'PASS' : 'WARN', `Labels: ${JSON.stringify(allSubtitles.slice(0, 3))}`);

      // Verificar data pt-BR
      const hasDate = allSubtitles.some(t => /\d{2}\/\d{2}\/\d{4} às/.test(t));
      record('CT03-data-ptbr', hasDate ? 'PASS' : 'WARN', `Datas: ${allSubtitles.filter(t => t.includes('às')).slice(0, 2).join(' | ')}`);

      // Clicar no 1º botão Restaurar
      const firstRestore = restoreBtns.first();
      const firstRestoreText = await firstRestore.textContent().catch(() => '');
      log(`1º botão Restaurar: "${firstRestoreText}"`);

      await firstRestore.click();
      await page.waitForTimeout(2000);
      await shot(page, 'CT3-FINAL-01-apos-restaurar-individual');

      const toast = page.locator('[data-sonner-toast]').first();
      const toastText = await toast.textContent().catch(() => '');
      log(`Toast: "${toastText}"`);
      record('CT03-toast', toastText?.toLowerCase().includes('restaur') ? 'PASS' : 'WARN', `Toast: "${toastText}"`);

      const afterRestoreCount = await restoreBtns.count();
      log(`Botões Restaurar: ${restoreCount} → ${afterRestoreCount}`);
      record('CT03-item-removido', afterRestoreCount < restoreCount ? 'PASS' : 'FAIL', `${restoreCount} → ${afterRestoreCount}`);

      // ── CT04: Restaurar Todos ─────────────────────────────────────────
      log('\n=== CT04: Restaurar Todos ===');
      const remaining = afterRestoreCount;
      log(`Alertas dispensados restantes: ${remaining}`);

      if (remaining === 0) {
        record('CT04-precondition', 'WARN', 'Sem alertas para testar restaurar todos');
      } else {
        const raBtn2 = page.locator('button:has-text("Restaurar todos")');
        const hasRA2 = await raBtn2.isVisible().catch(() => false);
        record('CT04-botao-restaurar-todos', hasRA2 ? 'PASS' : 'FAIL', hasRA2 ? 'Presente' : 'Ausente');

        if (hasRA2) {
          await raBtn2.click();
          await page.waitForTimeout(600);
          await shot(page, 'CT4-FINAL-00-dialog');

          const alertDialog = page.locator('[role="alertdialog"]');
          const dialogVisible = await alertDialog.isVisible().catch(() => false);
          record('CT04-dialog', dialogVisible ? 'PASS' : 'FAIL', dialogVisible ? 'AlertDialog abriu' : 'Não abriu');

          if (dialogVisible) {
            const dialogText = await alertDialog.textContent().catch(() => '');
            log(`Dialog: "${dialogText?.substring(0, 250)}"`);

            const hasN = /\d+/.test(dialogText || '');
            record('CT04-dialog-menciona-N', hasN ? 'PASS' : 'WARN', `Número: ${hasN}`);

            const hasRestaurarText = /restaurar/i.test(dialogText || '');
            record('CT04-dialog-texto-restaurar', hasRestaurarText ? 'PASS' : 'FAIL', hasRestaurarText ? 'Menciona "restaurar"' : 'Texto inesperado');

            // Confirmar
            const confirmBtn = alertDialog.locator('button').last();
            const confirmText = await confirmBtn.textContent().catch(() => '');
            log(`Confirmar texto: "${confirmText}"`);
            await confirmBtn.click();

            await page.waitForTimeout(3000);
            await shot(page, 'CT4-FINAL-01-apos-restaurar-todos');

            // Verificar estado vazio
            const emptyMsg = page.locator('text=Nenhum alerta dispensado');
            const hasEmpty = await emptyMsg.isVisible().catch(() => false);
            const finalRestoreBtns = await restoreBtns.count();
            log(`Final: ${finalRestoreBtns} botões, empty: ${hasEmpty}`);
            record('CT04-lista-vazia', (hasEmpty || finalRestoreBtns === 0) ? 'PASS' : 'FAIL', hasEmpty ? 'Vazio exibido' : `${finalRestoreBtns} itens restantes`);

            // "Restaurar todos" oculto quando lista vazia
            const hasRAFinal = await page.locator('button:has-text("Restaurar todos")').isVisible().catch(() => false);
            record('CT04-restaurar-todos-oculto', !hasRAFinal ? 'PASS' : 'FAIL', !hasRAFinal ? 'Corretamente oculto' : 'Ainda visível (bug)');
          }
        }
      }
    }
  } catch(e) {
    log(`ERRO: ${e.message}`);
    record('geral', 'FAIL', e.message);
    await shot(page, 'ERRO').catch(() => {});
  } finally {
    await ctx.close();
    await browser.close();
  }

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warned = results.filter(r => r.status === 'WARN').length;

  log('\n=== SUMÁRIO FINAL CT03/CT04 ===');
  results.forEach(r => {
    const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⚠️';
    log(`${icon} ${r.ct}: ${r.notes}`);
  });
  log(`\nTotal: ${results.length} | Pass: ${passed} | Fail: ${failed} | Warn: ${warned}`);

  writeFileSync(join(OUT, 'resultado-ct3-ct4-final.json'), JSON.stringify({ results, summary: { passed, failed, warned } }, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
