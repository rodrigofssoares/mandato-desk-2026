import { useEffect, useState } from 'react';
import { Plus, Trash2, MessageSquarePlus, GripVertical, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { STARTER_ICONS } from '@/components/agent/AgentWelcome';
import type { ConversationStarter } from '@/hooks/useAgentSettings';
import { useUpsertAgentSettings } from '@/hooks/useAgentSettingsMutation';
import { cn } from '@/lib/utils';

const ICON_NAMES = Object.keys(STARTER_ICONS);
const DEFAULT_ICON = 'MessageCircle';
const MAX_STARTERS = 8;
const TITLE_MAX = 60;
const TEXT_MAX = 120;
const PROMPT_MAX = 500;

interface ConversationStartersEditorProps {
  agentId: string;
  initial: ConversationStarter[];
}

function emptyStarter(): ConversationStarter {
  return { icon: DEFAULT_ICON, title: '', text: '', prompt: '' };
}

export function ConversationStartersEditor({ agentId, initial }: ConversationStartersEditorProps) {
  const [items, setItems] = useState<ConversationStarter[]>(initial);
  const [dirty, setDirty] = useState(false);
  const mutation = useUpsertAgentSettings();

  // Re-hidrata se o banco mudou via realtime ou re-fetch
  useEffect(() => {
    setItems(initial);
    setDirty(false);
  }, [initial]);

  function updateItem(idx: number, patch: Partial<ConversationStarter>) {
    setItems((curr) => curr.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
    setDirty(true);
  }

  function addItem() {
    if (items.length >= MAX_STARTERS) return;
    setItems((curr) => [...curr, emptyStarter()]);
    setDirty(true);
  }

  function removeItem(idx: number) {
    setItems((curr) => curr.filter((_, i) => i !== idx));
    setDirty(true);
  }

  function moveItem(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= items.length) return;
    setItems((curr) => {
      const next = [...curr];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
    setDirty(true);
  }

  function reset() {
    setItems(initial);
    setDirty(false);
  }

  function save() {
    // Validacao basica: titulos e prompts nao podem estar vazios
    const cleaned = items
      .map((it) => ({
        icon: it.icon || DEFAULT_ICON,
        title: it.title.trim(),
        text: it.text.trim(),
        prompt: it.prompt.trim(),
      }))
      .filter((it) => it.title.length > 0 && it.prompt.length > 0);

    mutation.mutate(
      { id: agentId, data: { conversation_starters: cleaned } },
      { onSuccess: () => setDirty(false) },
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          <MessageSquarePlus className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <Label className="text-sm font-semibold">Iniciadores de conversa</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Botões clicáveis que aparecem na tela inicial do agente para acelerar perguntas frequentes.
            Até <strong>{MAX_STARTERS}</strong> itens. Deixe vazio o título OU o prompt para descartar um item ao salvar.
          </p>
        </div>
      </div>

      <div className="space-y-2.5">
        {items.map((item, idx) => {
          const IconCmp = STARTER_ICONS[item.icon] ?? STARTER_ICONS[DEFAULT_ICON];
          return (
            <div
              key={idx}
              className="border border-border rounded-xl bg-card p-3 space-y-2.5"
            >
              {/* Header: icone + reorder + remove */}
              <div className="flex items-center gap-2">
                <Select
                  value={item.icon}
                  onValueChange={(v) => updateItem(idx, { icon: v })}
                >
                  <SelectTrigger className="w-[140px] h-9 text-xs gap-2">
                    <div className="flex items-center gap-2">
                      <IconCmp className="h-3.5 w-3.5 text-primary" />
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="max-h-[280px]">
                    {ICON_NAMES.map((name) => {
                      const Icon = STARTER_ICONS[name];
                      return (
                        <SelectItem key={name} value={name}>
                          <div className="flex items-center gap-2">
                            <Icon className="h-3.5 w-3.5" />
                            <span className="text-xs">{name}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>

                <span className="text-xs text-muted-foreground font-mono">#{idx + 1}</span>

                <div className="flex-1" />

                <button
                  type="button"
                  onClick={() => moveItem(idx, -1)}
                  disabled={idx === 0}
                  className="p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="Mover para cima"
                  title="Mover para cima"
                >
                  <GripVertical className="h-3.5 w-3.5 rotate-180" />
                </button>
                <button
                  type="button"
                  onClick={() => moveItem(idx, 1)}
                  disabled={idx === items.length - 1}
                  className="p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="Mover para baixo"
                  title="Mover para baixo"
                >
                  <GripVertical className="h-3.5 w-3.5" />
                </button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      type="button"
                      className="p-1.5 text-muted-foreground hover:text-destructive rounded-md hover:bg-muted"
                      aria-label={`Remover iniciador #${idx + 1}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remover iniciador?</AlertDialogTitle>
                      <AlertDialogDescription>
                        {item.title
                          ? <>O iniciador <strong>"{item.title}"</strong> será removido.</>
                          : 'O iniciador será removido.'} Você ainda precisa clicar em <strong>Salvar</strong> para confirmar.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => removeItem(idx)}
                        className="bg-destructive hover:bg-destructive/90"
                      >
                        Remover
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              {/* Campos */}
              <div className="grid gap-2.5 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    Título do card
                  </Label>
                  <Input
                    placeholder="Ex: Atender pedido de obra pública"
                    value={item.title}
                    maxLength={TITLE_MAX}
                    onChange={(e) => updateItem(idx, { title: e.target.value })}
                    className="h-9 text-sm"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    {item.title.length}/{TITLE_MAX}
                  </p>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    Subtítulo (descrição)
                  </Label>
                  <Input
                    placeholder="Ex: Roteiro padrão para eleitor pedindo asfalto..."
                    value={item.text}
                    maxLength={TEXT_MAX}
                    onChange={(e) => updateItem(idx, { text: e.target.value })}
                    className="h-9 text-sm"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    {item.text.length}/{TEXT_MAX}
                  </p>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Prompt enviado ao agente ao clicar
                </Label>
                <Textarea
                  placeholder="Ex: Como respondo a um eleitor pedindo asfalto?"
                  value={item.prompt}
                  maxLength={PROMPT_MAX}
                  onChange={(e) => updateItem(idx, { prompt: e.target.value })}
                  rows={2}
                  className="text-sm resize-none"
                />
                <p className="text-[10px] text-muted-foreground">
                  {item.prompt.length}/{PROMPT_MAX}
                </p>
              </div>
            </div>
          );
        })}

        {items.length === 0 && (
          <div className="border border-dashed border-border rounded-xl p-6 text-center text-sm text-muted-foreground">
            Nenhum iniciador configurado. A tela inicial do agente aparecerá apenas com o título.
          </div>
        )}
      </div>

      {/* Footer: adicionar + salvar */}
      <div className="flex items-center gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addItem}
          disabled={items.length >= MAX_STARTERS}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Adicionar iniciador
          <span className="text-muted-foreground text-[10px] ml-1.5">
            ({items.length}/{MAX_STARTERS})
          </span>
        </Button>

        <div className="flex-1" />

        {dirty && (
          <>
            <Button type="button" variant="ghost" size="sm" onClick={reset}>
              Descartar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={save}
              disabled={mutation.isPending}
              className={cn('gap-1.5')}
            >
              {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Salvar iniciadores
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
