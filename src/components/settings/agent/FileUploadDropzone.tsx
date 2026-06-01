import { useRef, useState, useCallback } from 'react';
import { Upload, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ============================================================================
// Tipos
// ============================================================================

interface FileUploadDropzoneProps {
  accept?: string[];
  maxSizeMB?: number;
  maxFiles?: number;
  currentCount?: number;
  onUpload: (file: File) => void;
  disabled?: boolean;
  className?: string;
}

// ============================================================================
// Componente
// ============================================================================

/**
 * Dropzone reutilizável com drag&drop e validação.
 * Aceita múltiplos arquivos — chama onUpload para cada um.
 */
export function FileUploadDropzone({
  accept = ['application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'],
  maxSizeMB = 5,
  maxFiles = 10,
  currentCount = 0,
  onUpload,
  disabled = false,
  className,
}: FileUploadDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateAndUpload = useCallback(
    (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      const remaining = maxFiles - currentCount;

      if (fileArray.length > remaining) {
        toast.error(
          `Limite de ${maxFiles} arquivos. ${remaining} vaga${remaining !== 1 ? 's' : ''} disponível${remaining !== 1 ? 's' : ''}.`
        );
        return;
      }

      for (const file of fileArray) {
        if (!accept.includes(file.type)) {
          toast.error(`Formato não aceito: ${file.name}. Use PDF, DOCX ou TXT.`);
          continue;
        }
        const sizeMB = file.size / (1024 * 1024);
        if (sizeMB > maxSizeMB) {
          toast.error(`${file.name} é maior que ${maxSizeMB} MB (${sizeMB.toFixed(1)} MB).`);
          continue;
        }
        onUpload(file);
      }
    },
    [accept, maxSizeMB, maxFiles, currentCount, onUpload]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled) return;
    validateAndUpload(e.dataTransfer.files);
  };

  const handleClick = () => {
    if (!disabled) inputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      validateAndUpload(e.target.files);
      e.target.value = '';
    }
  };

  const atLimit = currentCount >= maxFiles;

  return (
    <div
      role="button"
      tabIndex={disabled || atLimit ? -1 : 0}
      aria-label="Clique ou arraste arquivos para enviar"
      aria-disabled={disabled || atLimit}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(); }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200',
        'border-border bg-muted/30',
        isDragOver && !disabled && 'border-primary/50 bg-primary/6',
        (disabled || atLimit) && 'opacity-50 cursor-not-allowed',
        !disabled && !atLimit && 'hover:border-primary/50 hover:bg-primary/4',
        className
      )}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.doc,.docx,.txt"
        className="hidden"
        onChange={handleChange}
        disabled={disabled || atLimit}
        aria-hidden
      />

      <div className="w-9 h-9 bg-primary/10 text-primary rounded-lg flex items-center justify-center mx-auto mb-3">
        {isDragOver ? <FileText className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
      </div>

      <p className="text-sm font-semibold mb-1">
        {atLimit
          ? 'Limite de arquivos atingido'
          : isDragOver
          ? 'Solte os arquivos aqui'
          : 'Arraste arquivos ou clique para enviar'}
      </p>
      <p className="text-xs text-muted-foreground">
        PDF, DOCX, TXT · Máx {maxFiles} arquivos · {maxSizeMB} MB cada
        {currentCount > 0 && ` · ${currentCount}/${maxFiles} enviados`}
      </p>
    </div>
  );
}
