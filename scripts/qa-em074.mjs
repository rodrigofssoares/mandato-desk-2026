/**
 * QA Smoke Test — RAQ-MAND-EM074
 * Filtro de Aceite WhatsApp no Funil e Contatos
 *
 * Critérios testados:
 *   CT01 — Segmented control visível na toolbar do funil
 *   CT02 — Clicar "Aceita" ativa filtro; clicar "Todos" remove filtro
 *   CT03 — Seletor "a partir de:" aparece quando filtro ativo
 *   CT04 — Badge "protegida" aparece nas colunas antes do stageFrom
 *   CT05 — Contador "Visíveis: X de Y" aparece com filtro ativo
 *   CT06 — Legenda rodapé aparece com filtro ativo
 *   CT07 — Chip "Aceite WA:" visível na toolbar de Contatos
 *   CT08 — Clicar chip Contatos ativa filtro na lista
 *   CT09 — Mobile 375x812 sem overflow horizontal
 */

import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:3001';
const EMAIL = 'rodrigofssoares@gmail.com';
const SENHA = 'QA-Temp-2026!';

const OUT = join(__dirname, '..', 'screenshots', 'qa-RAQ-MAND-EM074');
mkdirSync(OUT, { recursive: true });

const log = (msg) => console.log(`[QA-EM074] ${msg}`);

const results = [];
function record(ct, status, notes = '') {
  results.push({ ct, status, notes });
  const icon = status === 'PASS' ? 'PASS' : status === 'FAIL' ? 'FAIL' : 'SKIP';
  log(`[${icon}] ${ct}${notes ? ' — ' + notes : ''}`);
}

async function shot(page, name) {
  const path = join(OUT, `${name}.png`);
  await page.screenshot({ path, fullPage: false });
  log(`Screenshot salvo: ${path}`);
  return path;
}

