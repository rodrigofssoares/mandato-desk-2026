// EM054 — Studio 3 painéis: Paleta | Prévia ao vivo | Inspetor
import { useState, useCallback, useRef } from 'react';
import {
  Image as ImageIcon, Video as VideoIcon,
  GripVertical, ChevronUp, ChevronDown, Trash2, Plus, Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  useAddFormularioCampo,
  useUpdateFormularioCampo,
  useDeleteFormularioCampo,
  useReorderFormularioCampos,
  useUpdateFormulario,
  useUploadFormularioImagem,
  useUploadFormularioMidia,
} from '@/hooks/useFormularios';
import {
  FIELD_TYPES_COM_OPCOES,
  FIELD_TYPE_LABELS,
  type Formulario,
  type FormularioCampo,
  type FieldType,
  type TemaFormulario,
} from '@/types/formularios';
import { CampoInspetor, FieldIcon } from './CampoInspetor';

// ── Grupos de campo para a paleta ─────────────────────────────────────────────

const GRUPOS_PALETA: { label: string; tipos: FieldType[] }[] = [
  { label: 'Texto', tipos: ['texto_curto', 'paragrafo', 'telefone', 'email', 'cpf'] },
  { label: 'Escolhas', tipos: ['escolha_unica', 'checkboxes', 'lista'] },
  { label: 'Mídia & Layout', tipos: ['imagem', 'video', 'data', 'secao'] },
];

// ── Paleta de tipos de campo ──────────────────────────────────────────────────

interface PaletaProps {
  onAdd: (tipo: FieldType) => void;
  isAdding: boolean;
}

function Paleta({ onAdd, isAdding }: PaletaProps) {
  return (
    <aside className="w-56 border-r bg-card overflow-y-auto shrink-0 p-3">
      {GRUPOS_PALETA.map((grupo) => (
        <div key={grupo.label}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 mt-3 first:mt-0 px-1">
            {grupo.label}
          </p>
          {grupo.tipos.map((tipo) => (
            <button
              key={tipo}
              type="button"
              disabled={isAdding}
              onClick={() => onAdd(tipo)}
              className="
                w-full flex items-center gap-2.5 px-2.5 py-2.5 mb-1.5 rounded-lg
                border bg-muted/30 text-sm font-semibold text-muted-foreground
                hover:border-primary hover:text-primary hover:bg-card
                transition-all duration-100 cursor-pointer disabled:opacity-50
                text-left
              "
              aria-label={`Adicionar campo ${FIELD_TYPE_LABELS[tipo]}`}
            >
              <FieldIcon tipo={tipo} />
              {FIELD_TYPE_LABELS[tipo]}
              <GripVertical className="ml-auto h-3.5 w-3.5 opacity-40" />
            </button>
          ))}
        </div>
      ))}
    </aside>
  );
}

// ── Prévia de um campo no device ──────────────────────────────────────────────

interface CampoPreviaProps {
  campo: FormularioCampo;
  selecionado: boolean;
  onSelect: () => void;
  onMoverUp: () => void;
  onMoverDown: () => void;
  onExcluir: () => void;
  podeSubir: boolean;
  podeDescer: boolean;
  corDestaque: string;
}

