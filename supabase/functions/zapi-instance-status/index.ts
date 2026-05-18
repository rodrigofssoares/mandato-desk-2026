// Edge Function: zapi-instance-status
//
// Proxy de saúde — consulta o status de conexão de uma instância Z-API
// sem expor tokens ao frontend.
//
// Fluxo:
//   1. Valida JWT do chamador (requireAuth — qualquer perfil ATIVO).
//   2. Lê { account_id } do body.
//   3. Valida account_id como UUID.
//   4. Busca instance_id + instance_token + client_token via service_role.
//   5. Chama GET https://api.z-api.io/instances/{instance_id}/token/{instance_token}/status
//        Header: Client-Token: {client_token}
//   6. Normaliza a resposta e retorna APENAS { connected, state, needsQR }.
//      Nunca retorna tokens ou dados brutos.
//
// Resposta normalizada:
//   { connected: boolean, state: string, needsQR: boolean }
//
// Em caso de erro da Z-API ou timeout:
//   { connected: false, state: 'unknown', needsQR: false }
//
// Erros HTTP:
//   400 — account_id ausente ou UUID inválido
//   401 — sem JWT / JWT inválido
//   403 — perfil não autorizado
//   404 — conta não encontrada
//   500 — erro interno
//
// Segurança:
//   - instance_token e client_token NUNCA aparecem na resposta.
//   - Timeout de 8s no fetch para Z-API (evita EF pendurada).
//   - account_id validado como UUID (evita IDOR — não evita SSRF por si só).
//   - instance_id e instance_token validados contra ^[A-Za-z0-9]+$ antes do fetch
//     (defesa em profundidade contra SSRF: impede injeção de host alternativo na URL).
//   - Cada segmento de URL encapsulado com encodeURIComponent() como camada adicional.
//   - CHECK constraint de formato no banco (migration 060) rejeita valores maliciosos na origem.
//   - RLS verificada no service_role: conta deve existir no banco.
//
// Referência: RAQ-MAND-EM073 — Onda B, T27

import { corsHeaders, jsonResponse, requireAuth } from '../_shared/auth-guard.ts';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ZAPI_BASE = 'https://api.z-api.io/instances';

// Regex de formato válido para credenciais Z-API — defesa contra SSRF.
// instance_id: 4-64 caracteres alfanuméricos.
// instance_token: 8-128 caracteres alfanuméricos.
// CHECK constraints equivalentes existem no banco (migration 060).
const ZAPI_INSTANCE_ID_REGEX = /^[A-Za-z0-9]{4,64}$/;
const ZAPI_INSTANCE_TOKEN_REGEX = /^[A-Za-z0-9]{8,128}$/;

// Resposta normalizada — enviada ao frontend
interface InstanceStatus {
  connected: boolean;
  state: string;
  needsQR: boolean;
}

// Resposta bruta que a Z-API retorna no endpoint /status
interface ZapiStatusResponse {
  // A Z-API retorna { connected: boolean, smartphoneConnected: boolean, error: string | null }
  connected?: boolean;
  smartphoneConnected?: boolean;
  error?: string | null;
}

/** Normaliza a resposta bruta da Z-API para o shape { connected, state, needsQR }. */
function normalizeStatus(raw: ZapiStatusResponse): InstanceStatus {
  const connected = raw.connected === true;
  const phoneConnected = raw.smartphoneConnected === true;

  // Inferência do state a partir dos campos
  let state: string;
  let needsQR: boolean;

  if (connected && phoneConnected) {
    state = 'CONNECTED';
    needsQR = false;
  } else if (!connected && raw.error === null) {
    // Sem erro mas desconectado = aguardando QR ou reautenticação
    state = 'PAIRING';
    needsQR = true;
  } else if (!connected) {
    state = 'DISCONNECTED';
    needsQR = false;
  } else {
    // connected=true mas smartphone=false = conexão parcial
    state = 'CONNECTING';
    needsQR = false;
  }

  return { connected, state, needsQR };
}

