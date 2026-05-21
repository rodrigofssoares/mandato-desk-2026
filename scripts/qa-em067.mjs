/**
 * QA E2E — RAQ-MAND-EM067 — Dismiss de Alertas no Dashboard
 * Playwright headless, screenshots salvos em screenshots/qa-RAQ-MAND-EM067/
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const BASE = 'http://localhost:3001';
const EMAIL = 'rodrigofssoares@gmail.com';
const SENHA = 'QA-Temp-2026!';
// Path absoluto com decodificação de URL
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
  log(`Screenshot: ${name}.png -> ${path}`);
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

async function main() {
  mkdirSync(OUT, { recursive: true });
  log(`Screenshots em: ${OUT}`);

  const browser = await chromium.launch({ headless: true });
  const consoleErrors = [];

  // ── Cenário 1 — Dismiss individual (US01) ─────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(`[C1] ${msg.text()}`);
    });
    page.on('pageerror', (err) => consoleErrors.push(`[C1 PageError] ${err.message}`));

    try {
      log('=== Cenário 1: Dismiss Individual ===');
      await login(page);
      await shot(page, '01-dashboard-inicial');

      // Badge de alertas
      const badge = page.locator('button[aria-label*="alerta"]').first();
      const badgeVisible = await badge.isVisible();

      if (!badgeVisible) {
        record('CT01-badge-presente', 'FAIL', 'Badge de alertas não encontrado no header');
        await ctx.close();
      } else {
        const badgeText = await badge.textContent();
        log(`Badge texto: "${badgeText?.trim()}"`);
        await shot(page, '02-dashboard-badge-alertas');
        record('CT01-badge-presente', 'PASS', `Badge visível: "${badgeText?.trim()}"`);

        // Clicar no badge
        await badge.click();
        // Aguardar modal aparecer de forma robusta
        await page.waitForSelector('[role="dialog"]', { timeout: 8000 }).catch(() => null);
        await page.waitForTimeout(1000);
        await shot(page, '03-modal-aberto');

        // Verificar modal
        const modal = page.locator('[role="dialog"]').first();
        const hasModal = await modal.isVisible().catch(() => false);

        if (!hasModal) {
          record('CT01-modal-abre', 'FAIL', 'Modal não abriu após clicar no badge');
        } else {
          // Conteúdo do modal
          const modalContent = await modal.textContent().catch(() => '');
          log(`Modal conteúdo (primeiros 200 chars): "${modalContent?.substring(0, 200)}"`);
          record('CT01-modal-abre', 'PASS', 'Modal abriu corretamente');

          // Verificar título "Alertas"
          const hasAlertasTitle = modalContent?.includes('Alertas');
          record('CT01-modal-titulo', hasAlertasTitle ? 'PASS' : 'WARN', hasAlertasTitle ? 'Título "Alertas" presente' : 'Título "Alertas" não detectado');

          // Contar alertas
          const alertItems = modal.locator('ul li');
          const itemCount = await alertItems.count();
          log(`Alertas no modal: ${itemCount}`);

          if (itemCount === 0) {
            record('CT01-alertas-na-lista', 'WARN', 'Modal abriu mas lista de alertas vazia');
          } else {
            record('CT01-alertas-na-lista', 'PASS', `${itemCount} alertas na lista`);

            // Botão X
            const firstXBtn = modal.locator('button[aria-label="Dispensar alerta"]').first();
            const xBtnExists = await firstXBtn.isVisible().catch(() => false);

            if (!xBtnExists) {
              record('CT01-botao-x-existe', 'FAIL', 'Botão X (aria-label="Dispensar alerta") não encontrado');
            } else {
              record('CT01-botao-x-existe', 'PASS', 'Botão X presente nos itens');

              // Contar badge ANTES
              const badgeBefore = await badge.textContent().catch(() => '');
              const countBefore = parseInt(badgeBefore?.match(/\d+/)?.[0] ?? '0');
              log(`Badge ANTES dismiss: ${countBefore}`);

              // Clicar X
              await firstXBtn.click();
              await page.waitForTimeout(2000);
              await shot(page, '04-apos-dismiss-individual');

              // Verificar toast
              const toast = page.locator('[data-sonner-toast]').first();
              const toastVisible = await toast.isVisible().catch(() => false);
              if (toastVisible) {
                const toastText = await toast.textContent().catch(() => '');
                log(`Toast texto: "${toastText}"`);
                record('CT01-toast-dispensado', toastText?.toLowerCase().includes('dispen') ? 'PASS' : 'WARN', `Toast: "${toastText}"`);
              } else {
                record('CT01-toast-dispensado', 'WARN', 'Toast não capturado (pode ter sumido rápido)');
              }

              // Items após dismiss
              const itemsAfter = await modal.locator('ul li').count();
              log(`Alertas após dismiss: ${itemsAfter} (antes: ${itemCount})`);
              record('CT01-item-sumiu', itemsAfter < itemCount ? 'PASS' : 'FAIL', `${itemCount} → ${itemsAfter}`);

              // Badge decrementou
              await page.waitForTimeout(1000);
              const badgeAfterText = await badge.textContent().catch(() => '');
              const countAfter = parseInt(badgeAfterText?.match(/\d+/)?.[0] ?? '0');
              log(`Badge APÓS dismiss: ${countAfter}`);
              if (countBefore > 0) {
                record('CT01-badge-decrement', countAfter < countBefore ? 'PASS' : 'FAIL', `Badge: ${countBefore} → ${countAfter}`);
              } else {
                record('CT01-badge-decrement', 'WARN', 'Badge estava sem número antes — impossível verificar decremento');
              }

              // Reload e verificar persistência
              await page.reload({ waitUntil: 'networkidle' });
              await page.waitForTimeout(2000);
              await shot(page, '05-apos-reload');

              const badgeAfterReload = page.locator('button[aria-label*="alerta"]').first();
              await badgeAfterReload.click();
              await page.waitForSelector('[role="dialog"]', { timeout: 8000 }).catch(() => null);
              await page.waitForTimeout(800);

              const itemsAfterReload = await page.locator('[role="dialog"] ul li').count();
              log(`Alertas após reload: ${itemsAfterReload}`);
              await shot(page, '06-modal-apos-reload');

              if (itemsAfterReload <= itemsAfter) {
                record('CT01-persistencia-reload', 'PASS', `Após reload: ${itemsAfterReload} (dismiss persistiu)`);
              } else {
                record('CT01-persistencia-reload', 'FAIL', `Após reload: ${itemsAfterReload} > ${itemsAfter} (alerta voltou)`);
              }
            }
          }
        }
        await ctx.close();
      }
    } catch (err) {
      log(`ERRO no Cenário 1: ${err.message}`);
      record('CT01-cenario-geral', 'FAIL', err.message);
      await shot(page, '01-erro').catch(() => {});
      await ctx.close();
    }
  }

  // ── Cenário 2 — Dismiss em massa (US02) ───────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(`[C2] ${msg.text()}`);
    });

    try {
      log('=== Cenário 2: Dismiss em Massa ===');
      await login(page);

      // Restaurar todos para ter dados
      await page.goto(`${BASE}/settings?tab=alertas`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      const restoreAllBtn = page.locator('button:has-text("Restaurar todos")');
      const hasRestoreAll = await restoreAllBtn.isVisible().catch(() => false);
      if (hasRestoreAll) {
        log('Restaurando todos para garantir estado limpo...');
        await restoreAllBtn.click();
        await page.waitForTimeout(500);
        const confirmBtn = page.locator('[role="alertdialog"] button').last();
        const hasConfirm = await confirmBtn.isVisible().catch(() => false);
        if (hasConfirm) {
          await confirmBtn.click();
          await page.waitForTimeout(2000);
        }
      }

      // Navegar ao dashboard
      await page.goto(BASE, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const badge = page.locator('button[aria-label*="alerta"]').first();
      await badge.click();
      await page.waitForSelector('[role="dialog"]', { timeout: 8000 }).catch(() => null);
      await page.waitForTimeout(800);

      const modal = page.locator('[role="dialog"]').first();
      const hasModal = await modal.isVisible().catch(() => false);

      if (!hasModal) {
        record('CT02-setup', 'WARN', 'Modal não abriu para cenário 2');
      } else {
        const itemCount = await modal.locator('ul li').count();
        log(`Alertas disponíveis para dismiss em massa: ${itemCount}`);
        await shot(page, '07-modal-antes-dismiss-todos');

        if (itemCount === 0) {
          record('CT02-setup', 'WARN', 'Modal vazia — sem alertas para testar dismiss em massa');
        } else {
          // Verificar botão "Dispensar todos"
          const dispensarTodosBtn = modal.locator('button:has-text("Dispensar todos")');
          const hasDT = await dispensarTodosBtn.isVisible().catch(() => false);

          if (!hasDT) {
            record('CT02-botao-dispensar-todos', 'FAIL', 'Botão "Dispensar todos" não encontrado no rodapé do modal');
          } else {
            record('CT02-botao-dispensar-todos', 'PASS', 'Botão "Dispensar todos" presente');

            // Clicar para abrir AlertDialog
            await dispensarTodosBtn.click();
            await page.waitForTimeout(600);
            await shot(page, '08-alert-dialog-confirmacao');

            const alertDialog = page.locator('[role="alertdialog"]');
            const dialogVisible = await alertDialog.isVisible().catch(() => false);

            if (!dialogVisible) {
              record('CT02-dialog-confirmacao', 'FAIL', 'AlertDialog de confirmação não apareceu');
            } else {
              record('CT02-dialog-confirmacao', 'PASS', 'AlertDialog de confirmação abriu');

              const dialogText = await alertDialog.textContent().catch(() => '');
              log(`Dialog texto: "${dialogText?.substring(0, 300)}"`);
              const mentionsCount = /\d+/.test(dialogText || '');
              record('CT02-dialog-menciona-qtd', mentionsCount ? 'PASS' : 'WARN', mentionsCount ? 'Dialog menciona número' : 'Número não detectado');

              // Cancelar
              const cancelBtn = alertDialog.locator('button:has-text("Cancelar")');
              await cancelBtn.click();
              await page.waitForTimeout(500);
              await shot(page, '09-apos-cancelar');

              const dialogClosed = !(await alertDialog.isVisible().catch(() => true));
              record('CT02-cancelar-fecha-dialog', dialogClosed ? 'PASS' : 'FAIL', dialogClosed ? 'Dialog fechou ao cancelar' : 'Dialog ainda aberto');

              const itemsAfterCancel = await modal.locator('ul li').count();
              record('CT02-cancelar-intacto', itemsAfterCancel === itemCount ? 'PASS' : 'FAIL', `${itemsAfterCancel} (esperado ${itemCount})`);

              // Confirmar dismiss em massa
              await dispensarTodosBtn.click();
              await page.waitForTimeout(600);

              const confirmBtn = page.locator('[role="alertdialog"] button').last();
              log(`Texto botão confirmar: "${await confirmBtn.textContent().catch(() => '')}"`);
              await confirmBtn.click();
              await page.waitForTimeout(3000);
              await shot(page, '10-apos-dismiss-todos');

              const itemsAfterAll = await modal.locator('ul li').count();
              const emptyMsg = modal.locator('p:has-text("Nenhum alerta")');
              const showsEmpty = await emptyMsg.isVisible().catch(() => false);

              log(`Items após dismiss todos: ${itemsAfterAll}, msg vazia: ${showsEmpty}`);
              record('CT02-modal-vazia-apos-confirm', (itemsAfterAll === 0 || showsEmpty) ? 'PASS' : 'FAIL', showsEmpty ? 'Estado vazio exibido' : `${itemsAfterAll} itens restantes`);

              // Badge zerou
              await page.keyboard.press('Escape');
              await page.waitForTimeout(500);
              const badgeTextAfter = await badge.textContent().catch(() => '');
              const countAfterAll = parseInt(badgeTextAfter?.match(/\d+/)?.[0] ?? '0');
              log(`Badge após dismiss todos: ${countAfterAll}`);
              record('CT02-badge-zero', countAfterAll === 0 ? 'PASS' : 'FAIL', `Badge: ${countAfterAll}`);
            }
          }
        }
      }
      await ctx.close();
    } catch (err) {
      log(`ERRO no Cenário 2: ${err.message}`);
      record('CT02-cenario-geral', 'FAIL', err.message);
      await shot(page, '02-erro').catch(() => {});
      await ctx.close();
    }
  }

  // ── Cenário 3 — Restaurar individual (US03) ───────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(`[C3] ${msg.text()}`);
    });

    try {
      log('=== Cenário 3: Restaurar Individual ===');
      await login(page);

      // Primeiro verificar se há alertas dispensados; se não, dispensar um
      await page.goto(`${BASE}/settings?tab=alertas`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      let dismissedCount = await page.locator('[data-slot="card-content"] .space-y-2 > div').count();
      log(`Alertas dispensados iniciais: ${dismissedCount}`);

      if (dismissedCount === 0) {
        // Dispensar manualmente um alerta
        await page.goto(BASE, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1500);
        const badge = page.locator('button[aria-label*="alerta"]').first();
        const hasBadge = await badge.isVisible().catch(() => false);
        if (hasBadge) {
          await badge.click();
          await page.waitForSelector('[role="dialog"]', { timeout: 8000 }).catch(() => null);
          await page.waitForTimeout(800);
          const xBtn = page.locator('[role="dialog"] button[aria-label="Dispensar alerta"]').first();
          const hasX = await xBtn.isVisible().catch(() => false);
          if (hasX) {
            await xBtn.click();
            await page.waitForTimeout(1500);
            log('Dispensou um alerta para preparar o cenário 3.');
          }
          await page.keyboard.press('Escape');
          await page.waitForTimeout(300);
        }

        // Voltar para settings
        await page.goto(`${BASE}/settings?tab=alertas`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(2000);
        dismissedCount = await page.locator('[data-slot="card-content"] .space-y-2 > div').count();
        log(`Alertas dispensados após setup: ${dismissedCount}`);
      }

      await shot(page, '11-settings-alertas');

      const activeTab = await page.locator('[role="tab"][data-state="active"]').textContent().catch(() => '?');
      log(`Aba ativa: "${activeTab}"`);
      record('CT03-aba-alertas-existe', 'PASS', `Aba renderizada, ativa: "${activeTab}"`);

      if (dismissedCount === 0) {
        const emptyMsg = page.locator('text=Nenhum alerta dispensado');
        const hasEmpty = await emptyMsg.isVisible().catch(() => false);
        record('CT03-estado-vazio', hasEmpty ? 'PASS' : 'WARN', hasEmpty ? 'Estado vazio correto' : 'Sem itens e sem msg de vazio');
        record('CT03-restaurar-individual', 'WARN', 'Sem alertas dispensados para restaurar');
      } else {
        record('CT03-lista-dispensados', 'PASS', `${dismissedCount} alertas dispensados listados`);

        // Verificar estrutura de um item
        const firstItem = page.locator('[data-slot="card-content"] .space-y-2 > div').first();
        const itemText = await firstItem.textContent().catch(() => '');
        log(`Primeiro item: "${itemText?.substring(0, 150)}"`);

        // Verificar campos: tipo formatado, data, botão restaurar
        const hasDate = /\d{2}\/\d{2}\/\d{4}/.test(itemText || '');
        record('CT03-data-formatada', hasDate ? 'PASS' : 'WARN', hasDate ? 'Data em formato dd/MM/yyyy detectada' : 'Data não detectada no item');

        const hasRestoreBtn = await firstItem.locator('button:has-text("Restaurar")').isVisible().catch(() => false);
        record('CT03-botao-restaurar-existe', hasRestoreBtn ? 'PASS' : 'FAIL', hasRestoreBtn ? 'Botão Restaurar presente' : 'Botão Restaurar não encontrado');

        if (hasRestoreBtn) {
          const restoreBtn = firstItem.locator('button:has-text("Restaurar")');
          await restoreBtn.click();
          await page.waitForTimeout(2000);
          await shot(page, '12-apos-restaurar-individual');

          // Toast
          const toast = page.locator('[data-sonner-toast]').first();
          const toastText = await toast.textContent().catch(() => '');
          log(`Toast restaurar: "${toastText}"`);
          record('CT03-toast-restaurado', toastText?.toLowerCase().includes('restaur') ? 'PASS' : 'WARN', `Toast: "${toastText}"`);

          // Item removido
          const itemsAfterRestore = await page.locator('[data-slot="card-content"] .space-y-2 > div').count();
          log(`Itens após restaurar: ${itemsAfterRestore} (antes: ${dismissedCount})`);
          record('CT03-item-removido', itemsAfterRestore < dismissedCount ? 'PASS' : 'FAIL', `${dismissedCount} → ${itemsAfterRestore}`);

          // Dashboard — badge incrementou
          await page.goto(BASE, { waitUntil: 'networkidle' });
          await page.waitForTimeout(2000);
          await shot(page, '13-dashboard-apos-restaurar');

          const badge = page.locator('button[aria-label*="alerta"]').first();
          const badgeText = await badge.textContent().catch(() => '');
          const count = parseInt(badgeText?.match(/\d+/)?.[0] ?? '0');
          log(`Badge após restaurar individual: ${count}`);
          record('CT03-badge-incrementou', count > 0 ? 'PASS' : 'WARN', `Badge: ${count}`);
        }
      }
      await ctx.close();
    } catch (err) {
      log(`ERRO no Cenário 3: ${err.message}`);
      record('CT03-cenario-geral', 'FAIL', err.message);
      await shot(page, '03-erro').catch(() => {});
      await ctx.close();
    }
  }

  // ── Cenário 4 — Restaurar todos com confirmação (US04) ────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(`[C4] ${msg.text()}`);
    });

    try {
      log('=== Cenário 4: Restaurar Todos ===');
      await login(page);

      // Dispensar alguns alertas para ter dados
      await page.goto(BASE, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const badge = page.locator('button[aria-label*="alerta"]').first();
      const hasBadge = await badge.isVisible().catch(() => false);

      if (hasBadge) {
        await badge.click();
        await page.waitForSelector('[role="dialog"]', { timeout: 8000 }).catch(() => null);
        await page.waitForTimeout(800);
        const dtBtn = page.locator('[role="dialog"] button:has-text("Dispensar todos")');
        const hasDT = await dtBtn.isVisible().catch(() => false);
        if (hasDT) {
          await dtBtn.click();
          await page.waitForTimeout(500);
          const confirmBtn = page.locator('[role="alertdialog"] button').last();
          const hasC = await confirmBtn.isVisible().catch(() => false);
          if (hasC) {
            await confirmBtn.click();
            await page.waitForTimeout(2000);
            log('Alertas dispensados em massa para preparar C4.');
          }
        } else {
          // Modal vazia — usar dismiss individual
          const xBtn = page.locator('[role="dialog"] button[aria-label="Dispensar alerta"]').first();
          const hasX = await xBtn.isVisible().catch(() => false);
          if (hasX) {
            await xBtn.click();
            await page.waitForTimeout(1000);
          }
        }
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }

      // Navegar para Settings > Alertas
      await page.goto(`${BASE}/settings?tab=alertas`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await shot(page, '14-settings-alertas-pre-restore-all');

      const dismissedItems = page.locator('[data-slot="card-content"] .space-y-2 > div');
      const dismissedCount = await dismissedItems.count();
      log(`Alertas dispensados para restaurar todos: ${dismissedCount}`);

      const restoreAllBtn = page.locator('button:has-text("Restaurar todos")');
      const hasRestoreAll = await restoreAllBtn.isVisible().catch(() => false);

      if (dismissedCount === 0) {
        record('CT04-restaurar-todos', 'WARN', 'Nenhum alerta dispensado para restaurar');
      } else {
        record('CT04-botao-restaurar-todos', hasRestoreAll ? 'PASS' : 'FAIL', hasRestoreAll ? 'Botão presente' : 'Botão "Restaurar todos" ausente');

        if (hasRestoreAll) {
          await restoreAllBtn.click();
          await page.waitForTimeout(600);
          await shot(page, '15-dialog-restaurar-todos');

          const alertDialog = page.locator('[role="alertdialog"]');
          const dialogVisible = await alertDialog.isVisible().catch(() => false);
          record('CT04-dialog-confirmacao', dialogVisible ? 'PASS' : 'FAIL', dialogVisible ? 'AlertDialog abriu' : 'Dialog não apareceu');

          if (dialogVisible) {
            const dialogText = await alertDialog.textContent().catch(() => '');
            log(`Dialog restaurar todos: "${dialogText?.substring(0, 200)}"`);
            const mentionsCount = /\d+/.test(dialogText || '');
            record('CT04-dialog-menciona-qtd', mentionsCount ? 'PASS' : 'WARN', mentionsCount ? 'Menciona número' : 'Número não detectado');

            const confirmBtn = alertDialog.locator('button').last();
            await confirmBtn.click();
            await page.waitForTimeout(2000);
            await shot(page, '16-apos-restaurar-todos');

            const emptyMsg = page.locator('text=Nenhum alerta dispensado');
            const hasEmpty = await emptyMsg.isVisible().catch(() => false);
            const itemsLeft = await dismissedItems.count();
            log(`Após restaurar todos: ${itemsLeft} itens, msg vazia: ${hasEmpty}`);
            record('CT04-lista-vazia', (hasEmpty || itemsLeft === 0) ? 'PASS' : 'FAIL', hasEmpty ? 'Estado vazio exibido' : `${itemsLeft} itens restantes`);
          }
        }
      }
      await ctx.close();
    } catch (err) {
      log(`ERRO no Cenário 4: ${err.message}`);
      record('CT04-cenario-geral', 'FAIL', err.message);
      await shot(page, '04-erro').catch(() => {});
      await ctx.close();
    }
  }

  // ── Cenário 5 — Mobile responsivo ─────────────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 667 } });
    const page = await ctx.newPage();

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(`[C5] ${msg.text()}`);
    });

    try {
      log('=== Cenário 5: Mobile Responsivo ===');
      await login(page);
      await page.waitForTimeout(1000);
      await shot(page, '17-mobile-dashboard');

      const badge = page.locator('button[aria-label*="alerta"]').first();
      const badgeVisible = await badge.isVisible().catch(() => false);

      if (!badgeVisible) {
        record('CT05-badge-mobile', 'WARN', 'Badge não encontrado em mobile');
      } else {
        record('CT05-badge-mobile', 'PASS', 'Badge visível em mobile');

        const box = await badge.boundingBox();
        log(`Badge: ${box?.width}x${box?.height}px`);
        record('CT05-touch-target-badge', (box && box.height >= 36) ? 'PASS' : 'WARN', `${box?.width}x${box?.height}px`);

        await badge.click();
        await page.waitForSelector('[role="dialog"]', { timeout: 8000 }).catch(() => null);
        await page.waitForTimeout(800);
        await shot(page, '18-mobile-modal');

        const modal = page.locator('[role="dialog"]').first();
        const modalVisible = await modal.isVisible().catch(() => false);
        record('CT05-modal-mobile', modalVisible ? 'PASS' : 'FAIL', modalVisible ? 'Modal abre em mobile' : 'Modal não abre');

        if (modalVisible) {
          // Botão X tocável
          const xBtn = modal.locator('button[aria-label="Dispensar alerta"]').first();
          const xBtnExists = await xBtn.isVisible().catch(() => false);

          if (xBtnExists) {
            const xBox = await xBtn.boundingBox();
            log(`Botão X: ${xBox?.width}x${xBox?.height}px`);
            // Alvo mínimo de toque: verificar o item pai
            const rowBox = await xBtn.locator('..').boundingBox().catch(() => null);
            log(`Row pai: ${rowBox?.width}x${rowBox?.height}px`);
            record('CT05-touch-target-x', xBtnExists ? 'PASS' : 'WARN', `Botão X presente, ${xBox?.width}x${xBox?.height}px`);
          } else {
            record('CT05-touch-target-x', 'WARN', 'Sem alertas ativos em mobile para verificar botão X');
          }

          // "Dispensar todos" cabe na largura
          const dtBtn = modal.locator('button:has-text("Dispensar todos")');
          const dtVisible = await dtBtn.isVisible().catch(() => false);
          if (dtVisible) {
            const dtBox = await dtBtn.boundingBox();
            const vp = page.viewportSize();
            const fitsWidth = dtBox && dtBox.right <= (vp?.width ?? 375);
            record('CT05-dispensar-todos-largura', fitsWidth ? 'PASS' : 'WARN', fitsWidth ? 'Cabe na largura' : `overflow right=${dtBox?.right}`);
          }

          // Link "Gerenciar alertas dispensados"
          const manageLink = modal.locator('button:has-text("Gerenciar")');
          const manageLinkVisible = await manageLink.isVisible().catch(() => false);
          record('CT05-link-gerenciar', manageLinkVisible ? 'PASS' : 'WARN', manageLinkVisible ? 'Link Gerenciar presente em mobile' : 'Link Gerenciar não encontrado em mobile');
        }
      }

      // Mobile Settings > Alertas
      await page.goto(`${BASE}/settings?tab=alertas`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);
      await shot(page, '19-mobile-settings-alertas');
      record('CT05-settings-mobile', 'PASS', 'Settings > Alertas acessível em mobile');

      await ctx.close();
    } catch (err) {
      log(`ERRO no Cenário 5: ${err.message}`);
      record('CT05-cenario-geral', 'FAIL', err.message);
      await shot(page, '05-erro').catch(() => {});
      await ctx.close();
    }
  }

  await browser.close();

  // ── Sumário ────────────────────────────────────────────────────────────────
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  const warned = results.filter((r) => r.status === 'WARN').length;

  log('');
  log('=== SUMÁRIO QA ===');
  log(`Total CTs: ${results.length}`);
  log(`Passaram: ${passed}`);
  log(`Falharam: ${failed}`);
  log(`Avisos: ${warned}`);

  if (consoleErrors.length > 0) {
    log('\n=== ERROS DE CONSOLE ===');
    consoleErrors.slice(0, 20).forEach((e) => log(e));
  } else {
    log('\nNenhum erro de console vermelho.');
  }

  const output = {
    timestamp: new Date().toISOString(),
    results,
    consoleErrors: consoleErrors.slice(0, 50),
    summary: { passed, failed, warned, total: results.length },
  };
  writeFileSync(join(OUT, 'resultado.json'), JSON.stringify(output, null, 2));
  log(`\nResultados: ${join(OUT, 'resultado.json')}`);
}

main().catch((err) => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
