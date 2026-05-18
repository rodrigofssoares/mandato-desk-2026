// RelationshipRulesSection.tsx
// Gestão de réguas de relacionamento automático (T74 / Fase 6 Onda B — C22).
// Criar, listar, ativar/desativar e excluir réguas.

import { useState } from 'react';
import {
  Zap,
  Plus,
  Trash2,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { EmptyState } from '@/components/ui-system';
import {
  useRelationshipRules,
  useCreateRelationshipRule,
  useUpdateRelationshipRule,
  useDeleteRelationshipRule,
  type RelationshipRule,
  type RelationshipRuleInsert,
} from '@/hooks/useRelationshipRules';
import { useBoards } from '@/hooks/useBoards';
import { useBoardStages } from '@/hooks/useBoardStages';

interface RelationshipRulesSectionProps {
  accountId: string;
}

// ─── RuleFormDialog ───────────────────────────────────────────────────────────

interface RuleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  isLoading: boolean;
  onSubmit: (data: RelationshipRuleInsert) => void;
}

function RuleFormDialog({ open, onOpenChange, accountId, isLoading, onSubmit }: RuleFormDialogProps) {
  const { data: boards = [] } = useBoards();
  const [selectedBoardId, setSelectedBoardId] = useState<string>('');
  const { data: stages = [] } = useBoardStages(selectedBoardId || null);

  const [nome, setNome] = useState('');
  const [boardStageId, setBoardStageId] = useState<string>('');
  const [diasSemResposta, setDiasSemResposta] = useState(3);
  const [mensagemTemplate, setMensagemTemplate] = useState('');

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setNome('');
      setSelectedBoardId('');
      setBoardStageId('');
      setDiasSemResposta(3);
      setMensagemTemplate('');
    }
    onOpenChange(nextOpen);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !mensagemTemplate.trim() || diasSemResposta < 1) return;

    onSubmit({
      account_id: accountId,
      nome: nome.trim(),
      board_stage_id: boardStageId || null,
      dias_sem_resposta: diasSemResposta,
      mensagem_template: mensagemTemplate.trim(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova régua de relacionamento</DialogTitle>
          <DialogDescription>
            Define quando e como enviar follow-up automático para eleitores sem resposta.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="rule-nome">Nome da régua *</Label>
            <Input
              id="rule-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Follow-up Interesse"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rule-dias">Dias sem resposta *</Label>
            <Input
              id="rule-dias"
              type="number"
              min={1}
              max={365}
              value={diasSemResposta}
              onChange={(e) => setDiasSemResposta(Math.max(1, parseInt(e.target.value) || 1))}
              required
            />
            <p className="text-[11px] text-muted-foreground">
              Dias desde a última mensagem recebida (não enviada).
            </p>
          </div>

          {/* Funil + etapa (opcional) */}
          <div className="space-y-1.5">
            <Label>Etapa do funil (opcional)</Label>
            <Select value={selectedBoardId} onValueChange={(v) => { setSelectedBoardId(v); setBoardStageId(''); }}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os contatos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos os contatos</SelectItem>
                {boards.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedBoardId && stages.length > 0 && (
              <Select value={boardStageId} onValueChange={setBoardStageId}>
                <SelectTrigger>
                  <SelectValue placeholder="Qualquer etapa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Qualquer etapa</SelectItem>
                  {stages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rule-template">Mensagem de follow-up *</Label>
            <Textarea
              id="rule-template"
              value={mensagemTemplate}
              onChange={(e) => setMensagemTemplate(e.target.value)}
              placeholder="Olá {nome}! Passando para verificar se posso ajudá-lo(a) em algo. Aguardo seu retorno!"
              rows={4}
              className="resize-none text-sm"
              required
            />
            <p className="text-[11px] text-muted-foreground">
              Variáveis disponíveis: <code className="font-mono">{'{nome}'}</code>,{' '}
              <code className="font-mono">{'{protocolo}'}</code>
            </p>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading || !nome.trim() || !mensagemTemplate.trim()}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Criar régua
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── RelationshipRulesSection ─────────────────────────────────────────────────

export function RelationshipRulesSection({ accountId }: RelationshipRulesSectionProps) {
  const { data: rules = [], isLoading } = useRelationshipRules(accountId);
  const createRule = useCreateRelationshipRule();
  const updateRule = useUpdateRelationshipRule();
  const deleteRule = useDeleteRelationshipRule();

  const [formOpen, setFormOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function handleToggleActive(rule: RelationshipRule) {
    updateRule.mutate({ id: rule.id, ativo: !rule.ativo });
  }

  function handleDeleteConfirm() {
    if (!deletingId) return;
    deleteRule.mutate(
      { id: deletingId, accountId },
      { onSuccess: () => setDeletingId(null) },
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold">Régua de relacionamento</h4>
        </div>
        <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={() => setFormOpen(true)}>
          <Plus className="h-3 w-3" />
          Nova régua
        </Button>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Carregando...
        </div>
      ) : rules.length === 0 ? (
        <EmptyState
          icon={Zap}
          title="Nenhuma régua configurada"
          description="Configure follow-ups automáticos para eleitores sem resposta."
          action={
            <Button size="sm" onClick={() => setFormOpen(true)} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Nova régua
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => {
            const isExpanded = expandedId === rule.id;
            return (
              <div key={rule.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{rule.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {rule.dias_sem_resposta} dia{rule.dias_sem_resposta !== 1 ? 's' : ''} sem resposta
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={rule.ativo}
                      onCheckedChange={() => handleToggleActive(rule)}
                      disabled={updateRule.isPending}
                      aria-label={rule.ativo ? 'Desativar régua' : 'Ativar régua'}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setDeletingId(rule.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Preview do template (colapsável) */}
                <Collapsible open={isExpanded} onOpenChange={(v) => setExpandedId(v ? rule.id : null)}>
                  <CollapsibleTrigger className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                    {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    Ver mensagem
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <p className="text-xs text-muted-foreground italic mt-1.5 bg-muted/30 rounded p-2 leading-relaxed">
                      {rule.mensagem_template}
                    </p>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            );
          })}
        </div>
      )}

      {/* Form Dialog */}
      <RuleFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        accountId={accountId}
        isLoading={createRule.isPending}
        onSubmit={(data) => createRule.mutate(data, { onSuccess: () => setFormOpen(false) })}
      />

      {/* Alert de exclusão */}
      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir régua</AlertDialogTitle>
            <AlertDialogDescription>
              Esta régua será removida e não disparará mais follow-ups automáticos.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteConfirm}
            >
              {deleteRule.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Excluir régua
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
