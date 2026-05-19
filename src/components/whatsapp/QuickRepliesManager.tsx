// Componente: QuickRepliesManager
//
// CRUD completo de respostas rápidas organizadas por categoria.
// Acessível do AccountFormDialog ou de qualquer ponto que precise gerenciar snippets.
//
// Funcionalidades:
//   - Lista respostas agrupadas por categoria (seções colapsáveis)
//   - Formulário modal para criar/editar (título, categoria, corpo)
//   - Preview do corpo com variáveis {{nome}} destacadas
//   - AlertDialog de confirmação antes de excluir
//
// Referência: RAQ-MAND-EM073 — T46

import { useState, useMemo } from 'react';
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, Zap } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useQuickReplies, type QuickReply } from '@/hooks/useQuickReplies';
import { extractVariables } from '@/hooks/useQuickReplies';

// ─── Schema de validação ──────────────────────────────────────────────────────

const quickReplySchema = z.object({
  titulo: z
    .string()
    .min(1, 'Título é obrigatório')
    .max(100, 'Título deve ter no máximo 100 caracteres'),
  corpo: z
    .string()
    .min(1, 'Corpo é obrigatório')
    .max(4096, 'Corpo deve ter no máximo 4096 caracteres'),
  categoria: z
    .string()
    .max(64, 'Categoria deve ter no máximo 64 caracteres')
    .optional()
    .or(z.literal('')),
});

type FormValues = z.infer<typeof quickReplySchema>;

// ─── Props ────────────────────────────────────────────────────────────────────

interface QuickRepliesManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
}

// ─── Helper: preview com variáveis destacadas ─────────────────────────────────

