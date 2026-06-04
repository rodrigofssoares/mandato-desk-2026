import { useState, useCallback } from 'react';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Trash2, AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useZapiCleanup, type CleanupMode, type GranularItem } from '@/hooks/useZapiCleanup';
import { useZapiChats } from '@/hooks/useZapiChats';

// ─── Constantes ──────────────────────────────────────────────────────────────

const MODO_LABELS: Record<CleanupMode, string> = {
  period: 'Por período',
  all: 'Tudo (conta inteira)',
  chats: 'Conversas específicas',
  granular: 'Avançado (granular)',
};

const MODO_DESC: Record<CleanupMode, string> = {
  period: 'Apaga mensagens e conversas dentro de um intervalo de datas.',
  all: 'Apaga todos os chats e mensagens desta conta.',
  chats: 'Escolha quais conversas enviar para a lixeira.',
  granular: 'Selecione exatamente quais tipos de dados apagar.',
};

const PRESETS_DIA = [
  { label: '7 dias', days: 7 },
  { label: '30 dias', days: 30 },
  { label: '90 dias', days: 90 },
  { label: 'Tudo', days: null },
] as const;

const GRANULAR_ITEMS: { id: GranularItem; label: string; desc: string }[] = [
  { id: 'messages', label: 'Mensagens', desc: 'Todas as mensagens de texto e mídia.' },
  { id: 'media', label: 'Mídias', desc: 'Apenas mídias (imagens, áudios, documentos).' },
  { id: 'notes', label: 'Anotações', desc: 'Notas internas das conversas.' },
  { id: 'tags', label: 'Etiquetas', desc: 'Etiquetas associadas às conversas.' },
  { id: 'flags', label: 'Favoritos', desc: 'Mensagens marcadas como favoritas.' },
  { id: 'logs', label: 'Logs de webhook', desc: 'Eventos registrados pelo webhook Z-API.' },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface CleanupHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  accountName: string;
  /** Callback para abrir o painel de lixeira após conclusão (admin-only) */
  onViewTrash?: () => void;
}

// ─── Estado inicial ───────────────────────────────────────────────────────────

function makeInitialState() {
  return {
    step: 1 as 1 | 2 | 3 | 4,
    modo: null as CleanupMode | null,
    // Período: null='Tudo', number=preset em dias, undefined=datas manuais
    presetDays: null as number | null | undefined,
    startDate: '',
    endDate: '',
    // Chats específicos
    chatSearch: '',
    selectedChatIds: new Set<string>(),
    // Granular
    granularItems: new Set<GranularItem>(),
    // Confirmação
    confirmInput: '',
    // Resultado
    result: null as { batch_id: string; row_count: number; expires_at: string } | null,
  };
}

// ─── CleanupHistoryDialog ─────────────────────────────────────────────────────

