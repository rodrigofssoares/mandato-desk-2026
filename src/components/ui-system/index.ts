/**
 * Design system primitives — building blocks reutilizáveis pra padronizar
 * a interface do app. Importe daqui em qualquer página/componente:
 *
 *   import { PageHeader, StatusChip, IconBubble, EmptyState } from '@/components/ui-system';
 *
 * Os primitivos consomem os tokens semânticos definidos em src/index.css
 * (--success, --warning, --info, --danger, --primary, --accent), então
 * trocar de tema (Burgundy↔Navy) reflete automaticamente em todos.
 *
 * Para componentes shadcn (Button, Input, Card, Dialog, etc), continue
 * importando de '@/components/ui/*' — eles também consomem os mesmos
 * tokens.
 */
export { IconBubble, type IconBubbleSize, type IconBubbleVariant } from './IconBubble';
export { SectionEyebrow, type SectionEyebrowTone } from './SectionEyebrow';
export { PageHeader } from './PageHeader';
export { PanelHeader } from './PanelHeader';
export { ColorPicker, DEFAULT_COLOR_PRESETS } from './ColorPicker';
export {
  StatusChip,
  type StatusChipVariant,
  type StatusChipTone,
  type StatusChipSize,
} from './StatusChip';
export { EmptyState } from './EmptyState';
