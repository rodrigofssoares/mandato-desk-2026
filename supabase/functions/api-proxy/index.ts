import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
}

// Mapeamento campo_API -> coluna_banco (API em ingles, DB em portugues para contacts/tags)
const FIELD_MAP: Record<string, Record<string, string>> = {
  contacts: {
    name: 'nome',
    phone: 'telefone',
    email: 'email',
    cpf: 'cpf',
    birth_date: 'data_nascimento',
    gender: 'genero',
    zip_code: 'cep',
    address: 'logradouro',
    number: 'numero',
    complement: 'complemento',
    neighborhood: 'bairro',
    city: 'cidade',
    state: 'estado',
    latitude: 'lat',
    longitude: 'lng',
    instagram: 'instagram',
    facebook: 'facebook',
    twitter: 'twitter',
    declarou_voto: 'declarou_voto',
    is_favorite: 'is_favorite',
    voter_registration: 'titulo_eleitor',
    electoral_zone: 'zona_eleitoral',
    electoral_section: 'secao_eleitoral',
    political_group: 'grupo_politico',
    notes: 'observacoes',
    leader_id: 'leader_id',
    last_contact: 'ultimo_contato',
    source: 'origem',
    occupation: 'profissao',
    em_canal_whatsapp: 'em_canal_whatsapp',
    e_multiplicador: 'e_multiplicador',
  },
  demands: {
    title: 'title',
    description: 'description',
    contact_id: 'contact_id',
    responsible_id: 'responsible_id',
    status: 'status',
    priority: 'priority',
    neighborhood: 'neighborhood',
  },
  tags: {
    name: 'nome',
    color: 'cor',
  },
}

