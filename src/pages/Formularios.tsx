// EM054 — Lista "Meus formulários" (rota /formularios)
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Plus, Trash2, X, CheckSquare, EyeOff, CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/ui-system';
import { useFormularios, useCreateFormulario, useBulkDeleteFormularios } from '@/hooks/useFormularios';
import { usePermissions } from '@/hooks/usePermissions';
import { FormCard } from '@/components/formularios/FormCard';
import type { FormularioComMetricas, FormularioStatus } from '@/types/formularios';

// ── Tipos de filtro ───────────────────────────────────────────────────────────

type FiltroStatus = 'todos' | FormularioStatus;

const FILTROS: { id: FiltroStatus; label: string }[] = [
  { id: 'ativo', label: 'Ativos' },
  { id: 'agendado', label: 'Agendados' },
  { id: 'encerrado', label: 'Encerrados' },
  { id: 'rascunho', label: 'Rascunhos' },
  { id: 'todos', label: 'Todos' },
];

// ── Dialog de criação ─────────────────────────────────────────────────────────

interface CriarFormularioDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

function CriarFormularioDialog({ open, onOpenChange }: CriarFormularioDialogProps) {
  const navigate = useNavigate();
  const createMutation = useCreateFormulario();
  const [titulo, setTitulo] = useState('');

  async function handleCriar() {
    if (!titulo.trim()) return;
    const novo = await createMutation.mutateAsync({ titulo: titulo.trim() });
    setTitulo('');
    onOpenChange(false);
    navigate(`/formularios/${novo.id}`);
  }

  function handleOpenChange(v: boolean) {
    if (!v) setTitulo('');
    onOpenChange(v);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Novo formulário</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="novo-titulo">Título do formulário</Label>
          <Input
            id="novo-titulo"
            autoFocus
            placeholder="Ex: Cadastro Cultura Viva 2026"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCriar()}
            maxLength={120}
            aria-label="Título do novo formulário"
          />
          <p className="text-xs text-muted-foreground">
            O slug e o link público serão gerados automaticamente.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleCriar}
            disabled={!titulo.trim() || createMutation.isPending}
          >
            {createMutation.isPending ? 'Criando...' : 'Criar e abrir editor'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Sem acesso ────────────────────────────────────────────────────────────────

function SemAcesso() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 text-center py-20">
      <EyeOff className="h-10 w-10 text-muted-foreground" />
      <div>
        <h2 className="font-semibold text-lg">Acesso restrito</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Você não tem permissão para visualizar os formulários.
        </p>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function Formularios() {
  const { can } = usePermissions();
  const { data: formularios = [], isLoading, error, refetch } = useFormularios();
  const bulkDeleteMutation = useBulkDeleteFormularios();

  const [criarOpen, setCriarOpen] = useState(false);
  const [filtro, setFiltro] = useState<FiltroStatus>('ativo');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmBulkOpen, setConfirmBulkOpen] = useState(false);

  // ── Permissões ──────────────────────────────────────────────────────────────

  if (!can.viewFormularios()) {
    return (
      <div className="p-6">
        <SemAcesso />
      </div>
    );
  }

  // ── Filtro e contagens ──────────────────────────────────────────────────────

  const formulariosFiltrados = useMemo(() => {
    if (filtro === 'todos') return formularios;
    return formularios.filter((f) => f.status === filtro);
  }, [formularios, filtro]);

  const contagens = useMemo(() => {
    const c: Record<FiltroStatus, number> = {
      ativo: 0, agendado: 0, encerrado: 0, rascunho: 0, todos: formularios.length,
    };
    formularios.forEach((f) => {
      if (f.status in c) c[f.status as FormularioStatus]++;
    });
    return c;
  }, [formularios]);

  // ── Seleção ─────────────────────────────────────────────────────────────────

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleTodos() {
    if (selectedIds.size === formulariosFiltrados.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(formulariosFiltrados.map((f) => f.id)));
    }
  }

  function cancelarSelecao() {
    setSelectMode(false);
    setSelectedIds(new Set());
  }

  async function handleBulkDelete() {
    await bulkDeleteMutation.mutateAsync(Array.from(selectedIds));
    cancelarSelecao();
    setConfirmBulkOpen(false);
  }

  // ── Render: loading ─────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-36" />
        </div>
        <Skeleton className="h-10 w-80" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  // ── Render: erro ────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="p-6">
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm"
        >
          <p className="font-medium text-destructive">Erro ao carregar formulários</p>
          <p className="text-muted-foreground mt-1">{(error as Error).message}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  // ── Render principal ────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        eyebrow="Comunicação"
        title="Formulários"
        description={`${contagens.ativo} formulário${contagens.ativo !== 1 ? 's' : ''} ativo${contagens.ativo !== 1 ? 's' : ''}. Clique num card para abrir o editor.`}
        icon={FileText}
        actions={
          <div className="flex gap-2">
            {can.bulkDeleteFormularios() && !selectMode && formularios.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectMode(true)}
                aria-label="Selecionar formulários para exclusão em massa"
              >
                <CheckSquare className="h-3.5 w-3.5 mr-1.5" />
                Selecionar
              </Button>
            )}
            {can.createFormulario() && (
              <Button size="sm" onClick={() => setCriarOpen(true)}>
                <Plus className="h-4 w-4 mr-1.5" />
                Novo formulário
              </Button>
            )}
          </div>
        }
      />

      {/* Barra de seleção em massa */}
      {selectMode && (
        <div
          className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-xl"
          role="toolbar"
          aria-label="Barra de ações em massa"
        >
          <Button variant="ghost" size="sm" onClick={toggleTodos} className="text-xs">
            {selectedIds.size === formulariosFiltrados.length ? 'Desmarcar todos' : 'Marcar todos'}
          </Button>
          <span className="text-xs text-muted-foreground">
            {selectedIds.size} selecionado{selectedIds.size !== 1 ? 's' : ''}
          </span>
          <div className="ml-auto flex gap-2">
            {selectedIds.size > 0 && (
              <Button
                variant="destructive"
                size="sm"
                className="text-xs"
                onClick={() => setConfirmBulkOpen(true)}
                aria-label={`Excluir ${selectedIds.size} formulários selecionados`}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Excluir ({selectedIds.size})
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={cancelarSelecao}
              aria-label="Cancelar seleção"
            >
              <X className="h-3.5 w-3.5 mr-1.5" />
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Filtros de status */}
      <div
        className="flex items-center gap-1 bg-card border p-1 rounded-xl w-fit"
        role="group"
        aria-label="Filtrar formulários por status"
      >
        {FILTROS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setFiltro(id)}
            className={`
              px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors
              ${filtro === id
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }
            `}
            aria-pressed={filtro === id}
            aria-label={`Filtrar por ${label} (${contagens[id]})`}
          >
            {label} ({contagens[id]})
          </button>
        ))}
      </div>

      {/* Grid de cards */}
      {formulariosFiltrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 text-center py-16 border-2 border-dashed rounded-xl">
          <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center">
            {filtro === 'ativo' ? (
              <FileText className="h-7 w-7 text-muted-foreground" />
            ) : (
              <CalendarClock className="h-7 w-7 text-muted-foreground" />
            )}
          </div>
          <div>
            <p className="text-sm font-medium">Nenhum formulário {filtro !== 'todos' ? `${FILTROS.find(f => f.id === filtro)?.label.toLowerCase()}` : ''}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {filtro === 'todos' || filtro === 'ativo'
                ? 'Crie o primeiro clicando em "+ Novo formulário".'
                : `Nenhum formulário com este status no momento.`}
            </p>
          </div>
          {can.createFormulario() && (filtro === 'todos' || filtro === 'ativo') && (
            <Button size="sm" onClick={() => setCriarOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Criar primeiro formulário
            </Button>
          )}
        </div>
      ) : (
        <div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          role="list"
          aria-label="Lista de formulários"
        >
          {formulariosFiltrados.map((form) => (
            <div key={form.id} role="listitem">
              <FormCard
                form={form}
                selected={selectedIds.has(form.id)}
                selectMode={selectMode}
                onToggleSelect={toggleSelect}
                canEdit={can.editFormulario()}
                canDelete={can.deleteFormulario()}
              />
            </div>
          ))}
        </div>
      )}

      {/* Banner informativo */}
      {formularios.length > 0 && (
        <div className="flex items-start gap-3 border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-950/20 rounded-lg p-3 text-xs">
          <CalendarClock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong className="text-amber-800 dark:text-amber-400">Fechamento automático.</strong>
            <span className="text-muted-foreground ml-1">
              Cada formulário tem data/hora de abertura e de encerramento. Quando o prazo termina,
              o link público fecha sozinho — sem precisar desativar manualmente.
            </span>
          </div>
        </div>
      )}

      {/* Dialog de criar */}
      <CriarFormularioDialog open={criarOpen} onOpenChange={setCriarOpen} />

      {/* AlertDialog de exclusão em massa */}
      <AlertDialog open={confirmBulkOpen} onOpenChange={setConfirmBulkOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {selectedIds.size} formulário(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os campos e respostas dos formulários selecionados serão excluídos
              permanentemente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleBulkDelete}
              disabled={bulkDeleteMutation.isPending}
            >
              Excluir {selectedIds.size} formulário(s)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
