import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CopyButtonProps {
  text: string;
  label?: string;
  successMessage?: string;
  ariaLabel?: string;
  size?: 'sm' | 'default' | 'icon';
  variant?: 'default' | 'secondary' | 'outline' | 'ghost';
  className?: string;
}

export function CopyButton({
  text,
  label = 'Copiar',
  successMessage = 'Copiado!',
  ariaLabel,
  size = 'sm',
  variant = 'default',
  className,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(successMessage);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Não foi possível copiar');
    }
  };

  const Icon = copied ? Check : Copy;

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      onClick={handleCopy}
      aria-label={ariaLabel ?? label}
      className={cn('gap-1.5', className)}
    >
      <Icon className="h-3.5 w-3.5" />
      {size !== 'icon' && <span>{copied ? 'Copiado' : label}</span>}
    </Button>
  );
}
