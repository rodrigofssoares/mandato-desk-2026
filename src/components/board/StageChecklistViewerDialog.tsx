import { useEffect, useMemo, useState } from 'react';
import {
  ListChecks,
  MessageSquareQuote,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Paperclip,
  Link2,
  ArrowUpRight,
  ClipboardList,
  Image as ImageIcon,
  Video as VideoIcon,
  Info,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { CopyButton } from '@/components/common/CopyButton';
import { stageDotClass } from '@/components/settings/stageColors';
import { useStageChecklist, type ChecklistItem, type ChecklistAttachment } from '@/hooks/useStageChecklist';
import { useStageTemplates } from '@/hooks/useStageTemplates';
import { useSignedUrls } from '@/hooks/useStageAttachmentUpload';
import type { BoardStage } from '@/hooks/useBoardStages';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stage: BoardStage | null;
}

type View = { kind: 'task'; idx: number } | { kind: 'templates' };

export function StageChecklistViewerDialog({ open, onOpenChange, stage }: Props) {
  const stageId = stage?.id;

  const itemsQ = useStageChecklist(stageId);
  const templatesQ = useStageTemplates(stageId);
  const items = useMemo(() => itemsQ.data ?? [], [itemsQ.data]);
  const templates = templatesQ.data ?? [];

  const [view, setView] = useState<View>({ kind: 'task', idx: 0 });

  useEffect(() => {
    if (open) {
      setView(items.length > 0 ? { kind: 'task', idx: 0 } : { kind: 'templates' });
    }
  }, [open, stageId, items.length]);

  // Coletar todos os storage_paths de uma vez para gerar signed URLs em batch
  const allPaths = useMemo(
    () => items.flatMap((i) => i.attachments.filter((a) => a.storage_path).map((a) => a.storage_path as string)),
    [items],
  );
  const { data: signedMap = {} } = useSignedUrls(allPaths);

  const isLoading = itemsQ.isLoading || templatesQ.isLoading;
  const isEmpty = !isLoading && items.length === 0 && templates.length === 0;

  const currentItem =
    view.kind === 'task' && view.idx < items.length ? items[view.idx] : null;

  if (!stage) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 max-w-4xl gap-0 overflow-hidden"
        style={{ height: 'min(85vh, 720px)' }}
      >
        {/* Header */}
        <header className="px-6 py-4 border-b border-border flex items-start gap-3">
          <span className={cn('w-2.5 h-2.5 rounded-full mt-2 shrink-0', stageDotClass(stage.cor))} />
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Checklist da etapa</p>
            <DialogTitle className="text-lg leading-tight">{stage.nome}</DialogTitle>
            <DialogDescription className="sr-only">
              Passo a passo orientativo configurado pelo administrador para esta etapa.
            </DialogDescription>
          </div>
        </header>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : isEmpty ? (
          <EmptyState />
        ) : (
          <div className="flex-1 grid grid-cols-12 overflow-hidden">
            {/* Sidebar */}
            <aside className="col-span-12 md:col-span-4 border-r border-border bg-muted/20">
              <ScrollArea className="h-full">
                <div className="p-3">
                  <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground px-1 pb-2">
                    Tarefas
                  </div>
                  {items.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic px-2 py-2">Sem tarefas</p>
                  ) : (
                    <ul className="space-y-1">
                      {items.map((item, idx) => (
                        <NavItem
                          key={item.id}
                          item={item}
                          idx={idx}
                          active={view.kind === 'task' && view.idx === idx}
                          onClick={() => setView({ kind: 'task', idx })}
                        />
                      ))}
                    </ul>
                  )}

                  {templates.length > 0 && (
                    <>
                      <Separator className="my-4" />
                      <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground px-1 pb-2">
                        Atalhos
                      </div>
                      <button
                        type="button"
                        onClick={() => setView({ kind: 'templates' })}
                        className={cn(
                          'w-full flex items-start gap-2 px-3 py-2 rounded-md border transition-colors text-left',
                          view.kind === 'templates'
                            ? 'bg-primary/10 border-primary/30'
                            : 'border-transparent hover:bg-accent',
                        )}
                      >
                        <MessageSquareQuote className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p
                            className={cn(
                              'text-sm font-medium leading-snug',
                              view.kind === 'templates' && 'text-primary',
                            )}
                          >
                            Mensagens prontas
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {templates.length} template{templates.length === 1 ? '' : 's'} · WhatsApp
                          </p>
                        </div>
                      </button>
                    </>
                  )}
                </div>
              </ScrollArea>
            </aside>

            {/* Right Panel */}
            <main className="col-span-12 md:col-span-8 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="p-6">
                  {view.kind === 'task' && currentItem ? (
                    <TaskView
                      item={currentItem}
                      idx={view.idx}
                      total={items.length}
                      signedMap={signedMap}
                      onPrev={() => setView({ kind: 'task', idx: view.idx - 1 })}
                      onNext={() => setView({ kind: 'task', idx: view.idx + 1 })}
                    />
                  ) : view.kind === 'templates' ? (
                    <TemplatesView templates={templates} />
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <p>Selecione uma tarefa ao lado.</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </main>
          </div>
        )}

        {/* Footer */}
        <footer className="px-6 py-2.5 border-t border-border bg-muted/30 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            <strong>{items.length}</strong> tarefas · <strong>{templates.length}</strong> templates
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">Esc</kbd> fecha
          </span>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

// ===========================================================================
// Sub-components
// ===========================================================================

function NavItem({
  item,
  idx,
  active,
  onClick,
}: {
  item: ChecklistItem;
  idx: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'w-full flex items-start gap-2 px-3 py-2 rounded-md border transition-colors text-left',
          active ? 'bg-primary/10 border-primary/30' : 'border-transparent hover:bg-accent',
        )}
      >
        <span
          className={cn(
            'shrink-0 w-5 h-5 rounded-full text-[11px] font-semibold flex items-center justify-center mt-0.5',
            active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
          )}
        >
          {idx + 1}
        </span>
        <div className="flex-1 min-w-0">
          <p className={cn('text-sm leading-snug break-words', active && 'text-primary font-semibold')}>
            {item.texto}
          </p>
          {item.attachments.length > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <Paperclip className="h-3 w-3" />
              {item.attachments.length} anexo{item.attachments.length === 1 ? '' : 's'}
            </p>
          )}
        </div>
      </button>
    </li>
  );
}

