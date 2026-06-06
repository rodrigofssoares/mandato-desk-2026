// EM054 — Aba Mapeamento do editor de formulários
import { ArrowRight, Tag as TagIcon, Kanban, Trophy, Flag, Layers, Settings2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { useUpdateFormulario } from '@/hooks/useFormularios';
import { useTags } from '@/hooks/useTags';
import { useDefaultBoard } from '@/hooks/useBoards';
import { useBoardStages } from '@/hooks/useBoardStages';
import {
  DESTINOS_CONTATO,
  SITUACOES_CONTATO,
  type Formulario,
  type FormularioCampo,
  type DedupCampo,
  type DedupAcao,
} from '@/types/formularios';

interface MappingPanelProps {
  formulario: Formulario;
  campos: FormularioCampo[];
}

interface AutoItemProps {
  icon: React.ReactNode;
  label: string;
  desc: string;
  children: React.ReactNode;
}

function AutoItem({ icon, label, desc, children }: AutoItemProps) {
  return (
    <div className="flex items-center gap-3 p-3 border rounded-lg bg-card">
      <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function SectionCard({
  title,
  icon,
  hint,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card border rounded-xl shadow-sm p-4 space-y-3">
      <div>
        <h3 className="font-semibold text-sm flex items-center gap-2">
          {icon}
          {title}
        </h3>
        <p className="text-xs text-muted-foreground mt-1">{hint}</p>
      </div>
      {children}
    </div>
  );
}

export function MappingPanel({ formulario, campos }: MappingPanelProps) {
  const updateMutation = useUpdateFormulario();
  const { data: tags = [], isLoading: isLoadingTags } = useTags();
  const defaultBoard = useDefaultBoard('contact');
  const { data: stages = [], isLoading: isLoadingStages } = useBoardStages(
    defaultBoard.data?.id ?? null
  );

  const camposMapeaveis = campos.filter(
    (c) => c.tipo !== 'secao' && c.tipo !== 'imagem'
  );

  function patchForm(patch: Partial<Formulario>) {
    updateMutation.mutate({ id: formulario.id, patch });
  }

  function toggleEtiqueta(tagId: string) {
    const atuais = formulario.aplicar_etiquetas ?? [];
    const novas = atuais.includes(tagId)
      ? atuais.filter((t) => t !== tagId)
      : [...atuais, tagId];
    patchForm({ aplicar_etiquetas: novas });
  }

  function toggleSituacao(key: string, valor: boolean) {
    patchForm({
      marcar_situacao: {
        ...(formulario.marcar_situacao ?? {}),
        [key]: valor,
      },
    });
  }

  return (
    <div className="p-6 space-y-6 overflow-y-auto">
      <div>
        <h2 className="text-lg font-semibold mb-1">Mapeamento &amp; Automações</h2>
        <p className="text-sm text-muted-foreground">
          Tudo que acontece quando um contato envia o formulário.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Painel 1: Campos → Contato */}
        <SectionCard
          title="Campos → Contato"
          icon={<ArrowRight className="h-4 w-4 text-primary" />}
          hint="Cada campo grava em até dois destinos do contato."
        >
          {camposMapeaveis.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              Nenhum campo mapeável. Adicione campos no Construtor.
            </p>
          ) : (
            <div className="space-y-2">
              {camposMapeaveis.map((campo) => (
                <div
                  key={campo.id}
                  className="flex items-center gap-2 p-2.5 bg-muted/30 border rounded-lg text-xs"
                >
                  <span className="font-semibold flex-1 min-w-0 truncate">
                    {campo.rotulo || '(sem rótulo)'}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                  <div className="flex gap-1.5 shrink-0">
                    <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                      {campo.mapear_destino_1
                        ? (DESTINOS_CONTATO.find((d) => d.value === campo.mapear_destino_1)?.label ??
                          campo.mapear_destino_1)
                        : '—'}
                    </span>
                    {campo.mapear_destino_2 && (
                      <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                        {DESTINOS_CONTATO.find((d) => d.value === campo.mapear_destino_2)?.label ??
                          campo.mapear_destino_2}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Painel 2: Automações */}
        <SectionCard
          title="Automações no envio"
          icon={<Settings2 className="h-4 w-4 text-primary" />}
          hint="Disparadas para todo contato recebido."
        >
          {/* Etiquetas */}
          <AutoItem
            icon={<TagIcon className="h-4 w-4 text-amber-700" />}
            label="Aplicar etiquetas"
            desc="Adicionadas automaticamente ao contato"
          >
            {null}
          </AutoItem>
          <div className="pl-2 -mt-1 flex flex-wrap gap-1.5 pb-1">
            {isLoadingTags ? (
              <Skeleton className="h-6 w-24" />
            ) : (
              tags.map((tag) => {
                const ativo = (formulario.aplicar_etiquetas ?? []).includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleEtiqueta(tag.id)}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border transition-all
                      ${ativo
                        ? 'border-transparent text-white shadow-sm'
                        : 'border-border text-muted-foreground bg-background hover:bg-muted'
                      }`}
                    style={ativo ? { backgroundColor: tag.cor } : undefined}
                    aria-pressed={ativo}
                    aria-label={`${ativo ? 'Remover' : 'Adicionar'} etiqueta ${tag.nome}`}
                  >
                    ● {tag.nome}
                  </button>
                );
              })
            )}
          </div>

          {/* Mover no funil */}
          <AutoItem
            icon={<Kanban className="h-4 w-4 text-amber-700" />}
            label="Mover no Funil"
            desc="Coluna de destino"
          >
            {isLoadingStages ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <Select
                value={formulario.mover_stage_id ?? '__none__'}
                onValueChange={(v) =>
                  patchForm({ mover_stage_id: v === '__none__' ? null : v })
                }
              >
                <SelectTrigger className="w-28 h-8 text-xs" aria-label="Coluna do funil">
                  <SelectValue placeholder="Nenhuma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhuma</SelectItem>
                  {stages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </AutoItem>

          {/* Ranking */}
          <AutoItem
            icon={<Trophy className="h-4 w-4 text-amber-700" />}
            label="Ranking"
            desc="Pontuação por resposta"
          >
            <Input
              type="number"
              min={0}
              max={9999}
              className="w-20 h-8 text-xs text-right"
              defaultValue={formulario.ranking_pontos ?? 0}
              onBlur={(e) =>
                patchForm({ ranking_pontos: parseInt(e.target.value) || 0 })
              }
              aria-label="Pontos de ranking"
            />
          </AutoItem>

          {/* Situação */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground px-0.5">
              <Flag className="h-3.5 w-3.5 text-amber-700" />
              Marcar situação no contato
            </div>
            {SITUACOES_CONTATO.map((sit) => {
              const ativo = !!(formulario.marcar_situacao ?? {})[sit.value];
              return (
                <div
                  key={sit.value}
                  className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-muted/30"
                >
                  <Label htmlFor={`sit-${sit.value}`} className="text-xs cursor-pointer">
                    {sit.label}
                  </Label>
                  <Switch
                    id={`sit-${sit.value}`}
                    checked={ativo}
                    onCheckedChange={(v) => toggleSituacao(sit.value, v)}
                    aria-label={`Marcar ${sit.label}`}
                  />
                </div>
              );
            })}
          </div>
        </SectionCard>

        {/* Painel 3: Robustez */}
        <SectionCard
          title="Robustez &amp; prazo"
          icon={<Layers className="h-4 w-4 text-primary" />}
          hint="Escala para milhares de envios e fechamento automático."
        >
          {/* Deduplicação */}
          <div className="space-y-2">
            <Label className="text-xs">Duplicados (mesmo WhatsApp/CPF)</Label>
            <Select
              value={formulario.dedup_campo ?? 'nenhum'}
              onValueChange={(v) => patchForm({ dedup_campo: v as DedupCampo })}
            >
              <SelectTrigger className="h-8 text-xs" aria-label="Campo de deduplicação">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhum">Sem deduplicação</SelectItem>
                <SelectItem value="whatsapp">Por WhatsApp</SelectItem>
                <SelectItem value="cpf">Por CPF</SelectItem>
              </SelectContent>
            </Select>

            {formulario.dedup_campo && formulario.dedup_campo !== 'nenhum' && (
              <Select
                value={formulario.dedup_acao ?? 'mesclar'}
                onValueChange={(v) => patchForm({ dedup_acao: v as DedupAcao })}
              >
                <SelectTrigger className="h-8 text-xs" aria-label="Ação ao duplicar">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mesclar">Mesclar com existente</SelectItem>
                  <SelectItem value="criar">Criar novo contato</SelectItem>
                  <SelectItem value="ignorar">Ignorar envio</SelectItem>
                </SelectContent>
              </Select>
            )}
            {formulario.dedup_campo && formulario.dedup_campo !== 'nenhum' && (
              <p className="text-[11px] text-muted-foreground leading-snug">
                {formulario.dedup_acao === 'mesclar' && 'Mesclar: atualiza o contato existente com os novos dados preenchidos (campos em branco não apagam o que já existe).'}
                {formulario.dedup_acao === 'criar' && 'Criar: sempre cria um novo contato, mesmo que já exista um com o mesmo dado.'}
                {formulario.dedup_acao === 'ignorar' && 'Ignorar: se já existe um contato, não altera nada — só registra a resposta.'}
              </p>
            )}
          </div>

          {/* Origem */}
          <div className="space-y-1.5">
            <Label htmlFor="origem" className="text-xs">Origem (tag de rastreio)</Label>
            <Input
              id="origem"
              className="h-8 text-xs"
              placeholder="ex: formulario-web, emendas-2026"
              defaultValue={formulario.origem ?? ''}
              onBlur={(e) =>
                patchForm({ origem: e.target.value || null })
              }
              aria-label="Origem do formulário"
            />
          </div>

          {/* Infos fixas */}
          <div className="space-y-2 pt-1">
            {[
              { label: 'Gravação em lotes', desc: 'Fila assíncrona — sem travar no pico' },
              { label: 'Rate limit + captcha', desc: 'Antiflood no link público' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3 p-2.5 border rounded-lg">
                <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center">
                  <Layers className="h-3.5 w-3.5 text-amber-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold">{item.label}</p>
                  <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                </div>
                <Switch checked disabled aria-label={item.label} />
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