const REQUIRED_FIELDS: Record<string, string[]> = {
  contacts: ['name'],
  demands: ['title'],
  tags: ['name'],
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// Valida o token via RPC SECURITY DEFINER (bypass de RLS)
async function validateToken(supabase: SupabaseClient, authHeader: string) {
  const token = authHeader.replace('Bearer ', '').trim()
  if (!token) return null

  const { data, error } = await supabase.rpc('validate_api_token', { p_token: token })
  if (error || !data || (Array.isArray(data) && data.length === 0)) return null

  const row = Array.isArray(data) ? data[0] : data
  if (!row?.user_id) return null

  return { id: row.token_id, user_id: row.user_id }
}

// Filtra e traduz o body: aceita nomes da API e retorna com colunas do DB
function filterBody(body: Record<string, unknown>, resource: string): Record<string, unknown> {
  const fieldMap = FIELD_MAP[resource] || {}
  const filtered: Record<string, unknown> = {}
  for (const key of Object.keys(body)) {
    const dbColumn = fieldMap[key]
    if (dbColumn) {
      filtered[dbColumn] = body[key]
    }
  }
  return filtered
}

// Valida campos obrigatorios — checa nomes da API
function validateRequired(body: Record<string, unknown>, resource: string): string | null {
  const required = REQUIRED_FIELDS[resource] || []
  for (const field of required) {
    if (!body[field] && body[field] !== false && body[field] !== 0) {
      return `Campo obrigatorio ausente: ${field}`
    }
  }
  return null
}

// ---- Handlers ----

async function handleGet(
  supabase: SupabaseClient,
  resource: string,
  resourceId: string | undefined,
  params: URLSearchParams,
  userId: string,
) {
  if (resourceId) {
    const { data, error } = await supabase.rpc('api_get_one', {
      p_user_id: userId,
      p_resource: resource,
      p_id: resourceId,
    })
    if (error) return json(500, { error: error.message })
    if (!data) return json(404, { error: 'Registro nao encontrado' })
    return json(200, data)
  }

  const limit = Math.min(parseInt(params.get('limit') || '50'), 200)
  const offset = parseInt(params.get('offset') || '0')
  const search = params.get('search') || null

  const { data, error } = await supabase.rpc('api_list', {
    p_user_id: userId,
    p_resource: resource,
    p_limit: limit,
    p_offset: offset,
    p_search: search,
  })
  if (error) return json(500, { error: error.message })

  const payload = data as { data: unknown[]; total: number } | null
  return json(200, {
    data: payload?.data ?? [],
    pagination: {
      total: payload?.total ?? 0,
      limit,
      offset,
    },
  })
}

async function handlePost(
  supabase: SupabaseClient,
  resource: string,
  body: Record<string, unknown>,
  userId: string,
) {
  const boardRef = typeof body.board_id === 'string' ? body.board_id : null
  const stageRef = typeof body.stage_id === 'string' ? body.stage_id : null
  delete body.board_id
  delete body.stage_id

  const requiredError = validateRequired(body, resource)
  if (requiredError) return json(400, { error: requiredError })

  // Para contatos: se ja existe um contato com o mesmo telefone, reusa em vez
  // de duplicar. Permite API como upsert quando vinculado a um board.
  let contact: Record<string, unknown> | null = null
  let reused = false

  if (resource === 'contacts' && typeof body.phone === 'string' && body.phone.trim()) {
    const normalized = normalizePhone(body.phone)
    if (normalized) {
      const { data: existing } = await supabase.rpc('api_find_contact_by_phone', {
        p_user_id: userId,
        p_phone_normalized: normalized,
      })
      if (existing && (existing as { id?: string }).id) {
        contact = existing as Record<string, unknown>
        reused = true
      }
    }
  }

  if (!contact) {
    const filtered = filterBody(body, resource)
    const { data, error } = await supabase.rpc('api_insert', {
      p_user_id: userId,
      p_resource: resource,
      p_data: filtered,
    })

    if (error) {
      if (error.message.includes('duplicate') || error.message.includes('unique')) {
        return json(409, { error: 'Registro duplicado: ' + error.message })
      }
      return json(500, { error: error.message })
    }

    contact = data as Record<string, unknown>
  }

  if (!contact?.id) {
    return json(500, { error: 'Erro ao inserir registro' })
  }

  if (resource === 'contacts' && boardRef) {
    const { data: linkData, error: linkError } = await supabase.rpc('api_link_contact_to_board', {
      p_user_id: userId,
      p_contact_id: contact.id,
      p_board_ref: boardRef,
      p_stage_ref: stageRef,
    })
    const boardLink = linkError
      ? { status: 'warning', message: linkError.message }
      : linkData
    return json(reused ? 200 : 201, { ...contact, board_link: boardLink, reused })
  }

  return json(reused ? 200 : 201, reused ? { ...contact, reused: true } : contact)
}

async function handlePatch(
  supabase: SupabaseClient,
  resource: string,
  resourceId: string | undefined,
  body: Record<string, unknown>,
  userId: string,
) {
  if (!resourceId) return json(400, { error: 'ID do registro e obrigatorio para atualizacao' })

  // Para contatos: board_id/stage_id nao sao colunas da tabela contacts —
  // sao resolvidos por api_link_contact_to_board (move ou cria board_item).
  const boardRef =
    resource === 'contacts' && typeof body.board_id === 'string' ? body.board_id : null
  const stageRef =
    resource === 'contacts' && typeof body.stage_id === 'string' ? body.stage_id : null
  if (resource === 'contacts') {
    delete body.board_id
    delete body.stage_id
  }

  const filtered = filterBody(body, resource)
  const hasFieldsToUpdate = Object.keys(filtered).length > 0

  if (!hasFieldsToUpdate && !boardRef) {
    return json(400, { error: 'Nenhum campo valido para atualizar' })
  }

  let updated: Record<string, unknown> | null = null

  if (hasFieldsToUpdate) {
    const { data, error } = await supabase.rpc('api_update', {
      p_user_id: userId,
      p_resource: resource,
      p_id: resourceId,
      p_data: filtered,
    })

    if (error) return json(500, { error: error.message })
    if (!data) return json(404, { error: 'Registro nao encontrado' })
    updated = data as Record<string, unknown>
  } else {
    const { data, error } = await supabase.rpc('api_get_one', {
      p_user_id: userId,
      p_resource: resource,
      p_id: resourceId,
    })
    if (error) return json(500, { error: error.message })
    if (!data) return json(404, { error: 'Registro nao encontrado' })
    updated = data as Record<string, unknown>
  }

  if (boardRef) {
    const { data: linkData, error: linkError } = await supabase.rpc('api_link_contact_to_board', {
      p_user_id: userId,
      p_contact_id: resourceId,
      p_board_ref: boardRef,
      p_stage_ref: stageRef,
    })
    const boardLink = linkError
      ? { status: 'warning', message: linkError.message }
      : linkData
    return json(200, { ...updated, board_link: boardLink })
  }

  return json(200, updated)
}

async function handleDelete(
  supabase: SupabaseClient,
  resource: string,
  resourceId: string | undefined,
  userId: string,
) {
  if (!resourceId) return json(400, { error: 'ID do registro e obrigatorio para exclusao' })

  const { data, error } = await supabase.rpc('api_delete', {
    p_user_id: userId,
    p_resource: resource,
    p_id: resourceId,
  })

  if (error) return json(500, { error: error.message })
  if (!data) return json(404, { error: 'Registro nao encontrado' })
  return json(200, { message: 'Registro excluido com sucesso', id: resourceId })
}

function normalizePhone(phone: string): string {
  return phone.replace(/[\s\(\)\-\+]/g, '').replace(/^55/, '')
}

// Campos suportados para identificar um contato alem do UUID na URL.
// Uso: PUT /contacts/by-phone/{valor}, /contacts/by-instagram/{valor}, /contacts/by-name/{valor}
const LOOKUP_FIELDS = ['phone', 'instagram', 'name'] as const
type LookupField = typeof LOOKUP_FIELDS[number]

function isLookupField(value: string): value is LookupField {
  return (LOOKUP_FIELDS as readonly string[]).includes(value)
}

async function handlePatchByLookup(
  supabase: SupabaseClient,
  field: LookupField,
  rawValue: string,
  body: Record<string, unknown>,
  userId: string,
): Promise<Response> {
  if (!rawValue || !rawValue.trim()) {
    return json(400, { error: `Valor obrigatorio na URL para /contacts/by-${field}/{valor}` })
  }

  const boardRef = typeof body.board_id === 'string' ? body.board_id : null
  const stageRef = typeof body.stage_id === 'string' ? body.stage_id : null
  delete body.board_id
  delete body.stage_id

  const { data: contact, error: searchErr } = await supabase.rpc('api_find_contact_by_lookup', {
    p_user_id: userId,
    p_field: field,
    p_value: rawValue,
  })
  if (searchErr) return json(500, { error: searchErr.message })

  const result = contact as Record<string, unknown> | null

  if (result?.status === 'ambiguous') {
    return json(409, {
      error: result.message,
      ambiguous: true,
      count: result.count,
      hint: 'Use o UUID, telefone ou Instagram (unicos) para identificar o contato sem ambiguidade.',
    })
  }

  if (result?.status === 'error') {
    return json(400, { error: result.message })
  }

  const found = result as { id?: string } | null
  if (!found?.id) {
    return json(404, { error: `Contato nao encontrado para ${field}: ${rawValue}` })
  }

  const filtered = filterBody(body, 'contacts')
  const hasFieldsToUpdate = Object.keys(filtered).length > 0

  if (!hasFieldsToUpdate && !boardRef) {
    return json(400, { error: 'Nenhum campo valido para atualizar' })
  }

  let updatedContact: Record<string, unknown> = found

  if (hasFieldsToUpdate) {
    const { data: updated, error: updateErr } = await supabase.rpc('api_update', {
      p_user_id: userId,
      p_resource: 'contacts',
      p_id: found.id,
      p_data: filtered,
    })
    if (updateErr) return json(500, { error: updateErr.message })
    if (updated) updatedContact = updated as Record<string, unknown>
  }

  if (boardRef) {
    const { data: linkData, error: linkError } = await supabase.rpc('api_link_contact_to_board', {
      p_user_id: userId,
      p_contact_id: found.id,
      p_board_ref: boardRef,
      p_stage_ref: stageRef,
    })
    const boardLink = linkError
      ? { status: 'warning', message: linkError.message }
      : linkData
    return json(200, { ...updatedContact, board_link: boardLink })
  }

  return json(200, updatedContact)
}

// ---- Main Handler ----

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')!,
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return json(401, {
        error: 'Token de autorizacao obrigatorio',
        hint: 'Adicione o header: Authorization: Bearer <seu_token>',
      })
    }

    const tokenData = await validateToken(supabase, authHeader)
    if (!tokenData) {
      return json(401, {
        error: 'Token invalido ou revogado',
        hint: 'Gere um novo token na pagina de API do sistema',
      })
    }

    const url = new URL(req.url)
    const pathParts = url.pathname.split('/').filter(Boolean)
    const funcIndex = pathParts.indexOf('api-proxy')
    const resource = pathParts[funcIndex + 1]
    const resourceId = pathParts[funcIndex + 2]

    // Rotas especiais: PATCH|PUT /contacts/by-{phone|instagram|name}/{valor}
    if (
      resource === 'contacts' &&
      typeof resourceId === 'string' &&
      resourceId.startsWith('by-') &&
      (req.method === 'PATCH' || req.method === 'PUT')
    ) {
      const field = resourceId.slice('by-'.length)
      if (!isLookupField(field)) {
        return json(400, {
          error: `Campo de busca invalido: ${resourceId}. Use: by-phone, by-instagram, by-name.`,
        })
      }
      const rawValue = pathParts[funcIndex + 3]
      if (!rawValue) {
        return json(400, {
          error: `Valor obrigatorio na URL. Ex: /contacts/${resourceId}/{valor}`,
        })
      }
      const body = await req.json().catch(() => ({}))
      return await handlePatchByLookup(
        supabase,
        field,
        decodeURIComponent(rawValue),
        body as Record<string, unknown>,
        tokenData.user_id,
      )
    }

    if (!resource || !['contacts', 'demands', 'tags'].includes(resource)) {
      return json(400, {
        error: 'Recurso invalido',
        hint: 'Recursos disponiveis: contacts, demands, tags',
        exemplo: '/functions/v1/api-proxy/contacts',
      })
    }

    switch (req.method) {
      case 'GET':
        return await handleGet(supabase, resource, resourceId, url.searchParams, tokenData.user_id)
      case 'POST': {
        const body = await req.json().catch(() => ({}))
        return await handlePost(supabase, resource, body as Record<string, unknown>, tokenData.user_id)
      }
      case 'PUT':
      case 'PATCH': {
        const body = await req.json().catch(() => ({}))
        return await handlePatch(supabase, resource, resourceId, body as Record<string, unknown>, tokenData.user_id)
      }
      case 'DELETE':
        return await handleDelete(supabase, resource, resourceId, tokenData.user_id)
      default:
        return json(405, { error: 'Metodo nao permitido' })
    }
  } catch (err) {
    return json(500, { error: 'Erro interno do servidor', detail: err instanceof Error ? err.message : String(err) })
  }
})
