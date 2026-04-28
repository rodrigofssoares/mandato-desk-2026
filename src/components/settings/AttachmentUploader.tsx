import { useRef, useState } from 'react';
import {
  Image as ImageIcon,
  Video as VideoIcon,
  Link2,
  Trash2,
  UploadCloud,
  Loader2,
  ArrowUpRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  useStageAttachmentUpload,
  validateAttachmentFile,
  AttachmentValidationError,
  useSignedUrls,
} from '@/hooks/useStageAttachmentUpload';
import {
  useCreateAttachment,
  useDeleteAttachment,
  type ChecklistAttachment,
  type ChecklistAttachmentTipo,
} from '@/hooks/useStageChecklist';
import { linkAttachmentSchema } from '@/lib/schemas/stageChecklist';
import { cn } from '@/lib/utils';

interface AttachmentUploaderProps {
  itemId: string;
  stageId: string;
  boardId: string;
  attachments: ChecklistAttachment[];
}

export function AttachmentUploader({
  itemId,
  stageId,
  boardId,
  attachments,
}: AttachmentUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const upload = useStageAttachmentUpload();
  const createAttachment = useCreateAttachment();
  const deleteAttachment = useDeleteAttachment();

  const storedPaths = attachments
    .filter((a) => a.storage_path)
    .map((a) => a.storage_path as string);
  const { data: signedMap = {} } = useSignedUrls(storedPaths);

  const handleFile = async (file: File) => {
    try {
      validateAttachmentFile(file);
    } catch (err) {
      if (err instanceof AttachmentValidationError) {
        toast.error(err.message);
        return;
      }
      throw err;
    }
    try {
      const result = await upload.mutateAsync({ boardId, stageId, itemId, file });
      await createAttachment.mutateAsync({
        item_id: itemId,
        stage_id: stageId,
        tipo: result.tipo,
        storage_path: result.storage_path,
        nome_original: result.nome_original,
        mime_type: result.mime_type,
        tamanho_bytes: result.tamanho_bytes,
      });
      toast.success(`${result.tipo === 'imagem' ? 'Imagem' : 'Vídeo'} anexado`);
    } catch {
      // toast já disparado nos hooks
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    for (const f of Array.from(files)) {
      await handleFile(f);
    }
  };

  const handleDelete = (att: ChecklistAttachment) => {
    if (!confirm('Remover este anexo?')) return;
    deleteAttachment.mutate({
      id: att.id,
      stage_id: stageId,
      storage_path: att.storage_path,
    });
  };

  const formatBytes = (bytes: number | null) => {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
  };

  return (
    <div className="space-y-2">
      {attachments.length > 0 && (
        <ul className="space-y-2">
          {attachments.map((att) => (
            <li
              key={att.id}
              className="flex items-stretch rounded-md border border-border bg-card overflow-hidden"
            >
              <Thumbnail att={att} signedUrl={att.storage_path ? signedMap[att.storage_path] : undefined} />
              <div className="flex-1 min-w-0 px-3 py-2">
                <div className="flex items-center gap-2 mb-0.5">
                  <TipoBadge tipo={att.tipo} />
                  {att.tamanho_bytes && (
                    <span className="text-xs text-muted-foreground">{formatBytes(att.tamanho_bytes)}</span>
                  )}
                </div>
                <p className="text-sm font-medium truncate">
                  {att.tipo === 'link' ? att.rotulo || att.url_externa : att.nome_original}
                </p>
                {att.tipo === 'link' && att.url_externa && (
                  <a
                    href={att.url_externa}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground truncate hover:text-primary inline-flex items-center gap-1 max-w-full"
                  >
                    <span className="truncate">{att.url_externa}</span>
                    <ArrowUpRight className="h-3 w-3 shrink-0" />
                  </a>
                )}
              </div>
              <button
                type="button"
                aria-label="Remover anexo"
                onClick={() => handleDelete(att)}
                className="px-3 text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
                disabled={deleteAttachment.isPending}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div
        className={cn(
          'rounded-md border-2 border-dashed border-border bg-muted/30 px-4 py-5 text-center text-sm transition-colors cursor-pointer',
          dragOver && 'border-primary bg-primary/5 text-primary',
          upload.isPending && 'opacity-60 pointer-events-none',
        )}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
        }}
      >
        {upload.isPending ? (
          <>
            <Loader2 className="h-5 w-5 mx-auto mb-1 animate-spin" />
            <div className="text-xs">Enviando arquivo…</div>
          </>
        ) : (
          <>
            <UploadCloud className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
            <div className="font-medium text-foreground">Arraste um arquivo ou clique aqui</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Imagem (≤ 5 MB · jpg/png/webp) ou Vídeo (≤ 50 MB · mp4/webm)
            </div>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      <div>
        <Button type="button" size="sm" variant="outline" onClick={() => setLinkOpen(true)}>
          <Link2 className="h-3.5 w-3.5 mr-1.5" /> Adicionar link
        </Button>
      </div>

      <LinkAttachmentDialog
        open={linkOpen}
        onOpenChange={setLinkOpen}
        onSubmit={async ({ url, rotulo }) => {
          try {
            await createAttachment.mutateAsync({
              item_id: itemId,
              stage_id: stageId,
              tipo: 'link',
              url_externa: url,
              rotulo: rotulo || null,
            });
            toast.success('Link adicionado');
            setLinkOpen(false);
          } catch {
            // toast já disparado
          }
        }}
        pending={createAttachment.isPending}
      />
    </div>
  );
}

function Thumbnail({
  att,
  signedUrl,
}: {
  att: ChecklistAttachment;
  signedUrl?: string;
}) {
  if (att.tipo === 'imagem' && signedUrl) {
    return (
      <img
        src={signedUrl}
        alt={att.nome_original ?? ''}
        className="w-24 h-16 object-cover shrink-0 bg-muted"
        loading="lazy"
      />
    );
  }
  if (att.tipo === 'video') {
    return (
      <div className="w-24 h-16 shrink-0 bg-slate-900 flex items-center justify-center">
        <VideoIcon className="h-6 w-6 text-white" />
      </div>
    );
  }
  if (att.tipo === 'imagem') {
    return (
      <div className="w-24 h-16 shrink-0 bg-muted flex items-center justify-center">
        <ImageIcon className="h-6 w-6 text-muted-foreground" />
      </div>
    );
  }
  return (
    <div className="w-24 h-16 shrink-0 bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center">
      <Link2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
    </div>
  );
}

function TipoBadge({ tipo }: { tipo: ChecklistAttachmentTipo }) {
  const styles = {
    imagem: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
    video: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
    link: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  } as const;
  return (
    <span
      className={cn(
        'text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded',
        styles[tipo],
      )}
    >
      {tipo}
    </span>
  );
}

function LinkAttachmentDialog({
  open,
  onOpenChange,
  onSubmit,
  pending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: { url: string; rotulo: string }) => void;
  pending: boolean;
}) {
  const [url, setUrl] = useState('');
  const [rotulo, setRotulo] = useState('');
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setUrl('');
    setRotulo('');
    setError(null);
  };

  const handleSubmit = () => {
    const parsed = linkAttachmentSchema.safeParse({ url_externa: url, rotulo });
    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message ?? 'Dados inválidos');
      return;
    }
    onSubmit({ url: parsed.data.url_externa, rotulo: parsed.data.rotulo ?? '' });
    reset();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar link</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">URL</label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://exemplo.com/manual"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Texto exibido <span className="text-muted-foreground/70 normal-case">(opcional)</span>
            </label>
            <Input
              value={rotulo}
              onChange={(e) => setRotulo(e.target.value)}
              placeholder="Manual interno: como agendar"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