const STATUS_FALLBACK: InstanceStatus = {
  connected: false,
  state: 'unknown',
  needsQR: false,
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse(405, { error: 'Método não permitido' });

  try {
    // ── 1. Autenticação ──────────────────────────────────────────────────────
    const guard = await requireAuth(req);
    if (guard instanceof Response) return guard;
    const { admin, callerId } = guard;

    // ── 2. Parse body ────────────────────────────────────────────────────────
    let body: { account_id?: string };
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: 'Payload JSON inválido' });
    }

    const accountId = body.account_id?.trim();

    if (!accountId) {
      return jsonResponse(400, { error: 'account_id é obrigatório' });
    }
    if (!UUID_REGEX.test(accountId)) {
      return jsonResponse(400, { error: 'account_id deve ser um UUID válido' });
    }

    // ── 3. Busca tokens da conta via service_role ────────────────────────────
    // Somente instance_id, instance_token e client_token — demais campos não
    // precisam ser carregados (evita exposição acidental de dados).
    const { data: account, error: accountErr } = await admin
      .from('zapi_accounts')
      .select('id, instance_id, instance_token, client_token')
      .eq('id', accountId)
      .maybeSingle<{
        id: string;
        instance_id: string;
        instance_token: string;
        client_token: string;
      }>();

    if (accountErr) {
      console.error('zapi-instance-status: erro ao buscar conta', { code: accountErr.code });
      return jsonResponse(500, { error: 'Erro ao localizar conta' });
    }
    if (!account) {
      return jsonResponse(404, { error: 'Conta Z-API não encontrada' });
    }

    // ── 4. Valida formato das credenciais antes do fetch (anti-SSRF) ─────────
    // Garante que instance_id e instance_token são alfanuméricos puros.
    // Impede que um valor como "x@servidor-atacante.com" redirecione o fetch
    // para host externo e vaze o header Client-Token.
    if (!ZAPI_INSTANCE_ID_REGEX.test(account.instance_id)) {
      console.error('zapi-instance-status: instance_id em formato inválido', { account_id: accountId });
      return jsonResponse(500, { error: 'Conta com configuração inválida' });
    }
    if (!ZAPI_INSTANCE_TOKEN_REGEX.test(account.instance_token)) {
      console.error('zapi-instance-status: instance_token em formato inválido', { account_id: accountId });
      return jsonResponse(500, { error: 'Conta com configuração inválida' });
    }

    // ── 5. Chama o endpoint de status da Z-API ───────────────────────────────
    // Endpoint oficial: GET /instances/{instance_id}/token/{instance_token}/status
    // Header obrigatório: Client-Token
    // encodeURIComponent() em cada segmento como camada adicional de defesa.
    const zapiUrl = `${ZAPI_BASE}/${encodeURIComponent(account.instance_id)}/token/${encodeURIComponent(account.instance_token)}/status`;

    let zapiResp: Response;
    try {
      zapiResp = await fetch(zapiUrl, {
        method: 'GET',
        headers: {
          'Client-Token': account.client_token,
        },
        signal: AbortSignal.timeout(8000),
      });
    } catch (fetchErr) {
      // Timeout ou erro de rede — retorna status desconhecido graciosamente
      const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      console.warn('zapi-instance-status: timeout/erro no fetch Z-API', { account_id: accountId, msg });
      return jsonResponse(200, STATUS_FALLBACK);
    }

    // ── 6. Processa resposta da Z-API ────────────────────────────────────────
    if (!zapiResp.ok) {
      console.warn('zapi-instance-status: Z-API retornou status não-ok', {
        account_id: accountId,
        http_status: zapiResp.status,
      });
      return jsonResponse(200, STATUS_FALLBACK);
    }

    let rawBody: ZapiStatusResponse = {};
    try {
      rawBody = await zapiResp.json();
    } catch {
      console.warn('zapi-instance-status: resposta da Z-API sem JSON válido', { account_id: accountId });
      return jsonResponse(200, STATUS_FALLBACK);
    }

    const status = normalizeStatus(rawBody);

    console.log('zapi-instance-status: ok', {
      callerId,
      account_id: accountId,
      state: status.state,
    });

    // Retorna APENAS os 3 campos normalizados — sem tokens, sem dados brutos
    return jsonResponse(200, status);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('zapi-instance-status crash:', msg);
    return jsonResponse(500, { error: 'Erro interno' });
  }
});
