import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logActivity } from '@/lib/activityLog';
import { slugify } from '@/lib/slugify';

// ============================================================================
// Tipos
// ============================================================================

export type CampoPersonalizadoTipo = 'texto' | 'numero' | 'data' | 'booleano' | 'selecao';

export interface CampoPersonalizado {
  id: string;
  entidade: 'contact';
  chave: string;
  rotulo: string;
  tipo: CampoPersonalizadoTipo;
  opcoes: string[] | null;
  filtravel: boolean;
  ordem: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampoPersonalizadoInsert {
  rotulo: string;
  tipo: CampoPersonalizadoTipo;
  opcoes?: string[] | null;
  filtravel?: boolean;
  ordem?: number;
}

export interface CampoPersonalizadoUpdate {
  rotulo?: string;
  opcoes?: string[] | null;
  filtravel?: boolean;
  ordem?: number;
}

/**
 * Valor de um campo personalizado para um contato.
 * Apenas uma das colunas `valor_*` estará preenchida, correspondendo ao `tipo`
 * definido em `campos_personalizados`.
 */
export interface CampoPersonalizadoValor {
  id: string;
  campo_id: string;
  contact_id: string;
  valor_texto: string | null;
  valor_numero: number | null;
  valor_data: string | null;
  valor_bool: boolean | null;
  valor_selecao: string | null;
  created_at: string;
  updated_at: string;
}

/** Forma normalizada de valores: { campo_id: valor }. */
export type ValoresContato = Record<string, string | number | boolean | null>;

// ============================================================================
// Helpers
// ============================================================================

/** Retorna o nome da coluna que armazena o valor para um dado tipo. */
function colunaValorParaTipo(tipo: CampoPersonalizadoTipo): keyof CampoPersonalizadoValor {
  switch (tipo) {
    case 'texto':
      return 'valor_texto';
    case 'numero':
      return 'valor_numero';
    case 'data':
      return 'valor_data';
    case 'booleano':
      return 'valor_bool';
    case 'selecao':
      return 'valor_selecao';
  }
}

/** Extrai o valor efetivo de uma linha valor, baseado no tipo do campo. */
export function extrairValor(
  valor: CampoPersonalizadoValor,
  tipo: CampoPersonalizadoTipo
): string | number | boolean | null {
  const coluna = colunaValorParaTipo(tipo);
  return (valor[coluna] as string | number | boolean | null) ?? null;
}

// ============================================================================
// Queries — definições de campos
// ============================================================================

export function useCustomFields(options?: { filtravel?: boolean }) {
  return useQuery<CampoPersonalizado[]>({
    queryKey: ['custom_fields', options],
    queryFn: async () => {
      let query = supabase
        .from('campos_personalizados')
        .select('*')
        .eq('entidade', 'contact')
        .order('ordem', { ascending: true });

      if (options?.filtravel !== undefined) {
        query = query.eq('filtravel', options.filtravel);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as CampoPersonalizado[];
    },
  });
}

// ============================================================================
// Mutations — definições
// ============================================================================

export function useCreateCustomField() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CampoPersonalizadoInsert) => {
      const rotulo = input.rotulo.trim();
      if (!rotulo) throw new Error('Rótulo do campo é obrigatório');

      const chave = slugify(rotulo);
      if (!chave) throw new Error('Rótulo do campo inválido');

      // Blacklist para evitar colisão com campos fixos do contato
      const BLACKLIST = new Set([
        'id',
        'nome',
        'email',
        'telefone',
        'cpf',
        'created_at',
        'updated_at',
      ]);
      if (BLACKLIST.has(chave)) {
        throw new Error(`Chave "${chave}" já é usada por um campo fixo do contato`);
      }

      if (input.tipo === 'selecao') {
        const opcoes = input.opcoes ?? [];
        if (opcoes.length < 2) {
          throw new Error('Campo de seleção precisa de pelo menos 2 opções');
        }
      }

      // Descobre próxima ordem
      let ordem = input.ordem;
      if (ordem === undefined) {
        const { count } = await supabase
          .from('campos_personalizados')
          .select('*', { count: 'exact', head: true })
          .eq('entidade', 'contact');
        ordem = count ?? 0;
      }

      const { data, error } = await supabase
        .from('campos_personalizados')
        .insert({
          entidade: 'contact',
          chave,
          rotulo,
          tipo: input.tipo,
          opcoes: input.tipo === 'selecao' ? input.opcoes : null,
          filtravel: input.filtravel ?? true,
          ordem,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error(`Já existe um campo com chave "${chave}"`);
        }
        throw error;
      }
      return data as CampoPersonalizado;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['custom_fields'] });
      toast.success(`Campo "${data.rotulo}" criado`);
      logActivity({
        type: 'create',
        entity_type: 'campo_personalizado',
        entity_id: data.id,
        entity_name: data.rotulo,
        description: `Criou campo personalizado "${data.rotulo}"`,
      });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar campo: ${error.message}`);
    },
  });
}

export function useUpdateCustomField() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: CampoPersonalizadoUpdate }) => {
      // Se mudou rótulo, NÃO regera chave (mantém estabilidade dos valores)
      const payload: Partial<CampoPersonalizado> = {};
      if (patch.rotulo !== undefined) payload.rotulo = patch.rotulo.trim();
      if (patch.opcoes !== undefined) payload.opcoes = patch.opcoes;
      if (patch.filtravel !== undefined) payload.filtravel = patch.filtravel;
      if (patch.ordem !== undefined) payload.ordem = patch.ordem;

      const { data, error } = await supabase
        .from('campos_personalizados')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as CampoPersonalizado;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['custom_fields'] });
      toast.success('Campo atualizado');
      logActivity({
        type: 'update',
        entity_type: 'campo_personalizado',
        entity_id: data.id,
        entity_name: data.rotulo,
      });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar campo: ${error.message}`);
    },
  });
}

