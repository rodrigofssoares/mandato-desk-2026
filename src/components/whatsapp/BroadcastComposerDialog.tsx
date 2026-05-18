// BroadcastComposerDialog.tsx
// Wizard de 3 passos para criar e disparar uma campanha broadcast (T66 / Fase 6 Onda A).
// Passo 1: Conteúdo (texto ou enquete)
// Passo 2: Segmentação (tags, bairro, zona) + contagem de elegíveis
// Passo 3: Configuração (ritmo, agendamento) + confirmação

import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Trash2, ChevronRight, ChevronLeft, Loader2, Megaphone, Users, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useTags } from '@/hooks/useTags';
import { useCreateBroadcast, countEligibleContacts } from '@/hooks/useZapiBroadcasts';

interface BroadcastComposerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
}

type TipoMensagem = 'mensagem' | 'enquete';

export function BroadcastComposerDialog({
  open,
  onOpenChange,
  accountId,
}: BroadcastComposerDialogProps) {
  const [step, setStep] = useState(1);
  const createBroadcast = useCreateBroadcast();
  const { data: tags = [] } = useTags();

  // Step 1 — Conteúdo
  const [title, setTitle] = useState('');
  const [tipo, setTipo] = useState<TipoMensagem>('mensagem');
  const [body, setBody] = useState('');
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);

  // Step 2 — Segmentação
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [bairro, setBairro] = useState('');
  const [zona, setZona] = useState('');
  const [eligible, setEligible] = useState<number | null>(null);
  const [withoutOptin, setWithoutOptin] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(false);

  // Step 3 — Configuração
  const [ritmo, setRitmo] = useState(10);
  const [sendNow, setSendNow] = useState(true);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');

  // Reset ao abrir
  useEffect(() => {
    if (open) {
      setStep(1);
      setTitle('');
      setTipo('mensagem');
      setBody('');
      setPollQuestion('');
      setPollOptions(['', '']);
      setSelectedTags([]);
      setBairro('');
      setZona('');
      setEligible(null);
      setWithoutOptin(null);
      setRitmo(10);
      setSendNow(true);
      setScheduledDate('');
      setScheduledTime('');
    }
  }, [open]);

  // Debounce simples (sem dependência externa)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Contagem de elegíveis (debounce 500ms)
  const fetchCount = useCallback(
    async (tags: string[], bairro: string, zona: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        setCountLoading(true);
        try {
          const result = await countEligibleContacts({
            tags: tags.length > 0 ? tags : undefined,
            bairro: bairro || undefined,
            zona_eleitoral: zona || undefined,
          });
          setEligible(result.eligible);
          setWithoutOptin(result.withoutOptin);
        } catch {
          setEligible(null);
        } finally {
          setCountLoading(false);
        }
      }, 500);
    },
    [],
  );

  useEffect(() => {
    const noFilter =
      selectedTags.length === 0 && bairro.trim() === '' && zona.trim() === '';
    if (step === 2 && !noFilter) {
      fetchCount(selectedTags, bairro, zona);
    } else if (step === 2 && noFilter) {
      setEligible(null);
      setWithoutOptin(null);
    }
  }, [step, selectedTags, bairro, zona, fetchCount]);

  // ── Validações por step ───────────────────────────────────────────────────────

  const step1Valid =
    title.trim().length > 0 &&
    (tipo === 'mensagem'
      ? body.trim().length > 0
      : pollQuestion.trim().length > 0 && pollOptions.filter((o) => o.trim()).length >= 2);

  const hasSegmentFilter =
    selectedTags.length > 0 || bairro.trim() !== '' || zona.trim() !== '';

  const step2Valid = eligible !== null && eligible > 0 && hasSegmentFilter;

  const step3Valid =
    sendNow ||
    (scheduledDate.trim().length > 0 && scheduledTime.trim().length > 0);

  // ── Handlers ──────────────────────────────────────────────────────────────────

  function toggleTag(tagId: string) {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId],
    );
  }

  function updatePollOption(idx: number, value: string) {
    setPollOptions((prev) => prev.map((o, i) => (i === idx ? value : o)));
  }

  function addPollOption() {
    if (pollOptions.length < 12) setPollOptions((prev) => [...prev, '']);
  }

  function removePollOption(idx: number) {
    if (pollOptions.length > 2) setPollOptions((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleConfirm() {
    let scheduledAt: string | null = null;
    if (!sendNow && scheduledDate && scheduledTime) {
      scheduledAt = new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString();
    }

    try {
      await createBroadcast.mutateAsync({
        account_id: accountId,
        title: title.trim(),
        body: tipo === 'mensagem' ? body.trim() : pollQuestion.trim(),
        tipo,
        poll_question: tipo === 'enquete' ? pollQuestion.trim() : null,
        poll_options: tipo === 'enquete' ? pollOptions.filter((o) => o.trim()) : null,
        segment_filters: {
          tags: selectedTags.length > 0 ? selectedTags : undefined,
          bairro: bairro.trim() || undefined,
          zona_eleitoral: zona.trim() || undefined,
        },
        ritmo_por_minuto: ritmo,
        scheduled_at: scheduledAt,
      });
      onOpenChange(false);
    } catch {
      // Toast já foi mostrado pelo hook
    }
  }

  // ── Cálculo de tempo estimado ──────────────────────────────────────────────────

  const tempoEstimado =
    eligible !== null && ritmo > 0
      ? Math.ceil(eligible / ritmo)
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            Nova campanha
          </DialogTitle>
        </DialogHeader>

        {/* Stepper visual */}
        <div className="flex items-center gap-2 mb-4">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-1.5 flex-1">
              <div
                className={`h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                  s === step
                    ? 'bg-primary text-primary-foreground'
                    : s < step
                    ? 'bg-primary/30 text-primary'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {s}
              </div>
              <span className="text-[11px] text-muted-foreground">
                {s === 1 ? 'Conteúdo' : s === 2 ? 'Segmento' : 'Configurar'}
              </span>
              {s < 3 && <div className="flex-1 h-px bg-border" />}
            </div>
          ))}
        </div>

        <Separator />

        {/* ── Step 1: Conteúdo ────────────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Título da campanha *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Comunicado de votação"
                maxLength={255}
                className="text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Tipo de mensagem</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={tipo === 'mensagem' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTipo('mensagem')}
                  className="flex-1 text-xs"
                >
                  Mensagem de texto
                </Button>
                <Button
                  type="button"
                  variant={tipo === 'enquete' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTipo('enquete')}
                  className="flex-1 text-xs"
                >
                  Enquete
                </Button>
              </div>
            </div>

            {tipo === 'mensagem' ? (
              <div className="space-y-1.5">
                <Label className="text-xs">Mensagem *</Label>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Texto que será enviado a cada eleitor..."
                  rows={5}
                  maxLength={4096}
                  className="text-sm resize-none"
                />
                <p className="text-[11px] text-muted-foreground text-right">
                  {body.length}/4096
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Pergunta da enquete *</Label>
                  <Input
                    value={pollQuestion}
                    onChange={(e) => setPollQuestion(e.target.value)}
                    placeholder="Qual sua opinião sobre...?"
                    maxLength={255}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Opções (mínimo 2) *</Label>
                  {pollOptions.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        value={opt}
                        onChange={(e) => updatePollOption(idx, e.target.value)}
                        placeholder={`Opção ${idx + 1}`}
                        maxLength={100}
                        className="text-sm"
                      />
                      {pollOptions.length > 2 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={() => removePollOption(idx)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {pollOptions.length < 12 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs gap-1"
                      onClick={addPollOption}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Adicionar opção
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Step 2: Segmentação ──────────────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-4 py-2">
            {/* Alerta: segmento obrigatório */}
            {!hasSegmentFilter && (
              <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Selecione ao menos um filtro de segmento (etiqueta, bairro ou zona)
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Filtrar por etiquetas <span className="text-destructive">*</span></Label>
              <p className="text-[11px] text-muted-foreground">
                Ao menos um filtro (etiqueta, bairro ou zona) é obrigatório para criar a campanha.
              </p>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                {tags.map((tag) => (
                  <Badge
                    key={tag.id}
                    variant="outline"
                    className={`cursor-pointer text-[11px] transition-all ${
                      selectedTags.includes(tag.id)
                        ? 'bg-primary/15 border-primary text-primary'
                        : 'hover:bg-muted'
                    }`}
                    onClick={() => toggleTag(tag.id)}
                    style={
                      selectedTags.includes(tag.id)
                        ? { borderColor: tag.cor, color: tag.cor }
                        : {}
                    }
                  >
                    {tag.nome}
                  </Badge>
                ))}
                {tags.length === 0 && (
                  <span className="text-xs text-muted-foreground italic">
                    Nenhuma etiqueta cadastrada
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Bairro</Label>
              <Input
                value={bairro}
                onChange={(e) => setBairro(e.target.value)}
                placeholder="Ex: Centro, Vila Nova..."
                className="text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Zona eleitoral</Label>
              <Input
                value={zona}
                onChange={(e) => setZona(e.target.value)}
                placeholder="Ex: Zona 01"
                className="text-sm"
              />
            </div>

            {/* Contador de elegíveis */}
            <div className="rounded-lg border bg-muted/30 px-3 py-3 space-y-1.5">
              {!hasSegmentFilter ? (
                <p className="text-xs text-muted-foreground">
                  Selecione ao menos um filtro acima para calcular os contatos elegíveis.
                </p>
              ) : countLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Calculando elegíveis...
                </div>
              ) : eligible !== null ? (
                <>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-sm font-semibold">
                      {eligible} contato{eligible !== 1 ? 's' : ''} elegíve{eligible !== 1 ? 'is' : 'l'}
                    </span>
                    <span className="text-xs text-muted-foreground">(com opt-in)</span>
                  </div>
                  {withoutOptin !== null && withoutOptin > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-amber-600">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      {withoutOptin} contato{withoutOptin !== 1 ? 's' : ''} sem consentimento
                      (serão bloqueados)
                    </div>
                  )}
                  {eligible === 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-destructive">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      Nenhum contato com consentimento neste segmento
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Configure os filtros para ver a contagem de elegíveis
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Step 3: Configuração ──────────────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs">
                Ritmo de envio: <strong>{ritmo} msg/min</strong>
              </Label>
              <Slider
                value={[ritmo]}
                onValueChange={([v]) => setRitmo(v)}
                min={1}
                max={30}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>1/min (mais seguro)</span>
                <span>30/min (máximo)</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="send-now"
                checked={sendNow}
                onCheckedChange={setSendNow}
              />
              <Label htmlFor="send-now" className="text-sm cursor-pointer">
                Enviar imediatamente
              </Label>
            </div>

            {!sendNow && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Data</Label>
                  <Input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Hora</Label>
                  <Input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="text-sm"
                  />
                </div>
              </div>
            )}

            {/* Resumo */}
            <div className="rounded-lg border bg-muted/30 px-3 py-3 space-y-1 text-xs">
              <p className="font-semibold text-sm">Resumo</p>
              <p>Contatos: <strong>{eligible ?? '—'}</strong></p>
              <p>Ritmo: <strong>{ritmo} msg/min</strong></p>
              {tempoEstimado !== null && (
                <p>Tempo estimado: <strong>~{tempoEstimado} min</strong></p>
              )}
              {!sendNow && scheduledDate && scheduledTime && (
                <p>
                  Agendado para:{' '}
                  <strong>
                    {new Date(`${scheduledDate}T${scheduledTime}`).toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </strong>
                </p>
              )}
            </div>
          </div>
        )}

        <Separator />

        {/* Navegação */}
        <div className="flex justify-between pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => (step === 1 ? onOpenChange(false) : setStep(step - 1))}
            disabled={createBroadcast.isPending}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            {step === 1 ? 'Cancelar' : 'Voltar'}
          </Button>

          {step < 3 ? (
            <Button
              type="button"
              size="sm"
              onClick={() => setStep(step + 1)}
              disabled={(step === 1 && !step1Valid) || (step === 2 && !step2Valid)}
            >
              Próximo
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={() => void handleConfirm()}
              disabled={!step3Valid || createBroadcast.isPending || !eligible}
            >
              {createBroadcast.isPending ? (
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Iniciando...</>
              ) : (
                <><Megaphone className="h-4 w-4 mr-1" />Confirmar e disparar</>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
