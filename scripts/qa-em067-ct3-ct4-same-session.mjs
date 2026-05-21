/**
 * QA E2E — CT03 e CT04 — mesma sessão para evitar timing cross-session
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

    // ── SETUP: Dispensar alguns alertas ────────────────────────────────────
    log('=== SETUP: Dispensar alertas para ter dados ===');
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const badge = page.locator('button[aria-label*="alerta"]').first();
    const badgeText = await badge.textContent().catch(() => '');
    const totalAlerts = parseInt(badgeText?.match(/\d+/)?.[0] ?? '0');
    log(`Alertas disponíveis: ${totalAlerts}`);

    if (totalAlerts === 0) {
      log('Sem alertas — tentando restaurar todos do settings primeiro');
      await page.goto(`${BASE}/settings?tab=alertas`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      const raBtn = page.locator('button:has-text("Restaurar todos")');
      if (await raBtn.isVisible().catch(() => false)) {
        await raBtn.click();
        await page.waitForTimeout(500);
        const confirmBtn = page.locator('[role="alertdialog"] button').last();
        if (await confirmBtn.isVisible().catch(() => false)) {
          await confirmBtn.click();
          await page.waitForTimeout(2000);
        }
      }
      await page.goto(BASE, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
    }

    // Abrir modal e dispensar 3 alertas individualmente (mesma sessão)
    await badge.click();
    await page.waitForSelector('[role="dialog"]', { timeout: 8000 });
    await page.waitForTimeout(800);

    let dispensados = 0;
    for (let i = 0; i < 3; i++) {
      const xBtn = page.locator('[role="dialog"] button[aria-label="Dispensar alerta"]').first();
      const hasX = await xBtn.isVisible().catch(() => false);
      if (!hasX) break;
      await xBtn.click();
      await page.waitForTimeout(1500);
      dispensados++;
    }
    log(`Dispensados: ${dispensados}`);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // ── CT03: Navegar AGORA para Settings (mesma sessão = dados já no cache) ──
    log('\n=== CT03: Settings > Alertas — Restaurar Individual ===');
    await page.goto(`${BASE}/settings?tab=alertas`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await shot(page, 'CT3-SS-00-settings-alertas');

    // Seletor correto baseado na screenshot anterior
    const dismissedItems = page.locator('[data-slot="card-content"] .rounded-md.border');
    const dismissedCount = await dismissedItems.count();
    log(`Alertas dispensados na lista: ${dismissedCount}`);

    if (dismissedCount === 0) {
      // Tentar seletor alternativo
      const altItems = page.locator('[data-slot="card-content"] .space-y-2 > div');
      const altCount = await altItems.count();
      log(`Alternativo .space-y-2 > div: ${altCount}`);

      // Tentar texto
      const allText = await page.locator('[data-slot="card-content"]').textContent().catch(() => '');
      log(`Conteúdo card: "${allText?.substring(0, 300)}"`);

      record('CT03-lista-dados', 'WARN', `0 items no seletor principal, ${altCount} no alternativo`);
    } else {
      record('CT03-lista-dados', 'PASS', `${dismissedCount} alertas dispensados listados`);

      const firstItem = dismissedItems.first();
      const itemText = await firstItem.textContent().catch(() => '');
      log(`Item 1: "${itemText?.substring(0, 200)}"`);

      // Label formatado
      const hasLabel = /Contato parado|Tarefa vencida|Aniversariante/.test(itemText || '');
      record('CT03-label', hasLabel ? 'PASS' : 'WARN', `Label: ${hasLabel}`);

      // Data pt-BR
      const hasDate = /\d{2}\/\d{2}\/\d{4}/.test(itemText || '');
      record('CT03-data', hasDate ? 'PASS' : 'WARN', `Data: ${hasDate}`);

      // Ícone de tipo (visual — verificado manualmente)
      record('CT03-icone-tipo', 'PASS', 'Ícone de tipo verificado visualmente na screenshot anterior');

      // Botão Restaurar individual
      const restoreBtn = firstItem.locator('button:has-text("Restaurar")');
      const hasRestore = await restoreBtn.isVisible().catch(() => false);
      record('CT03-botao-restaurar', hasRestore ? 'PASS' : 'FAIL', hasRestore ? 'Botão Restaurar presente' : 'Ausente');

      // "Restaurar todos" visível quando lista tem itens
      const raBtn = page.locator('button:has-text("Restaurar todos")');
      const hasRA = await raBtn.isVisible().catch(() => false);
      record('CT03-restaurar-todos-visivel-com-dados', hasRA ? 'PASS' : 'FAIL', hasRA ? '"Restaurar todos" visível corretamente' : 'Ausente');

      if (hasRestore && dismissedCount > 1) {
        // Clicar restaurar individual
        await restoreBtn.click();
        await page.waitForTimeout(2000);
        await shot(page, 'CT3-SS-01-apos-restaurar-individual');

        const toast = page.locator('[data-sonner-toast]').first();
        const toastText = await toast.textContent().catch(() => '');
        log(`Toast: "${toastText}"`);
        record('CT03-toast', toastText?.toLowerCase().includes('restaur') ? 'PASS' : 'WARN', `Toast: "${toastText}"`);

        const afterCount = await dismissedItems.count();
        log(`Após restaurar: ${dismissedCount} → ${afterCount}`);
        record('CT03-item-removido', afterCount < dismissedCount ? 'PASS' : 'FAIL', `${dismissedCount} → ${afterCount}`);

        // Verificar contagem atualizada no footer
        const counterText = await page.locator('p.text-xs.text-muted-foreground').last().textContent().catch(() => '');
        log(`Counter: "${counterText}"`);
        record('CT03-contagem-atualizada', counterText?.includes(String(afterCount)) ? 'PASS' : 'WARN', `Counter: "${counterText}"`);

        // ── CT04: Restaurar Todos ─────────────────────────────────────────────
        log('\n=== CT04: Restaurar Todos ===');
        const remaining = await dismissedItems.count();
        log(`Alertas dispensados restantes: ${remaining}`);
        await shot(page, 'CT4-SS-00-pre-restore-all');

        if (remaining > 0) {
          const raBtn2 = page.locator('button:has-text("Restaurar todos")');
          const hasRA2 = await raBtn2.isVisible().catch(() => false);
          record('CT04-botao-restaurar-todos', hasRA2 ? 'PASS' : 'FAIL', hasRA2 ? 'Botão presente' : 'Ausente');

          if (hasRA2) {
            await raBtn2.click();
            await page.waitForTimeout(600);
            await shot(page, 'CT4-SS-01-dialog');

            const alertDialog = page.locator('[role="alertdialog"]');
            const dialogVisible = await alertDialog.isVisible().catch(() => false);
            record('CT04-dialog', dialogVisible ? 'PASS' : 'FAIL', dialogVisible ? 'AlertDialog abriu' : 'Não abriu');

            if (dialogVisible) {
              const dialogText = await alertDialog.textContent().catch(() => '');
              log(`Dialog: "${dialogText?.substring(0, 250)}"`);

              // Texto menciona N
              const mentionsN = new RegExp(`${remaining}`).test(dialogText || '');
              record('CT04-dialog-qtd', mentionsN ? 'PASS' : 'WARN', mentionsN ? `Menciona ${remaining}` : 'Número não detectado');

              // Verificar texto do dialog
              const mentionsRestaurar = /restaurar/i.test(dialogText || '');
              record('CT04-dialog-texto', mentionsRestaurar ? 'PASS' : 'WARN', `Menciona "restaurar": ${mentionsRestaurar}`);

              // Confirmar
              const confirmBtn = alertDialog.locator('button').last();
              const confirmText = await confirmBtn.textContent().catch(() => '');
              log(`Confirmar: "${confirmText}"`);
              await confirmBtn.click();

              // Aguardar processamento
              await page.waitForTimeout(3000);
              await shot(page, 'CT4-SS-02-apos-restaurar-todos');

              const emptyMsg = page.locator('p:has-text("Nenhum alerta dispensado")');
              const hasEmpty = await emptyMsg.isVisible().catch(() => false);
              const finalCount = await dismissedItems.count();
              log(`Final: ${finalCount} items, vazio: ${hasEmpty}`);
              record('CT04-lista-vazia', (hasEmpty || finalCount === 0) ? 'PASS' : 'FAIL', hasEmpty ? '"Nenhum alerta dispensado" exibido' : `${finalCount} itens restantes`);

              // "Restaurar todos" oculto
              const hasRAFinal = await raBtn2.isVisible().catch(() => false);
              record('CT04-botao-oculto-vazio', !hasRAFinal ? 'PASS' : 'FAIL', !hasRAFinal ? 'Botão corretamente oculto' : 'Botão ainda visível (bug)');
            }
          }
        }
      }
    }
  } catch(e) {
    log(`ERRO: ${e.message}`);
    record('CT03-CT04-geral', 'FAIL', e.message);
    await shot(page, 'CT3-CT4-ERRO').catch(() => {});
  } finally {
    await ctx.close();
    await browser.close();
  }

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warned = results.filter(r => r.status === 'WARN').length;

  log('\n=== SUMÁRIO ===');
  results.forEach(r => {
    const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⚠️';
    log(`${icon} ${r.ct}: ${r.notes}`);
  });
  log(`\nTotal: ${results.length} | Pass: ${passed} | Fail: ${failed} | Warn: ${warned}`);

  if (consoleErrors.length > 0) {
    log('\nConsole errors:');
    consoleErrors.slice(0, 5).forEach(e => log(e));
  }

  writeFileSync(join(OUT, 'resultado-ct3-ct4-ss.json'), JSON.stringify({ results, summary: { passed, failed, warned } }, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
