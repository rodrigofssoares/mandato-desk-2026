// RAQ-MAND-EM054 — Hooks do Construtor de Formulários Web
//
// Usa sbForms (supabase as any) para acessar as tabelas formularios,
// formulario_campos e formulario_respostas até o types.ts ser regenerado.
// EM054: usar sbForms até types.ts regenerado

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { logActivity } from '@/lib/activityLog';
import {
  sbForms,              // EM054: usar sbForms até types.ts regenerado
  slugify,
  type Formulario,
  type FormularioCampo,
  type FormularioComMetricas,
  type FormularioInput,
  type FieldType,
} from '@/types/formularios';

// ── Constantes ─────────────────────────────────────────────────────────────

const FORMULARIOS_KEY = 'formularios' as const;
const FORMULARIO_KEY = 'formulario' as const;
const FORMULARIO_METRICS_KEY = 'formulario-metrics' as const;

const UPLOAD_ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const UPLOAD_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const BULK_CHUNK_SIZE = 100;

// ── Helpers internos ────────────────────────────────────────────────────────

/** Garante unicidade do slug tentando sufixos -2, -3... */
async function resolveUniqueSlug(base: string): Promise<string> {
  // EM054: usar sbForms até types.ts regenerado
  const { data } = await sbForms
    .from('formularios')
    .select('slug')
    .ilike('slug', `${base}%`);

  const existentes = new Set<string>((data ?? []).map((r: { slug: string }) => r.slug));

  if (!existentes.has(base)) return base;

  let counter = 2;
  while (existentes.has(`${base}-${counter}`)) {
    counter++;
  }
  return `${base}-${counter}`;
}

/** Extrai a extensão do nome do arquivo (sem ponto). */
function fileExt(file: File): string {
  const parts = file.name.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : 'jpg';
}

// ── logActivity — entity_type 'formulario' não existe no union fechado
//    de activityLog.ts (fora do escopo hook-writer). Cast necessário até
//    activityLog.ts ser ampliado pelo action-writer.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyEntityType = any;

// ── 1. useFormularios ───────────────────────────────────────────────────────

/**
 * Lista todos os formulários ordenados por created_at desc,
 * com a contagem de respostas de cada um (total_respostas).
 *
 * Usa `formulario_respostas(count)` via PostgREST embed para trazer
 * a contagem numa única query.
 */
export function useFormularios() {
  return useQuery<FormularioComMetricas[]>({
    queryKey: [FORMULARIOS_KEY],
    queryFn: async () => {
      // EM054: usar sbForms até types.ts regenerado
      const { data, error } = await sbForms
        .from('formularios')
        .select('*, formulario_respostas(count)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return ((data ?? []) as Record<string, unknown>[]).map((row) => {
        const respostasRaw = row['formulario_respostas'];
        const total_respostas =
          Array.isArray(respostasRaw) && respostasRaw.length > 0
            ? Number((respostasRaw[0] as Record<string, unknown>)['count'] ?? 0)
            : 0;

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { formulario_respostas: _drop, ...rest } = row;
        void _drop;

        return {
          ...(rest as unknown as Formulario),
          total_respostas,
        } as FormularioComMetricas;
      });
    },
  });
}

// ── 2. useFormulario ────────────────────────────────────────────────────────

export interface FormularioComCampos {
  formulario: Formulario;
  campos: FormularioCampo[];
}

/**
 * Carrega um formulário pelo id junto com seus campos (ordenados por `ordem`).
 */
export function useFormulario(id?: string) {
  return useQuery<FormularioComCampos | null>({
    queryKey: [FORMULARIO_KEY, id],
    queryFn: async () => {
      if (!id) return null;

      // EM054: usar sbForms até types.ts regenerado
      const [formRes, camposRes] = await Promise.all([
        sbForms.from('formularios').select('*').eq('id', id).single(),
        sbForms
          .from('formulario_campos')
          .select('*')
          .eq('form_id', id)
          .order('ordem', { ascending: true }),
      ]);

      if (formRes.error) throw formRes.error;
      if (camposRes.error) throw camposRes.error;

      return {
        formulario: formRes.data as Formulario,
        campos: (camposRes.data ?? []) as FormularioCampo[],
      };
    },
    enabled: !!id,
  });
}