export function useDeleteCustomField() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data: existing } = await supabase
        .from('campos_personalizados')
        .select('rotulo')
        .eq('id', id)
        .single();

      // CASCADE remove os valores automaticamente
      const { error } = await supabase.from('campos_personalizados').delete().eq('id', id);
      if (error) throw error;

      return { id, rotulo: existing?.rotulo ?? 'campo' };
    },
    onSuccess: ({ id, rotulo }) => {
      queryClient.invalidateQueries({ queryKey: ['custom_fields'] });
      queryClient.invalidateQueries({ queryKey: ['contact_custom_values'] });
      toast.success(`Campo "${rotulo}" excluído`);
      logActivity({
        type: 'delete',
        entity_type: 'campo_personalizado',
        entity_id: id,
        entity_name: rotulo,
      });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir campo: ${error.message}`);
    },
  });
}

// ============================================================================
// Queries — valores por contato
// ============================================================================

/**
 * Retorna os valores personalizados de um contato já normalizados.
 * Formato: { [campo_id]: valor_apropriado }
 */
export function useContactCustomValues(contactId: string | null | undefined) {
  return useQuery<ValoresContato>({
    queryKey: ['contact_custom_values', contactId],
    queryFn: async () => {
      if (!contactId) return {};
      const { data: valores, error } = await supabase
        .from('campos_personalizados_valores')
        .select('*, campo:campos_personalizados(tipo)')
        .eq('contact_id', contactId);

      if (error) throw error;

      const resultado: ValoresContato = {};
      for (const v of valores ?? []) {
        const tipo = (v as { campo: { tipo: CampoPersonalizadoTipo } | null }).campo?.tipo;
        if (!tipo) continue;
        resultado[v.campo_id] = extrairValor(v as CampoPersonalizadoValor, tipo);
      }
      return resultado;
    },
    enabled: !!contactId,
  });
}

// ============================================================================
// Mutation — upsert de valores em lote
// ============================================================================

export function useSaveContactCustomValues() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      contactId,
      values,
      campos,
    }: {
      contactId: string;
      values: ValoresContato;
      campos: CampoPersonalizado[];
    }) => {
      // Para cada campo existente, fazer upsert baseado no tipo
      const upserts = campos.map((campo) => {
        const raw = values[campo.id];
        const coluna = colunaValorParaTipo(campo.tipo);

        const row: Record<string, unknown> = {
          campo_id: campo.id,
          contact_id: contactId,
          valor_texto: null,
          valor_numero: null,
          valor_data: null,
          valor_bool: null,
          valor_selecao: null,
        };
        row[coluna] = raw ?? null;
        return row;
      });

      const { error } = await supabase
        .from('campos_personalizados_valores')
        .upsert(upserts, { onConflict: 'campo_id,contact_id' });

      if (error) throw error;
      return upserts.length;
    },
    onSuccess: (count, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['contact_custom_values', variables.contactId],
      });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success(`${count} campo(s) salvo(s)`);
    },
    onError: (error: Error) => {
      toast.error(`Erro ao salvar valores: ${error.message}`);
    },
  });
}
