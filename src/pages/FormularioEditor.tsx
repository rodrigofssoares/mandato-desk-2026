// EM054-v2 — Editor de formulário (rota /formularios/:id)
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, FileText, PencilRuler, GitMerge, BarChart3, Eye,
  Send, EyeOff, CheckCircle2, Loader2, ListChecks,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import type { FormularioStatus } from '@/types/formularios';
import { useFormulario, useUpdateFormulario } from '@/hooks/useFormularios';
import { usePermissions } from '@/hooks/usePermissions';
import { FormBuilderStudio } from '@/components/formularios/FormBuilderStudio';
import { MappingPanel } from '@/components/formularios/MappingPanel';
import { MetricsPanel } from '@/components/formularios/MetricsPanel';
import { PublishPanel } from '@/components/formularios/PublishPanel';
import { ResultadosPanel } from '@/components/formularios/ResultadosPanel';

type EditorTab = 'construtor' | 'mapeamento' | 'resultados' | 'metricas' | 'publica';

// ── Indicador de autosave ─────────────────────────────────────────────────────

function SaveIndicator({ isSaving, lastSaved }: { isSaving: boolean; lastSaved: Date | null }) {
  if (isSaving) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Salvando...
      </span>
    );
  }
  if (lastSaved) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
        Salvo
      </span>
    );
  }
  return null;
}

// ── Sem acesso ────────────────────────────────────────────────────────────────