// ── 3. useCreateFormulario ──────────────────────────────────────────────────

/**
 * Cria um novo formulário (status 'rascunho').
 * Gera slug único a partir do título (sufixa -2, -3... se colidir).
 * Retorna o registro criado para navegação imediata ao editor.
 */
export function useCreateFormulario() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation<Formulario, Error, FormularioInput>({
    mutationFn: async (input) => {
      if (!user) throw new Error('Usuário não autenticado');

      const baseSlug = input.slug ?? slugify(input.titulo);
      const slug = await resolveUniqueSlug(baseSlug);

      // EM054: usar sbForms até types.ts regenerado
      const { data, error } = await sbForms
        .from('formularios')
        .insert({
          titulo: input.titulo,
          slug,
          descricao: input.descricao ?? null,
          status: 'rascunho',
          publicado: false,
          created_by: user.id,
        })
        .select('*')
        .single();

      if (error) throw error;
      return data as Formulario;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: [FORMULARIOS_KEY] });
      toast.success(`Formulário "${data.titulo}" criado`);
      logActivity({
        type: 'create',
        entity_type: 'formulario' as AnyEntityType,
        entity_name: data.titulo,
        entity_id: data.id,
        description: `Criou o formulário "${data.titulo}"`,
      });
    },
    onError: (err) => {
      toast.error(`Erro ao criar formulário: ${err.message}`);
    },
  });
}

// ── 4. useUpdateFormulario ──────────────────────────────────────────────────

export interface UpdateFormularioInput {
  id: string;
  patch: Partial<Omit<Formulario, 'id' | 'created_at' | 'created_by'>>;
}

/**
 * Atualiza qualquer campo do formulário (config, publicar, datas, tema,
 * mapeamento, automações).
 */
export function useUpdateFormulario() {
  const qc = useQueryClient();

  return useMutation<Formulario, Error, UpdateFormularioInput>({
    mutationFn: async ({ id, patch }) => {
      // EM054: usar sbForms até types.ts regenerado
      const { data, error } = await sbForms
        .from('formularios')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw error;
      return data as Formulario;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: [FORMULARIOS_KEY] });
      qc.invalidateQueries({ queryKey: [FORMULARIO_KEY, data.id] });
      toast.success('Formulário salvo');
    },
    onError: (err) => {
      toast.error(`Erro ao salvar formulário: ${err.message}`);
    },
  });
}

// ── 5. useDeleteFormulario ──────────────────────────────────────────────────

/**
 * Exclui um formulário (cascata apaga campos e respostas via FK na migration).
 */
export function useDeleteFormulario() {
  const qc = useQueryClient();

  return useMutation<string, Error, string>({
    mutationFn: async (id) => {
      // EM054: usar sbForms até types.ts regenerado
      const { error } = await sbForms.from('formularios').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: [FORMULARIOS_KEY] });
      qc.removeQueries({ queryKey: [FORMULARIO_KEY, id] });
      qc.removeQueries({ queryKey: [FORMULARIO_METRICS_KEY, id] });
      toast.success('Formulário excluído');
      logActivity({
        type: 'delete',
        entity_type: 'formulario' as AnyEntityType,
        entity_id: id,
        description: 'Excluiu um formulário',
      });
    },
    onError: (err) => {
      toast.error(`Erro ao excluir formulário: ${err.message}`);
    },
  });
}

// ── 6. useDuplicateFormulario ───────────────────────────────────────────────

/**
 * Duplica um formulário e todos os seus campos.
 * Novo slug = "<titulo> cópia" slugificado + sufixo único.
 * Status rascunho, publicado false, total_visitas 0.
 */
