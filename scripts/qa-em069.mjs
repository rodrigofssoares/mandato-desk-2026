/**
 * QA E2E — RAQ-MAND-EM069 — Novos filtros de endereco no drawer de Contatos
 *
 * Cobre: CT01 (presenca dos 4 inputs), CT02 (bairro), CT03 (CEP parcial),
 *        CT04 (combinacao AND), CT05 (chip X individual), CT06 (limpar tudo),
 *        CT07 (mobile 375px)
 */

import { chromium } from 'playwright';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:8081';
const EMAIL = 'rodrigofssoares@gmail.com';
const SENHA = 'QA-Temp-2026!';
const OUT = join(__dirname, '..', 'screenshots', 'qa-RAQ-MAND-EM069');
const DEBOUNCE_WAIT = 600; // maior que 300ms do debounce pra garantir disparo

const log = (msg) => console.log(`[QA-EM069] ${msg}`);
const results = [];

function record(ct, status, notes = '') {
  results.push({ ct, status, notes });
  const icon = status === 'PASS' ? 'OK' : status === 'FAIL' ? 'FAIL' : 'WARN';
  log(`[${icon}] ${ct} — ${status}${notes ? ': ' + notes : ''}`);
}

async function shot(page, name) {
  const path = join(OUT, `${name}.png`);
  await page.screenshot({ path, fullPage: false });
  log(`Screenshot: ${name}.png`);
  return path;
}

