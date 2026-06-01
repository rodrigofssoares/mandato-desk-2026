/**
 * QA E2E — RAQ-MAND-EM067 — Cenários 3 e 4 isolados
 * Testa restauração de alertas dispensados em Settings > Alertas
 */

import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
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
  const browser = await chromium.launch({ headless: true });
  const consoleErrors = [];

  // ── FASE 1: Dispensar 3 alertas individualmente para criar dados ───────────
  // Fazemos isso numa sessão, depois verificamos em nova sessão (confirma persistência cross-session)
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

    try {
      log('=== FASE 1: Dispensar alertas para criar dados de teste ===');
      await login(page);
      await page.goto(BASE, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      const badge = page.locator('button[aria-label*="alerta"]').first();
      const badgeText = await badge.textContent().catch(() => '');
      const totalCount = parseInt(badgeText?.match(/\d+/)?.[0] ?? '0');
      log(`Total de alertas disponíveis: ${totalCount}`);

      if (totalCount === 0) {
        log('AVISO: Sem alertas disponíveis. Dispensar será impossível.');
        record('FASE1-dados', 'WARN', 'Sem alertas no banco de dados');
        await ctx.close();
      } else {
        // Abrir modal e dispensar 3 alertas (1 de cada vez para confirmar UX)
        await badge.click();
        await page.waitForSelector('[role="dialog"]', { timeout: 8000 });
        await page.waitForTimeout(800);

        const modal = page.locator('[role="dialog"]').first();
        let dispensados = 0;
        const TARGET = Math.min(3, totalCount);

        for (let i = 0; i < TARGET; i++) {
          const xBtn = modal.locator('button[aria-label="Dispensar alerta"]').first();
          const hasX = await xBtn.isVisible().catch(() => false);
          if (!hasX) break;
          await xBtn.click();
          await page.waitForTimeout(1500);
          dispensados++;
          log(`Dispensou alerta ${dispensados}/${TARGET}`);
        }

        log(`Total dispensados: ${dispensados}`);
        record('FASE1-dispensou', dispensados > 0 ? 'PASS' : 'WARN', `${dispensados} alertas dispensados`);

        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
        await ctx.close();
      }
    } catch(e) {
      log(`ERRO FASE1: ${e.message}`);
      record('FASE1-geral', 'FAIL', e.message);
      await ctx.close();
    }
  }

  // ── FASE 2: Verificar Settings > Alertas (nova sessão = cross-session test) ──
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

    try {
      log('\n=== FASE 2: CT03 — Restaurar Individual ===');
      await login(page);

      // Navegar para Settings > Alertas
      await page.goto(`${BASE}/settings?tab=alertas`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(3000); // espera maior para carregar dados

      await shot(page, 'CT3-CT4-00-settings-aberta');

      const dismissedItems = page.locator('[data-slot="card-content"] .space-y-2 > div');
      const dismissedCount = await dismissedItems.count();
      log(`Alertas dispensados encontrados: ${dismissedCount}`);

      if (dismissedCount === 0) {
        // Verificar se mostra estado vazio correto
        const emptyEl = page.locator('p:has-text("Nenhum alerta dispensado")');
        const hasEmpty = await emptyEl.isVisible().catch(() => false);
        record('CT03-estado-vazio', hasEmpty ? 'PASS' : 'WARN', hasEmpty ? '"Nenhum alerta dispensado" exibido' : 'Estado vazio não detectado');

        // Verificar que "Restaurar todos" NÃO aparece quando lista vazia
        const hasRA = await page.locator('button:has-text("Restaurar todos")').isVisible().catch(() => false);
        record('CT03-restaurar-todos-oculto', !hasRA ? 'PASS' : 'FAIL', !hasRA ? '"Restaurar todos" oculto (correto)' : '"Restaurar todos" visível com lista vazia (bug)');

        record('CT03-restaurar-individual', 'WARN', 'Lista vazia — sem dados para restaurar nesta sessão');
      } else {
        record('CT03-lista-com-dados', 'PASS', `${dismissedCount} alertas dispensados na lista`);

        const firstItem = dismissedItems.first();
        const itemText = await firstItem.textContent().catch(() => '');
        log(`Item: "${itemText?.substring(0, 200)}"`);

        // Verificar formatação do alert_key (label legível)
        const hasLabel = /Contato parado no funil|Tarefa vencida|Aniversariante sem tarefa/.test(itemText || '');
        record('CT03-label-legivel', hasLabel ? 'PASS' : 'WARN', hasLabel ? 'Label legível exibido' : `Label: "${itemText?.substring(0, 80)}"`);

        // Verificar data em pt-BR
        const hasDate = /Dispensado em \d{2}\/\d{2}\/\d{4} às \d{2}:\d{2}/.test(itemText || '');
        record('CT03-data-ptbr', hasDate ? 'PASS' : 'WARN', hasDate ? 'Data em pt-BR correta' : `Data: "${itemText?.match(/Dispensado.{0,40}/)?.[0] ?? 'não encontrado'}"`);

        // Verificar botão Restaurar
        const restoreBtn = firstItem.locator('button:has-text("Restaurar")');
        const hasRestore = await restoreBtn.isVisible().catch(() => false);
        record('CT03-botao-restaurar', hasRestore ? 'PASS' : 'FAIL', hasRestore ? 'Botão Restaurar presente' : 'Botão Restaurar ausente');

        // Verificar "Restaurar todos" visível
        const restoreAllBtn = page.locator('button:has-text("Restaurar todos")');
        const hasRA = await restoreAllBtn.isVisible().catch(() => false);
        record('CT03-restaurar-todos-visivel', hasRA ? 'PASS' : 'FAIL', hasRA ? '"Restaurar todos" visível' : 'Botão ausente');

        if (hasRestore && dismissedCount > 1) {
          // Clicar Restaurar no primeiro item
          await restoreBtn.click();
          await page.waitForTimeout(2000);
          await shot(page, 'CT3-01-apos-restaurar-individual');

          const toast = page.locator('[data-sonner-toast]').first();
          const toastText = await toast.textContent().catch(() => '');
          log(`Toast: "${toastText}"`);
          record('CT03-toast-restaurado', toastText?.toLowerCase().includes('restaur') ? 'PASS' : 'WARN', `Toast: "${toastText}"`);

          const itemsAfter = await dismissedItems.count();
          log(`Items após restaurar: ${dismissedCount} → ${itemsAfter}`);
          record('CT03-item-removido-da-lista', itemsAfter < dismissedCount ? 'PASS' : 'FAIL', `${dismissedCount} → ${itemsAfter}`);

          // Verificar badge incrementou no dashboard
          await page.goto(BASE, { waitUntil: 'networkidle' });
          await page.waitForTimeout(2000);
          await shot(page, 'CT3-02-dashboard-badge-pos-restore');

          const badge = page.locator('button[aria-label*="alerta"]').first();
          const badgeText = await badge.textContent().catch(() => '');
          const count = parseInt(badgeText?.match(/\d+/)?.[0] ?? '0');
          log(`Badge: "${badgeText?.trim()}", count: ${count}`);
          record('CT03-alerta-voltou-ao-badge', count > 0 ? 'PASS' : 'WARN', `Badge: ${count}`);

          // ── CT04: Restaurar Todos (usa os alertas restantes) ─────────────────
          log('\n=== CT04: Restaurar Todos ===');
          await page.goto(`${BASE}/settings?tab=alertas`, { waitUntil: 'networkidle' });
          await page.waitForTimeout(2000);

          const remainingCount = await dismissedItems.count();
          log(`Alertas dispensados restantes: ${remainingCount}`);
          await shot(page, 'CT4-00-settings-pre-restore-all');

          if (remainingCount === 0) {
            record('CT04-restaurar-todos', 'WARN', 'Sem alertas dispensados para testar restaurar todos');
          } else {
            const raBtn = page.locator('button:has-text("Restaurar todos")');
            const hasRA2 = await raBtn.isVisible().catch(() => false);
            record('CT04-botao-restaurar-todos', hasRA2 ? 'PASS' : 'FAIL', hasRA2 ? 'Botão presente' : 'Botão ausente');

            if (hasRA2) {
              await raBtn.click();
              await page.waitForTimeout(600);
              await shot(page, 'CT4-01-dialog-confirmacao');

              const alertDialog = page.locator('[role="alertdialog"]');
              const dialogVisible = await alertDialog.isVisible().catch(() => false);
              record('CT04-dialog-abre', dialogVisible ? 'PASS' : 'FAIL', dialogVisible ? 'AlertDialog abriu' : 'Não abriu');

              if (dialogVisible) {
                const dialogText = await alertDialog.textContent().catch(() => '');
                log(`Dialog texto: "${dialogText?.substring(0, 200)}"`);

                // Verificar texto menciona N alertas
                const mentionsCount = /\d+/.test(dialogText || '');
                record('CT04-dialog-qtd', mentionsCount ? 'PASS' : 'WARN', mentionsCount ? 'Menciona número' : 'Número não detectado');

                // Verificar ícone de loading no botão de confirmar
                const confirmBtn = alertDialog.locator('button').last();
                const confirmText = await confirmBtn.textContent().catch(() => '');
                log(`Botão confirmar: "${confirmText}"`);
                record('CT04-botao-confirmar-texto', confirmText?.includes(String(remainingCount)) || confirmText?.toLowerCase().includes('restaurar') ? 'PASS' : 'WARN', `Texto: "${confirmText}"`);

                // Confirmar
                await confirmBtn.click();
                await page.waitForTimeout(3000);
                await shot(page, 'CT4-02-apos-restaurar-todos');

                const finalItems = await dismissedItems.count();
                const emptyMsg = page.locator('p:has-text("Nenhum alerta dispensado")');
                const hasEmpty = await emptyMsg.isVisible().catch(() => false);
                log(`Itens após restaurar todos: ${finalItems}, vazio: ${hasEmpty}`);
                record('CT04-lista-vazia', (finalItems === 0 || hasEmpty) ? 'PASS' : 'FAIL', hasEmpty ? '"Nenhum alerta dispensado" exibido' : `${finalItems} itens restantes`);

                // Verificar "Restaurar todos" sumiu
                const hasRAFinal = await page.locator('button:has-text("Restaurar todos")').isVisible().catch(() => false);
                record('CT04-restaurar-todos-oculto', !hasRAFinal ? 'PASS' : 'FAIL', !hasRAFinal ? 'Botão oculto corretamente' : 'Botão ainda visível com lista vazia');
              }
            }
          }
        } else if (hasRestore && dismissedCount === 1) {
          // Só 1 item — testar CT04 direto
          log('Só 1 alerta dispensado, pulando CT03 individual e testando CT04 direto...');

          log('\n=== CT04: Restaurar Todos (com 1 item) ===');
          const raBtn = page.locator('button:has-text("Restaurar todos")');
          const hasRA2 = await raBtn.isVisible().catch(() => false);
          record('CT04-botao-restaurar-todos', hasRA2 ? 'PASS' : 'FAIL', hasRA2 ? 'Botão presente' : 'Botão ausente');

          if (hasRA2) {
            await raBtn.click();
            await page.waitForTimeout(600);
            await shot(page, 'CT4-01-dialog-confirmacao');

            const alertDialog = page.locator('[role="alertdialog"]');
            const dialogVisible = await alertDialog.isVisible().catch(() => false);
            record('CT04-dialog-abre', dialogVisible ? 'PASS' : 'FAIL', dialogVisible ? 'AlertDialog abriu' : 'Não abriu');

            if (dialogVisible) {
              const dialogText = await alertDialog.textContent().catch(() => '');
              log(`Dialog: "${dialogText?.substring(0, 200)}"`);

              const confirmBtn = alertDialog.locator('button').last();
              await confirmBtn.click();
              await page.waitForTimeout(3000);
              await shot(page, 'CT4-02-apos-restaurar-todos');

              const emptyMsg = page.locator('p:has-text("Nenhum alerta dispensado")');
              const hasEmpty = await emptyMsg.isVisible().catch(() => false);
              record('CT04-lista-vazia', hasEmpty ? 'PASS' : 'FAIL', hasEmpty ? 'Lista vazia exibida' : 'Estado vazio não detectado');
            }
          }
        }
      }

      await ctx.close();
    } catch(e) {
      log(`ERRO FASE2: ${e.message}`);
      record('CT03-CT04-geral', 'FAIL', e.message);
      await shot(page, 'CT3-CT4-erro').catch(() => {});
      await ctx.close();
    }
  }

  await browser.close();

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

  writeFileSync(join(OUT, 'resultado-ct3-ct4.json'), JSON.stringify({ results, consoleErrors, summary: { passed, failed, warned } }, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