function SemAcesso() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
      <EyeOff className="h-10 w-10 text-muted-foreground" />
      <div>
        <h2 className="font-semibold text-lg">Acesso restrito</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Você não tem permissão para editar formulários.
        </p>
      </div>
      <Button variant="outline" onClick={() => navigate('/formularios')}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Voltar para a lista
      </Button>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function FormularioEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { can } = usePermissions();

  const tabParam = searchParams.get('tab') as EditorTab | null;
  const [abaAtiva, setAbaAtiva] = useState<EditorTab>(tabParam ?? 'construtor');

  const { data, isLoading, error } = useFormulario(id);
  const updateMutation = useUpdateFormulario();

  const [tituloEditando, setTituloEditando] = useState(false);
  const [tituloTemp, setTituloTemp] = useState('');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup do debounce do título ao desmontar (evita salvar sobre componente morto).
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Sincroniza aba com searchParam
  useEffect(() => {
    if (tabParam && tabParam !== abaAtiva) {
      setAbaAtiva(tabParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabParam]);

  function mudarAba(aba: EditorTab) {
    setAbaAtiva(aba);
    setSearchParams(aba !== 'construtor' ? { tab: aba } : {});
  }

  // Autosave do título com debounce
  const salvarTitulo = useCallback(
    async (novoTitulo: string) => {
      if (!id || !novoTitulo.trim()) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        await updateMutation.mutateAsync({ id, patch: { titulo: novoTitulo.trim() } });
        setLastSaved(new Date());
      }, 800);
    },
    [id, updateMutation]
  );

  async function handlePublicar() {
    if (!id || !data) return;
    let patch: { publicado: boolean; status: FormularioStatus };
    if (data.formulario.publicado) {
      // Despublicando → volta para rascunho.
      patch = { publicado: false, status: 'rascunho' };
    } else {
      // Publicando → status calculado pela janela: se abre no futuro, fica
      // 'agendado' (o cron promove para 'ativo' na hora); senão já 'ativo'.
      const now = Date.now();
      const abre = data.formulario.abre_em ? new Date(data.formulario.abre_em).getTime() : null;
      const status: FormularioStatus = abre && abre > now ? 'agendado' : 'ativo';
      patch = { publicado: true, status };
    }
    await updateMutation.mutateAsync({ id, patch });
    setLastSaved(new Date());
  }

  // ── Guards ──────────────────────────────────────────────────────────────────

  if (!can.viewFormularios()) {
    return <SemAcesso />;
  }

  if (!can.editFormulario()) {
    return <SemAcesso />;
  }

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        {/* Header skeleton */}
        <div className="h-14 border-b flex items-center gap-3 px-4">
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-8 w-72 ml-4" />
          <Skeleton className="h-8 w-24 ml-auto" />
        </div>
        <div className="flex-1 p-6">
          <Skeleton className="h-full w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div
        role="alert"
        className="m-6 p-4 rounded-lg border border-destructive/30 bg-destructive/5 text-sm text-destructive"
      >
        <p className="font-medium">Erro ao carregar formulário</p>
        <p className="text-xs mt-1">{(error as Error)?.message ?? 'Formulário não encontrado.'}</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => navigate('/formularios')}
        >
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
          Voltar
        </Button>
      </div>
    );
  }

  const { formulario, campos } = data;
  const publicado = formulario.publicado;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Topbar do editor */}
      <header className="h-14 border-b bg-card flex items-center gap-2 px-4 shrink-0 flex-wrap">
        {/* Voltar */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => navigate('/formularios')}
          aria-label="Voltar para a lista de formulários"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        {/* Título editável */}
        <div className="flex items-center gap-1.5 min-w-0">
          <FileText className="h-4 w-4 text-primary shrink-0" />
          {tituloEditando ? (
            <Input
              autoFocus
              value={tituloTemp}
              onChange={(e) => {
                setTituloTemp(e.target.value);
                salvarTitulo(e.target.value);
              }}
              onBlur={() => setTituloEditando(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setTituloEditando(false);
                if (e.key === 'Escape') {
                  setTituloEditando(false);
                  setTituloTemp(formulario.titulo);
                }
              }}
              className="h-8 text-sm font-semibold w-64 max-w-full"
              aria-label="Título do formulário"
            />
          ) : (
            <button
              type="button"
              className="text-sm font-semibold text-foreground truncate max-w-[200px] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
              onClick={() => {
                setTituloTemp(formulario.titulo);
                setTituloEditando(true);
              }}
              aria-label="Editar título do formulário"
            >
              {formulario.titulo}
            </button>
          )}
        </div>

        {/* Abas de navegação */}
        <nav
          className="flex items-center gap-1 ml-3"
          role="navigation"
          aria-label="Abas do editor"
        >
          {(
            [
              { id: 'construtor', label: 'Construtor', Icon: PencilRuler },
              { id: 'mapeamento', label: 'Mapeamento', Icon: GitMerge },
              { id: 'resultados', label: 'Resultados', Icon: ListChecks },
              { id: 'metricas', label: 'Métricas', Icon: BarChart3 },
              { id: 'publica', label: 'Pública', Icon: Eye },
            ] as const
          ).map(({ id: tabId, label, Icon }) => (
            <button
              key={tabId}
              type="button"
              onClick={() => mudarAba(tabId)}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors
                ${abaAtiva === tabId
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }
              `}
              aria-current={abaAtiva === tabId ? 'page' : undefined}
              aria-label={`Aba ${label}`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </nav>

        {/* Indicador de save + botão publicar */}
        <div className="ml-auto flex items-center gap-3 shrink-0">
          <SaveIndicator isSaving={updateMutation.isPending} lastSaved={lastSaved} />

          <Button
            size="sm"
            className={`h-8 text-xs ${publicado ? 'bg-amber-600 hover:bg-amber-700' : 'bg-primary hover:bg-primary/90'}`}
            onClick={handlePublicar}
            disabled={updateMutation.isPending}
            aria-label={publicado ? 'Despublicar formulário' : 'Publicar formulário'}
          >
            {publicado ? (
              <>
                <EyeOff className="h-3.5 w-3.5 mr-1.5" />
                Despublicar
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5 mr-1.5" />
                Publicar
              </>
            )}
          </Button>
        </div>
      </header>

      {/* Conteúdo das abas */}
      <div className="flex-1 overflow-hidden">
        {abaAtiva === 'construtor' && (
          <FormBuilderStudio formulario={formulario} campos={campos} />
        )}
        {abaAtiva === 'mapeamento' && (
          <div className="h-full overflow-y-auto">
            <MappingPanel formulario={formulario} campos={campos} />
          </div>
        )}
        {abaAtiva === 'resultados' && (
          <div className="h-full overflow-y-auto">
            <ResultadosPanel formulario={formulario} campos={campos} />
          </div>
        )}
        {abaAtiva === 'metricas' && (
          <div className="h-full overflow-y-auto">
            <MetricsPanel formulario={formulario} />
          </div>
        )}
        {abaAtiva === 'publica' && (
          <div className="h-full overflow-y-auto">
            <PublishPanel formulario={formulario} />
          </div>
        )}
      </div>
    </div>
  );
}
