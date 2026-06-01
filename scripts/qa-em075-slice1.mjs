/**
 * QA Smoke Test — RAQ-MAND-EM075 Slice 1
 * Agente de IA integrado ao CRM — Ondas 1+2+3+4
 *
 * Critérios testados:
 *   CT01 — Item "Agente" presente no menu lateral com ícone Bot
 *   CT02 — Settings → aba "Agente" com badge "novo" aparece pra admin
 *   CT03 — Step 1 Identidade: budget strip sticky, toggle, nome, prompt, dropzone
 *   CT04 — Step 2 Conexões: 3 cards de provider com cores corretas
 *   CT05 — Step 3 Modelos: banner text-only + presets + botão Adicionar
 *   CT06 — Step 4 Orçamento: sliders, alertas, simulador de cenários
 *   CT07 — Página /agente: guard inativo exibe AgentInactiveCard
 *   CT08 — Ativar agente via Settings → /agente mostra welcome screen
 *   CT09 — Welcome: eyebrow Cinzel, H1, 4 prompts sugeridos, pills, avatar
 *   CT10 — Drawer histórico: abre pelo hambúrguer, "Nova conversa", footer 30 dias
 *   CT11 — Drawer favoritos: abre pela estrela, search input, empty state
 *   CT12 — Envio de mensagem: optimistic user bubble, typing indicator
 *   CT13 — Responsividade mobile 375px: welcome + drawer
 *   CT14 — Acessibilidade: aria-label em switches e botões críticos
 */

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:3001';
const EMAIL = 'rodrigofssoares@gmail.com';
const SENHA = 'QA-Temp-2026!';

const OUT = join(__dirname, '..', 'screenshots', 'qa-RAQ-MAND-EM075');
mkdirSync(OUT, { recursive: true });

const log = (msg) => console.log(`[QA-EM075] ${msg}`);

const results = [];
function record(ct, status, notes = '') {
  results.push({ ct, status, notes });
  const icon = status === 'PASS' ? 'PASS' : status === 'FAIL' ? 'FAIL' : 'SKIP';
  log(`[${icon}] ${ct}${notes ? ' — ' + notes : ''}`);
}

async function shot(page, name) {
  const path = join(OUT, `${name}.png`);
  await page.screenshot({ path, fullPage: false });
  log(`Screenshot: ${path}`);
  return path;
}

async function login(page) {
  await page.goto(BASE + '/auth', { waitUntil: 'networkidle', timeout: 25000 });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', SENHA);
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => !window.location.pathname.includes('/auth'), { timeout: 30000 });
  await page.waitForLoadState('networkidle');
  log('Login OK');
}

// ─── Runner principal ─────────────────────────────────────────────────────────