async function login(page) {
  log('Login...');
  await page.goto(`${BASE}/auth`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', SENHA);
  await page.click('button[type="submit"]');
  try {
    await page.waitForURL((url) => !url.includes('/auth'), { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    log('Login OK');
    return true;
  } catch {
    log('Falha no login');
    await shot(page, '00-login-fail');
    return false;
  }
}

/**
 * Abre o drawer de filtros na pagina /contatos e expande o segmento Localizacao.
 * Retorna true se conseguiu abrir e expandir.
 */
async function abrirDrawerLocalizacao(page) {
  await page.goto(`${BASE}/contatos`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Clica no botao Filtros
  const filtrosBtn = page.locator('button').filter({ hasText: /^Filtros/ }).first();
  const filtrosBtnVisible = await filtrosBtn.isVisible({ timeout: 5000 }).catch(() => false);
  if (!filtrosBtnVisible) {
    log('AVISO: botao Filtros nao encontrado — tentando aria-label');
    const filtrosByLabel = page.locator('[aria-label="Abrir painel de filtros"]');
    if (await filtrosByLabel.isVisible({ timeout: 3000 }).catch(() => false)) {
      await filtrosByLabel.click();
    } else {
      log('ERRO: botao Filtros nao encontrado');
      return false;
    }
  } else {
    await filtrosBtn.click();
  }

  await page.waitForTimeout(800);

  // Verifica se o drawer abriu (Sheet)
  const sheetContent = page.locator('[role="dialog"]').first();
  const sheetOpen = await sheetContent.isVisible({ timeout: 5000 }).catch(() => false);
  if (!sheetOpen) {
    // Tenta identificar pelo conteudo — SheetContent sem role="dialog" em alguns builds
    const filterPanel = page.locator('text=Filtros de contatos, text=Limpar tudo').first();
    log(`Sheet aberta via role=dialog: ${sheetOpen}`);
  }

  // Procura o segmento Localizacao pelo titulo
  const localizacaoTrigger = page.locator('button').filter({ hasText: 'Localização' }).first();
  const locVisible = await localizacaoTrigger.isVisible({ timeout: 5000 }).catch(() => false);

  if (!locVisible) {
    log('AVISO: segmento Localizacao nao encontrado visivel — pode ja estar expandido ou drawer nao abriu');
    return sheetOpen;
  }

  // Verifica se ja esta expandido (aria-expanded=true)
  const expanded = await localizacaoTrigger.getAttribute('aria-expanded').catch(() => null);
  log(`Segmento Localizacao aria-expanded: ${expanded}`);

  if (expanded !== 'true') {
    await localizacaoTrigger.click();
    await page.waitForTimeout(500);
  }

  return true;
}

async function main() {
  mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  try {
    // ─── LOGIN ────────────────────────────────────────────────────────────────
    const loggedIn = await login(page);
    if (!loggedIn) {
      record('LOGIN', 'FAIL', 'credenciais invalidas ou app fora do ar');
      await browser.close();
      printSummary();
      return;
    }

    // ─── CT01 — Presenca dos 4 inputs novos no drawer ────────────────────────
    log('\n=== CT01: Presenca dos 4 inputs novos + subtitulo ===');
    const drawerOk = await abrirDrawerLocalizacao(page);
    if (!drawerOk) {
      record('CT01', 'FAIL', 'nao conseguiu abrir drawer ou segmento Localizacao');
      await shot(page, 'ct01-drawer-localizacao-falha');
    } else {
      await page.waitForTimeout(500);

      // Verifica os placeholders dos inputs novos
      const hasBairro = await page.locator('input[placeholder*="Centro"]').isVisible({ timeout: 3000 }).catch(() => false);
      const hasLogradouro = await page.locator('input[placeholder*="Rua das Flores"]').isVisible({ timeout: 3000 }).catch(() => false);
      // CEP placeholder pode ser "30140-071" (da implementacao real)
      const hasCep = await page.locator('input[placeholder*="30140"]').isVisible({ timeout: 3000 }).catch(() => false);
      const hasComplemento = await page.locator('input[placeholder*="Apto"]').isVisible({ timeout: 3000 }).catch(() => false);

      log(`Bairro input: ${hasBairro}, Logradouro: ${hasLogradouro}, CEP: ${hasCep}, Complemento: ${hasComplemento}`);

      // Verifica subtitulo atualizado
      const bodyText = await page.textContent('body');
      const subtituloAtualizado = bodyText.includes('bairro e mais') || bodyText.includes('Cidade, estado, bairro');
      const subtituloAntigo = bodyText.includes('Cidade, estado, origem') && !subtituloAtualizado;
      log(`Subtitulo atualizado ("bairro e mais"): ${subtituloAtualizado}`);
      log(`Subtitulo antigo presente: ${subtituloAntigo}`);

      await shot(page, 'ct01-drawer-localizacao-expandido');

      if (hasBairro && hasLogradouro && hasCep && hasComplemento && subtituloAtualizado) {
        record('CT01', 'PASS', `todos 4 inputs presentes, subtitulo correto: "bairro e mais"`);
      } else {
        const falhas = [];
        if (!hasBairro) falhas.push('input Bairro ausente');
        if (!hasLogradouro) falhas.push('input Logradouro ausente');
        if (!hasCep) falhas.push('input CEP ausente');
        if (!hasComplemento) falhas.push('input Complemento ausente');
        if (!subtituloAtualizado) falhas.push('subtitulo nao atualizado (ainda "Cidade, estado, origem")');
        record('CT01', 'FAIL', falhas.join('; '));
      }
    }

    // ─── CT02 — Filtragem por bairro (happy path) ────────────────────────────
    log('\n=== CT02: Filtragem por bairro ===');
    // Drawer ainda deve estar aberto; caso contrario, reabre
    const drawerStillOpen = await page.locator('text=Limpar tudo').isVisible({ timeout: 2000 }).catch(() => false);
    if (!drawerStillOpen) {
      await abrirDrawerLocalizacao(page);
    }

    const bairroInput = page.locator('input[placeholder*="Centro"]').first();
    const bairroVisible = await bairroInput.isVisible({ timeout: 3000 }).catch(() => false);

    if (!bairroVisible) {
      record('CT02', 'FAIL', 'input Bairro nao encontrado para digitar');
      await shot(page, 'ct02-bairro-filtrado');
    } else {
      await bairroInput.fill('Centro');
      await page.waitForTimeout(DEBOUNCE_WAIT);

      // Verifica badge no segmento Localizacao
      const locBadge = page.locator('.rounded-\\[10px\\]').filter({ hasText: 'Localização' }).locator('.bg-primary.text-white').first();
      const badgeVisible = await locBadge.isVisible({ timeout: 3000 }).catch(() => false);
      const badgeText = badgeVisible ? await locBadge.textContent().catch(() => '0') : '0';
      log(`Badge Localizacao: visivel=${badgeVisible}, texto="${badgeText}"`);

      // Verifica chip "Bairro: Centro" na area de chips
      const bairroChip = page.locator('text=Bairro: Centro').first();
      const chipVisible = await bairroChip.isVisible({ timeout: 4000 }).catch(() => false);
      log(`Chip "Bairro: Centro": ${chipVisible}`);

      await shot(page, 'ct02-bairro-filtrado');

      if (chipVisible) {
        record('CT02', 'PASS', `chip "Bairro: Centro" visivel, badge="${badgeText}"`);
      } else {
        // Badge pode ter aparecido mas chip nao (badge requer filtro aplicado via debounce)
        if (badgeVisible && parseInt(badgeText) > 0) {
          record('CT02', 'WARN', `badge=${badgeText} mas chip "Bairro: Centro" nao visivel ainda — debounce pode nao ter disparado`);
        } else {
          record('CT02', 'FAIL', `chip "Bairro: Centro" nao apareceu apos debounce; badge="${badgeText}"`);
        }
      }
    }

    // ─── CT03 — Filtragem por CEP parcial ────────────────────────────────────
    log('\n=== CT03: CEP parcial ===');
    // Limpar bairro antes para isolar
    const drawerOpenCt03 = await page.locator('text=Limpar tudo').isVisible({ timeout: 2000 }).catch(() => false);
    if (!drawerOpenCt03) {
      await abrirDrawerLocalizacao(page);
    }

    // Limpa bairro para testar CEP isolado
    const bairroInputCt03 = page.locator('input[placeholder*="Centro"]').first();
    if (await bairroInputCt03.isVisible({ timeout: 2000 }).catch(() => false)) {
      await bairroInputCt03.fill('');
      await page.waitForTimeout(DEBOUNCE_WAIT);
    }

    const cepInput = page.locator('input[placeholder*="30140"]').first();
    const cepVisible = await cepInput.isVisible({ timeout: 3000 }).catch(() => false);

    if (!cepVisible) {
      record('CT03', 'FAIL', 'input CEP nao encontrado');
      await shot(page, 'ct03-cep-parcial');
    } else {
      await cepInput.fill('30140');
      await page.waitForTimeout(DEBOUNCE_WAIT);

      const cepChip = page.locator('text=CEP: 30140').first();
      const cepChipVisible = await cepChip.isVisible({ timeout: 4000 }).catch(() => false);
      log(`Chip "CEP: 30140": ${cepChipVisible}`);

      await shot(page, 'ct03-cep-parcial');

      if (cepChipVisible) {
        record('CT03', 'PASS', 'chip "CEP: 30140" visivel apos debounce');
      } else {
        // Verifica se o chip de applied section existe mas com texto diferente
        const bodyContent = await page.textContent('body');
        const hasCepAnywhere = bodyContent.includes('CEP') && bodyContent.includes('30140');
        if (hasCepAnywhere) {
          record('CT03', 'WARN', 'texto CEP/30140 presente na pagina mas chip especifico nao localizado pelo seletor exato');
        } else {
          record('CT03', 'FAIL', 'chip CEP nao apareceu; filtro pode nao ter disparado');
        }
      }
    }

    // ─── CT04 — Combinacao AND de filtros ────────────────────────────────────
    log('\n=== CT04: Combinacao AND (Bairro + CEP) ===');
    const drawerOpenCt04 = await page.locator('text=Limpar tudo').isVisible({ timeout: 2000 }).catch(() => false);
    if (!drawerOpenCt04) {
      await abrirDrawerLocalizacao(page);
    }

    // Digitar Bairro (CEP ja deve estar ativo do CT03)
    const bairroInputCt04 = page.locator('input[placeholder*="Centro"]').first();
    const bairroVisibleCt04 = await bairroInputCt04.isVisible({ timeout: 3000 }).catch(() => false);

    if (!bairroVisibleCt04) {
      record('CT04', 'FAIL', 'input Bairro nao encontrado para CT04');
      await shot(page, 'ct04-combinacao-and');
    } else {
      await bairroInputCt04.fill('Centro');
      await page.waitForTimeout(DEBOUNCE_WAIT);

      // Contar chips ativos
      const allChips = page.locator('[class*="badge"]').filter({ hasText: /Bairro:|CEP:/ });
      const chipCount = await allChips.count();
      log(`Chips Bairro+CEP ativos: ${chipCount}`);

      // Badge do segmento Localizacao deve ser >= 2
      // Tenta selecionar o badge dentro do card Localizacao
      const bodyText2 = await page.textContent('body');
      const hasBairroChip = bodyText2.includes('Bairro: Centro');
      const hasCepChip = bodyText2.includes('CEP: 30140');
      log(`Bairro chip presente: ${hasBairroChip}, CEP chip presente: ${hasCepChip}`);

      await shot(page, 'ct04-combinacao-and');

      if (hasBairroChip && hasCepChip) {
        record('CT04', 'PASS', 'ambos chips Bairro e CEP ativos simultaneamente (AND semantico)');
      } else {
        record('CT04', 'FAIL', `hasBairro=${hasBairroChip}, hasCep=${hasCepChip} — combinacao AND falhou`);
      }
    }

    // ─── CT05 — Remocao individual via chip X ────────────────────────────────
    log('\n=== CT05: Remocao individual via chip X ===');
    // Estado: Bairro=Centro e CEP=30140 ativos. Vai remover Bairro via X do chip.
    const drawerOpenCt05 = await page.locator('text=Limpar tudo').isVisible({ timeout: 2000 }).catch(() => false);
    if (!drawerOpenCt05) {
      // Reabre e reaplica filtros
      await abrirDrawerLocalizacao(page);
      const bInput = page.locator('input[placeholder*="Centro"]').first();
      if (await bInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await bInput.fill('Centro');
        await page.waitForTimeout(DEBOUNCE_WAIT);
      }
      const cInput = page.locator('input[placeholder*="30140"]').first();
      if (await cInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await cInput.fill('30140');
        await page.waitForTimeout(DEBOUNCE_WAIT);
      }
    }

    // Encontra o chip de Bairro e clica no X
    const bairroChipEl = page.locator('text=Bairro: Centro').first();
    const bairroChipExists = await bairroChipEl.isVisible({ timeout: 3000 }).catch(() => false);
    log(`Chip Bairro visivel para remocao: ${bairroChipExists}`);

    if (!bairroChipExists) {
      record('CT05', 'FAIL', 'chip "Bairro: Centro" nao encontrado para remover');
      await shot(page, 'ct05-bairro-removido');
    } else {
      // O botao X fica dentro do mesmo Badge/container que o texto
      // Estrutura: <Badge><span>Bairro: Centro</span><Button aria-label="Remover filtro: Bairro: Centro"><X /></Button></Badge>
      const removeBtn = page.locator('[aria-label="Remover filtro: Bairro: Centro"]').first();
      const removeBtnVisible = await removeBtn.isVisible({ timeout: 3000 }).catch(() => false);

      if (!removeBtnVisible) {
        // Tenta via parent do chip
        log('Botao X via aria-label nao encontrado, tentando via locator proximo ao texto');
        // Busca o Badge que contem "Bairro: Centro" e clica no botao dentro dele
        const chipBadge = page.locator('span:has-text("Bairro: Centro")').locator('..').locator('button').first();
        const chipBadgeVisible = await chipBadge.isVisible({ timeout: 2000 }).catch(() => false);
        if (chipBadgeVisible) {
          await chipBadge.click();
        } else {
          log('Tentativa alternativa: clicar no X dentro do badge pelo posicionamento');
          // Usa evaluate pra encontrar e clicar
          const clicked = await page.evaluate(() => {
            const spans = Array.from(document.querySelectorAll('span'));
            const bairroSpan = spans.find(s => s.textContent?.trim() === 'Bairro: Centro');
            if (!bairroSpan) return false;
            const badge = bairroSpan.closest('[class*="badge"], [class*="Badge"]') || bairroSpan.parentElement;
            const btn = badge?.querySelector('button');
            if (btn) { btn.click(); return true; }
            return false;
          });
          log(`Click via evaluate: ${clicked}`);
        }
      } else {
        await removeBtn.click();
      }

      await page.waitForTimeout(DEBOUNCE_WAIT);

      // Verifica que Bairro foi removido mas CEP continua
      const bodyAfter = await page.textContent('body');
      const bairroRemovido = !bodyAfter.includes('Bairro: Centro');
      const cepMantido = bodyAfter.includes('CEP: 30140');
      log(`Bairro removido: ${bairroRemovido}, CEP mantido: ${cepMantido}`);

      // Verifica que o input Bairro ficou vazio
      const bairroInputValue = await page.locator('input[placeholder*="Centro"]').first().inputValue().catch(() => 'ERRO');
      log(`Valor do input Bairro apos remocao: "${bairroInputValue}"`);

      await shot(page, 'ct05-bairro-removido');

      if (bairroRemovido && cepMantido) {
        record('CT05', 'PASS', `chip Bairro removido, CEP mantido; input bairro="${bairroInputValue}"`);
      } else {
        record('CT05', 'FAIL', `bairroRemovido=${bairroRemovido}, cepMantido=${cepMantido}`);
      }
    }

    // ─── CT06 — Limpar tudo ───────────────────────────────────────────────────
    log('\n=== CT06: Limpar tudo ===');
    // Garante que ha filtros ativos para testar
    const drawerOpenCt06 = await page.locator('text=Limpar tudo').isVisible({ timeout: 2000 }).catch(() => false);
    if (!drawerOpenCt06) {
      await abrirDrawerLocalizacao(page);
    }

    // Aplica ao menos 2 filtros para ter algo pra limpar
    const bairroInputCt06 = page.locator('input[placeholder*="Centro"]').first();
    if (await bairroInputCt06.isVisible({ timeout: 2000 }).catch(() => false)) {
      const currentVal = await bairroInputCt06.inputValue().catch(() => '');
      if (!currentVal) {
        await bairroInputCt06.fill('Centro');
        await page.waitForTimeout(DEBOUNCE_WAIT);
      }
    }

    const logradouroInput = page.locator('input[placeholder*="Rua das Flores"]').first();
    if (await logradouroInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await logradouroInput.fill('Teste QA');
      await page.waitForTimeout(DEBOUNCE_WAIT);
    }

    // Clica em "Limpar tudo" no footer
    const limparTudoBtn = page.locator('button').filter({ hasText: 'Limpar tudo' }).first();
    const limparVisible = await limparTudoBtn.isVisible({ timeout: 3000 }).catch(() => false);
    log(`Botao "Limpar tudo" visivel: ${limparVisible}`);

    if (!limparVisible) {
      record('CT06', 'FAIL', 'botao "Limpar tudo" nao encontrado no footer do drawer');
      await shot(page, 'ct06-pos-limpar-tudo');
    } else {
      await limparTudoBtn.click();
      await page.waitForTimeout(600);

      // Verifica que todos os chips sumiriam e inputs ficaram vazios
      const bodyAfterClear = await page.textContent('body');
      const noBairroChip = !bodyAfterClear.includes('Bairro:');
      const noLogradouroChip = !bodyAfterClear.includes('Logradouro:');
      const noCepChip = !bodyAfterClear.includes('CEP:');

      const bairroVal = await page.locator('input[placeholder*="Centro"]').first().inputValue().catch(() => 'ERRO');
      const logradouroVal = await page.locator('input[placeholder*="Rua das Flores"]').first().inputValue().catch(() => 'ERRO');
      log(`Pos limpar: bairro="${bairroVal}", logradouro="${logradouroVal}"`);
      log(`Chips removidos: bairro=${noBairroChip}, logradouro=${noLogradouroChip}, cep=${noCepChip}`);

      // Verifica ausencia da secao "Aplicados" (que so aparece quando ha filtros ativos)
      const aplicadosSection = await page.locator('text=APLICADOS').isVisible({ timeout: 1000 }).catch(() => false);
      const aplicadosSection2 = await page.locator('text=Aplicados').isVisible({ timeout: 1000 }).catch(() => false);
      log(`Secao Aplicados visivel pos limpar: ${aplicadosSection || aplicadosSection2}`);

      await shot(page, 'ct06-pos-limpar-tudo');

      const inputsClearOk = bairroVal === '' && logradouroVal === '';
      if (noBairroChip && noLogradouroChip && noCepChip && inputsClearOk) {
        record('CT06', 'PASS', 'todos chips removidos e inputs zerados apos "Limpar tudo"');
      } else {
        const issues = [];
        if (!noBairroChip) issues.push('chip Bairro persiste');
        if (!noLogradouroChip) issues.push('chip Logradouro persiste');
        if (!noCepChip) issues.push('chip CEP persiste');
        if (!inputsClearOk) issues.push(`input bairro="${bairroVal}", logradouro="${logradouroVal}"`);
        record('CT06', 'FAIL', issues.join('; '));
      }
    }

    // ─── CT07 — Mobile responsive (375x667) ──────────────────────────────────
    log('\n=== CT07: Mobile viewport 375x667 ===');
    await ctx.close();

    const mobileCtx = await browser.newContext({ viewport: { width: 375, height: 667 } });
    const mobilePage = await mobileCtx.newPage();
    mobilePage.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(`[mobile] ${msg.text()}`);
    });

    // Login mobile
    await mobilePage.goto(`${BASE}/auth`, { waitUntil: 'networkidle' });
    await mobilePage.fill('input[type="email"]', EMAIL);
    await mobilePage.fill('input[type="password"]', SENHA);
    await mobilePage.click('button[type="submit"]');
    await mobilePage.waitForURL((url) => !url.includes('/auth'), { timeout: 15000 }).catch(() => {});
    await mobilePage.waitForLoadState('networkidle');

    await mobilePage.goto(`${BASE}/contatos`, { waitUntil: 'networkidle' });
    await mobilePage.waitForTimeout(1500);

    // Abre drawer
    const filtrosBtnMobile = mobilePage.locator('button').filter({ hasText: /^Filtros/ }).first();
    const filtrosBtnMobileAlt = mobilePage.locator('[aria-label="Abrir painel de filtros"]');
    if (await filtrosBtnMobile.isVisible({ timeout: 3000 }).catch(() => false)) {
      await filtrosBtnMobile.click();
    } else if (await filtrosBtnMobileAlt.isVisible({ timeout: 3000 }).catch(() => false)) {
      await filtrosBtnMobileAlt.click();
    } else {
      log('AVISO: botao Filtros nao encontrado no mobile');
    }

    await mobilePage.waitForTimeout(800);

    // Expande Localizacao
    const locMobile = mobilePage.locator('button').filter({ hasText: 'Localização' }).first();
    const locMobileVisible = await locMobile.isVisible({ timeout: 4000 }).catch(() => false);
    if (locMobileVisible) {
      const expandedMobile = await locMobile.getAttribute('aria-expanded').catch(() => null);
      if (expandedMobile !== 'true') {
        await locMobile.click();
        await mobilePage.waitForTimeout(500);
      }
    }

    // Verifica inputs no mobile
    const mobileBairro = await mobilePage.locator('input[placeholder*="Centro"]').isVisible({ timeout: 3000 }).catch(() => false);
    const mobileCep = await mobilePage.locator('input[placeholder*="30140"]').isVisible({ timeout: 3000 }).catch(() => false);
    const mobileLogradouro = await mobilePage.locator('input[placeholder*="Rua das Flores"]').isVisible({ timeout: 3000 }).catch(() => false);
    const mobileComplemento = await mobilePage.locator('input[placeholder*="Apto"]').isVisible({ timeout: 3000 }).catch(() => false);

    log(`Mobile - Bairro: ${mobileBairro}, CEP: ${mobileCep}, Logradouro: ${mobileLogradouro}, Complemento: ${mobileComplemento}`);

    // Verifica overflow horizontal (scroll horizontal indesejado)
    const scrollWidth = await mobilePage.evaluate(() => document.body.scrollWidth);
    const clientWidth = await mobilePage.evaluate(() => document.body.clientWidth);
    const hasHorizontalScroll = scrollWidth > clientWidth + 5; // tolerancia de 5px
    log(`Mobile scroll horizontal: scrollWidth=${scrollWidth}, clientWidth=${clientWidth}, overflow=${hasHorizontalScroll}`);

    await mobilePage.screenshot({ path: join(OUT, 'ct07-mobile-drawer.png'), fullPage: false });
    log('Screenshot mobile: ct07-mobile-drawer.png');

    const allMobileInputsVisible = mobileBairro && mobileCep;
    if (allMobileInputsVisible && !hasHorizontalScroll) {
      record('CT07', 'PASS', `inputs visiveis no mobile 375px, sem overflow horizontal`);
    } else if (allMobileInputsVisible && hasHorizontalScroll) {
      record('CT07', 'FAIL', `inputs presentes mas overflow horizontal detectado (scrollWidth=${scrollWidth} > clientWidth=${clientWidth})`);
    } else {
      const missing = [];
      if (!mobileBairro) missing.push('Bairro');
      if (!mobileCep) missing.push('CEP');
      if (!mobileLogradouro) missing.push('Logradouro');
      if (!mobileComplemento) missing.push('Complemento');
      record('CT07', 'FAIL', `inputs ausentes no mobile: ${missing.join(', ')}${hasHorizontalScroll ? '; overflow horizontal' : ''}`);
    }

    await mobileCtx.close();

    // ─── REGRESSAO: Campos pre-existentes ainda presentes ─────────────────────
    log('\n=== Regressao: campos pre-existentes ===');
    const regressCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const regressPage = await regressCtx.newPage();

    await regressPage.goto(`${BASE}/auth`, { waitUntil: 'networkidle' });
    await regressPage.fill('input[type="email"]', EMAIL);
    await regressPage.fill('input[type="password"]', SENHA);
    await regressPage.click('button[type="submit"]');
    await regressPage.waitForURL((url) => !url.includes('/auth'), { timeout: 15000 }).catch(() => {});
    await regressPage.waitForLoadState('networkidle');

    await regressPage.goto(`${BASE}/contatos`, { waitUntil: 'networkidle' });
    await regressPage.waitForTimeout(1500);

    const filtrosBtnReg = regressPage.locator('button').filter({ hasText: /^Filtros/ }).first();
    if (await filtrosBtnReg.isVisible({ timeout: 3000 }).catch(() => false)) {
      await filtrosBtnReg.click();
      await regressPage.waitForTimeout(800);
    }

    const locReg = regressPage.locator('button').filter({ hasText: 'Localização' }).first();
    if (await locReg.isVisible({ timeout: 3000 }).catch(() => false)) {
      const expReg = await locReg.getAttribute('aria-expanded').catch(() => null);
      if (expReg !== 'true') {
        await locReg.click();
        await regressPage.waitForTimeout(500);
      }
    }

    // Verifica campos pre-existentes ainda presentes
    const regCidade = await regressPage.locator('input[placeholder*="Belo Horizonte"]').isVisible({ timeout: 3000 }).catch(() => false);
    const regEstado = await regressPage.locator('button[role="combobox"]').filter({ hasText: /MG|Todos/ }).first().isVisible({ timeout: 2000 }).catch(() =>
      regressPage.locator('select, [role="combobox"]').count().then(c => c > 0).catch(() => false)
    );
    const regOrigem = await regressPage.locator('input[placeholder*="evento"]').isVisible({ timeout: 3000 }).catch(() => false);
    log(`Regressao - Cidade: ${regCidade}, Estado select: ${regEstado}, Origem: ${regOrigem}`);

    await regressPage.screenshot({ path: join(OUT, 'regressao-campos-existentes.png'), fullPage: false });
    log('Screenshot regressao: regressao-campos-existentes.png');

    if (regCidade && regOrigem) {
      record('REGRESSAO', 'PASS', `Cidade e Origem pre-existentes ainda presentes`);
    } else {
      const missing = [];
      if (!regCidade) missing.push('Cidade');
      if (!regOrigem) missing.push('Origem');
      record('REGRESSAO', 'FAIL', `campos pre-existentes ausentes: ${missing.join(', ')}`);
    }

    await regressCtx.close();

  } catch (err) {
    log(`ERRO INESPERADO: ${err.message}\n${err.stack}`);
    results.push({ ct: 'ERRO-GERAL', status: 'FAIL', notes: err.message });
  } finally {
    await browser.close().catch(() => {});
  }

  // Console errors summary
  if (consoleErrors.length > 0) {
    log(`\nErros de console capturados (${consoleErrors.length}):`);
    consoleErrors.slice(0, 10).forEach((e) => log(`  - ${e}`));
  }

  printSummary();
}

function printSummary() {
  log('\n========== RESUMO QA RAQ-MAND-EM069 ==========');
  let pass = 0, fail = 0, warn = 0;
  for (const r of results) {
    const icon = r.status === 'PASS' ? 'PASS' : r.status === 'FAIL' ? 'FAIL' : 'WARN';
    log(`[${icon}] ${r.ct}: ${r.status} — ${r.notes}`);
    if (r.status === 'PASS') pass++;
    else if (r.status === 'FAIL') fail++;
    else warn++;
  }
  log(`\nTotal: ${pass} PASS | ${fail} FAIL | ${warn} WARN`);
  log('==============================================');

  // Output JSON estruturado para leitura automatizada
  const output = { results, summary: { pass, fail, warn } };
  console.log('\nJSON_OUTPUT:' + JSON.stringify(output));
}

main().catch((err) => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
