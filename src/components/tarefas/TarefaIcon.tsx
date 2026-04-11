import { Phone, Users as UsersIcon, MapPin, MessageCircle, Mail, CheckSquare } from 'lucide-react';
import type { TarefaTipo } from '@/hooks/useTarefas';

const ICONS: Record<TarefaTipo, typeof Phone> = {
  LIGACAO: Phone,
  REUNIAO: UsersIcon,
  VISITA: MapPin,
  WHATSAPP: MessageCircle,
  EMAIL: Mail,
  TAREFA: CheckSquare,
};

const COLORS: Record<TarefaTipo, string> = {
  LIGACAO: 'text-blue-600',
  REUNIAO: 'text-purple-600',
  VISITA: 'text-orange-600',
  WHATSAPP: 'text-green-600',
  EMAIL: 'text-sky-600',
  TAREFA: 'text-muted-foreground',
};

export const TIPO_LABELS: Record<TarefaTipo, string> = {
  LIGACAO: 'Ligação',
  REUNIAO: 'Reunião',
  VISITA: 'Visita',
  WHATSAPP: 'WhatsApp',
  EMAIL: 'E-mail',
  TAREFA: 'Tarefa',
};

interface Props {
  tipo: TarefaTipo;
  className?: string;
}

export function TarefaIcon({ tipo, className }: Props) {
  const Icon = ICONS[tipo] ?? CheckSquare;
  const color = COLORS[tipo] ?? COLORS.TAREFA;
  return <Icon className={`${color} ${className ?? 'h-4 w-4'}`} aria-label={TIPO_LABELS[tipo]} />;
}
