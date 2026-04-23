// Reseta a senha de um usuário via Supabase Admin API e marca
// senha_temporaria=true em profiles, forçando o alvo a trocar a senha
// no próximo login.
//
// Requisitos:
//  - Chamador deve ter role admin/proprietario (validado em requireAdmin).
//  - Parâmetros: userId (uuid do alvo), password (nova senha, min 6).

import { corsHeaders, jsonResponse, requireAdmin } from '../_shared/admin-guard.ts';

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST') return jsonResponse(405, { error: 'Método não permitido' });

    const guard = await requireAdmin(req);
    if (guard instanceof Response) return guard;
    const { admin } = guard;

  let body: { userId?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: 'Payload JSON inválido' });
  }

  const userId = body.userId?.trim();
  const password = body.password ?? '';

  if (!userId) return jsonResponse(400, { error: 'userId é obrigatório' });
  if (password.length < 6) {
    return jsonResponse(400, { error: 'Senha deve ter pelo menos 6 caracteres' });
  }

  // 1. Atualiza a senha + garante e-mail confirmado
  const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
    password,
    email_confirm: true,
  });

  if (updateError) {
    return jsonResponse(400, { error: updateError.message });
  }

  // 2. Marca como senha temporária
  const { error: profileError } = await admin
    .from('profiles')
    .update({ senha_temporaria: true })
    .eq('id', userId);

  if (profileError) {
    return jsonResponse(500, {
      error: `Senha alterada, mas falhou ao marcar como temporária: ${profileError.message}`,
    });
  }

    return jsonResponse(200, { ok: true });
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.error('reset-user-password crash:', err);
    return jsonResponse(500, { error: `reset-user-password crash: ${msg}` });
  }
});
