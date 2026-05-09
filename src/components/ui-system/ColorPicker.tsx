import { useId, useRef } from 'react';
import { Pipette } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/**
 * Paleta sugerida pelo design system. Inclui cores do tema (vinho, navy,
 * gold) + tokens semânticos (success/warning/info/danger) + cores
 * decorativas comuns (purple/pink/teal/indigo/slate). Usuário pode
 * escolher qualquer cor além dessas via roda de cores nativa.
 */
export const DEFAULT_COLOR_PRESETS = [
  // Tema
  '#7B1E2E', // Burgundy primary
  '#1B3A6B', // Navy primary
  '#D4A446', // Gold accent
  // Semânticos
  '#22C55E', // success
  '#F59E0B', // warning
  '#0EA5E9', // info
  '#DC2626', // danger
  // Decorativos
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#14B8A6', // teal
  '#6366F1', // indigo
  '#64748B', // slate
] as const;

interface ColorPickerProps {
  /** Cor atual em hex (`#RRGGBB`). */
  value: string;
  /** Chamado quando o usuário escolhe uma cor (sempre em hex maiúsculo). */
  onChange: (color: string) => void;
  /** Texto do label acima do controle. */
  label?: string;
  /** Mensagem de erro (ex: validação Zod). */
  error?: string;
  /** Paleta sugerida. Default: DEFAULT_COLOR_PRESETS. */
  presets?: readonly string[];
  /** Se true, mostra botão "Cor personalizada" que abre roda nativa. Default: true. */
  allowCustom?: boolean;
  /** Tamanho dos swatches da paleta. Default: 'md'. */
  swatchSize?: 'sm' | 'md';
  /** Desabilita interação. */
  disabled?: boolean;
  className?: string;
}

const SWATCH_SIZES: Record<NonNullable<ColorPickerProps['swatchSize']>, string> = {
  sm: 'w-6 h-6',
  md: 'w-7 h-7',
};

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

/**
 * Seletor de cor com paleta sugerida + roda de cores nativa.
 *
 * Combina 3 formas do usuário escolher cor:
 *   1. Clicar num swatch da paleta sugerida (cores do design system)
 *   2. Digitar um hex manual no input
 *   3. Abrir a roda de cores do navegador (botão "Cor personalizada")
 *
 * Paleta sugerida vem do design system mas o usuário NÃO está limitado a
 * ela. Qualquer cor hex válida funciona.
 *
 * @example
 * ```tsx
 * <ColorPicker
 *   label="Cor da etiqueta"
 *   value={color}
 *   onChange={setColor}
 *   error={errors.color?.message}
 * />
 * ```
 */
export function ColorPicker({
  value,
  onChange,
  label,
  error,
  presets = DEFAULT_COLOR_PRESETS,
  allowCustom = true,
  swatchSize = 'md',
  disabled,
  className,
}: ColorPickerProps) {
  const id = useId();
  const colorInputRef = useRef<HTMLInputElement>(null);

  const isValidHex = HEX_RE.test(value);
  const previewColor = isValidHex ? value : '#6B7280';
  const normalizedValue = value.toUpperCase();

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value;
    if (v && !v.startsWith('#')) v = '#' + v;
    onChange(v);
  };

  const handleNativePicker = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value.toUpperCase());
  };

  const openNative = () => {
    if (!disabled) colorInputRef.current?.click();
  };

  return (
    <div className={cn('space-y-2', className)}>
      {label && <Label htmlFor={id}>{label}</Label>}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={openNative}
          disabled={disabled || !allowCustom}
          className={cn(
            'w-9 h-9 rounded-full border-2 border-border shrink-0 transition-transform hover:scale-105 disabled:opacity-60 disabled:hover:scale-100 disabled:cursor-not-allowed',
            allowCustom && !disabled && 'cursor-pointer',
          )}
          style={{ backgroundColor: previewColor }}
          aria-label="Abrir seletor de cor personalizada"
          title={allowCustom ? 'Clique pra abrir a roda de cores' : undefined}
        />
        <Input
          id={id}
          value={value}
          onChange={handleHexChange}
          placeholder="#6B7280"
          maxLength={7}
          className="font-mono uppercase"
          disabled={disabled}
        />
      </div>

      {/* Roda de cores nativa — input invisível disparado pelo botão acima */}
      {allowCustom && (
        <input
          ref={colorInputRef}
          type="color"
          value={isValidHex ? value : '#6b7280'}
          onChange={handleNativePicker}
          disabled={disabled}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        />
      )}

      {/* Paleta sugerida */}
      <div className="flex flex-wrap gap-1.5 pt-1">
        {presets.map((color) => {
          const selected = normalizedValue === color.toUpperCase();
          return (
            <button
              key={color}
              type="button"
              onClick={() => onChange(color.toUpperCase())}
              disabled={disabled}
              className={cn(
                'rounded-full transition-all hover:scale-110 disabled:opacity-50 disabled:hover:scale-100',
                SWATCH_SIZES[swatchSize],
                selected
                  ? 'ring-2 ring-offset-2 ring-offset-background ring-foreground shadow-sm'
                  : 'border border-border/40',
              )}
              style={{ backgroundColor: color }}
              aria-label={`Selecionar cor ${color}`}
              title={color}
            />
          );
        })}
      </div>

      {allowCustom && (
        <button
          type="button"
          onClick={openNative}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          <Pipette className="h-3 w-3" />
          Escolher cor personalizada
        </button>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