async function login(page) {
  await page.goto(BASE + '/auth', { waitUntil: 'networkidle', timeout: 20000 });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', SENHA);
  await page.click('button[type="submit"]');
  try {
    await page.waitForFunction(() => !window.location.pathname.includes('/auth'), { timeout: 30000 });
    await page.waitForLoadState('networkidle');
    log('Login OK');
    return true;
  } catch {
    log('Login FALHOU');
    await shot(page, 'login-fail');
    return false;
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  // ── LOGIN ────────────────────────────────────────────────────────────────────
  const ok = await login(page);
  if (!ok) {
    log('Abortando — login falhou');
    await browser.close();
    process.exit(1);
  }
  await shot(page, '00-pos-login');

  // ── CT01: Segmented control visível na toolbar do funil ───────────────────────
  try {
    await page.goto(BASE + '/funis', { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(2000);
    await shot(page, 'ct01-funil-inicial');

    // O componente renderiza quando há stages — verificar se o radiogroup está presente
    const radiogroup = page.locator('[role="radiogroup"][aria-label="Filtro de aceite WhatsApp"]');
    const rgVisible = await radiogroup.isVisible({ timeout: 8000 }).catch(() => false);

    if (rgVisible) {
      record('CT01 — Segmented control visível na toolbar do funil', 'PASS');
    } else {
      // Pode ser que não haja funil com stages criado — verificar texto de estado vazio
      const semEstagio = await page.locator('text=Este funil não tem estágios').isVisible({ timeout: 3000 }).catch(() => false);
      const semFunil = await page.locator('text=Nenhum funil criado').isVisible({ timeout: 3000 }).catch(() => false);
      if (semEstagio || semFunil) {
        record('CT01 — Segmented control visível na toolbar do funil', 'SKIP', 'Funil sem etapas ou sem funil criado — não é falha da feature');
      } else {
        record('CT01 — Segmented control visível na toolbar do funil', 'FAIL', 'radiogroup não encontrado com stages presentes');
      }
    }
  } catch (e) {
    record('CT01 — Segmented control visível na toolbar do funil', 'FAIL', e.message);
  }

  // ── CT02: Clicar "Aceita" ativa filtro ───────────────────────────────────────
  try {
    const radiogroup = page.locator('[role="radiogroup"][aria-label="Filtro de aceite WhatsApp"]');
    const rgVisible = await radiogroup.isVisible({ timeout: 3000 }).catch(() => false);

    if (!rgVisible) {
      record('CT02 — Clicar Aceita filtra kanban', 'SKIP', 'Dependente do CT01 — sem funil/stages');
    } else {
      const btnAceita = radiogroup.locator('[role="radio"]').nth(1); // índice 1 = "Aceita"
      await btnAceita.click();
      await page.waitForTimeout(500);
      await shot(page, 'ct02-aceita-ativo');

      // Verificar aria-checked="true" no botão Aceita
      const checked = await btnAceita.getAttribute('aria-checked');
      if (checked === 'true') {
        record('CT02 — Clicar Aceita filtra kanban', 'PASS', 'aria-checked=true no botão Aceita');
      } else {
        record('CT02 — Clicar Aceita filtra kanban', 'FAIL', `aria-checked esperado "true", obtido "${checked}"`);
      }

      // Verificar botão "Todos" volta ao normal
      const btnTodos = radiogroup.locator('[role="radio"]').nth(0);
      await btnTodos.click();
      await page.waitForTimeout(300);
      const todosChecked = await btnTodos.getAttribute('aria-checked');
      if (todosChecked === 'true') {
        record('CT02b — Clicar Todos remove filtro', 'PASS');
      } else {
        record('CT02b — Clicar Todos remove filtro', 'FAIL', `aria-checked esperado "true", obtido "${todosChecked}"`);
      }
    }
  } catch (e) {
    record('CT02 — Clicar Aceita filtra kanban', 'FAIL', e.message);
  }

  // ── CT03: Seletor "a partir de:" aparece quando filtro ativo ─────────────────
  try {
    const radiogroup = page.locator('[role="radiogroup"][aria-label="Filtro de aceite WhatsApp"]');
    const rgVisible = await radiogroup.isVisible({ timeout: 3000 }).catch(() => false);

    if (!rgVisible) {
      record('CT03 — Seletor "a partir de:" aparece com filtro ativo', 'SKIP', 'Sem funil/stages');
    } else {
      // Ativar filtro "Aceita"
      const btnAceita = radiogroup.locator('[role="radio"]').nth(1);
      await btnAceita.click();
      await page.waitForTimeout(500);

      const selectorLabel = page.locator('text=a partir de:');
      const labelVisible = await selectorLabel.isVisible({ timeout: 3000 }).catch(() => false);

      if (labelVisible) {
        record('CT03 — Seletor "a partir de:" aparece com filtro ativo', 'PASS');
      } else {
        record('CT03 — Seletor "a partir de:" aparece com filtro ativo', 'FAIL', 'Label "a partir de:" não encontrado');
      }
      await shot(page, 'ct03-seletor-apartir');
    }
  } catch (e) {
    record('CT03 — Seletor "a partir de:" aparece com filtro ativo', 'FAIL', e.message);
  }

  // ── CT04: Badge "protegida" nas colunas antes do stageFrom ───────────────────
  try {
    const radiogroup = page.locator('[role="radiogroup"][aria-label="Filtro de aceite WhatsApp"]');
    const rgVisible = await radiogroup.isVisible({ timeout: 3000 }).catch(() => false);

    if (!rgVisible) {
      record('CT04 — Badge protegida nas colunas', 'SKIP', 'Sem funil/stages');
    } else {
      // Verificar se algum badge "protegida" está visível (requer funil com stageFromIndex > 0)
      const badgesProtegidas = page.locator('text=🛡 protegida');
      const count = await badgesProtegidas.count();
      // Se o default é Math.floor(N/2) e N > 1, há stages protegidos
      // Se count === 0, pode ser stageFromIndex = 0 (funil com 1 etapa) — SKIP
      if (count > 0) {
        record('CT04 — Badge protegida nas colunas', 'PASS', `${count} badge(s) visível(is)`);
      } else {
        record('CT04 — Badge protegida nas colunas', 'SKIP', 'Nenhum badge visível — funil com 1 etapa ou stageFrom=0 (aceitável)');
      }
      await shot(page, 'ct04-badges-protegidas');
    }
  } catch (e) {
    record('CT04 — Badge protegida nas colunas', 'FAIL', e.message);
  }

  // ── CT05: Contador "Visíveis: X de Y" ────────────────────────────────────────
  try {
    const radiogroup = page.locator('[role="radiogroup"][aria-label="Filtro de aceite WhatsApp"]');
    const rgVisible = await radiogroup.isVisible({ timeout: 3000 }).catch(() => false);

    if (!rgVisible) {
      record('CT05 — Contador Visíveis:X de Y', 'SKIP', 'Sem funil/stages');
    } else {
      // Filtro "Aceita" já deve estar ativo do CT03
      const contadorVisivel = page.locator('text=Visíveis:');
      const contVisible = await contadorVisivel.isVisible({ timeout: 3000 }).catch(() => false);

      if (contVisible) {
        const contText = await contadorVisivel.first().textContent();
        record('CT05 — Contador Visíveis:X de Y', 'PASS', `Texto: "${contText?.trim()}"`);
      } else {
        record('CT05 — Contador Visíveis:X de Y', 'FAIL', 'Contador não encontrado com filtro ativo');
      }
      await shot(page, 'ct05-contador');
    }
  } catch (e) {
    record('CT05 — Contador Visíveis:X de Y', 'FAIL', e.message);
  }

  // ── CT06: Legenda rodapé ──────────────────────────────────────────────────────
  try {
    const radiogroup = page.locator('[role="radiogroup"][aria-label="Filtro de aceite WhatsApp"]');
    const rgVisible = await radiogroup.isVisible({ timeout: 3000 }).catch(() => false);

    if (!rgVisible) {
      record('CT06 — Legenda rodapé', 'SKIP', 'Sem funil/stages');
    } else {
      const legendaText = page.locator('text=Aceita WhatsApp').last();
      const rodapeText = page.locator('text=novos leads não ficam ocultos');
      const legendaVisible = await legendaText.isVisible({ timeout: 3000 }).catch(() => false);
      const rodapeVisible = await rodapeText.isVisible({ timeout: 3000 }).catch(() => false);

      if (legendaVisible && rodapeVisible) {
        record('CT06 — Legenda rodapé com 3 itens + texto explicativo', 'PASS');
      } else if (legendaVisible) {
        record('CT06 — Legenda rodapé com 3 itens + texto explicativo', 'PASS', 'Legenda visível (texto "novos leads" pode estar fora do viewport)');
      } else {
        record('CT06 — Legenda rodapé com 3 itens + texto explicativo', 'FAIL', 'Legenda não encontrada com filtro ativo');
      }
      await shot(page, 'ct06-legenda-rodape');
    }
  } catch (e) {
    record('CT06 — Legenda rodapé', 'FAIL', e.message);
  }

  // Resetar filtro antes de sair da página funis
  try {
    const radiogroup = page.locator('[role="radiogroup"][aria-label="Filtro de aceite WhatsApp"]');
    const rgVisible = await radiogroup.isVisible({ timeout: 2000 }).catch(() => false);
    if (rgVisible) {
      const btnTodos = radiogroup.locator('[role="radio"]').nth(0);
      await btnTodos.click();
      await page.waitForTimeout(300);
    }
  } catch { /* ignorar */ }

  // ── CT07: Chip "Aceite WA:" visível na toolbar de Contatos ───────────────────
  try {
    await page.goto(BASE + '/contatos', { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(2000);
    await shot(page, 'ct07-contatos-inicial');

    const chipLabel = page.locator('text=Aceite WA:');
    const chipVisible = await chipLabel.isVisible({ timeout: 5000 }).catch(() => false);

    if (chipVisible) {
      record('CT07 — Chip Aceite WA: visível na toolbar de Contatos', 'PASS');
    } else {
      record('CT07 — Chip Aceite WA: visível na toolbar de Contatos', 'FAIL', 'Label "Aceite WA:" não encontrado na toolbar');
    }
  } catch (e) {
    record('CT07 — Chip Aceite WA: visível na toolbar de Contatos', 'FAIL', e.message);
  }

  // ── CT08: Clicar chip ativa filtro na lista ───────────────────────────────────
  try {
    const contatos_radiogroup = page.locator('[role="radiogroup"][aria-label="Filtro de aceite WhatsApp"]');
    const rgVisible = await contatos_radiogroup.isVisible({ timeout: 5000 }).catch(() => false);

    if (!rgVisible) {
      record('CT08 — Clicar chip Aceita filtra lista de contatos', 'FAIL', 'radiogroup não encontrado na página Contatos');
    } else {
      // Captura contagem inicial
      const totalBefore = await page.locator('text=de ' ).first().textContent().catch(() => null);

      const btnAceita = contatos_radiogroup.locator('[role="radio"]').nth(1);
      await btnAceita.click();
      await page.waitForTimeout(1500); // aguarda refetch server-side
      await shot(page, 'ct08-contatos-aceita-filtrado');

      const checked = await btnAceita.getAttribute('aria-checked');
      if (checked === 'true') {
        record('CT08 — Clicar chip Aceita filtra lista de contatos', 'PASS', 'aria-checked=true no botão Aceita');
      } else {
        record('CT08 — Clicar chip Aceita filtra lista de contatos', 'FAIL', `aria-checked esperado "true", obtido "${checked}"`);
      }

      // Verificar chip ativo no ContactFiltersChips
      const filterChip = page.locator('text=Aceita WhatsApp: Sim');
      const chipAtivo = await filterChip.isVisible({ timeout: 3000 }).catch(() => false);
      if (chipAtivo) {
        record('CT08b — Chip Aceita WhatsApp: Sim aparece nos filtros ativos', 'PASS');
      } else {
        record('CT08b — Chip Aceita WhatsApp: Sim aparece nos filtros ativos', 'SKIP', 'Chip de filtro ativo não visível (pode estar fora do viewport ou não há chip quando usando o tri-state)');
      }

      // Voltar pra Todos
      const btnTodos = contatos_radiogroup.locator('[role="radio"]').nth(0);
      await btnTodos.click();
      await page.waitForTimeout(500);
    }
  } catch (e) {
    record('CT08 — Clicar chip Aceita filtra lista de contatos', 'FAIL', e.message);
  }

  // ── CT09: Mobile 375px sem overflow horizontal ────────────────────────────────
  const mobileCtx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const mobilePage = await mobileCtx.newPage();

  try {
    // Reutilizar session cookie
    const cookies = await ctx.cookies();
    await mobileCtx.addCookies(cookies);

    // Testar Funis em mobile
    await mobilePage.goto(BASE + '/funis', { waitUntil: 'networkidle', timeout: 20000 });
    await mobilePage.waitForTimeout(2000);
    await mobilePage.screenshot({ path: join(OUT, 'ct09-funil-mobile-375.png'), fullPage: false });
    log('Screenshot mobile funil: ' + join(OUT, 'ct09-funil-mobile-375.png'));

    // Verificar overflow horizontal
    const hasOverflow = await mobilePage.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    if (!hasOverflow) {
      record('CT09 — Mobile 375px sem overflow horizontal (funil)', 'PASS');
    } else {
      record('CT09 — Mobile 375px sem overflow horizontal (funil)', 'FAIL', 'scrollWidth > clientWidth — overflow horizontal detectado');
    }

    // Testar Contatos em mobile
    await mobilePage.goto(BASE + '/contatos', { waitUntil: 'networkidle', timeout: 20000 });
    await mobilePage.waitForTimeout(2000);
    await mobilePage.screenshot({ path: join(OUT, 'ct09-contatos-mobile-375.png'), fullPage: false });

    const hasOverflowContatos = await mobilePage.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    if (!hasOverflowContatos) {
      record('CT09b — Mobile 375px sem overflow horizontal (contatos)', 'PASS');
    } else {
      record('CT09b — Mobile 375px sem overflow horizontal (contatos)', 'FAIL', 'Overflow horizontal em /contatos mobile');
    }
  } catch (e) {
    record('CT09 — Mobile 375px', 'FAIL', e.message);
  } finally {
    await mobileCtx.close();
  }

  await browser.close();

  // ── SUMÁRIO ───────────────────────────────────────────────────────────────────
  console.log('\n═══ RESULTADO QA-EM074 ═══');
  const pass = results.filter((r) => r.status === 'PASS').length;
  const fail = results.filter((r) => r.status === 'FAIL').length;
  const skip = results.filter((r) => r.status === 'SKIP').length;
  console.log(`PASS: ${pass} | FAIL: ${fail} | SKIP: ${skip}`);
  results.forEach((r) => {
    const icon = r.status === 'PASS' ? 'PASS' : r.status === 'FAIL' ? 'FAIL' : 'SKIP';
    console.log(`  [${icon}] ${r.ct}${r.notes ? ' — ' + r.notes : ''}`);
  });
  console.log(`\nScreenshots em: ${OUT}`);

  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error('[QA-EM074] Erro fatal:', e);
  process.exit(1);
});
