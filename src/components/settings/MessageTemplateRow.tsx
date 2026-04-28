import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { CopyButton } from '@/components/common/CopyButton';
import {
  useUpdateStageTemplate,
  useDeleteStageTemplate,
  type StageMessageTemplate,
} from '@/hooks/useStageTemplates';

interface Props {
  template: StageMessageTemplate;
}

export function MessageTemplateRow({ template }: Props) {
  const updateMutation = useUpdateStageTemplate();
  const deleteMutation = useDeleteStageTemplate();

  const [titulo, setTitulo] = useState(template.titulo);
  const [conteudo, setConteudo] = useState(template.conteudo);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setTitulo(template.titulo);
  }, [template.titulo]);

  useEffect(() => {
    setConteudo(template.conteudo);
  }, [template.conteudo]);

  const saveTitulo = () => {
    const trimmed = titulo.trim();
    if (!trimmed) {
      setTitulo(template.titulo);
      return;
    }
    if (trimmed === template.titulo) return;
    updateMutation.mutate({
      id: template.id,
      stage_id: template.stage_id,
      patch: { titulo: trimmed },
    });
  };

  const saveConteudo = () => {
    if (conteudo === template.conteudo) return;
    if (!conteudo.trim()) {
      setConteudo(template.conteudo);
      return;
    }
    updateMutation.mutate({
      id: template.id,
      stage_id: template.stage_id,
      patch: { conteudo },
    });
  };

  return (
    <article className="rounded-md border border-border bg-card p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">
            Título do template
          </label>
          <Input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            onBlur={saveTitulo}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            placeholder="Ex: Saudação de boas-vindas"
            maxLength={120}
          />
        </div>
        <div className="flex items-center gap-1 mt-6">
          <CopyButton
            text={conteudo}
            label="Copiar"
            successMessage="Template copiado!"
            ariaLabel={`Copiar template ${template.titulo}`}
            variant="outline"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setConfirmDelete(true)}
            aria-label="Excluir template"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1 flex items-center justify-between">
            <span>Conteúdo</span>
            <span className="text-[10px] font-normal normal-case tracking-normal text-muted-foreground/70">
              edite aqui
            </span>
          </label>
          <Textarea
            value={conteudo}
            onChange={(e) => setConteudo(e.target.value)}
            onBlur={saveConteudo}
            placeholder={'Olá *Maria*! Aqui é a equipe do mandato.\nVi que você se inscreveu no nosso _evento_ — posso te enviar o material?'}
            className="font-mono text-[13px] min-h-[140px]"
            maxLength={4000}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1 flex items-center justify-between">
            <span>Pré-visualização literal</span>
            <span className="text-[10px] font-normal normal-case tracking-normal text-muted-foreground/70">
              como o atendente verá
            </span>
          </label>
          <pre className="font-mono text-[13px] whitespace-pre-wrap break-words rounded-md border border-dashed border-border bg-muted/40 p-3 min-h-[140px] text-foreground">
            {conteudo || (
              <span className="text-muted-foreground italic">Comece a digitar para ver o preview</span>
            )}
          </pre>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Use <code className="bg-muted px-1 rounded">*texto*</code> para <strong>negrito</strong>,
        {' '}<code className="bg-muted px-1 rounded">_texto_</code> para <em>itálico</em> e
        {' '}<code className="bg-muted px-1 rounded">~texto~</code> para tachado. Os caracteres ficam
        literais aqui e viram formatação só no WhatsApp.
      </p>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir template "{template.titulo}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O template será removido para todos os atendentes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                deleteMutation.mutate({ id: template.id, stage_id: template.stage_id });
                setConfirmDelete(false);
              }}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}