export function useDuplicateFormulario() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation<Formulario, Error, string>({
    mutationFn: async (id) => {
      if (!user) throw new Error('Usuário não autenticado');

      // EM054: usar sbForms até types.ts regenerado
      const [formRes, camposRes] = await Promise.all([
        sbForms.from('formularios').select('*').eq('id', id).single(),
        sbForms
          .from('formulario_campos')
          .select('*')
          .eq('form_id', id)
          .order('ordem', { ascending: true }),
      ]);

      if (formRes.error) throw formRes.error;
      if (camposRes.error) throw camposRes.error;

      const original = formRes.data as Formulario;
      const campos = (camposRes.data ?? []) as FormularioCampo[];

      const baseSlug = slugify(`${original.titulo} copia`);
      const slug = await resolveUniqueSlug(baseSlug);

      // Inserir novo formulário
      const {
        id: _,
        created_at: __,
        updated_at: ___,
        total_visitas: ____,
        ...restForm
      } = original;
      void _;
      void __;
      void ___;
      void ____;

      // EM054: usar sbForms até types.ts regenerado
      const { data: novoForm, error: errForm } = await sbForms
        .from('formularios')
        .insert({
          ...restForm,
          titulo: `${original.titulo} (cópia)`,
          slug,
          status: 'rascunho',
          publicado: false,
          total_visitas: 0,
          created_by: user.id,
        })
        .select('*')
        .single();

      if (errForm) throw errForm;
      const novoId = (novoForm as Formulario).id;

      // Inserir campos sem ids originais
      if (campos.length > 0) {
        const novosCampos = campos.map(({ id: _cid, created_at: _ca, ...c }) => {
          void _cid;
          void _ca;
          return { ...c, form_id: novoId };
        });

        // EM054: usar sbForms até types.ts regenerado
        const { error: errCampos } = await sbForms
          .from('formulario_campos')
          .insert(novosCampos);

        if (errCampos) throw errCampos;
      }

      return novoForm as Formulario;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: [FORMULARIOS_KEY] });
      toast.success(`"${data.titulo}" duplicado`);
      logActivity({
        type: 'create',
        entity_type: 'formulario' as AnyEntityType,
        entity_name: data.titulo,
        entity_id: data.id,
        description: `Duplicou o formulário "${data.titulo}"`,
      });
    },
    onError: (err) => {
      toast.error(`Erro ao duplicar formulário: ${err.message}`);
    },
  });
}

// ── 7. useBulkDeleteFormularios ─────────────────────────────────────────────

/**
 * Exclui múltiplos formulários em lotes de até 100 ids por vez
 * (cascata apaga campos e respostas via FK).
 */
export function useBulkDeleteFormularios() {
  const qc = useQueryClient();

  return useMutation<number, Error, string[]>({
    mutationFn: async (ids) => {
      if (ids.length === 0) return 0;

      // Particiona em chunks de BULK_CHUNK_SIZE
      const chunks: string[][] = [];
      for (let i = 0; i < ids.length; i += BULK_CHUNK_SIZE) {
        chunks.push(ids.slice(i, i + BULK_CHUNK_SIZE));
      }

      let total = 0;
      for (const chunk of chunks) {
        // EM054: usar sbForms até types.ts regenerado
        const { error, count } = await sbForms
          .from('formularios')
          .delete({ count: 'exact' })
          .in('id', chunk);

        if (error) throw error;
        total += count ?? chunk.length;
      }

      return total;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: [FORMULARIOS_KEY] });
      toast.success(`${count} formulário(s) excluído(s)`);
      logActivity({
        type: 'bulk_delete',
        entity_type: 'formulario' as AnyEntityType,
        description: `Excluiu ${count} formulários em massa`,
      });
    },
    onError: (err) => {
      toast.error(`Erro ao excluir formulários: ${err.message}`);
    },
  });
}

// ── 8a. useAddFormularioCampo ───────────────────────────────────────────────

export interface AddCampoInput {
  form_id: string;
  tipo: FieldType;
  rotulo?: string;
  obrigatorio?: boolean;
  largura?: '100' | '50';
}

/**
 * Adiciona um campo ao formulário com ordem = (max atual) + 1.
 */
