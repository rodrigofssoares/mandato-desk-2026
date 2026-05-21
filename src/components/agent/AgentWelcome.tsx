import { motion } from 'framer-motion';
import { Home, FileText, Briefcase, CheckSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Suggestion {
  icon: React.ReactNode;
  title: string;
  text: string;
  prompt: string;
}

const SUGGESTIONS: Suggestion[] = [
  {
    icon: <Home className="h-[15px] w-[15px]" />,
    title: 'Atender pedido de obra pública',
    text: 'Roteiro padrão para eleitor pedindo asfalto, iluminação, calçada...',
    prompt: 'Como respondo a um eleitor pedindo asfalto?',
  },
  {
    icon: <FileText className="h-[15px] w-[15px]" />,
    title: 'Redigir ofício institucional',
    text: 'Estrutura formal para Secretaria, Câmara, Ministério Público...',
    prompt: 'Qual o modelo de ofício para Secretaria Municipal?',
  },
  {
    icon: <Briefcase className="h-[15px] w-[15px]" />,
    title: 'Classificar demanda jurídica',
    text: 'Categorização, encaminhamento e priorização de casos legais.',
    prompt: 'Como classificar uma demanda jurídica do eleitor?',
  },
  {
    icon: <CheckSquare className="h-[15px] w-[15px]" />,
    title: 'Organizar evento de campo',
    text: 'Logística, segurança, mobilização e cobertura de imprensa.',
    prompt: 'Checklist completo para evento no bairro',
  },
];

interface AgentWelcomeProps {
  onSelectSuggestion: (prompt: string) => void;
}

export function AgentWelcome({ onSelectSuggestion }: AgentWelcomeProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, filter: 'blur(3px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="text-center mb-8"
    >
      {/* Eyebrow Cinzel */}
      <div
        className="flex items-center justify-center gap-3 mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-accent-foreground"
        style={{ fontFamily: "'Cinzel', serif" }}
      >
        <span
          className="flex-none w-8 h-px"
          style={{ background: 'hsl(var(--accent) / 0.5)' }}
          aria-hidden="true"
        />
        Mandato Desk · 2026
        <span
          className="flex-none w-8 h-px"
          style={{ background: 'hsl(var(--accent) / 0.5)' }}
          aria-hidden="true"
        />
      </div>

      <h1
        className="text-[28px] font-semibold text-foreground mb-2 tracking-tight"
        style={{ fontFamily: "'Space Grotesk', sans-serif" }}
      >
        Como posso ajudar hoje?
      </h1>
      <p className="text-[14.5px] text-muted-foreground leading-relaxed max-w-[480px] mx-auto">
        Pergunte ao agente do gabinete. Respostas baseadas no comportamento
        configurado e contexto institucional do mandato.
      </p>

      {/* Grid de sugestões */}
      <div className="grid grid-cols-2 gap-3 mt-6 sm:grid-cols-1">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.title}
            onClick={() => onSelectSuggestion(s.prompt)}
            className={cn(
              'group text-left flex gap-2.5 items-start p-[14px_16px] rounded-[14px] cursor-pointer',
              'bg-card/70 backdrop-blur-[8px] border border-border/70',
              'hover:border-primary/40 hover:bg-card hover:shadow-[0_6px_16px_hsl(var(--primary)/0.08)] hover:translate-y-[-1px]',
              'transition-all duration-200'
            )}
          >
            {/* Ícone */}
            <div
              className="flex-shrink-0 w-[30px] h-[30px] flex items-center justify-center rounded-[9px] text-primary"
              style={{ background: 'hsl(var(--primary) / 0.1)' }}
            >
              {s.icon}
            </div>
            {/* Texto */}
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold mb-[2px] text-foreground">
                {s.title}
              </div>
              <div className="text-[12px] text-muted-foreground leading-[1.45]">
                {s.text}
              </div>
            </div>
          </button>
        ))}
      </div>
    </motion.div>
  );
}
