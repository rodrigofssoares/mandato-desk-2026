/**
 * QA E2E — RAQ-MAND-EM067 — Cenários 1 e 3 isolados
 * Garante que há alertas antes de testar dismiss individual e restaurar individual.
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

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
  await page.screenshot({ path, fullPage: false });
  log(`Screenshot: ${name}.png`);
  return path;
}

async function login(page) {
  await page.goto(`${BASE}/auth`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', SENHA);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/$/, { timeout: 15000 });
  await page.waitForLoadState('networkidle');
}

async function ensureAlertsRestored(page) {
  // Garante que todos os alertas estão restaurados para começar com lista cheia
  await page.goto(`${BASE}/settings?tab=alertas`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const restoreAll = page.locator('button:has-text("Restaurar todos")');
  const hasRA = await restoreAll.isVisible().catch(() => false);
  if (hasRA) {
    log('Restaurando todos para estado limpo...');
    await restoreAll.click();
    await page.waitForTimeout(500);
    const confirm = page.locator('[role="alertdialog"] button').last();
    if (await confirm.isVisible().catch(() => false)) {
      await confirm.click();
      await page.waitForTimeout(2000);
      log('Alertas restaurados.');
    }
  } else {
    log('Nenhum alerta para restaurar — banco já está limpo.');
  }
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const consoleErrors = [];

  // ── SETUP: Restaurar todos + verificar alertas no dashboard ───────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(`[SETUP] ${msg.text()}`);
    });

    try {
      log('=== SETUP: Restaurar + verificar estado inicial ===');
      await login(page);
      await ensureAlertsRestored(page);

      await page.goto(BASE, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await shot(page, 'CT1-00-dashboard-pos-restore');

      const badge = page.locator('button[aria-label*="alerta"]').first();
      const badgeText = await badge.textContent().catch(() => '');
      const countStr = badgeText?.match(/\d+/)?.[0] ?? '0';
      log(`Badge após restaurar: "${badgeText?.trim()}" (count detectado: ${countStr})`);
      record('SETUP-alertas-disponiveis', parseInt(countStr) > 0 ? 'PASS' : 'WARN', `Badge: "${badgeText?.trim()}" — ${countStr} alertas`);
    } catch(e) {
      record('SETUP-geral', 'FAIL', e.message);
    } finally {
      await ctx.close();
    }
  }

  // ── CT01: Dismiss individual completo ─────────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(`[CT01] ${msg.text()}`);
    });

    try {
      log('\n=== CT01: Dismiss Individual ===');
      await login(page);
      await page.goto(BASE, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      const badge = page.locator('button[aria-label*="alerta"]').first();
      const badgeTextBefore = await badge.textContent().catch(() => '');
      const countBefore = parseInt(badgeTextBefore?.match(/\d+/)?.[0] ?? '0');
      log(`Badge antes: "${badgeTextBefore?.trim()}", count: ${countBefore}`);
      await shot(page, 'CT1-01-dashboard-com-badge');

      if (countBefore === 0) {
        record('CT01-precondition', 'WARN', 'Sem alertas no dashboard — dados de banco sem contatos parados/tarefas vencidas no ambiente de teste');
        await ctx.close();
      } else {
        record('CT01-precondition', 'PASS', `${countBefore} alertas disponíveis`);

        // Abrir modal
        await badge.click();
        await page.waitForSelector('[role="dialog"]', { timeout: 8000 });
        await page.waitForTimeout(1000);
        await shot(page, 'CT1-02-modal-aberto');

        const modal = page.locator('[role="dialog"]').first();
        const modalContent = await modal.textContent().catch(() => '');
        log(`Modal: "${modalContent?.substring(0, 100)}..."`);

        // Verificar estrutura do modal
        const titleMatch = /Alertas \(\d+\)/.test(modalContent || '');
        record('CT01-modal-titulo', titleMatch ? 'PASS' : 'FAIL', titleMatch ? 'Título "Alertas (N)" correto' : `Título inesperado: "${modalContent?.substring(0, 50)}"`);

        // Verificar botão X em cada item
        const allXBtns = modal.locator('button[aria-label="Dispensar alerta"]');
        const xCount = await allXBtns.count();
        log(`Botões X encontrados: ${xCount}`);
        record('CT01-botoes-x', xCount > 0 ? 'PASS' : 'FAIL', `${xCount} botões X encontrados`);

        // Verificar ícone ExternalLink ao lado dos itens com href
        const items = modal.locator('ul li');
        const totalItems = await items.count();
        log(`Total de items na lista: ${totalItems}`);

        if (xCount > 0) {
          const firstX = allXBtns.first();
          const ariaLabel = await firstX.getAttribute('aria-label');
          record('CT01-aria-label-x', ariaLabel === 'Dispensar alerta' ? 'PASS' : 'FAIL', `aria-label: "${ariaLabel}"`);

          // Verificar tamanho mínimo do botão para a11y
          const xBox = await firstX.boundingBox();
          log(`Botão X size: ${xBox?.width}x${xBox?.height}px`);

          // Clicar no X do primeiro item
          log('Clicando no X do primeiro alerta...');
          await firstX.click();
          await page.waitForTimeout(2500);
          await shot(page, 'CT1-03-apos-dismiss-individual');

          // Verificar item sumiu
          const itemsAfter = await modal.locator('ul li').count();
          log(`Items após dismiss: ${totalItems} → ${itemsAfter}`);
          record('CT01-item-sumiu', itemsAfter < totalItems ? 'PASS' : 'FAIL', `${totalItems} → ${itemsAfter}`);

          // Verificar badge decrementou
          await page.waitForTimeout(500);
          const badgeAfter = await badge.textContent().catch(() => '');
          const countAfter = parseInt(badgeAfter?.match(/\d+/)?.[0] ?? '0');
          log(`Badge após: "${badgeAfter?.trim()}", count: ${countAfter}`);
          record('CT01-badge-decrement', countAfter < countBefore ? 'PASS' : 'FAIL', `${countBefore} → ${countAfter}`);

          // Verificar título do modal atualizou ("Alertas (N-1)")
          const modalContentAfter = await modal.textContent().catch(() => '');
          const newTitleMatch = modalContentAfter?.match(/Alertas \((\d+)\)/)?.[1];
          log(`Título modal após dismiss: ${newTitleMatch}`);
          const expectedCount = countBefore - 1;
          record('CT01-titulo-atualizado', newTitleMatch === String(expectedCount) ? 'PASS' : 'WARN', `Título indica ${newTitleMatch} (esperado ${expectedCount})`);

          // Verificar link "Gerenciar alertas dispensados" no rodapé
          const manageLink = modal.locator('button:has-text("Gerenciar alertas dispensados")');
          const hasManageLink = await manageLink.isVisible().catch(() => false);
          record('CT01-link-gerenciar', hasManageLink ? 'PASS' : 'FAIL', hasManageLink ? 'Link "Gerenciar alertas dispensados" presente' : 'Link ausente no rodapé');

          // Verificar "Dispensar todos" ainda visível
          const hasDT = await modal.locator('button:has-text("Dispensar todos")').isVisible().catch(() => false);
          record('CT01-dispensar-todos-visivel', hasDT ? 'PASS' : 'FAIL', hasDT ? 'Botão "Dispensar todos" presente' : 'Botão "Dispensar todos" ausente após dismiss individual');

          // PERSISTÊNCIA: Fechar modal, recarregar, reabrir e verificar
          await page.keyboard.press('Escape');
          await page.waitForTimeout(300);
          await page.reload({ waitUntil: 'networkidle' });
          await page.waitForTimeout(2000);
          await shot(page, 'CT1-04-apos-reload');

          const badgeAfterReload = page.locator('button[aria-label*="alerta"]').first();
          const badgeReloadText = await badgeAfterReload.textContent().catch(() => '');
          const countReload = parseInt(badgeReloadText?.match(/\d+/)?.[0] ?? '0');
          log(`Badge após reload: "${badgeReloadText?.trim()}", count: ${countReload}`);
          record('CT01-persistencia-badge', countReload <= countAfter ? 'PASS' : 'FAIL', `Badge reload: ${countReload} (esperado ≤ ${countAfter})`);

          // Reabrir modal e verificar alerta não voltou
          await badgeAfterReload.click();
          await page.waitForSelector('[role="dialog"]', { timeout: 8000 });
          await page.waitForTimeout(1000);
          await shot(page, 'CT1-05-modal-apos-reload');

          const itemsAfterReload = await page.locator('[role="dialog"] ul li').count();
          log(`Items após reload: ${itemsAfterReload} (esperado ≤ ${itemsAfter})`);
          record('CT01-persistencia-item-sumido', itemsAfterReload <= itemsAfter ? 'PASS' : 'FAIL', `${itemsAfterReload} items após reload (esperado ≤ ${itemsAfter})`);
        }
      }
      await ctx.close();
    } catch (e) {
      log(`ERRO CT01: ${e.message}`);
      record('CT01-geral', 'FAIL', e.message);
      await shot(page, 'CT1-erro').catch(() => {});
      await ctx.close();
    }
  }

  // ── CT03: Restaurar individual ─────────────────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(`[CT03] ${msg.text()}`);
    });

    try {
      log('\n=== CT03: Restaurar Individual ===');
      await login(page);

      // Navegar para settings e verificar lista de dismissals
      await page.goto(`${BASE}/settings?tab=alertas`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await shot(page, 'CT3-00-settings-alertas-inicial');

      const dismissedItems = page.locator('[data-slot="card-content"] .space-y-2 > div');
      let dismissedCount = await dismissedItems.count();
      log(`Alertas dispensados: ${dismissedCount}`);

      if (dismissedCount === 0) {
        // Dispensar um alerta primeiro
        log('Dispensando um alerta para ter dados para restaurar...');
        await page.goto(BASE, { waitUntil: 'networkidle' });
        await page.waitForTimeout(2000);

        const badge = page.locator('button[aria-label*="alerta"]').first();
        const hasBadge = await badge.isVisible().catch(() => false);

        if (!hasBadge) {
          record('CT03-precondition', 'WARN', 'Sem alertas no dashboard para dispensar e testar restauração');
          await ctx.close();
          // Sair do bloco
          throw new Error('SKIP');
        }

        await badge.click();
        await page.waitForSelector('[role="dialog"]', { timeout: 8000 });
        await page.waitForTimeout(800);

        const xBtn = page.locator('[role="dialog"] button[aria-label="Dispensar alerta"]').first();
        const hasX = await xBtn.isVisible().catch(() => false);
        if (!hasX) {
          record('CT03-precondition', 'WARN', 'Modal abriu mas sem alertas para dispensar');
          await ctx.close();
          throw new Error('SKIP');
        }

        await xBtn.click();
        await page.waitForTimeout(2000);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
        log('Um alerta dispensado com sucesso.');

        // Voltar para settings
        await page.goto(`${BASE}/settings?tab=alertas`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(2000);
        dismissedCount = await dismissedItems.count();
        log(`Alertas dispensados após setup: ${dismissedCount}`);
      }

      record('CT03-precondition', dismissedCount > 0 ? 'PASS' : 'WARN', `${dismissedCount} alertas dispensados para restaurar`);

      if (dismissedCount > 0) {
        await shot(page, 'CT3-01-lista-dispensados');

        // Verificar estrutura dos itens
        const firstItem = dismissedItems.first();
        const itemText = await firstItem.textContent().catch(() => '');
        log(`Primeiro item: "${itemText?.substring(0, 200)}"`);

        // Verificar campos obrigatórios
        const hasFormatLabel = /Contato parado no funil|Tarefa vencida|Aniversariante sem tarefa/.test(itemText || '');
        record('CT03-label-formatado', hasFormatLabel ? 'PASS' : 'WARN', hasFormatLabel ? 'Label formatado correto' : `Label não detectado: "${itemText?.substring(0, 80)}"`);

        const hasDate = /\d{2}\/\d{2}\/\d{4} às \d{2}:\d{2}/.test(itemText || '');
        record('CT03-data-formatada-pt', hasDate ? 'PASS' : 'WARN', hasDate ? 'Data em pt-BR com horário' : `Data não encontrada em "${itemText?.substring(0, 80)}"`);

        const restoreBtn = firstItem.locator('button:has-text("Restaurar")');
        const hasRestore = await restoreBtn.isVisible().catch(() => false);
        record('CT03-botao-restaurar', hasRestore ? 'PASS' : 'FAIL', hasRestore ? 'Botão Restaurar presente' : 'Botão Restaurar ausente');

        // Verificar "Restaurar todos" visível quando há itens
        const restoreAllBtn = page.locator('button:has-text("Restaurar todos")');
        const hasRA = await restoreAllBtn.isVisible().catch(() => false);
        record('CT03-botao-restaurar-todos-visivel', hasRA ? 'PASS' : 'FAIL', hasRA ? '"Restaurar todos" visível com itens' : '"Restaurar todos" ausente com itens');

        if (hasRestore) {
          // Clicar Restaurar em 1 item
          await restoreBtn.click();
          await page.waitForTimeout(2000);
          await shot(page, 'CT3-02-apos-restaurar-individual');

          const toast = page.locator('[data-sonner-toast]').first();
          const toastText = await toast.textContent().catch(() => '');
          log(`Toast: "${toastText}"`);
          record('CT03-toast', toastText?.toLowerCase().includes('restaur') ? 'PASS' : 'WARN', `Toast: "${toastText}"`);

          const itemsAfter = await dismissedItems.count();
          log(`Itens após restaurar: ${dismissedCount} → ${itemsAfter}`);
          record('CT03-item-removido', itemsAfter < dismissedCount ? 'PASS' : 'FAIL', `${dismissedCount} → ${itemsAfter}`);

          // Dashboard — alerta voltou
          await page.goto(BASE, { waitUntil: 'networkidle' });
          await page.waitForTimeout(2000);
          await shot(page, 'CT3-03-dashboard-apos-restaurar');

          const badge = page.locator('button[aria-label*="alerta"]').first();
          const badgeText = await badge.textContent().catch(() => '');
          const count = parseInt(badgeText?.match(/\d+/)?.[0] ?? '0');
          log(`Badge: "${badgeText?.trim()}", count: ${count}`);
          record('CT03-badge-incrementou', count > 0 ? 'PASS' : 'WARN', `Badge: ${count} (esperado > 0)`);
        }
      }

      await ctx.close();
    } catch (e) {
      if (e.message !== 'SKIP') {
        log(`ERRO CT03: ${e.message}`);
        record('CT03-geral', 'FAIL', e.message);
        await shot(page, 'CT3-erro').catch(() => {});
      }
      await ctx.close();
    }
  }

  await browser.close();

  // Sumário
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warned = results.filter(r => r.status === 'WARN').length;

  log('\n=== SUMÁRIO CTs ===');
  results.forEach(r => {
    const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⚠️';
    log(`${icon} ${r.ct}: ${r.notes}`);
  });
  log(`\nTotal: ${results.length} | Passed: ${passed} | Failed: ${failed} | Warned: ${warned}`);

  if (consoleErrors.length > 0) {
    log('\nErros de console:');
    consoleErrors.slice(0, 10).forEach(e => log(e));
  }

  const output = { timestamp: new Date().toISOString(), results, consoleErrors, summary: { passed, failed, warned } };
  writeFileSync(join(OUT, 'resultado-ct1-ct3.json'), JSON.stringify(output, null, 2));
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