export function useAddFormularioCampo() {
  const qc = useQueryClient();

  return useMutation<FormularioCampo, Error, AddCampoInput>({
    mutationFn: async ({ form_id, tipo, rotulo, obrigatorio = false, largura = '100' }) => {
      // EM054: usar sbForms até types.ts regenerado
      const { data: maxRow } = await sbForms
        .from('formulario_campos')
        .select('ordem')
        .eq('form_id', form_id)
        .order('ordem', { ascending: false })
        .limit(1)
        .maybeSingle();

      const proximaOrdem = maxRow ? (maxRow as { ordem: number }).ordem + 1 : 1;

      // EM054: usar sbForms até types.ts regenerado
      const { data, error } = await sbForms
        .from('formulario_campos')
        .insert({
          form_id,
          tipo,
          rotulo: rotulo ?? '',
          ajuda: null,
          obrigatorio,
          min_chars: null,
          max_chars: null,
          validar_formato: false,
          opcoes: [],
          mapear_destino_1: null,
          mapear_destino_2: null,
          largura,
          config: {},
          ordem: proximaOrdem,
        })
        .select('*')
        .single();

      if (error) throw error;
      return data as FormularioCampo;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: [FORMULARIO_KEY, vars.form_id] });
    },
    onError: (err) => {
      toast.error(`Erro ao adicionar campo: ${err.message}`);
    },
  });
}

// ── 8b. useUpdateFormularioCampo ────────────────────────────────────────────

export interface UpdateCampoInput {
  id: string;
  form_id: string;
  patch: Partial<Omit<FormularioCampo, 'id' | 'form_id'>>;
}

/**
 * Atualiza um campo do formulário.
 */
export function useUpdateFormularioCampo() {
  const qc = useQueryClient();

  return useMutation<FormularioCampo, Error, UpdateCampoInput>({
    mutationFn: async ({ id, patch }) => {
      // EM054: usar sbForms até types.ts regenerado
      const { data, error } = await sbForms
        .from('formulario_campos')
        .update(patch)
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw error;
      return data as FormularioCampo;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: [FORMULARIO_KEY, vars.form_id] });
    },
    onError: (err) => {
      toast.error(`Erro ao atualizar campo: ${err.message}`);
    },
  });
}

// ── 8c. useDeleteFormularioCampo ────────────────────────────────────────────

export interface DeleteCampoInput {
  id: string;
  form_id: string;
}

/**
 * Remove um campo do formulário.
 */
export function useDeleteFormularioCampo() {
  const qc = useQueryClient();

  return useMutation<void, Error, DeleteCampoInput>({
    mutationFn: async ({ id }) => {
      // EM054: usar sbForms até types.ts regenerado
      const { error } = await sbForms.from('formulario_campos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: [FORMULARIO_KEY, vars.form_id] });
      toast.success('Campo removido');
    },
    onError: (err) => {
      toast.error(`Erro ao remover campo: ${err.message}`);
    },
  });
}

// ── 8d. useReorderFormularioCampos ──────────────────────────────────────────

export interface ReorderCamposInput {
  form_id: string;
  ordens: { id: string; ordem: number }[];
}

/**
 * Atualiza a ordem de múltiplos campos em paralelo.
 * Usa Promise.all — se um falhar, o resto pode já ter sido aplicado;
 * a invalidação subsequente corrige a UI.
 */
export function useReorderFormularioCampos() {
  const qc = useQueryClient();

  return useMutation<void, Error, ReorderCamposInput>({
    mutationFn: async ({ ordens }) => {
      await Promise.all(
        ordens.map(({ id, ordem }) =>
          // EM054: usar sbForms até types.ts regenerado
          sbForms
            .from('formulario_campos')
            .update({ ordem })
            .eq('id', id)
            .then(({ error }: { error: Error | null }) => {
              if (error) throw error;
            })
        )
      );
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: [FORMULARIO_KEY, vars.form_id] });
    },
    onError: (err) => {
      toast.error(`Erro ao reordenar campos: ${err.message}`);
      // A invalidação forçada sincroniza o estado real do banco
      qc.invalidateQueries({ queryKey: [FORMULARIO_KEY] });
    },
  });
}

// ── 9. useFormularioMetrics ─────────────────────────────────────────────────

