import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { mapContactToPeopleApi, type ContactRow } from './mapContact.ts';
import { ensureValidToken } from './refreshToken.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Wrapper de retry para chamadas à People API
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  delayMs = 1000,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;
      if (attempt < maxAttempts - 1) {
        await sleep(delayMs);
      }
    }
  }
  throw lastError;
}

const PEOPLE_API = 'https://people.googleapis.com/v1';
const UPDATE_PERSON_FIELDS =
  'names,phoneNumbers,emailAddresses,addresses,birthdays,biographies,urls';

// Busca etag atual de um contato no Google
async function fetchEtag(
  resourceName: string,
  accessToken: string,
): Promise<string | null> {
  const resp = await fetch(
    `${PEOPLE_API}/${resourceName}?personFields=metadata`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!resp.ok) return null;
  const data = await resp.json();
  return data.etag ?? null;
}

// Grava log de sincronização
async function writeLog(
  admin: ReturnType<typeof createClient>,
  params: {
    user_id: string;
    contact_id?: string | null;
    operation: string;
    status: 'success' | 'error' | 'skipped';
    error_message?: string | null;
    details?: Record<string, unknown>;
  },
) {
  // Trunca error_message a 500 chars — evita PII em excesso vinda da resposta do Google
  const safeErrorMessage = params.error_message
    ? params.error_message.slice(0, 500)
    : null;

  await admin.from('google_sync_logs').insert({
    user_id: params.user_id,
    contact_id: params.contact_id ?? null,
    direction: 'crm_to_google',
    operation: params.operation,
    status: params.status,
    error_message: safeErrorMessage,
    details: params.details ?? null,
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'Método não permitido' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return jsonResponse(500, { error: 'Configuração incompleta: variáveis Supabase ausentes' });
  }

  // Valida JWT do chamador
  const authHeader = req.headers.get('Authorization') ?? '';
  const callerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!callerToken) {
    return jsonResponse(401, { error: 'Token de autenticação ausente' });
  }

  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${callerToken}` } },
  });
  const { data: userData, error: userError } = await caller.auth.getUser(callerToken);
  if (userError || !userData.user) {
    return jsonResponse(401, { error: 'Sessão inválida' });
  }
  const callerId = userData.user.id;

  // Parse do body
  // google_resource_name NÃO é aceito do body — buscamos sempre do banco (FIX P-CRIT-2)
  let body: { contact_id: string; user_id: string; operation: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: 'Body JSON inválido' });
  }

  const { contact_id, user_id, operation } = body;

  if (!contact_id || !user_id || !operation) {
    return jsonResponse(400, { error: 'Campos obrigatórios: contact_id, user_id, operation' });
  }

  // Segurança: user_id do body deve bater com o JWT
  if (user_id !== callerId) {
    return jsonResponse(403, { error: 'user_id não corresponde ao usuário autenticado' });
  }

  // Cliente admin (service_role) para operações que precisam bypass de RLS
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Verifica se sync está habilitado
  const { data: settings } = await admin
    .from('google_sync_settings')
    .select('sync_enabled, keep_on_google_delete')
    .eq('user_id', user_id)
    .maybeSingle();

  if (!settings || !settings.sync_enabled) {
    return jsonResponse(200, { skipped: true, reason: 'sync_enabled=false ou sem configurações' });
  }

  // Verifica se token existe e está ativo
  const { data: tokenCheck } = await admin
    .from('google_oauth_tokens')
    .select('is_active')
    .eq('user_id', user_id)
    .maybeSingle();

  if (!tokenCheck || !tokenCheck.is_active) {
    return jsonResponse(200, { skipped: true, reason: 'sem token ativo' });
  }

  // ─── DELETE ──────────────────────────────────────────────────────────────
  if (operation === 'delete') {
    // FIX P-CRIT-2: Ignorar google_resource_name do body — buscar sempre do banco
    // com filtro user_id para evitar deleção arbitrária de contatos Google
    const { data: syncRow } = await admin
      .from('contact_sync')
      .select('google_resource_name')
      .eq('contact_id', contact_id)
      .eq('user_id', user_id)
      .maybeSingle();

    const resourceName = syncRow?.google_resource_name ?? null;

    // Validar formato do resourceName antes de usar na People API
    if (resourceName && !/^people\/[A-Za-z0-9_-]+$/.test(resourceName)) {
      await writeLog(admin, {
        user_id,
        contact_id,
        operation: 'delete',
        status: 'error',
        error_message: 'formato resource_name invalido',
      });
      return jsonResponse(400, { error: 'Identificador de contato Google inválido' });
    }

    const keepOnDelete = settings.keep_on_google_delete ?? true;

    if (!keepOnDelete && resourceName) {
      // Chama People API para deletar
      try {
        const accessToken = await ensureValidToken(admin, user_id);
        const resp = await fetch(`${PEOPLE_API}/${resourceName}:deleteContact`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!resp.ok && resp.status !== 404) {
          const errText = (await resp.text()).slice(0, 500);
          await writeLog(admin, {
            user_id,
            contact_id,
            operation: 'delete',
            status: 'error',
            error_message: `People API retornou ${resp.status}: ${errText}`,
          });
        } else {
          await writeLog(admin, {
            user_id,
            contact_id,
            operation: 'delete',
            status: 'success',
          });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        await writeLog(admin, {
          user_id,
          contact_id,
          operation: 'delete',
          status: 'error',
          error_message: msg,
        });
      }
    } else {
      // keep_on_google_delete=true: apenas remove contact_sync
      await writeLog(admin, {
        user_id,
        contact_id,
        operation: 'delete',
        status: 'success',
        details: { kept_on_google: true },
      });
    }

    // Remove de contact_sync em qualquer caso
    await admin
      .from('contact_sync')
      .delete()
      .eq('contact_id', contact_id)
      .eq('user_id', user_id);

    return jsonResponse(200, { ok: true, operation: 'delete' });
  }

  // ─── CREATE / UPDATE ──────────────────────────────────────────────────────
  // Busca dados do contato — FIX P-CRIT-1: filtra por created_by para evitar IDOR
  const { data: contact, error: contactError } = await admin
    .from('contacts')
    .select('id, nome, telefone, whatsapp, email, logradouro, numero, complemento, bairro, cidade, estado, cep, data_nascimento, observacoes, notas_assessor, instagram, google_resource_name, google_etag')
    .eq('id', contact_id)
    .eq('created_by', user_id)
    .maybeSingle();

  if (contactError || !contact) {
    return jsonResponse(404, { error: 'Contato não encontrado ou sem permissão' });
  }

  // Valida nome obrigatório
  if (!contact.nome || contact.nome.trim() === '') {
    await writeLog(admin, {
      user_id,
      contact_id,
      operation,
      status: 'error',
      error_message: 'nome obrigatorio',
    });
    return jsonResponse(200, { skipped: true, reason: 'nome obrigatorio' });
  }

  // Monta payload People API
  let peoplePayload: ReturnType<typeof mapContactToPeopleApi>;
  try {
    peoplePayload = mapContactToPeopleApi(contact as ContactRow);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await writeLog(admin, { user_id, contact_id, operation, status: 'error', error_message: msg });
    return jsonResponse(200, { skipped: true, reason: msg });
  }

  // Determina se é create ou update
  const existingResourceName = contact.google_resource_name ?? null;
  const effectiveOperation = (operation === 'update' && !existingResourceName)
    ? 'create'
    : operation;

  try {
    const accessToken = await ensureValidToken(admin, user_id);

    if (effectiveOperation === 'create') {
      // ── CREATE ──
      let googleResourceName: string | null = null;
      let googleEtag: string | null = null;

      await withRetry(async () => {
        const resp = await fetch(`${PEOPLE_API}/people:createContact`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(peoplePayload),
        });

        if (resp.status === 429) {
          const retryAfter = parseInt(resp.headers.get('Retry-After') ?? '60', 10);
          await sleep(retryAfter * 1000);
          throw new Error('Rate limit 429 — retentando');
        }

        if (!resp.ok) {
          const errText = await resp.text();
          throw new Error(`People API create falhou ${resp.status}: ${errText}`);
        }

        const created = await resp.json();
        googleResourceName = created.resourceName ?? null;
        googleEtag = created.etag ?? null;
      });

      if (googleResourceName) {
        // Atualiza contacts com google_resource_name
        await admin
          .from('contacts')
          .update({
            google_resource_name: googleResourceName,
            google_contact_id: googleResourceName.replace('people/', ''),
            google_etag: googleEtag,
            google_last_synced_at: new Date().toISOString(),
          })
          .eq('id', contact_id);

        // Upsert em contact_sync
        await admin
          .from('contact_sync')
          .upsert(
            {
              contact_id,
              user_id,
              google_resource_name: googleResourceName,
              sync_status: 'synced',
              sync_direction: 'crm_to_google',
              last_synced_at: new Date().toISOString(),
              last_error: null,
            },
            { onConflict: 'contact_id,user_id' },
          );

        await writeLog(admin, {
          user_id,
          contact_id,
          operation: 'create',
          status: 'success',
          details: { google_resource_name: googleResourceName },
        });
      }

      return jsonResponse(200, { ok: true, operation: 'create', google_resource_name: googleResourceName });
    }

    if (effectiveOperation === 'update') {
      // ── UPDATE ──
      const resourceName = existingResourceName!;
      let finalEtag = await fetchEtag(resourceName, accessToken);

      let updated = false;
      let syncStatus: 'synced' | 'conflict' = 'synced';

      try {
        await withRetry(async () => {
          if (!finalEtag) {
            finalEtag = await fetchEtag(resourceName, accessToken);
          }

          const payload = { ...peoplePayload, etag: finalEtag };
          const resp = await fetch(
            `${PEOPLE_API}/${resourceName}:updateContact?updatePersonFields=${UPDATE_PERSON_FIELDS}`,
            {
              method: 'PATCH',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(payload),
            },
          );

          if (resp.status === 412) {
            // etag desatualizado — busca novo e retenta
            finalEtag = await fetchEtag(resourceName, accessToken);
            throw new Error('412 etag desatualizado — retentando com etag novo');
          }

          if (resp.status === 429) {
            const retryAfter = parseInt(resp.headers.get('Retry-After') ?? '60', 10);
            await sleep(retryAfter * 1000);
            throw new Error('Rate limit 429 — retentando');
          }

          if (!resp.ok) {
            const errText = await resp.text();
            throw new Error(`People API update falhou ${resp.status}: ${errText}`);
          }

          const updatedPerson = await resp.json();
          finalEtag = updatedPerson.etag ?? finalEtag;
          updated = true;
        }, 2, 1000); // 2 tentativas: se ambas retornarem 412, escapa pro catch externo que marca como 'conflict'
      } catch (err: unknown) {
        const msg = (err instanceof Error ? err.message : String(err)).slice(0, 500);
        // Após falhas, verifica se foi conflito de etag
        if (msg.includes('412')) {
          syncStatus = 'conflict';
        }

        await admin
          .from('contact_sync')
          .upsert(
            {
              contact_id,
              user_id,
              google_resource_name: resourceName,
              sync_status: syncStatus,
              sync_direction: 'crm_to_google',
              last_error: msg,
            },
            { onConflict: 'contact_id,user_id' },
          );

        await writeLog(admin, {
          user_id,
          contact_id,
          operation: 'update',
          status: 'error',
          error_message: msg,
        });

        return jsonResponse(200, { ok: false, operation: 'update', error: msg });
      }

      if (updated) {
        await admin
          .from('contacts')
          .update({
            google_etag: finalEtag,
            google_last_synced_at: new Date().toISOString(),
          })
          .eq('id', contact_id);

        await admin
          .from('contact_sync')
          .upsert(
            {
              contact_id,
              user_id,
              google_resource_name: resourceName,
              sync_status: 'synced',
              sync_direction: 'crm_to_google',
              last_synced_at: new Date().toISOString(),
              last_error: null,
            },
            { onConflict: 'contact_id,user_id' },
          );

        await writeLog(admin, {
          user_id,
          contact_id,
          operation: 'update',
          status: 'success',
        });
      }

      return jsonResponse(200, { ok: true, operation: 'update' });
    }

    return jsonResponse(400, { error: `Operação desconhecida: ${operation}` });
  } catch (err: unknown) {
    const msg = (err instanceof Error ? err.message : String(err)).slice(0, 500);

    if (msg === 'TOKEN_REVOKED') {
      return jsonResponse(401, { error: 'Token Google revogado. Reconecte na página de Integração.' });
    }
    if (msg === 'TOKEN_INACTIVE') {
      return jsonResponse(200, { skipped: true, reason: 'token inativo' });
    }

    // Falha irrecuperável após retries — marca como error
    await admin
      .from('contact_sync')
      .upsert(
        {
          contact_id,
          user_id,
          sync_status: 'error',
          sync_direction: 'crm_to_google',
          last_error: msg,
        },
        { onConflict: 'contact_id,user_id' },
      );

    await writeLog(admin, {
      user_id,
      contact_id,
      operation,
      status: 'error',
      error_message: msg,
    });

    return jsonResponse(200, { ok: false, error: msg });
  }
});
