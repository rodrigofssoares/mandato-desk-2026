// EM054-v2 — Aba Mapeamento do editor de formulários
import { ArrowRight, Tag as TagIcon, Kanban, Trophy, Flag, Layers, Settings2, ClipboardList } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { useUpdateFormulario } from '@/hooks/useFormularios';
import { useTags } from '@/hooks/useTags';
import { useBoards } from '@/hooks/useBoards';
import { useBoardStages } from '@/hooks/useBoardStages';
import { usePermissions } from '@/hooks/usePermissions';
import {
  DESTINOS_CONTATO,
  DESTINOS_DEMANDA,
  DEMANDA_PRIORITY_LABELS,
  SITUACOES_CONTATO,
  type Formulario,
  type FormularioCampo,
  type DedupCampo,
  type DedupAcao,
  type DemandaPriority,
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
  const { can } = usePermissions();
  const updateMutation = useUpdateFormulario();
  const { data: tags = [], isLoading: isLoadingTags } = useTags();

  // Frente 3: funil específico — carrega todos os boards de contato
  const { data: boards = [], isLoading: isLoadingBoards } = useBoards('contact');
  const boardSelecionadoId = formulario.mover_board_id ?? null;

  // Stages do board selecionado
  const { data: stages = [], isLoading: isLoadingStages } = useBoardStages(boardSelecionadoId);

  // Frente 2: permissão para criar demanda
  const podeCriarDemanda = !!(can.createDemand?.() ?? can.viewDemands?.());

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
                  <div className="flex gap-1.5 shrink-0 flex-wrap">
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
                    {/* Indicador de mapeamento para demanda */}
                    {campo.mapear_demanda && (
                      <span className="px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 font-medium">
                        {DESTINOS_DEMANDA.find((d) => d.value === campo.mapear_demanda)?.label ??
                          campo.mapear_demanda}
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

          {/* Mover no funil — Frente 3: selects de funil + etapa */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground px-0.5">
              <Kanban className="h-3.5 w-3.5 text-amber-700" />
              Mover no Funil
            </div>

            {/* Select do board */}
            {isLoadingBoards ? (
              <Skeleton className="h-8 w-full" />
            ) : (
              <Select
                value={boardSelecionadoId ?? '__none__'}
                onValueChange={(v) => {
                  // Ao trocar o board, reseta a etapa
                  patchForm({
                    mover_board_id: v === '__none__' ? null : v,
                    mover_stage_id: null,
                  });
                }}
              >
                <SelectTrigger className="h-8 text-xs" aria-label="Funil de destino">
                  <SelectValue placeholder="— nenhum —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— nenhum —</SelectItem>
                  {boards.map((board) => (
                    <SelectItem key={board.id} value={board.id}>
                      {board.nome}
                      {board.is_default ? ' (padrão)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Select da etapa — só quando um board está selecionado */}
            {boardSelecionadoId && (
              isLoadingStages ? (
                <Skeleton className="h-8 w-full" />
              ) : (
                <Select
                  value={formulario.mover_stage_id ?? '__none__'}
                  onValueChange={(v) =>
                    patchForm({ mover_stage_id: v === '__none__' ? null : v })
                  }
                >
                  <SelectTrigger className="h-8 text-xs" aria-label="Coluna de destino no funil">
                    <SelectValue placeholder="— nenhuma —" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— nenhuma —</SelectItem>
                    {stages.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )
            )}

            {/* Fallback para forms da v1: board_id null mas stage_id preenchido */}
            {!boardSelecionadoId && formulario.mover_stage_id && (
              <p className="text-[11px] text-amber-600 bg-amber-50 dark:bg-amber-950/20 px-2 py-1.5 rounded">
                Etapa configurada na versão anterior — selecione um funil acima para confirmá-la.
              </p>
            )}
          </div>

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

          {/* Frente 2: Criar Demanda */}
          <div className="border rounded-lg p-3 space-y-3 bg-card">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center shrink-0">
                <ClipboardList className="h-4 w-4 text-violet-700 dark:text-violet-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">Criar Demanda</p>
                <p className="text-xs text-muted-foreground">Cada envio gera uma demanda</p>
              </div>
              <Switch
                checked={!!formulario.criar_demanda}
                onCheckedChange={(v) => patchForm({ criar_demanda: v })}
                disabled={!podeCriarDemanda}
                aria-label="Criar demanda ao receber formulário"
              />
            </div>

            {!podeCriarDemanda && (
              <p className="text-[11px] text-amber-600 bg-amber-50 dark:bg-amber-950/20 px-2 py-1.5 rounded">
                Sem permissão para criar demandas — contate o administrador.
              </p>
            )}

            {formulario.criar_demanda && podeCriarDemanda && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="demanda-prioridade" className="text-xs">Prioridade da demanda</Label>
                  <Select
                    value={formulario.demanda_priority ?? 'medium'}
                    onValueChange={(v) => patchForm({ demanda_priority: v as DemandaPriority })}
                  >
                    <SelectTrigger id="demanda-prioridade" className="h-8 text-xs" aria-label="Prioridade da demanda">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.entries(DEMANDA_PRIORITY_LABELS) as [DemandaPriority, string][]).map(
                        ([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Cada envio cria uma demanda vinculada ao contato. Mapeie abaixo quais campos
                  preenchem o título/descrição/bairro da demanda (no painel de cada campo).
                </p>
              </>
            )}
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