function BodyPreview({ corpo }: { corpo: string }) {
  if (!corpo) return null;

  // Divide em partes: texto normal e {{variavel}}
  const parts = corpo.split(/(\{\{\w+\}\})/g);
  return (
    <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap break-words">
      {parts.map((part, i) =>
        /^\{\{\w+\}\}$/.test(part) ? (
          <mark
            key={i}
            className="bg-yellow-100 text-yellow-800 rounded px-0.5 font-mono"
          >
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </p>
  );
}

// ─── FormulárioModal (criar / editar) ─────────────────────────────────────────

interface ReplyFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: QuickReply | null;
  accountId: string;
  onSave: (values: FormValues) => void;
  isSaving: boolean;
  /** Categorias já existentes — exibidas como sugestão */
  existingCategories: string[];
}

function ReplyFormDialog({
  open,
  onOpenChange,
  initial,
  onSave,
  isSaving,
  existingCategories,
}: ReplyFormDialogProps) {
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(quickReplySchema),
    defaultValues: {
      titulo: initial?.titulo ?? '',
      corpo: initial?.corpo ?? '',
      categoria: initial?.categoria ?? '',
    },
  });

  const corpo = watch('corpo') ?? '';
  const vars = extractVariables(corpo);

  // Sincroniza form quando initial muda
  const isEdit = !!initial;

  function handleClose() {
    reset();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Editar resposta rápida' : 'Nova resposta rápida'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
          {/* Título */}
          <div className="space-y-1">
            <Label htmlFor="titulo">Título <span className="text-destructive">*</span></Label>
            <Input
              id="titulo"
              {...register('titulo')}
              placeholder="Ex: Saudação inicial"
              autoFocus
            />
            {errors.titulo && (
              <p className="text-xs text-destructive">{errors.titulo.message}</p>
            )}
          </div>

          {/* Categoria */}
          <div className="space-y-1">
            <Label htmlFor="categoria">Categoria <span className="text-muted-foreground text-xs">(opcional)</span></Label>
            <Input
              id="categoria"
              {...register('categoria')}
              list="categorias-list"
              placeholder="Ex: Triagem, Encerramento, Reclamação"
            />
            <datalist id="categorias-list">
              {existingCategories.map((cat) => (
                <option key={cat} value={cat} />
              ))}
            </datalist>
            {errors.categoria && (
              <p className="text-xs text-destructive">{errors.categoria.message}</p>
            )}
          </div>

          {/* Corpo */}
          <div className="space-y-1">
            <Label htmlFor="corpo">Mensagem <span className="text-destructive">*</span></Label>
            <Textarea
              id="corpo"
              {...register('corpo')}
              placeholder="Use {{nome}}, {{bairro}} etc. para variáveis que serão preenchidas ao usar"
              rows={5}
              className="resize-none"
              maxLength={4096}
            />
            <p className="text-[10px] text-muted-foreground text-right">{corpo.length}/4096</p>
            {errors.corpo && (
              <p className="text-xs text-destructive">{errors.corpo.message}</p>
            )}
          </div>

          {/* Preview */}
          {corpo && (
            <div className="rounded border bg-muted/30 p-3 space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                Preview
              </p>
              <BodyPreview corpo={corpo} />
              {vars.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {vars.map((v) => (
                    <Badge key={v} variant="secondary" className="text-[10px] font-mono">
                      {`{{${v}}}`}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Salvando...' : isEdit ? 'Atualizar' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── QuickRepliesManager ──────────────────────────────────────────────────────

export function QuickRepliesManager({ open, onOpenChange, accountId }: QuickRepliesManagerProps) {
  const { listQuery, createMutation, updateMutation, deleteMutation } = useQuickReplies(accountId);
  // Memoizado para não criar array novo a cada render, estabilizando as deps dos useMemo abaixo
  const replies = useMemo(() => listQuery.data ?? [], [listQuery.data]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<QuickReply | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<QuickReply | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  // Agrupa por categoria
  const grouped = useMemo(() => {
    const map = new Map<string, QuickReply[]>();
    for (const r of replies) {
      const key = r.categoria ?? '(Sem categoria)';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [replies]);

  const existingCategories = useMemo(
    () => [...new Set(replies.map((r) => r.categoria).filter(Boolean) as string[])],
    [replies],
  );

  function toggleCategory(cat: string) {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  function openNew() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(reply: QuickReply) {
    setEditing(reply);
    setFormOpen(true);
  }

  async function handleSave(values: FormValues) {
    const categoria = values.categoria?.trim() || null;

    if (editing) {
      await updateMutation.mutateAsync({
        id: editing.id,
        titulo: values.titulo,
        corpo: values.corpo,
        categoria,
      });
    } else {
      await createMutation.mutateAsync({
        account_id: accountId,
        titulo: values.titulo,
        corpo: values.corpo,
        categoria,
      });
    }
    setFormOpen(false);
    setEditing(null);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await deleteMutation.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Respostas Rápidas
            </DialogTitle>
          </DialogHeader>

          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-muted-foreground">
              {replies.length} resposta{replies.length !== 1 ? 's' : ''} cadastrada{replies.length !== 1 ? 's' : ''}
            </p>
            <Button size="sm" onClick={openNew}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Nova resposta
            </Button>
          </div>

          <ScrollArea className="flex-1">
            {listQuery.isLoading ? (
              <p className="text-xs text-muted-foreground text-center py-8">Carregando...</p>
            ) : replies.length === 0 ? (
              <div className="text-center py-12">
                <Zap className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">Nenhuma resposta rápida cadastrada.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Crie respostas para usar com o atalho{' '}
                  <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">/</kbd>{' '}
                  no chat.
                </p>
              </div>
            ) : (
              <div className="space-y-2 pr-3">
                {grouped.map(([cat, items]) => {
                  const isCollapsed = collapsedCategories.has(cat);
                  return (
                    <div key={cat} className="rounded-md border overflow-hidden">
                      {/* Header da categoria */}
                      <button
                        type="button"
                        onClick={() => toggleCategory(cat)}
                        className="w-full flex items-center justify-between px-3 py-2 bg-muted/40 hover:bg-muted/60 transition-colors"
                      >
                        <span className="text-xs font-semibold text-foreground">
                          {cat}{' '}
                          <span className="text-muted-foreground font-normal">({items.length})</span>
                        </span>
                        {isCollapsed
                          ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                          : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        }
                      </button>

                      {/* Items */}
                      {!isCollapsed && (
                        <div className="divide-y">
                          {items.map((reply) => (
                            <div
                              key={reply.id}
                              className="px-3 py-2.5 flex items-start justify-between gap-2 hover:bg-accent/30 transition-colors"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate">{reply.titulo}</p>
                                <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">
                                  {reply.corpo}
                                </p>
                                {reply.variaveis && reply.variaveis.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {reply.variaveis.map((v) => (
                                      <Badge
                                        key={v}
                                        variant="secondary"
                                        className="text-[9px] font-mono py-0 px-1"
                                      >
                                        {`{{${v}}}`}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  title="Editar"
                                  onClick={() => openEdit(reply)}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-destructive hover:text-destructive"
                                  title="Excluir"
                                  onClick={() => setDeleteTarget(reply)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Formulário criar/editar */}
      <ReplyFormDialog
        open={formOpen}
        onOpenChange={(v) => { setFormOpen(v); if (!v) setEditing(null); }}
        initial={editing}
        accountId={accountId}
        onSave={handleSave}
        isSaving={isSaving}
        existingCategories={existingCategories}
      />

      {/* Confirmação de exclusão */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir resposta rápida?</AlertDialogTitle>
            <AlertDialogDescription>
              A resposta <strong>"{deleteTarget?.titulo}"</strong> será excluída permanentemente.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className={cn(
                'bg-destructive text-destructive-foreground',
                'hover:bg-destructive/90',
              )}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
