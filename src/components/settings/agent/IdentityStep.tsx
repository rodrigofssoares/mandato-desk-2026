import { useEffect, useRef } from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { FileBadge, Trash2, Loader2 } from 'lucide-react';
import { FileUploadDropzone } from './FileUploadDropzone';
import {
  useAgentAttachments,
  useUploadAgentAttachment,
  useDeleteAgentAttachment,
  formatFileSize,
  getFileExtension,
} from '@/hooks/useAgentAttachments';
import type { AgentSettings } from '@/hooks/useAgentSettings';
import type { AgentIdentityForm } from './formSchema';
import { cn } from '@/lib/utils';

// ============================================================================
// Tipos
// ============================================================================

interface IdentityStepProps {
  agentData: AgentSettings;
}

// ============================================================================
// Helpers
// ============================================================================

function FileIcon({ ext }: { ext: string }) {
  const colors: Record<string, string> = {
    pdf: 'bg-red-50 text-red-700',
    doc: 'bg-blue-50 text-blue-700',
    docx: 'bg-blue-50 text-blue-700',
    txt: 'bg-muted text-muted-foreground',
  };
  const color = colors[ext] ?? 'bg-muted text-muted-foreground';

  return (
    <div
      className={cn(
        'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-[10px]',
        color
      )}
    >
      {ext.toUpperCase().slice(0, 3)}
    </div>
  );
}

function statusBadge(status: string) {
  if (status === 'ready') return <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50 text-[10px] uppercase tracking-wide">Pronto</Badge>;
  if (status === 'processing') return <Badge variant="outline" className="text-yellow-700 border-yellow-300 bg-yellow-50 text-[10px] uppercase tracking-wide">Indexando</Badge>;
  if (status === 'uploading') return <Badge variant="outline" className="text-blue-700 border-blue-300 bg-blue-50 text-[10px] uppercase tracking-wide">Enviando</Badge>;
  return <Badge variant="destructive" className="text-[10px] uppercase tracking-wide">Erro</Badge>;
}

// ============================================================================
// Componente
// ============================================================================

export function IdentityStep({ agentData }: IdentityStepProps) {
  const { control, watch } = useFormContext<AgentIdentityForm>();
  const promptValue = watch('system_prompt') ?? '';
  const promptLength = promptValue.length;
  const MAX_PROMPT = 32000;

  const { data: attachments = [], isLoading: isLoadingAttachments } = useAgentAttachments(agentData.id);
  const uploadMutation = useUploadAgentAttachment(agentData.id);
  const deleteMutation = useDeleteAgentAttachment(agentData.id);

  const totalTokens = attachments.reduce((sum, a) => sum + (a.tokens_estimated ?? 0), 0);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [promptValue]);

  return (
    <div className="space-y-4">
      {/* Card principal */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-5 space-y-5">

          {/* Toggle ativo */}
          <Controller
            name="is_active"
            control={control}
            render={({ field }) => (
              <div
                className={cn(
                  'flex items-center gap-4 p-3 rounded-xl',
                  field.value ? 'bg-green-50' : 'bg-muted/40'
                )}
              >
                <Switch
                  id="agente-ativo"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  aria-label="Ativar ou desativar o agente"
                />
                <div className="flex-1">
                  <Label
                    htmlFor="agente-ativo"
                    className={cn(
                      'text-sm font-semibold cursor-pointer',
                      field.value ? 'text-green-700' : 'text-muted-foreground'
                    )}
                  >
                    {field.value ? 'Agente ativo' : 'Agente inativo'}
                  </Label>
                  <p
                    className={cn(
                      'text-xs mt-0.5',
                      field.value ? 'text-green-600' : 'text-muted-foreground'
                    )}
                  >
                    A aba "Agente" aparece no menu para usuários com permissão (configurada em Permissões).
                  </p>
                </div>
              </div>
            )}
          />

          {/* Nome */}
          <div className="space-y-1.5">
            <Label htmlFor="agent-name" className="text-xs font-semibold">
              Nome do agente
            </Label>
            <Controller
              name="name"
              control={control}
              render={({ field, fieldState }) => (
                <>
                  <Input
                    id="agent-name"
                    placeholder="Ex: Atendente do Gabinete"
                    {...field}
                    className={fieldState.error ? 'border-destructive' : ''}
                  />
                  {fieldState.error && (
                    <p className="text-xs text-destructive">{fieldState.error.message}</p>
                  )}
                </>
              )}
            />
          </div>

          {/* Prompt */}
          <div className="space-y-1.5">
            <Label htmlFor="agent-prompt" className="text-xs font-semibold">
              Prompt do sistema
            </Label>
            <Controller
              name="system_prompt"
              control={control}
              render={({ field }) => (
                <Textarea
                  id="agent-prompt"
                  ref={(el) => {
                    field.ref(el);
                    textareaRef.current = el;
                  }}
                  placeholder="Você é o Atendente Institucional do gabinete..."
                  rows={6}
                  maxLength={MAX_PROMPT}
                  className="font-mono text-[12.5px] leading-relaxed resize-none min-h-[120px]"
                  {...field}
                  value={field.value ?? ''}
                />
              )}
            />
            <p className="text-xs text-muted-foreground">
              <strong>
                {promptLength.toLocaleString('pt-BR')}/{MAX_PROMPT.toLocaleString('pt-BR')}
              </strong>{' '}
              caracteres
            </p>
          </div>

          {/* Documentos de referência */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              Documentos de referência{' '}
              <span className="font-normal text-muted-foreground text-[11px]">
                (o agente consulta antes de responder)
              </span>
            </Label>

            <FileUploadDropzone
              maxFiles={10}
              currentCount={attachments.length}
              onUpload={(file) => uploadMutation.mutate(file)}
              disabled={uploadMutation.isPending}
            />

            {/* Lista de arquivos */}
            {isLoadingAttachments ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : attachments.length > 0 ? (
              <div className="space-y-2 mt-3">
                {attachments.map((att) => {
                  const ext = getFileExtension(att.filename);
                  return (
                    <div
                      key={att.id}
                      className="flex items-center gap-3 p-2.5 border border-border rounded-xl bg-card"
                    >
                      <FileIcon ext={ext} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{att.filename}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatFileSize(att.file_size)}
                          {att.tokens_estimated && ` · ${att.tokens_estimated.toLocaleString('pt-BR')} tokens`}
                        </p>
                      </div>
                      {statusBadge(att.status)}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button
                            type="button"
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-muted transition-colors"
                            aria-label={`Remover ${att.filename}`}
                            disabled={deleteMutation.isPending}
                          >
                            {deleteMutation.isPending ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover arquivo?</AlertDialogTitle>
                            <AlertDialogDescription>
                              O arquivo <strong>{att.filename}</strong> será removido do agente.
                              Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate(att.id)}
                              className="bg-destructive hover:bg-destructive/90"
                            >
                              Remover
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center gap-2 py-4 text-center justify-center text-sm text-muted-foreground">
                <FileBadge className="h-4 w-4" />
                Nenhum arquivo enviado ainda
              </div>
            )}

            {attachments.length > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                {attachments.length}/{10} arquivos · {totalTokens.toLocaleString('pt-BR')} tokens
                total. O agente busca trechos relevantes antes de cada resposta.
              </p>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
