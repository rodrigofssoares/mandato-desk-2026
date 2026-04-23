// Cria um novo usuário via Supabase Admin API.
// - Cria em auth.users já com email_confirmed_at = agora (email_confirm: true)
//   evitando o bug "credenciais inválidas" que ocorre quando o usuário fica
//   com email_confirmed_at NULL via auth.signUp().
// - Escreve nome/telefone/role/status_aprovacao em profiles.
// - Marca senha_temporaria = true para forçar troca no primeiro acesso.
// - NÃO afeta a sessão do admin chamador (admin.createUser roda no backend).

import { corsHeaders, jsonResponse, requireAdmin } from '../_shared/admin-guard.ts';

const VALID_ROLES = new Set(['admin', 'proprietario', 'assessor', 'assistente', 'estagiario']);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse(405, { error: 'Método não permitido' });

  const guard = await requireAdmin(req);
  if (guard instanceof Response) return guard;
  const { admin } = guard;

  let body: {
    email?: string;
    password?: string;
    nome?: string;
    role?: string;
    telefone?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: 'Payload JSON inválido' });
  }

  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? '';
  const nome = body.nome?.trim() ?? '';
  const role = body.role ?? 'assistente';
  const telefone = body.telefone?.toString().trim() || null;

  if (!email || !password || !nome) {
    return jsonResponse(400, { error: 'email, password e nome são obrigatórios' });
  }
  if (password.length < 6) {
    return jsonResponse(400, { error: 'Senha deve ter pelo menos 6 caracteres' });
  }
  if (!VALID_ROLES.has(role)) {
    return jsonResponse(400, { error: `Role inválido: ${role}` });
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nome },
  });

  if (createError || !created.user) {
    return jsonResponse(400, {
      error: createError?.message ?? 'Erro ao criar usuário',
    });
  }

  const userId = created.user.id;

  // Garante linha em profiles (trigger handle_new_user já cria, mas é assíncrono
  // e pode não ter rodado; usamos upsert para ser resiliente).
  const { error: profileError } = await admin
    .from('profiles')
    .upsert(
      {
        id: userId,
        email,
        nome,
        telefone,
        role,
        status_aprovacao: 'ATIVO',
        senha_temporaria: true,
      },
      { onConflict: 'id' },
    );

  if (profileError) {
    // Rollback parcial: apagamos o auth.user para não deixar órfão
    await admin.auth.admin.deleteUser(userId);
    return jsonResponse(500, {
      error: `Erro ao gravar perfil: ${profileError.message}`,
    });
  }

  return jsonResponse(200, {
    user: { id: userId, email, nome, role },
  });
});