function TaskView({
  item,
  idx,
  total,
  signedMap,
  onPrev,
  onNext,
}: {
  item: ChecklistItem;
  idx: number;
  total: number;
  signedMap: Record<string, string>;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        Tarefa {idx + 1} de {total}
      </p>
      <h3 className="text-xl font-bold leading-tight mt-1">{item.texto}</h3>
      {item.descricao && (
        <p className="text-foreground/80 mt-3 leading-relaxed whitespace-pre-wrap">
          {item.descricao}
        </p>
      )}

      {item.attachments.length > 0 && (
        <div className="mt-5 space-y-3">
          {item.attachments.map((att) => (
            <AttachmentView key={att.id} att={att} signedUrl={att.storage_path ? signedMap[att.storage_path] : undefined} />
          ))}
        </div>
      )}

      <Separator className="my-6" />

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onPrev}
          disabled={idx === 0}
          className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-40 flex items-center gap-1"
        >
          <ChevronLeft className="h-4 w-4" /> Tarefa anterior
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={idx >= total - 1}
          className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-40 flex items-center gap-1"
        >
          Próxima tarefa <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function AttachmentView({ att, signedUrl }: { att: ChecklistAttachment; signedUrl?: string }) {
  if (att.tipo === 'imagem') {
    if (!signedUrl) {
      return (
        <div className="rounded-md border border-border bg-muted/40 p-6 flex items-center justify-center text-muted-foreground gap-2">
          <ImageIcon className="h-5 w-5" /> Carregando imagem...
        </div>
      );
    }
    return (
      <figure className="rounded-md overflow-hidden border border-border">
        <img
          src={signedUrl}
          alt={att.nome_original ?? ''}
          className="w-full h-auto block bg-muted"
          loading="lazy"
        />
        {att.nome_original && (
          <figcaption className="text-xs text-muted-foreground px-3 py-1.5 bg-muted/40">
            {att.nome_original}
          </figcaption>
        )}
      </figure>
    );
  }

  if (att.tipo === 'video') {
    if (!signedUrl) {
      return (
        <div className="rounded-md border border-border bg-muted/40 p-6 flex items-center justify-center text-muted-foreground gap-2">
          <VideoIcon className="h-5 w-5" /> Carregando vídeo...
        </div>
      );
    }
    return (
      <figure className="rounded-md overflow-hidden border border-border">
        <video
          src={signedUrl}
          controls
          preload="metadata"
          className="w-full h-auto block bg-black"
        />
        {att.nome_original && (
          <figcaption className="text-xs text-muted-foreground px-3 py-1.5 bg-muted/40">
            {att.nome_original}
          </figcaption>
        )}
      </figure>
    );
  }

  if (att.tipo === 'link' && att.url_externa) {
    return (
      <a
        href={att.url_externa}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 text-sm rounded-md border border-border bg-muted/30 px-3 py-2 hover:bg-accent transition-colors"
      >
        <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="font-medium truncate">{att.rotulo || att.url_externa}</span>
        <span className="text-xs text-muted-foreground truncate ml-auto">{att.url_externa}</span>
        <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      </a>
    );
  }

  return null;
}

function TemplatesView({
  templates,
}: {
  templates: { id: string; titulo: string; conteudo: string }[];
}) {
  if (templates.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <MessageSquareQuote className="h-10 w-10 mx-auto mb-2 text-muted-foreground/40" />
        <p className="text-sm">Nenhum template configurado</p>
      </div>
    );
  }
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">Mensagens prontas</p>
      <h3 className="text-xl font-bold leading-tight mt-1">Templates de WhatsApp</h3>
      <p className="text-sm text-muted-foreground mt-1">
        Os asteriscos viram negrito apenas no WhatsApp; aqui ficam literais.
      </p>

      <div className="mt-4 space-y-3">
        {templates.map((tpl) => (
          <article key={tpl.id} className="rounded-md border border-border bg-card">
            <header className="flex items-center justify-between px-3 py-2 border-b border-border/60">
              <div className="flex items-center gap-2 min-w-0">
                <MessageSquareQuote className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium truncate">{tpl.titulo}</span>
              </div>
              <CopyButton
                text={tpl.conteudo}
                label="Copiar"
                successMessage="Template copiado!"
                ariaLabel={`Copiar template ${tpl.titulo}`}
              />
            </header>
            <pre className="font-mono text-[13px] whitespace-pre-wrap break-words px-3 py-2.5 leading-relaxed">
              {tpl.conteudo}
            </pre>
          </article>
        ))}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
      <ClipboardList className="h-12 w-12 mb-3 text-muted-foreground/40" />
      <p className="text-base font-medium text-foreground">Sem checklist configurado</p>
      <p className="text-sm mt-1 max-w-sm">
        Peça ao administrador para configurar este passo a passo em
        <span className="text-foreground/80"> Configurações → Funis</span>.
      </p>
      <div className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground/80">
        <Info className="h-3.5 w-3.5" />
        Você só está vendo este popup porque clicou no ícone na coluna.
      </div>
    </div>
  );
}