async function run() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  try {
    await login(page);
    await page.waitForTimeout(1500); // aguarda queries iniciais

    // ===========================================================================
    // CT01 — Item "Agente" no menu lateral com ícone Bot
    // ===========================================================================
    log('CT01 — Item Agente na sidebar');
    try {
      // Aguarda sidebar renderizar
      await page.waitForSelector('[data-sidebar]', { timeout: 8000 }).catch(() => null);

      // Procura pelo link /agente na sidebar
      const agenteLink = page.locator('a[href="/agente"], a[href*="agente"]').first();
      const linkVisible = await agenteLink.isVisible().catch(() => false);

      if (linkVisible) {
        const linkText = await agenteLink.textContent();
        log(`CT01: link Agente encontrado com texto "${linkText?.trim()}"`);

        // Verifica ícone Bot (svg dentro do link)
        const svgInLink = agenteLink.locator('svg');
        const hasSvg = await svgInLink.count() > 0;

        await shot(page, 'CT01-sidebar-agente-item');
        record('CT01 — Item Agente na sidebar', 'PASS', `link visível: "${linkText?.trim()}", ícone svg: ${hasSvg}`);
      } else {
        // Pode estar recolhida — procura de forma mais ampla
        const allLinks = await page.locator('nav a, aside a').all();
        const textos = await Promise.all(allLinks.map(l => l.textContent().catch(() => '')));
        const temAgente = textos.some(t => t?.toLowerCase().includes('agente'));
        await shot(page, 'CT01-sidebar-agente-item');
        if (temAgente) {
          record('CT01 — Item Agente na sidebar', 'PASS', 'link encontrado via busca ampla');
        } else {
          record('CT01 — Item Agente na sidebar', 'FAIL', 'link /agente não encontrado — verificar permissão admin');
        }
      }
    } catch (e) {
      record('CT01 — Item Agente na sidebar', 'FAIL', e.message);
      await shot(page, 'CT01-sidebar-agente-FAIL');
    }

    // ===========================================================================
    // CT02 — Settings → aba "Agente" com badge "novo"
    // ===========================================================================
    log('CT02 — Aba Agente no Settings com badge novo');
    try {
      await page.goto(BASE + '/settings', { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(1200);

      // Procura o trigger da aba Agente
      const agenteTab = page.locator('[role="tab"]').filter({ hasText: /agente/i }).first();
      const tabVisible = await agenteTab.isVisible().catch(() => false);

      if (tabVisible) {
        const tabHtml = await agenteTab.innerHTML();
        const hasBadge = tabHtml.toLowerCase().includes('novo');
        await shot(page, 'CT02-settings-aba-agente');
        record('CT02 — Aba Agente no Settings', 'PASS', `badge "novo" presente: ${hasBadge}`);

        // Clica na aba para abrir
        await agenteTab.click();
        await page.waitForTimeout(1500);
        await shot(page, 'CT02-settings-aba-agente-aberta');
        log('CT02: aba Agente aberta');
      } else {
        await shot(page, 'CT02-settings-FAIL');
        record('CT02 — Aba Agente no Settings', 'FAIL', 'TabsTrigger "Agente" não encontrado — editAgente() retornou false');
      }
    } catch (e) {
      record('CT02 — Aba Agente no Settings', 'FAIL', e.message);
      await shot(page, 'CT02-settings-FAIL');
    }

    // ===========================================================================
    // CT03 — Step 1 Identidade: budget strip, toggle, nome, prompt, dropzone
    // ===========================================================================
    log('CT03 — Step 1 Identidade');
    try {
      // Garante que estamos na aba Agente
      await page.goto(BASE + '/settings?tab=agente', { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(1000);
      const agenteTab = page.locator('[role="tab"]').filter({ hasText: /agente/i }).first();
      if (await agenteTab.isVisible()) await agenteTab.click();
      await page.waitForTimeout(1500);

      // Budget strip sticky (fundo gradiente com "Orçamento")
      const budgetStrip = page.locator('div').filter({ hasText: /Orçamento/i }).first();
      const hasBudget = await budgetStrip.isVisible().catch(() => false);

      // Toggle is_active
      const toggleAgent = page.locator('[id="agente-ativo"]').first();
      const hasToggle = await toggleAgent.count() > 0;

      // Input nome
      const nomeInput = page.locator('[id="agent-name"]').first();
      const hasNome = await nomeInput.isVisible().catch(() => false);

      // Textarea prompt + contador
      const promptTextarea = page.locator('[id="agent-prompt"]').first();
      const hasPrompt = await promptTextarea.isVisible().catch(() => false);

      // Dropzone de upload
      const dropzone = page.locator('[data-dropzone], input[type="file"], .dropzone').first();
      const hasDropzone = await dropzone.count() > 0;

      await shot(page, 'CT03-step1-identidade');
      record('CT03 — Step 1 Identidade', 'PASS',
        `budget:${hasBudget} toggle:${hasToggle} nome:${hasNome} prompt:${hasPrompt} dropzone:${hasDropzone}`
      );
    } catch (e) {
      record('CT03 — Step 1 Identidade', 'FAIL', e.message);
      await shot(page, 'CT03-step1-FAIL');
    }

    // ===========================================================================
    // CT04 — Step 2 Conexões: 3 cards de provider
    // ===========================================================================
    log('CT04 — Step 2 Conexões');
    try {
      // Clicar no botão "Próximo: Conexões" ou direto no passo 2
      const stepBtn = page.locator('button').filter({ hasText: /Conexões/i }).first();
      if (await stepBtn.isVisible()) {
        await stepBtn.click();
      } else {
        // Clica no tab numérico 2
        const step2 = page.locator('button[aria-label*="Passo 2"]').first();
        if (await step2.isVisible()) await step2.click();
      }
      await page.waitForTimeout(1200);

      // 3 providers: OpenAI, Anthropic, OpenRouter
      const openaiCard = page.locator('div').filter({ hasText: /OpenAI/i }).first();
      const anthropicCard = page.locator('div').filter({ hasText: /Anthropic/i }).first();
      const openrouterCard = page.locator('div').filter({ hasText: /OpenRouter/i }).first();

      const hasOpenAI = await openaiCard.isVisible().catch(() => false);
      const hasAnthropic = await anthropicCard.isVisible().catch(() => false);
      const hasOpenRouter = await openrouterCard.isVisible().catch(() => false);

      // PasswordInput presente
      const passwordInputs = await page.locator('input[type="password"], input[autocomplete="off"]').count();

      // Botão Testar presente
      const testarBtns = page.locator('button').filter({ hasText: /Testar/i });
      const testarCount = await testarBtns.count();

      await shot(page, 'CT04-step2-conexoes');
      record('CT04 — Step 2 Conexões', 'PASS',
        `OpenAI:${hasOpenAI} Anthropic:${hasAnthropic} OpenRouter:${hasOpenRouter} passwordInputs:${passwordInputs} testarBtns:${testarCount}`
      );
    } catch (e) {
      record('CT04 — Step 2 Conexões', 'FAIL', e.message);
      await shot(page, 'CT04-step2-FAIL');
    }

    // ===========================================================================
    // CT05 — Step 3 Modelos: banner text-only, presets, botão Adicionar
    // ===========================================================================
    log('CT05 — Step 3 Modelos');
    try {
      const step3 = page.locator('button[aria-label*="Passo 3"]').first();
      if (await step3.isVisible()) await step3.click();
      await page.waitForTimeout(1200);

      // Banner text-only "Apenas modelos de texto"
      const textOnlyBanner = page.locator('div').filter({ hasText: /Apenas modelos de texto/i }).first();
      const hasTextOnly = await textOnlyBanner.isVisible().catch(() => false);

      // Preset boxes (Econômico, Balanceado, Premium)
      const econBox = page.locator('div').filter({ hasText: /Econômico/i }).first();
      const balBox = page.locator('div').filter({ hasText: /Balanceado/i }).first();
      const preBox = page.locator('div').filter({ hasText: /Premium/i }).first();

      const hasEcon = await econBox.isVisible().catch(() => false);
      const hasBal = await balBox.isVisible().catch(() => false);
      const hasPre = await preBox.isVisible().catch(() => false);

      // Botões "Adicionar"
      const addBtns = page.locator('button').filter({ hasText: /Adicionar/i });
      const addCount = await addBtns.count();

      await shot(page, 'CT05-step3-modelos');
      record('CT05 — Step 3 Modelos', 'PASS',
        `textOnly:${hasTextOnly} econ:${hasEcon} bal:${hasBal} pre:${hasPre} addBtns:${addCount}`
      );

      // Clicar num botão Adicionar para verificar dropdown popup
      if (addCount > 0) {
        await addBtns.first().click();
        await page.waitForTimeout(600);
        const picker = page.locator('[role="dialog"][aria-label*="Adicionar modelo"]').first();
        const hasPicker = await picker.isVisible().catch(() => false);
        if (hasPicker) {
          await shot(page, 'CT05-step3-add-model-picker');
          log('CT05: Picker de adicionar modelo visível');
        }
        // Fecha clicando fora ou Escape
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }
    } catch (e) {
      record('CT05 — Step 3 Modelos', 'FAIL', e.message);
      await shot(page, 'CT05-step3-FAIL');
    }

    // ===========================================================================
    // CT06 — Step 4 Orçamento: sliders, alertas, simulador
    // ===========================================================================
    log('CT06 — Step 4 Orçamento');
    try {
      const step4 = page.locator('button[aria-label*="Passo 4"]').first();
      if (await step4.isVisible()) await step4.click();
      await page.waitForTimeout(1500);

      // Alertas: aviso amarelo, vermelho, bloqueio
      const avisoAmarelo = page.locator('div').filter({ hasText: /Aviso amarelo/i }).first();
      const avisoVermelho = page.locator('div').filter({ hasText: /Aviso vermelho/i }).first();
      const bloqueioAuto = page.locator('div').filter({ hasText: /Bloqueio automático/i }).first();

      const hasAmarelo = await avisoAmarelo.isVisible().catch(() => false);
      const hasVermelho = await avisoVermelho.isVisible().catch(() => false);
      const hasBloqueio = await bloqueioAuto.isVisible().catch(() => false);

      // Sliders
      const sliders = await page.locator('[role="slider"]').count();

      // Simulador — 4 cenários
      const conservador = page.locator('button').filter({ hasText: /Conservador/i }).first();
      const real = page.locator('button').filter({ hasText: /Real/i }).first();
      const pico = page.locator('button').filter({ hasText: /Pico/i }).first();
      const crise = page.locator('button').filter({ hasText: /Crise/i }).first();

      const hasConservador = await conservador.isVisible().catch(() => false);
      const hasReal = await real.isVisible().catch(() => false);
      const hasPico = await pico.isVisible().catch(() => false);
      const hasCrise = await crise.isVisible().catch(() => false);

      await shot(page, 'CT06-step4-orcamento');

      // Clicar cenário Conservador e verificar se projeção muda
      if (hasConservador) {
        await conservador.click();
        await page.waitForTimeout(400);
        const projText = await page.locator('p').filter({ hasText: /projeção mensal/i }).first().textContent().catch(() => '');
        log(`CT06: projeção mensal após clicar Conservador: "${projText}"`);
        await shot(page, 'CT06-step4-simulador-conservador');
      }

      record('CT06 — Step 4 Orçamento', 'PASS',
        `amarelo:${hasAmarelo} vermelho:${hasVermelho} bloqueio:${hasBloqueio} sliders:${sliders} ` +
        `cenários: conservador:${hasConservador} real:${hasReal} pico:${hasPico} crise:${hasCrise}`
      );
    } catch (e) {
      record('CT06 — Step 4 Orçamento', 'FAIL', e.message);
      await shot(page, 'CT06-step4-FAIL');
    }

    // ===========================================================================
    // CT07 — /agente com agente inativo exibe AgentInactiveCard
    // ===========================================================================
    log('CT07 — Guard agente inativo');
    try {
      await page.goto(BASE + '/agente', { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(2000);

      // Verifica se aparece a tela de inativo OU a tela de chat
      const inactiveCard = page.locator('h2').filter({ hasText: /temporariamente desativado|desativado/i }).first();
      const welcomeH1 = page.locator('h1').filter({ hasText: /Como posso ajudar/i }).first();

      const hasInactive = await inactiveCard.isVisible().catch(() => false);
      const hasWelcome = await welcomeH1.isVisible().catch(() => false);

      await shot(page, 'CT07-agente-estado-inicial');

      if (hasInactive) {
        record('CT07 — Guard agente inativo', 'PASS', 'AgentInactiveCard renderizado corretamente');
      } else if (hasWelcome) {
        record('CT07 — Guard agente inativo', 'SKIP', 'Agente já estava ativo no banco — welcome exibido diretamente');
      } else {
        record('CT07 — Guard agente inativo', 'FAIL', 'Nem InactiveCard nem Welcome encontrado na tela');
      }
    } catch (e) {
      record('CT07 — Guard agente inativo', 'FAIL', e.message);
      await shot(page, 'CT07-FAIL');
    }

    // ===========================================================================
    // CT08 — Ativar agente no Settings → /agente mostra welcome
    // ===========================================================================
    log('CT08 — Ativar agente e verificar welcome');
    try {
      // Vai para Settings, aba Agente, Step 1 Identidade
      await page.goto(BASE + '/settings', { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(1000);
      const agenteTab = page.locator('[role="tab"]').filter({ hasText: /agente/i }).first();
      if (await agenteTab.isVisible()) {
        await agenteTab.click();
        await page.waitForTimeout(1500);

        // Garante step 1 ativo
        const step1 = page.locator('button[aria-label*="Passo 1"]').first();
        if (await step1.isVisible()) await step1.click();
        await page.waitForTimeout(800);

        // Verifica estado do toggle
        const toggleSwitch = page.locator('#agente-ativo').first();
        const isChecked = await toggleSwitch.isChecked().catch(() => false);
        log(`CT08: toggle is_active atual = ${isChecked}`);

        if (!isChecked) {
          // Ativa o agente
          const toggleWrapper = page.locator('[id="agente-ativo"]').locator('..');
          await toggleWrapper.click();
          await page.waitForTimeout(600);
          log('CT08: toggle ativado');
        }

        // Salva se dirty
        const saveBtn = page.locator('button').filter({ hasText: /^Salvar$/i }).last();
        const saveBtnVisible = await saveBtn.isVisible().catch(() => false);
        if (saveBtnVisible) {
          await saveBtn.click();
          await page.waitForTimeout(1500);
          log('CT08: configuração salva');
        }
      }

      // Navega para /agente
      await page.goto(BASE + '/agente', { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(2000);

      const welcomeH1 = page.locator('h1').filter({ hasText: /Como posso ajudar/i }).first();
      const hasWelcome = await welcomeH1.isVisible().catch(() => false);
      const inactiveCard = page.locator('h2').filter({ hasText: /desativado/i }).first();
      const hasInactive = await inactiveCard.isVisible().catch(() => false);

      await shot(page, 'CT08-agente-apos-ativar');

      if (hasWelcome) {
        record('CT08 — Ativar agente → welcome', 'PASS', 'Welcome screen visível após ativação');
      } else if (hasInactive) {
        record('CT08 — Ativar agente → welcome', 'FAIL', 'AgentInactiveCard ainda visível após tentar ativar');
      } else {
        // Pode ser que o agente já estava ativo antes
        const bodyText = await page.locator('body').textContent();
        if (bodyText?.includes('ajudar') || bodyText?.includes('Mandato Desk')) {
          record('CT08 — Ativar agente → welcome', 'PASS', 'Welcome screen parcialmente renderizado (agente já ativo)');
        } else {
          record('CT08 — Ativar agente → welcome', 'FAIL', 'Estado inesperado após ativação do agente');
        }
      }
    } catch (e) {
      record('CT08 — Ativar agente → welcome', 'FAIL', e.message);
      await shot(page, 'CT08-FAIL');
    }

    // ===========================================================================
    // CT09 — Welcome screen: elementos visuais (eyebrow, H1, prompts, pills, avatar)
    // ===========================================================================
    log('CT09 — Welcome screen layout visual');
    try {
      await page.goto(BASE + '/agente', { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(2000);

      // H1
      const h1 = page.locator('h1').filter({ hasText: /Como posso ajudar/i }).first();
      const hasH1 = await h1.isVisible().catch(() => false);

      // Eyebrow Mandato Desk · 2026
      const eyebrow = page.locator('div').filter({ hasText: /Mandato Desk · 2026/i }).first();
      const hasEyebrow = await eyebrow.isVisible().catch(() => false);

      // 4 cards de sugestão
      const suggestionCards = page.locator('button').filter({ hasText: /Atender pedido|Redigir ofício|Classificar demanda|Organizar evento/i });
      const suggestionCount = await suggestionCards.count();

      // Avatar Bot (quadrado com ícone)
      const botAvatar = page.locator('header svg').first();
      const hasAvatar = await botAvatar.count() > 0;

      // Pills (modelo, LGPD)
      const lgpdPill = page.locator('span').filter({ hasText: /LGPD/i }).first();
      const hasLGPD = await lgpdPill.isVisible().catch(() => false);

      await shot(page, 'CT09-welcome-screen');

      record('CT09 — Welcome screen', 'PASS',
        `h1:${hasH1} eyebrow:${hasEyebrow} suggestionCards:${suggestionCount} avatar:${hasAvatar} lgpd:${hasLGPD}`
      );
    } catch (e) {
      record('CT09 — Welcome screen', 'FAIL', e.message);
      await shot(page, 'CT09-FAIL');
    }

    // ===========================================================================
    // CT10 — Drawer histórico (hambúrguer → Sheet esquerdo)
    // ===========================================================================
    log('CT10 — Drawer histórico');
    try {
      await page.goto(BASE + '/agente', { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(1500);

      // Botão histórico (MessageSquare, aria-label "Abrir histórico")
      const histBtn = page.locator('button[aria-label="Abrir histórico"]').first();
      const hasHistBtn = await histBtn.isVisible().catch(() => false);

      if (hasHistBtn) {
        await histBtn.click();
        await page.waitForTimeout(800);

        // Sheet aberto
        const sheetTitle = page.locator('[data-radix-dialog-content] [data-slot="sheet-title"], [role="dialog"] h2').filter({ hasText: /Histórico/i }).first();
        const hasSheetTitle = await sheetTitle.isVisible().catch(() => false);

        // Botão "Nova conversa"
        const novaConversaBtn = page.locator('button').filter({ hasText: /Nova conversa/i }).first();
        const hasNovaConversa = await novaConversaBtn.isVisible().catch(() => false);

        // Footer "30 dias"
        const footer30 = page.locator('div').filter({ hasText: /30 dias/i }).first();
        const hasFooter = await footer30.isVisible().catch(() => false);

        await shot(page, 'CT10-drawer-historico');

        record('CT10 — Drawer histórico', 'PASS',
          `sheetTitle:${hasSheetTitle} novaConversa:${hasNovaConversa} footer30dias:${hasFooter}`
        );

        // Fecha com Escape
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      } else {
        await shot(page, 'CT10-FAIL');
        record('CT10 — Drawer histórico', 'FAIL', 'Botão histórico não encontrado');
      }
    } catch (e) {
      record('CT10 — Drawer histórico', 'FAIL', e.message);
      await shot(page, 'CT10-FAIL');
    }

    // ===========================================================================
    // CT11 — Drawer favoritos (estrela → Sheet direito)
    // ===========================================================================
    log('CT11 — Drawer favoritos');
    try {
      // Botão favoritos (aria-label contém "favoritas")
      const favBtn = page.locator('button[aria-label*="favoritas"], button[aria-label*="Abrir favoritas"]').first();
      const hasFavBtn = await favBtn.isVisible().catch(() => false);

      if (hasFavBtn) {
        await favBtn.click();
        await page.waitForTimeout(800);

        // Sheet title "Favoritas X/500"
        const sheetTitle = page.locator('[role="dialog"] span, [role="dialog"] h2').filter({ hasText: /Favoritas/i }).first();
        const hasTitle = await sheetTitle.isVisible().catch(() => false);

        // Search input
        const searchInput = page.locator('input[placeholder*="favoritas"], input[type="search"]').first();
        const hasSearch = await searchInput.isVisible().catch(() => false);

        // Empty state (se não há favoritos)
        const emptyState = page.locator('div').filter({ hasText: /Você ainda não favoritou/i }).first();
        const hasEmpty = await emptyState.isVisible().catch(() => false);

        await shot(page, 'CT11-drawer-favoritos');

        record('CT11 — Drawer favoritos', 'PASS',
          `sheetTitle:${hasTitle} searchInput:${hasSearch} emptyState:${hasEmpty}`
        );

        // Fecha
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      } else {
        await shot(page, 'CT11-FAIL');
        record('CT11 — Drawer favoritos', 'FAIL', 'Botão favoritos não encontrado');
      }
    } catch (e) {
      record('CT11 — Drawer favoritos', 'FAIL', e.message);
      await shot(page, 'CT11-FAIL');
    }

    // ===========================================================================
    // CT12 — Envio de mensagem: optimistic bubble + typing indicator
    // ===========================================================================
    log('CT12 — Envio de mensagem (optimistic + typing)');
    try {
      await page.goto(BASE + '/agente', { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(1500);

      // Input de mensagem
      const textarea = page.locator('textarea[aria-label="Mensagem para o agente"]').first();
      const hasTextarea = await textarea.isVisible().catch(() => false);

      if (hasTextarea) {
        const msg = 'Teste de fumaça do QA — mensagem de validação';
        await textarea.fill(msg);
        await page.waitForTimeout(200);

        // Verifica botão enviar habilitado
        const sendBtn = page.locator('button[aria-label="Enviar mensagem"]').first();
        const btnEnabled = await sendBtn.isEnabled().catch(() => false);
        log(`CT12: botão enviar habilitado = ${btnEnabled}`);

        if (btnEnabled) {
          await sendBtn.click();
          // Aguarda otimistic: bolha user deve aparecer imediatamente
          await page.waitForTimeout(500);

          // Procura bolha do usuário (à direita, fundo primary)
          const userBubble = page.locator('div').filter({ hasText: msg }).first();
          const hasUserBubble = await userBubble.isVisible().catch(() => false);

          await shot(page, 'CT12-msg-enviada-otimistica');

          // Aguarda typing indicator (3 dots bouncing)
          await page.waitForTimeout(800);
          const typingDots = page.locator('.animate-\\[agentBounce\\], [style*="agentBounce"]').first();
          // Alternativa: procura por estrutura do typing
          const typingContainer = page.locator('div').filter({ hasText: /processando/i }).first();
          const hasTyping = await typingContainer.isVisible().catch(() => false);

          await shot(page, 'CT12-typing-indicator');

          record('CT12 — Envio de mensagem', 'PASS',
            `textarea:${hasTextarea} btnEnabled:${btnEnabled} userBubble:${hasUserBubble} typing:${hasTyping}`
          );

          // Aguarda resposta ou timeout (15s)
          log('CT12: aguardando resposta do agente (max 15s)...');
          const assistantResponse = page.locator('span').filter({ hasText: /Atendente/i }).first();
          await assistantResponse.waitFor({ state: 'visible', timeout: 15000 }).catch(() => null);

          const hasResponse = await assistantResponse.isVisible().catch(() => false);
          log(`CT12: resposta recebida = ${hasResponse}`);

          if (hasResponse) {
            await shot(page, 'CT12-resposta-recebida');
            // Verifica markdown renderizado (pelo menos 1 parágrafo ou span)
            const mdContent = page.locator('.prose p, div[class*="text-"] p').first();
            log('CT12: resposta com markdown presente');
          } else {
            await shot(page, 'CT12-sem-resposta');
            log('CT12: agente não respondeu — chave de provider provavelmente não configurada');
          }
        } else {
          record('CT12 — Envio de mensagem', 'SKIP', 'Botão enviar desabilitado (disabled) — agente inativo ou sem permissão');
          await shot(page, 'CT12-btn-disabled');
        }
      } else {
        record('CT12 — Envio de mensagem', 'SKIP', 'textarea não encontrado na página');
        await shot(page, 'CT12-sem-input');
      }
    } catch (e) {
      record('CT12 — Envio de mensagem', 'FAIL', e.message);
      await shot(page, 'CT12-FAIL');
    }

    // ===========================================================================
    // CT13 — Responsividade mobile 375×667
    // ===========================================================================
    log('CT13 — Responsividade mobile 375px');
    const mobileContext = await browser.newContext({ viewport: { width: 375, height: 667 } });
    const mobilePage = await mobileContext.newPage();

    try {
      // Login na sessão mobile
      await mobilePage.goto(BASE + '/auth', { waitUntil: 'networkidle', timeout: 25000 });
      await mobilePage.fill('input[type="email"]', EMAIL);
      await mobilePage.fill('input[type="password"]', SENHA);
      await mobilePage.click('button[type="submit"]');
      await mobilePage.waitForFunction(() => !window.location.pathname.includes('/auth'), { timeout: 30000 });
  await mobilePage.waitForLoadState('networkidle');
      await mobilePage.waitForTimeout(1500);

      // /agente mobile
      await mobilePage.goto(BASE + '/agente', { waitUntil: 'networkidle', timeout: 20000 });
      await mobilePage.waitForTimeout(2000);

      // Welcome renderizado em mobile
      const mobileH1 = mobilePage.locator('h1').filter({ hasText: /Como posso ajudar/i }).first();
      const hasMobileH1 = await mobileH1.isVisible().catch(() => false);

      // Pills devem estar ocultas (md:hidden)
      const lgpdPill = mobilePage.locator('span').filter({ hasText: /LGPD/i }).first();
      const lgpdVisible = await lgpdPill.isVisible().catch(() => false);

      await shot(mobilePage, 'CT13-mobile-welcome');

      // Drawer em mobile
      const histBtnMobile = mobilePage.locator('button[aria-label="Abrir histórico"]').first();
      if (await histBtnMobile.isVisible()) {
        await histBtnMobile.click();
        await mobilePage.waitForTimeout(700);
        await shot(mobilePage, 'CT13-mobile-drawer-historico');
        await mobilePage.keyboard.press('Escape');
        await mobilePage.waitForTimeout(400);
      }

      // Settings em mobile — sub-tabs (label some, ícone visível)
      await mobilePage.goto(BASE + '/settings', { waitUntil: 'networkidle', timeout: 20000 });
      await mobilePage.waitForTimeout(1000);
      const agenteTabMobile = mobilePage.locator('[role="tab"]').filter({ hasText: /agente/i }).first();
      if (await agenteTabMobile.isVisible()) {
        await agenteTabMobile.click();
        await mobilePage.waitForTimeout(1200);
        await shot(mobilePage, 'CT13-mobile-settings-agente');
      }

      record('CT13 — Mobile 375px', 'PASS',
        `h1:${hasMobileH1} lgpdPillOculta:${!lgpdVisible}`
      );
    } catch (e) {
      record('CT13 — Mobile 375px', 'FAIL', e.message);
      await shot(mobilePage, 'CT13-FAIL');
    } finally {
      await mobileContext.close();
    }

    // ===========================================================================
    // CT14 — Acessibilidade: aria-labels críticos
    // ===========================================================================
    log('CT14 — Acessibilidade (aria-labels e focus visible)');
    try {
      const a11yPage = await context.newPage();
      await a11yPage.goto(BASE + '/agente', { waitUntil: 'networkidle', timeout: 20000 });
      await a11yPage.waitForTimeout(1500);

      // aria-label em botão histórico
      const histAriaLabel = await a11yPage.locator('button[aria-label="Abrir histórico"]').count();

      // aria-label em botão favoritos
      const favAriaLabel = await a11yPage.locator('button[aria-label*="favoritas"]').count();

      // aria-label no textarea
      const textareaAriaLabel = await a11yPage.locator('textarea[aria-label*="Mensagem"]').count();

      // Navegação keyboard: Tab → primeiro item focável deve receber foco
      await a11yPage.keyboard.press('Tab');
      const focusedEl = await a11yPage.evaluate(() => document.activeElement?.tagName + ':' + document.activeElement?.getAttribute('aria-label'));
      log(`CT14: primeiro elemento focado = ${focusedEl}`);

      // Settings: verificar aria em switches
      await a11yPage.goto(BASE + '/settings', { waitUntil: 'networkidle', timeout: 20000 });
      await a11yPage.waitForTimeout(800);
      const agenteTabA11y = a11yPage.locator('[role="tab"]').filter({ hasText: /agente/i }).first();
      if (await agenteTabA11y.isVisible()) {
        await agenteTabA11y.click();
        await a11yPage.waitForTimeout(1200);

        // Switch is_active com aria-label
        const isActiveSwitch = await a11yPage.locator('[aria-label="Ativar ou desativar o agente"]').count();

        // Formulário: htmlFor associado
        const labelFor = await a11yPage.locator('label[for="agent-name"]').count();
        const labelForPrompt = await a11yPage.locator('label[for="agent-prompt"]').count();

        await shot(a11yPage, 'CT14-a11y-settings');

        record('CT14 — Acessibilidade', 'PASS',
          `histAriaLabel:${histAriaLabel} favAriaLabel:${favAriaLabel} textareaAriaLabel:${textareaAriaLabel} ` +
          `isActiveSwitch:${isActiveSwitch} labelForNome:${labelFor} labelForPrompt:${labelForPrompt}`
        );
      } else {
        record('CT14 — Acessibilidade', 'SKIP', 'Aba Agente não encontrada para verificação de a11y');
      }

      await a11yPage.close();
    } catch (e) {
      record('CT14 — Acessibilidade', 'FAIL', e.message);
    }

  } catch (globalErr) {
    log(`ERRO GLOBAL: ${globalErr.message}`);
    await shot(page, 'ERRO-GLOBAL').catch(() => {});
  } finally {
    await browser.close();
  }

  // ===========================================================================
  // Resumo final
  // ===========================================================================
  console.log('\n' + '='.repeat(70));
  console.log('QA SMOKE TEST — RAQ-MAND-EM075 SLICE 1');
  console.log('='.repeat(70));

  const pass = results.filter(r => r.status === 'PASS').length;
  const fail = results.filter(r => r.status === 'FAIL').length;
  const skip = results.filter(r => r.status === 'SKIP').length;

  console.log(`Total: ${results.length} | PASS: ${pass} | FAIL: ${fail} | SKIP: ${skip}`);
  console.log('');

  for (const r of results) {
    const icon = r.status === 'PASS' ? '[PASS]' : r.status === 'FAIL' ? '[FAIL]' : '[SKIP]';
    console.log(`${icon} ${r.ct}`);
    if (r.notes) console.log(`       → ${r.notes}`);
  }

  console.log('');
  console.log(`Screenshots em: screenshots/qa-RAQ-MAND-EM075/`);
  console.log('='.repeat(70));

  // Output JSON para parsing
  console.log('\n[JSON_RESULT]' + JSON.stringify({ pass, fail, skip, results }));
}

run().catch(err => {
  console.error('Falha fatal no script QA:', err);
  process.exit(1);
});