function CampoPrevia({
  campo,
  selecionado,
  onSelect,
  onMoverUp,
  onMoverDown,
  onExcluir,
  podeSubir,
  podeDescer,
  corDestaque,
}: CampoPreviaProps) {
  return (
    <div
      className={`
        relative rounded-xl p-3.5 mb-2.5 cursor-pointer border transition-all
        ${selecionado
          ? 'border-primary shadow-[0_0_0_3px_rgba(123,30,46,.08)]'
          : 'border-transparent hover:bg-muted/30'
        }
      `}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect()}
      aria-pressed={selecionado}
      aria-label={`Campo: ${campo.rotulo || FIELD_TYPE_LABELS[campo.tipo]}`}
    >
      {selecionado && (
        <span
          className="absolute -top-2.5 left-3 text-white text-[9px] font-bold px-2 py-0.5 rounded"
          style={{ backgroundColor: corDestaque || 'hsl(var(--primary))' }}
        >
          editando
        </span>
      )}

      {/* Rótulo */}
      {campo.tipo !== 'secao' ? (
        <label className="block font-semibold text-sm mb-1.5 pointer-events-none">
          {campo.rotulo || <span className="text-muted-foreground italic">Sem rótulo</span>}
          {campo.obrigatorio && <span className="text-destructive ml-0.5">*</span>}
        </label>
      ) : (
        <p className="font-bold text-base mb-1">
          {campo.rotulo || <span className="text-muted-foreground italic">Título de seção</span>}
        </p>
      )}

      {/* Ajuda */}
      {campo.ajuda && (
        <p className="text-xs text-muted-foreground mb-1.5">{campo.ajuda}</p>
      )}

      {/* Corpo por tipo */}
      {campo.tipo === 'secao' ? null : campo.tipo === 'imagem' ? (
        typeof campo.config?.url === 'string' && campo.config.url ? (
          <img
            src={campo.config.url as string}
            alt={campo.rotulo || 'Imagem do campo'}
            className="w-full max-h-40 object-contain rounded-lg border bg-muted/30"
          />
        ) : (
          <div className="border-2 border-dashed rounded-lg h-20 flex items-center justify-center bg-muted/40 text-xs text-muted-foreground gap-2">
            <ImageIcon className="h-4 w-4" />
            Clique e use "Enviar imagem" no painel à direita
          </div>
        )
      ) : campo.tipo === 'video' ? (
        typeof campo.config?.url === 'string' && campo.config.url ? (
          <video src={campo.config.url as string} controls className="w-full max-h-40 rounded-lg border bg-muted/30" />
        ) : (
          <div className="border-2 border-dashed rounded-lg h-20 flex items-center justify-center bg-muted/40 text-xs text-muted-foreground gap-2">
            <VideoIcon className="h-4 w-4" />
            Clique e use "Enviar vídeo" no painel à direita
          </div>
        )
      ) : campo.tipo === 'data' ? (
        <div className="border rounded-lg px-3 py-2 text-sm text-muted-foreground bg-muted/30">
          DD/MM/AAAA
        </div>
      ) : FIELD_TYPES_COM_OPCOES.includes(campo.tipo) ? (
        <div className="space-y-1.5">
          {(campo.opcoes ?? []).slice(0, 3).map((op, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="w-3.5 h-3.5 rounded-full border border-current shrink-0" />
              {op.label}
            </div>
          ))}
          {(campo.opcoes ?? []).length === 0 && (
            <p className="text-xs text-muted-foreground italic">Nenhuma opção ainda</p>
          )}
          {(campo.opcoes ?? []).length > 3 && (
            <p className="text-xs text-muted-foreground">+{(campo.opcoes ?? []).length - 3} opções...</p>
          )}
        </div>
      ) : (
        <div className="border rounded-lg px-3 py-2 text-sm text-muted-foreground bg-muted/30">
          {campo.tipo === 'telefone' ? '(00) 0 0000-0000'
            : campo.tipo === 'email' ? 'email@exemplo.com'
            : campo.tipo === 'cpf' ? '000.000.000-00'
            : campo.tipo === 'paragrafo' ? 'Resposta longa...'
            : 'Resposta de texto curto'}
        </div>
      )}

      {/* Ações de reordenação/exclusão */}
      {selecionado && (
        <div
          className="flex gap-1 mt-2.5 pt-2 border-t"
          onClick={(e) => e.stopPropagation()}
        >
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onMoverUp} disabled={!podeSubir} aria-label="Mover acima">
            <ChevronUp className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onMoverDown} disabled={!podeDescer} aria-label="Mover abaixo">
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 ml-auto text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={onExcluir}
            aria-label="Excluir campo"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ── FormBuilderStudio ─────────────────────────────────────────────────────────

interface FormBuilderStudioProps {
  formulario: Formulario;
  campos: FormularioCampo[];
}

export function FormBuilderStudio({ formulario, campos }: FormBuilderStudioProps) {
  const [campoSelecionadoId, setCampoSelecionadoId] = useState<string | null>(null);
  const campoSelecionado = campos.find((c) => c.id === campoSelecionadoId) ?? null;

  const addCampoMutation = useAddFormularioCampo();
  const updateCampoMutation = useUpdateFormularioCampo();
  const deleteCampoMutation = useDeleteFormularioCampo();
  const reorderMutation = useReorderFormularioCampos();
  const updateFormMutation = useUpdateFormulario();
  const uploadMutation = useUploadFormularioImagem();
  const uploadMidiaMutation = useUploadFormularioMidia();

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Salva um patch de campo direto (o debounce/acúmulo vive dentro do inspetor).
  const handleSaveCampo = useCallback(
    (campoId: string, patch: Partial<FormularioCampo>) => {
      updateCampoMutation.mutate({ id: campoId, form_id: formulario.id, patch });
    },
    [updateCampoMutation, formulario.id]
  );

  // Upload de mídia (imagem ou vídeo) de um campo → retorna a URL pública.
  const handleUploadMidiaCampo = useCallback(
    async (file: File): Promise<string> => {
      const result = await uploadMidiaMutation.mutateAsync({ formId: formulario.id, file });
      return result.url;
    },
    [uploadMidiaMutation, formulario.id]
  );

  async function handleAdicionarCampo(tipo: FieldType) {
    // O hook aplica os defaults inteligentes por tipo (rótulo/ajuda/mapeamento).
    // texto_curto/parágrafo continuam sem rótulo; e-mail/CPF/telefone já vêm prontos.
    const novo = await addCampoMutation.mutateAsync({ form_id: formulario.id, tipo });
    setCampoSelecionadoId(novo.id);
  }

  async function handleExcluirCampo(campo: FormularioCampo) {
    await deleteCampoMutation.mutateAsync({ id: campo.id, form_id: formulario.id });
    if (campoSelecionadoId === campo.id) setCampoSelecionadoId(null);
  }

  async function handleMover(campo: FormularioCampo, direcao: 'up' | 'down') {
    const idx = campos.indexOf(campo);
    if (direcao === 'up' && idx === 0) return;
    if (direcao === 'down' && idx === campos.length - 1) return;
    const outro = campos[direcao === 'up' ? idx - 1 : idx + 1];
    await reorderMutation.mutateAsync({
      form_id: formulario.id,
      ordens: [
        { id: campo.id, ordem: outro.ordem },
        { id: outro.id, ordem: campo.ordem },
      ],
    });
  }

  async function handleUploadCapa(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await uploadMutation.mutateAsync({ formId: formulario.id, file });
    await updateFormMutation.mutateAsync({ id: formulario.id, patch: { capa_url: result.url } });
  }

  const corTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function handleTemaCor(cor: string) {
    // Debounce: <input type="color"> dispara muitos onChange ao arrastar.
    if (corTimerRef.current) clearTimeout(corTimerRef.current);
    corTimerRef.current = setTimeout(() => {
      const tema: TemaFormulario = {
        ...(formulario.tema ?? { cantos: 'arredondado', fundo: 'branco', mostrar_logo: false }),
        cor,
      };
      updateFormMutation.mutate({ id: formulario.id, patch: { tema } });
    }, 500);
  }

  const cor = formulario.tema?.cor ?? 'hsl(var(--primary))';

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Paleta à esquerda */}
      <Paleta onAdd={handleAdicionarCampo} isAdding={addCampoMutation.isPending} />

      {/* Prévia central */}
      <div className="flex-1 overflow-y-auto bg-gradient-to-b from-muted/20 to-background p-6 flex justify-center">
        <div className="w-full max-w-xl">
          {/* Capa */}
          <div
            className="relative h-32 rounded-t-xl flex items-end p-4 overflow-hidden"
            style={{ backgroundColor: cor }}
          >
            <span className="absolute top-3 left-4 text-[10px] font-bold bg-white/90 text-primary px-2.5 py-0.5 rounded-full">
              PRÉVIA AO VIVO
            </span>
            <h2 className="text-white font-bold text-xl z-10">{formulario.titulo}</h2>

            <button
              type="button"
              className="absolute top-3 right-3 bg-white/20 hover:bg-white/30 text-white rounded-lg p-1.5 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Upload de imagem de capa"
            >
              <Upload className="h-3.5 w-3.5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleUploadCapa}
              aria-label="Selecionar imagem de capa"
            />

            <label className="absolute bottom-3 right-3" aria-label="Cor de destaque">
              <input
                type="color"
                value={formulario.tema?.cor ?? '#7B1E2E'}
                onChange={(e) => handleTemaCor(e.target.value)}
                className="w-7 h-7 rounded cursor-pointer border-2 border-white/60 bg-transparent p-0.5"
                aria-label="Escolher cor"
              />
            </label>
          </div>

          {/* Campos */}
          <div className="bg-card border border-t-0 rounded-b-xl p-5 shadow-sm min-h-[200px]">
            {campos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                  <Plus className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">Nenhum campo ainda</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Clique em um tipo de campo na paleta à esquerda.
                  </p>
                </div>
              </div>
            ) : (
              campos.map((campo, idx) => (
                <CampoPrevia
                  key={campo.id}
                  campo={campo}
                  selecionado={campo.id === campoSelecionadoId}
                  onSelect={() =>
                    setCampoSelecionadoId(
                      campo.id === campoSelecionadoId ? null : campo.id
                    )
                  }
                  onMoverUp={() => handleMover(campo, 'up')}
                  onMoverDown={() => handleMover(campo, 'down')}
                  onExcluir={() => handleExcluirCampo(campo)}
                  podeSubir={idx > 0}
                  podeDescer={idx < campos.length - 1}
                  corDestaque={cor}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Inspetor à direita */}
      <CampoInspetor
        campo={campoSelecionado}
        onSave={handleSaveCampo}
        onUploadMidia={handleUploadMidiaCampo}
      />
    </div>
  );
}
