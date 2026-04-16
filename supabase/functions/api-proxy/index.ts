import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
}

// Colunas permitidas por recurso (whitelist de seguranca)
const ALLOWED_COLUMNS: Record<string, string[]> = {
  contacts: [
    'name', 'phone', 'email', 'cpf', 'birth_date', 'gender',
    'zip_code', 'address', 'number', 'complement', 'neighborhood', 'city', 'state',
    'latitude', 'longitude',
    'instagram', 'facebook', 'twitter',
    'declarou_voto', 'is_favorite', 'voter_registration', 'electoral_zone',
    'electoral_section', 'political_group', 'notes',
    'leader_id', 'last_contact', 'source', 'occupation',
    'em_canal_whatsapp', 'e_multiplicador',
  ],
  demands: [
    'title', 'description', 'contact_id', 'responsible_id',
    'status', 'priority', 'neighborhood',
  ],
  tags: [
    'name', 'category', 'color',
  ],
}

// Campos obrigatorios por recurso (para POST)
const REQUIRED_COLUMNS: Record<string, string[]> = {
  contacts: ['name'],
  demands: ['title'],
  tags: ['name', 'category'],
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// Valida o token customizado contra a tabela api_tokens
async function validateToken(supabase: SupabaseClient, authHeader: string) {
  const token = authHeader.replace('Bearer ', '').trim()
  if (!token) return null

  const { data, error } = await supabase
    .from('api_tokens')
    .select('id, user_id, token')
    .eq('token', token)
    .maybeSingle()

  if (error || !data) return null

  // Atualizar last_used_at (fire-and-forget)
  supabase
    .from('api_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)
    .then(() => {})

  return { id: data.id, user_id: data.user_id }
}

// Filtra o body para conter apenas colunas permitidas
function filterBody(body: Record<string, unknown>, resource: string): Record<string, unknown> {
  const allowed = ALLOWED_COLUMNS[resource] || []
  const filtered: Record<string, unknown> = {}
  for (const key of Object.keys(body)) {
    if (allowed.includes(key)) {
      filtered[key] = body[key]
    }
  }
  return filtered
}

// Valida campos obrigatorios
function validateRequired(body: Record<string, unknown>, resource: string): string | null {
  const required = REQUIRED_COLUMNS[resource] || []
  for (const field of required) {
    if (!body[field] && body[field] !== false && body[field] !== 0) {
      return `Campo obrigatorio ausente: ${field}`
    }
  }
  return null
}

// Resultado do vínculo com board
interface BoardLinkResult {
  status: 'ok' | 'warning'
  action?: 'linked' | 'moved'
  board_item_id?: string
  message?: string
}

// Vincula ou move um contato para um board/etapa
async function linkContactToBoard(
  supabase: SupabaseClient,
  contactId: string,
  boardId: string,
  stageId: string | null,
  userId: string,
): Promise<BoardLinkResult> {
  // Validar que o board pertence ao user
  const { data: board, error: boardErr } = await supabase
    .from('boards')
    .select('id')
    .eq('id', boardId)
    .eq('created_by', userId)
    .maybeSingle()

  if (boardErr || !board) {
    return { status: 'warning', message: 'board_id not found or not accessible' }
  }

  // Resolver stage_id: se ausente, buscar estágio com menor ordem
  let resolvedStageId = stageId
  if (!resolvedStageId) {
    const { data: firstStage, error: stageErr } = await supabase
      .from('board_stages')
      .select('id')
      .eq('board_id', boardId)
      .order('ordem', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (stageErr || !firstStage) {
      return { status: 'warning', message: 'Nenhuma etapa encontrada no board informado' }
    }
    resolvedStageId = firstStage.id
  }

  // Verificar se já existe board_item para (contact_id, board_id)
  const { data: existing } = await supabase
    .from('board_items')
    .select('id')
    .eq('contact_id', contactId)
    .eq('board_id', boardId)
    .maybeSingle()

  if (existing) {
    // Já está no board — mover de etapa
    const { error: moveErr } = await supabase
      .from('board_items')
      .update({ stage_id: resolvedStageId, moved_at: new Date().toISOString() })
      .eq('id', existing.id)

    if (moveErr) return { status: 'warning', message: moveErr.message }
    return { status: 'ok', action: 'moved', board_item_id: existing.id }
  }

  // Calcular próxima ordem dentro do estágio
  const { count } = await supabase
    .from('board_items')
    .select('id', { count: 'exact', head: true })
    .eq('stage_id', resolvedStageId)

  const nextOrdem = (count ?? 0) + 1

  // Criar novo board_item
  const { data: newItem, error: insertErr } = await supabase
    .from('board_items')
    .insert({
      board_id: boardId,
      contact_id: contactId,
      stage_id: resolvedStageId,
      ordem: nextOrdem,
    })
    .select('id')
    .single()

  if (insertErr || !newItem) {
    return { status: 'warning', message: insertErr?.message ?? 'Erro ao criar board_item' }
  }

  return { status: 'ok', action: 'linked', board_item_id: newItem.id }
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
    // GET single
    const { data, error } = await supabase
      .from(resource)
      .select('*')
      .eq('id', resourceId)
      .eq('created_by', userId)
      .maybeSingle()

    if (error) return json(500, { error: error.message })
    if (!data) return json(404, { error: 'Registro nao encontrado' })
    return json(200, data)
  }

  // GET list
  const limit = Math.min(parseInt(params.get('limit') || '100'), 1000)
  const offset = parseInt(params.get('offset') || '0')
  const search = params.get('search')
  const order = params.get('order') || 'created_at.desc'

  let query = supabase
    .from(resource)
    .select('*', { count: 'exact' })
    .eq('created_by', userId)

  // Busca textual
  if (search) {
    if (resource === 'contacts') {
      query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`)
    } else if (resource === 'demands') {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`)
    } else if (resource === 'tags') {
      query = query.ilike('name', `%${search}%`)
    }
  }

  // Filtros de coluna (ex: ?city=eq.Sao Paulo)
  const allowed = ALLOWED_COLUMNS[resource] || []
  for (const [key, value] of params.entries()) {
    if (allowed.includes(key) && value.includes('.')) {
      const dotIdx = value.indexOf('.')
      const op = value.substring(0, dotIdx)
      const val = value.substring(dotIdx + 1)
      if (op === 'eq') query = query.eq(key, val)
      else if (op === 'neq') query = query.neq(key, val)
      else if (op === 'gt') query = query.gt(key, val)
      else if (op === 'gte') query = query.gte(key, val)
      else if (op === 'lt') query = query.lt(key, val)
      else if (op === 'lte') query = query.lte(key, val)
      else if (op === 'like') query = query.like(key, val)
      else if (op === 'ilike') query = query.ilike(key, val)
      else if (op === 'is') query = query.is(key, val === 'null' ? null : val === 'true')
    }
  }

  // Ordenacao
  const [orderCol, orderDir] = order.split('.')
  if (allowed.includes(orderCol) || ['created_at', 'updated_at', 'id'].includes(orderCol)) {
    query = query.order(orderCol, { ascending: orderDir === 'asc' })
  } else {
    query = query.order('created_at', { ascending: false })
  }

  query = query.range(offset, offset + limit - 1)

  const { data, error, count } = await query

  if (error) return json(500, { error: error.message })

  return json(200, {
    data,
    pagination: {
      total: count,
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
  // Extrair parâmetros de board antes de filtrar (não são colunas do contato)
  const boardId = typeof body.board_id === 'string' ? body.board_id : null
  const stageId = typeof body.stage_id === 'string' ? body.stage_id : null
  delete body.board_id
  delete body.stage_id

  const filtered = filterBody(body, resource)
  const requiredError = validateRequired(filtered, resource)
  if (requiredError) return json(400, { error: requiredError })

  // Setar created_by automaticamente
  filtered.created_by = userId

  const { data, error } = await supabase
    .from(resource)
    .insert(filtered)
    .select()
    .single()

  if (error) {
    if (error.message.includes('duplicate') || error.message.includes('unique')) {
      return json(409, { error: 'Registro duplicado: ' + error.message })
    }
    return json(500, { error: error.message })
  }

  // Vincular ao board se informado (apenas para contacts)
  if (resource === 'contacts' && boardId) {
    const boardLink = await linkContactToBoard(supabase, data.id, boardId, stageId, userId)
    return json(201, { ...data, board_link: boardLink })
  }

  return json(201, data)
}

async function handlePatch(
  supabase: SupabaseClient,
  resource: string,
  resourceId: string | undefined,
  body: Record<string, unknown>,
  userId: string,
) {
  if (!resourceId) return json(400, { error: 'ID do registro e obrigatorio para atualizacao' })

  const filtered = filterBody(body, resource)
  if (Object.keys(filtered).length === 0) {
    return json(400, { error: 'Nenhum campo valido para atualizar' })
  }

  const { data, error } = await supabase
    .from(resource)
    .update(filtered)
    .eq('id', resourceId)
    .eq('created_by', userId)
    .select()
    .single()

  if (error) {
    if (error.code === 'PGRST116') return json(404, { error: 'Registro nao encontrado' })
    return json(500, { error: error.message })
  }

  return json(200, data)
}

async function handleDelete(
  supabase: SupabaseClient,
  resource: string,
  resourceId: string | undefined,
  userId: string,
) {
  if (!resourceId) return json(400, { error: 'ID do registro e obrigatorio para exclusao' })

  const { data, error } = await supabase
    .from(resource)
    .delete()
    .eq('id', resourceId)
    .eq('created_by', userId)
    .select()
    .single()

  if (error) {
    if (error.code === 'PGRST116') return json(404, { error: 'Registro nao encontrado' })
    return json(500, { error: error.message })
  }

  return json(200, { message: 'Registro excluido com sucesso', id: resourceId })
}

// ---- Main Handler ----

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    // Criar cliente com service role (bypass RLS)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Validar token
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

    // Parsear rota: /api-proxy/{resource}/{id?}
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/').filter(Boolean)
    // pathParts pode ser: ['api-proxy', 'contacts'] ou ['api-proxy', 'contacts', 'uuid']
    const funcIndex = pathParts.indexOf('api-proxy')
    const resource = pathParts[funcIndex + 1]
    const resourceId = pathParts[funcIndex + 2]

    if (!resource || !['contacts', 'demands', 'tags'].includes(resource)) {
      return json(400, {
        error: 'Recurso invalido',
        hint: 'Recursos disponiveis: contacts, demands, tags',
        exemplo: '/functions/v1/api-proxy/contacts',
      })
    }

    // Rotear por metodo HTTP
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
    return json(500, { error: 'Erro interno do servidor' })
  }
})
