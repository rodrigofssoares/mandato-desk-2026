import { useEffect, useMemo, useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  useUploadZapiAttachment,
  useSendZapiMedia,
  type ZapiMediaType,
} from '@/hooks/useZapiMedia';

interface AttachmentPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: File | null;
  type: ZapiMediaType;
  accountId: string;
  phone: string;
  onSent?: () => void;
}

const TITLES: Record<ZapiMediaType, string> = {
  image: 'Enviar imagem',
  video: 'Enviar vídeo',
  audio: 'Enviar áudio',
  document: 'Enviar documento',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function AttachmentPreviewDialog({
  open,
  onOpenChange,
  file,
  type,
  accountId,
  phone,
  onSent,
}: AttachmentPreviewDialogProps) {
  const [caption, setCaption] = useState('');
  const upload = useUploadZapiAttachment();
  const sendMedia = useSendZapiMedia();

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (open) setCaption('');
  }, [open]);

  if (!file) return null;

  const isPending = upload.isPending || sendMedia.isPending;
  const showCaption = type !== 'audio'; // áudio Z-API ignora caption

  async function handleSend() {
    if (!file) return;
    try {
      const uploaded = await upload.mutateAsync({ account_id: accountId, file, type });
      await sendMedia.mutateAsync({
        account_id: accountId,
        phone,
        type,
        media_url: uploaded.url,
        caption: caption.trim() || undefined,
        file_name: file.name,
        mime_type: uploaded.mime,
      });
      onSent?.();
      onOpenChange(false);
    } catch {
      // toasts já disparados pelos hooks
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{TITLES[type]}</DialogTitle>
          <DialogDescription>
            {file.name} · {formatBytes(file.size)}
          </DialogDescription>
        </DialogHeader>

        {/* Preview */}
        <div className="rounded-md border bg-muted/30 overflow-hidden">
          {type === 'image' && previewUrl && (
            <img src={previewUrl} alt={file.name} className="w-full max-h-72 object-contain" />
          )}
          {type === 'video' && previewUrl && (
            <video src={previewUrl} controls className="w-full max-h-72" />
          )}
          {type === 'audio' && previewUrl && (
            <div className="p-4">
              <audio src={previewUrl} controls className="w-full" />
            </div>
          )}
          {type === 'document' && (
            <div className="p-6 flex items-center gap-3">
              <div className="h-12 w-12 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {file.type || 'Arquivo'} · {formatBytes(file.size)}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Caption */}
        {showCaption && (
          <div className="space-y-1.5">
            <Label htmlFor="caption">Legenda (opcional)</Label>
            <Textarea
              id="caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Adicione uma legenda..."
              rows={2}
              maxLength={1024}
              disabled={isPending}
            />
            <p className="text-[10px] text-muted-foreground text-right">{caption.length}/1024</p>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={handleSend} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {upload.isPending
              ? 'Enviando arquivo...'
              : sendMedia.isPending
                ? 'Encaminhando...'
                : 'Enviar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