export function CleanupHistoryDialog({
  open,
  onOpenChange,
  accountId,
  accountName,
  onViewTrash,
}: CleanupHistoryDialogProps) {
  const [state, setState] = useState(makeInitialState);
  const { cleanupMutation } = useZapiCleanup(accountId);
  const chatsQuery = useZapiChats(
    state.modo === 'chats' || state.modo === 'granular' ? accountId : null,
  );

  // Reseta ao fechar
  function handleOpenChange(v: boolean) {
    if (!v) setState(makeInitialState());
    onOpenChange(v);
  }

  const setPartial = useCallback(
    (patch: Partial<ReturnType<typeof makeInitialState>>) =>
      setState((s) => ({ ...s, ...patch })),
    [],
  );

  // ─── Passo 1: validação ───────────────────────────────────────────────────

  const passo1Valido = state.modo !== null;

  // ─── Passo 2: validação ───────────────────────────────────────────────────

  // FIX 8: detecta intervalo invertido para exibir feedback visual
  const intervaloInvertido = (() => {
    if (state.modo !== 'period' && state.modo !== 'granular') return false;
    if (!state.startDate || !state.endDate) return false;
    return new Date(state.endDate) < new Date(state.startDate);
  })();

  const passo2Valido = (() => {
    if (!state.modo) return false;
    if (state.modo === 'all') return true;
    if (state.modo === 'period') {
      // preset selecionado (null="Tudo", number=X dias) OU datas manuais preenchidas e válidas
      if (state.presetDays !== undefined) return true;
      if (state.startDate.length === 0 || state.endDate.length === 0) return false;
      // FIX 8: impede avançar com intervalo invertido
      return !intervaloInvertido;
    }
    if (state.modo === 'chats') return state.selectedChatIds.size > 0;
    if (state.modo === 'granular') return state.granularItems.size > 0;
    return false;
  })();

  // ─── Passo 3: confirmação ────────────────────────────────────────────────

  const confirmacaoCorreta = state.confirmInput.trim().toUpperCase() === 'CONFIRMAR';

  // ─── Executa cleanup ─────────────────────────────────────────────────────

  function buildModeAndFilters(): { mode: CleanupMode; filters: ReturnType<typeof buildFilters> } {
    const { modo, presetDays } = state;

    // FIX 7: preset "Tudo" em modo 'period' deve enviar mode='all' com filtros vazios,
    // não mode='period' sem datas (que a EF rejeita com 400 pois start_date é obrigatório).
    if (modo === 'period' && presetDays === null) {
      return { mode: 'all', filters: {} };
    }

    return { mode: modo!, filters: buildFilters() };
  }

  function buildFilters() {
    const { modo, presetDays, startDate, endDate, selectedChatIds, granularItems } = state;

    if (modo === 'all') return {};

    if (modo === 'period') {
      // presetDays === null → tratado em buildModeAndFilters (não chega aqui)
      // presetDays === undefined → modo manual (datas do input)
      if (presetDays !== undefined && presetDays !== null) {
        const end = new Date();
        const start = subDays(end, presetDays);
        return { start_date: start.toISOString(), end_date: end.toISOString() };
      }
      // datas manuais
      return {
        start_date: new Date(startDate).toISOString(),
        end_date: new Date(endDate + 'T23:59:59').toISOString(),
      };
    }

    if (modo === 'chats') {
      return { chat_ids: Array.from(selectedChatIds) };
    }

    if (modo === 'granular') {
      return {
        ...(selectedChatIds.size > 0 && { chat_ids: Array.from(selectedChatIds) }),
        items: Array.from(granularItems),
      };
    }

    return {};
  }

  async function handleConfirmar() {
    if (!state.modo || !confirmacaoCorreta) return;

    const { mode, filters } = buildModeAndFilters();

    try {
      const result = await cleanupMutation.mutateAsync({ mode, filters });
      setPartial({ step: 4, result });
    } catch {
      // toast.error já exibido pelo hook
    }
  }

  // ─── Navegação entre passos ──────────────────────────────────────────────

  function handleProximo() {
    if (state.step === 1 && passo1Valido) setPartial({ step: 2 });
    else if (state.step === 2 && passo2Valido) setPartial({ step: 3 });
    else if (state.step === 3) handleConfirmar();
  }

  function handleVoltar() {
    if (state.step > 1 && state.step < 4) {
      setPartial({ step: (state.step - 1) as 1 | 2 | 3 });
    }
  }

  // ─── Helpers de modo ─────────────────────────────────────────────────────

  function toggleChatId(id: string) {
    const next = new Set(state.selectedChatIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPartial({ selectedChatIds: next });
  }

  function toggleGranularItem(item: GranularItem) {
    const next = new Set(state.granularItems);
    if (next.has(item)) next.delete(item);
    else next.add(item);
    setPartial({ granularItems: next });
  }

  // ─── Renderização dos passos ──────────────────────────────────────────────

  function renderPasso1() {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Escolha como deseja limpar o histórico de <span className="font-medium text-foreground">{accountName}</span>:
        </p>
        <div className="space-y-2">
          {(Object.keys(MODO_LABELS) as CleanupMode[]).map((modo) => (
            <button
              key={modo}
              type="button"
              onClick={() => setPartial({ modo })}
              className={cn(
                'w-full text-left px-4 py-3 rounded-lg border transition-colors',
                state.modo === modo
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:bg-muted/50',
              )}
            >
              <p className="font-medium text-sm">{MODO_LABELS[modo]}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{MODO_DESC[modo]}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  function renderPasso2() {
    const { modo } = state;

    if (modo === 'all') {
      return (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm text-destructive">Atenção: operação destrutiva</p>
              <p className="text-sm text-muted-foreground mt-1">
                Todos os chats, mensagens, anotações, etiquetas e logs desta conta serão enviados
                para a lixeira. Os dados ficam disponíveis por 7 dias antes de serem apagados
                definitivamente.
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (modo === 'period') {
      return (
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">Atalhos rápidos</p>
            <div className="flex gap-2 flex-wrap">
              {PRESETS_DIA.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setPartial({ presetDays: p.days ?? null, startDate: '', endDate: '' })}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
                    state.presetDays === p.days
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border hover:bg-muted/50',
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">ou intervalo personalizado</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="start-date" className="text-xs">Data de início</Label>
              <Input
                id="start-date"
                type="date"
                value={state.startDate}
                onChange={(e) => setPartial({ startDate: e.target.value, presetDays: undefined })}
                className={cn('h-8 text-xs', intervaloInvertido && 'border-destructive')}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end-date" className="text-xs">Data de fim</Label>
              <Input
                id="end-date"
                type="date"
                value={state.endDate}
                onChange={(e) => setPartial({ endDate: e.target.value, presetDays: undefined })}
                className={cn('h-8 text-xs', intervaloInvertido && 'border-destructive')}
              />
            </div>
          </div>
          {/* FIX 8: feedback visual de intervalo invertido */}
          {intervaloInvertido && (
            <p className="text-xs text-destructive">
              A data de fim não pode ser anterior à data de início.
            </p>
          )}
        </div>
      );
    }

    if (modo === 'chats') {
      const chats = chatsQuery.data ?? [];
      const filtered = chats.filter((c) => {
        const q = state.chatSearch.toLowerCase();
        if (!q) return true;
        return (
          (c.phone ?? '').includes(q) ||
          (c.contact_name ?? '').toLowerCase().includes(q) ||
          (c.whatsapp_name ?? '').toLowerCase().includes(q)
        );
      });

      return (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {state.selectedChatIds.size} de {chats.length} conversa{chats.length !== 1 ? 's' : ''} selecionada{state.selectedChatIds.size !== 1 ? 's' : ''}
          </p>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={state.chatSearch}
              onChange={(e) => setPartial({ chatSearch: e.target.value })}
              placeholder="Buscar por nome ou número..."
              className="pl-7 h-8 text-xs"
            />
          </div>
          <ScrollArea className="h-48 pr-2">
            {chatsQuery.isLoading && (
              <p className="text-xs text-muted-foreground text-center py-4">Carregando conversas...</p>
            )}
            {!chatsQuery.isLoading && filtered.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhuma conversa encontrada.</p>
            )}
            {filtered.map((chat) => {
              const isChecked = state.selectedChatIds.has(chat.id);
              const label = chat.contact_name ?? chat.whatsapp_name ?? chat.phone;
              return (
                <label
                  key={chat.id}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors mb-1',
                    isChecked ? 'bg-primary/5 border border-primary/30' : 'hover:bg-muted/50 border border-transparent',
                  )}
                >
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={() => toggleChatId(chat.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{label}</p>
                    {chat.contact_name && (
                      <p className="text-xs text-muted-foreground truncate">{chat.phone}</p>
                    )}
                  </div>
                </label>
              );
            })}
          </ScrollArea>
        </div>
      );
    }

    if (modo === 'granular') {
      const chats = chatsQuery.data ?? [];
      return (
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">Tipos de dados a apagar</p>
            <div className="space-y-2">
              {GRANULAR_ITEMS.map((item) => {
                const isChecked = state.granularItems.has(item.id);
                return (
                  <label
                    key={item.id}
                    className={cn(
                      'flex items-start gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-colors border',
                      isChecked ? 'bg-primary/5 border-primary/30' : 'hover:bg-muted/50 border-border',
                    )}
                  >
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => toggleGranularItem(item.id)}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {chats.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-1">
                Limitar a conversas específicas{' '}
                <span className="font-normal text-muted-foreground text-xs">(opcional)</span>
              </p>
              <p className="text-xs text-muted-foreground mb-2">
                Sem seleção, aplica a todas as conversas da conta.
              </p>
              <ScrollArea className="h-32 pr-2 border rounded-md p-2">
                {chats.map((chat) => {
                  const isChecked = state.selectedChatIds.has(chat.id);
                  const label = chat.contact_name ?? chat.whatsapp_name ?? chat.phone;
                  return (
                    <label
                      key={chat.id}
                      className="flex items-center gap-2 py-1.5 cursor-pointer hover:bg-muted/30 rounded px-1"
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => toggleChatId(chat.id)}
                      />
                      <span className="text-xs truncate">{label}</span>
                    </label>
                  );
                })}
              </ScrollArea>
            </div>
          )}
        </div>
      );
    }

    return null;
  }

  function renderPasso3() {
    const { modo, selectedChatIds, granularItems, presetDays, startDate, endDate } = state;

    // Resumo do que será apagado
    let resumo = '';
    if (modo === 'all') resumo = 'Todos os chats e mensagens desta conta';
    else if (modo === 'period') {
      if (presetDays === null) resumo = 'Todo o histórico (sem filtro de data)';
      else {
        const preset = PRESETS_DIA.find((p) => p.days === presetDays);
        resumo = preset ? `Mensagens dos últimos ${preset.label}` : `${startDate} a ${endDate}`;
      }
    } else if (modo === 'chats') {
      resumo = `${selectedChatIds.size} conversa${selectedChatIds.size !== 1 ? 's' : ''} selecionada${selectedChatIds.size !== 1 ? 's' : ''}`;
    } else if (modo === 'granular') {
      const labels = Array.from(granularItems)
        .map((i) => GRANULAR_ITEMS.find((g) => g.id === i)?.label ?? i)
        .join(', ');
      resumo = labels || 'Itens granulares selecionados';
    }

    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-sm text-amber-800 dark:text-amber-400">
                Confirme a limpeza
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-500">
                <span className="font-medium">{resumo}</span> serão enviados para a lixeira.
                Os dados ficam disponíveis por 7 dias e só um administrador pode recuperá-los.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm-input" className="text-sm">
            Para confirmar, digite{' '}
            <span className="font-mono font-bold tracking-wider">CONFIRMAR</span>{' '}
            no campo abaixo:
          </Label>
          <Input
            id="confirm-input"
            value={state.confirmInput}
            onChange={(e) => setPartial({ confirmInput: e.target.value })}
            placeholder="CONFIRMAR"
            className={cn(
              'font-mono',
              state.confirmInput.length > 0 && !confirmacaoCorreta && 'border-destructive',
              confirmacaoCorreta && 'border-green-500',
            )}
            autoComplete="off"
          />
          {state.confirmInput.length > 0 && !confirmacaoCorreta && (
            <p className="text-xs text-destructive">
              Digite exatamente "CONFIRMAR" (maiúsculas) para continuar.
            </p>
          )}
        </div>
      </div>
    );
  }

  function renderPasso4() {
    const { result } = state;
    if (!result) return null;

    const expiresFormatted = result.expires_at
      ? format(new Date(result.expires_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
      : '';

    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/30">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-sm text-green-800 dark:text-green-400">
                Limpeza realizada com sucesso
              </p>
              <p className="text-xs text-green-700 dark:text-green-500">
                {result.row_count} {result.row_count === 1 ? 'item enviado' : 'itens enviados'} para a lixeira.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-md border bg-muted/30 p-3 space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">ID do lote:</span>
            <span className="font-mono text-[10px]">{result.batch_id.slice(0, 8)}…</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Itens na lixeira:</span>
            <span className="font-medium">{result.row_count}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Expira em:</span>
            <span className="font-medium">{expiresFormatted}</span>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Somente um administrador pode recuperar os dados antes do prazo de expiração.
        </p>

        {onViewTrash && (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => {
              handleOpenChange(false);
              onViewTrash();
            }}
          >
            Ver lixeira
          </Button>
        )}
      </div>
    );
  }

  // ─── Stepper visual ───────────────────────────────────────────────────────

  const stepLabels = ['Modo', 'Filtros', 'Confirmação', 'Resultado'];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
              <Trash2 className="h-4 w-4 text-destructive" />
            </div>
            <div>
              <DialogTitle>Limpar histórico</DialogTitle>
              <DialogDescription>
                {accountName} — Passo {state.step} de {state.step < 4 ? '3' : '4'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center gap-1 px-1">
          {stepLabels.map((label, i) => {
            const step = (i + 1) as 1 | 2 | 3 | 4;
            const isDone = state.step > step;
            const isActive = state.step === step;
            return (
              <div key={label} className="flex items-center flex-1">
                <div
                  className={cn(
                    'h-1.5 rounded-full flex-1 transition-colors',
                    isDone ? 'bg-primary' : isActive ? 'bg-primary/50' : 'bg-border',
                  )}
                />
              </div>
            );
          })}
        </div>

        {/* Conteúdo do passo */}
        <div className="min-h-[200px]">
          {state.step === 1 && renderPasso1()}
          {state.step === 2 && renderPasso2()}
          {state.step === 3 && renderPasso3()}
          {state.step === 4 && renderPasso4()}
        </div>

        {/* Footer de navegação */}
        {state.step < 4 && (
          <div className="flex items-center justify-between pt-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              onClick={state.step === 1 ? () => handleOpenChange(false) : handleVoltar}
            >
              {state.step === 1 ? (
                'Cancelar'
              ) : (
                <>
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Voltar
                </>
              )}
            </Button>

            <Button
              size="sm"
              onClick={handleProximo}
              disabled={
                (state.step === 1 && !passo1Valido) ||
                (state.step === 2 && !passo2Valido) ||
                (state.step === 3 && (!confirmacaoCorreta || cleanupMutation.isPending))
              }
              variant={state.step === 3 ? 'destructive' : 'default'}
            >
              {cleanupMutation.isPending ? (
                'Limpando...'
              ) : state.step === 3 ? (
                'Limpar histórico'
              ) : (
                <>
                  Próximo
                  <ChevronRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        )}

        {state.step === 4 && (
          <div className="flex justify-end pt-2 border-t">
            <Button size="sm" onClick={() => handleOpenChange(false)}>
              Fechar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
