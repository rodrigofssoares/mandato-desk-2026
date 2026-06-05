// delete-user — RAQ-MAND-EM085
// Exclui PERMANENTEMENTE um usuário: remove do Supabase Auth (auth.users), o que
// cascateia a linha em profiles (FK ON DELETE CASCADE). Após isso a pessoa não
// consegue mais logar — nem com e-mail/senha (a credencial deixa de existir).
//
// Defesa em camadas (não confia no frontend):
//   1. requireAdmin       — JWT válido + nível >= assessor.
//   2. matriz de permissão — caller precisa de pode_deletar em 'usuarios' (admin sempre).
//   3. assertCanManage    — não pode excluir a si mesmo nem alvo de nível >= ao seu.
//   4. salvaguarda        — não permite excluir o último administrador.
//
// Parâmetro: { userId: string }

import {
  corsHeaders,
  jsonResponse,
  requireAdmin,
  assertCanManage,
  ROLE_LEVELS,
} from '../_shared/admin-guard.ts';

// Exclusão permanente é irreversível → piso mais alto que o das demais EFs admin
// (que aceitam assessor). Só proprietário e admin podem excluir usuários.
const MIN_DELETE_LEVEL = ROLE_LEVELS.proprietario; // 80
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST') return jsonResponse(405, { error: 'Método não permitido' });

    const guard = await requireAdmin(req);
    if (guard instanceof Response) return guard;
    const { admin, callerId, callerRole, callerLevel } = guard;

    // Piso de nível específico desta operação (acima do MIN_ADMIN_LEVEL da guard).
    if (callerLevel < MIN_DELETE_LEVEL) {
      return jsonResponse(403, {
        error: 'Exclusão permanente requer nível proprietário ou superior',
      });
    }

    let body: { userId?: string };
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: 'Payload JSON inválido' });
    }

    const userId = body.userId?.trim();
    if (!userId) return jsonResponse(400, { error: 'userId é obrigatório' });
    if (!UUID_RE.test(userId)) return jsonResponse(400, { error: 'userId inválido' });

    // Bloqueia auto-exclusão com mensagem clara (antes do assertCanManage).
    if (userId === callerId) {
      return jsonResponse(400, { error: 'Você não pode excluir a própria conta' });
    }

    // 2. Permissão de excluir usuários pela matriz (admin sempre pode).
    if (callerRole !== 'admin') {
      const { data: perm, error: permErr } = await admin
        .from('permissoes_perfil')
        .select('pode_deletar')
        .eq('role', callerRole)
        .eq('secao', 'usuarios')
        .maybeSingle();
      if (permErr) {
        console.error('delete-user: erro ao checar permissão:', permErr);
        return jsonResponse(500, { error: 'Erro interno ao verificar permissões' });
      }
      if (!perm?.pode_deletar) {
        return jsonResponse(403, { error: 'Sem permissão para excluir usuários' });
      }
    }

    // 3. Hierarquia: não excluir alvo de nível igual/superior.
    const manageErr = await assertCanManage(guard, userId);
    if (manageErr) return manageErr;

    // 4. Salvaguarda: nunca excluir o último administrador.
    const { data: target, error: targetErr } = await admin
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();
    if (targetErr) {
      console.error('delete-user: erro ao ler alvo:', targetErr);
      return jsonResponse(500, { error: 'Erro interno ao localizar o usuário' });
    }
    if (!target) {
      return jsonResponse(404, { error: 'Usuário alvo não encontrado' });
    }
    if (target.role === 'admin') {
      const { count, error: countErr } = await admin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'admin');
      if (countErr) {
        console.error('delete-user: erro ao contar admins:', countErr);
        return jsonResponse(500, { error: 'Erro interno ao validar administradores' });
      }
      if ((count ?? 0) <= 1) {
        return jsonResponse(400, {
          error: 'Não é possível excluir o último administrador do sistema',
        });
      }
    }

    // Exclui do Auth — cascateia profiles (FK ON DELETE CASCADE).
    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    if (delErr) {
      console.error('delete-user: erro ao excluir do Auth:', delErr);
      return jsonResponse(400, { error: 'Não foi possível excluir o usuário' });
    }

    return jsonResponse(200, { ok: true });
  } catch (err) {
    console.error('delete-user crash:', err);
    return jsonResponse(500, { error: 'Erro interno no servidor' });
  }
});