export interface FormularioMetrics {
  total_respostas: number;
  total_visitas: number;
  taxa_conversao: number; // valor entre 0 e 1
  serie_diaria: { dia: string; count: number }[]; // últimos 7 dias, ISO date
}

/**
 * KPIs de um formulário: contagens, taxa de conversão e série diária de
 * respostas dos últimos 7 dias.
 */
export function useFormularioMetrics(id?: string) {
  return useQuery<FormularioMetrics>({
    queryKey: [FORMULARIO_METRICS_KEY, id],
    queryFn: async () => {
      if (!id) throw new Error('id obrigatório');

      // Coleta dados em paralelo
      const dataLimite = new Date();
      dataLimite.setDate(dataLimite.getDate() - 6); // últimos 7 dias (hoje + 6 anteriores)
      const dataLimiteISO = dataLimite.toISOString().slice(0, 10); // YYYY-MM-DD

      const [formRes, respostasRes, serieRes] = await Promise.all([
        // total_visitas vem do registro do formulário
        // EM054: usar sbForms até types.ts regenerado
        sbForms.from('formularios').select('total_visitas').eq('id', id).single(),
        // total de respostas
        // EM054: usar sbForms até types.ts regenerado
        sbForms
          .from('formulario_respostas')
          .select('id', { count: 'exact', head: true })
          .eq('form_id', id),
        // série diária — apenas created_at para agregar no cliente
        // EM054: usar sbForms até types.ts regenerado
        sbForms
          .from('formulario_respostas')
          .select('created_at')
          .eq('form_id', id)
          .gte('created_at', `${dataLimiteISO}T00:00:00.000Z`),
      ]);

      if (formRes.error) throw formRes.error;
      if (respostasRes.error) throw respostasRes.error;
      if (serieRes.error) throw serieRes.error;

      const total_visitas = (formRes.data as { total_visitas: number }).total_visitas ?? 0;
      const total_respostas = respostasRes.count ?? 0;
      const taxa_conversao = total_visitas > 0 ? total_respostas / total_visitas : 0;

      // Agrega respostas por dia no cliente
      const contagem = new Map<string, number>();
      // Pré-popula os últimos 7 dias com 0
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        contagem.set(d.toISOString().slice(0, 10), 0);
      }
      for (const row of (serieRes.data ?? []) as { created_at: string }[]) {
        const dia = row.created_at.slice(0, 10);
        contagem.set(dia, (contagem.get(dia) ?? 0) + 1);
      }

      const serie_diaria = Array.from(contagem.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([dia, count]) => ({ dia, count }));

      return {
        total_respostas,
        total_visitas,
        taxa_conversao,
        serie_diaria,
      };
    },
    enabled: !!id,
  });
}

// ── 10. useUploadFormularioImagem ───────────────────────────────────────────

export interface UploadFormularioImagemInput {
  formId: string;
  file: File;
}

export interface UploadFormularioImagemResult {
  path: string;
  url: string;
}

/**
 * Faz upload de uma imagem para o bucket 'formularios' e retorna a URL pública.
 * Valida client-side: apenas jpeg/png/webp/gif, máx 5 MB.
 * Path: `<formId>/<uuid>.<ext>`
 */
export function useUploadFormularioImagem() {
  return useMutation<UploadFormularioImagemResult, Error, UploadFormularioImagemInput>({
    mutationFn: async ({ formId, file }) => {
      // Validação client-side
      if (!UPLOAD_ALLOWED_MIMES.includes(file.type)) {
        throw new Error('Formato não suportado. Use JPEG, PNG, WebP ou GIF.');
      }
      if (file.size > UPLOAD_MAX_BYTES) {
        throw new Error('Imagem muito grande. O limite é 5 MB.');
      }

      const ext = fileExt(file);
      const path = `${formId}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from('formularios')
        .upload(path, file, {
          contentType: file.type,
          upsert: false,
          cacheControl: '3600',
        });

      if (uploadErr) throw new Error(`Falha no upload: ${uploadErr.message}`);

      const { data: pub } = supabase.storage.from('formularios').getPublicUrl(path);

      return { path, url: pub.publicUrl };
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });
}
