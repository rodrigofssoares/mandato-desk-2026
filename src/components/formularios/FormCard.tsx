// EM054 — Card de formulário na lista "Meus formulários"
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarClock, BarChart3, Pencil, Copy, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
import { STATUS_LABELS, type FormularioComMetricas } from '@/types/formularios';
import { useDeleteFormulario, useDuplicateFormulario } from '@/hooks/useFormularios';
import { formatarData, calcularContagem } from './formularioUtils';

// Paleta de capas — cicla pelas cores disponíveis via tema
const CAPA_COLORS = [
  'bg-primary',
  'bg-amber-600',
  'bg-blue-700',
  'bg-emerald-700',
  'bg-purple-700',
  'bg-rose-700',
];

function getCapaClass(id: string): string {
  // Usa os últimos dígitos do UUID para determinar cor ciclicamente
  const n = parseInt(id.replace(/-/g, '').slice(-4), 16) % CAPA_COLORS.length;
  return CAPA_COLORS[n];
}

function StatusBadge({ status }: { status: FormularioComMetricas['status'] }) {
  const config = {
    ativo: { label: 'Ativo', dot: 'bg-emerald-500 animate-pulse', text: 'text-emerald-700' },
    agendado: { label: 'Agendado', dot: 'bg-amber-500', text: 'text-amber-700' },
    encerrado: { label: 'Encerrado', dot: 'bg-muted-foreground', text: 'text-muted-foreground' },
    rascunho: { label: 'Rascunho', dot: 'bg-muted-foreground', text: 'text-muted-foreground' },
  }[status] ?? { label: STATUS_LABELS[status] ?? status, dot: 'bg-muted-foreground', text: 'text-muted-foreground' };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-white/90 ${config.text}`}>
      <span className={`w-2 h-2 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}

interface FormCardProps {
  form: FormularioComMetricas;
  selected?: boolean;
  selectMode?: boolean;
  onToggleSelect?: (id: string) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

export function FormCard({
  form,
  selected = false,
  selectMode = false,
  onToggleSelect,
  canEdit = true,
  canDelete = true,
}: FormCardProps) {
  const navigate = useNavigate();
  const deleteMutation = useDeleteFormulario();
  const duplicateMutation = useDuplicateFormulario();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const capaClass = form.tema?.cor
    ? undefined
    : getCapaClass(form.id);

  const capaStyle = form.tema?.cor
    ? { backgroundColor: form.tema.cor }
    : undefined;

  const conversao =
    form.total_visitas > 0
      ? Math.round((form.total_respostas / form.total_visitas) * 100)
      : 0;

  const { texto: contagemTexto, urgente } = calcularContagem(form.encerra_em);

  function handleCardClick() {
    if (selectMode) {
      onToggleSelect?.(form.id);
    } else {
      navigate(`/formularios/${form.id}`);
    }
  }

  function handleEditar(e: React.MouseEvent) {
    e.stopPropagation();
    navigate(`/formularios/${form.id}`);
  }

  function handleMetricas(e: React.MouseEvent) {
    e.stopPropagation();
    navigate(`/formularios/${form.id}?tab=metricas`);
  }

  async function handleDuplicar(e: React.MouseEvent) {
    e.stopPropagation();
    await duplicateMutation.mutateAsync(form.id);
  }

  function handleExcluirClick(e: React.MouseEvent) {
    e.stopPropagation();
    setConfirmOpen(true);
  }

  async function handleConfirmExcluir() {
    await deleteMutation.mutateAsync(form.id);
    setConfirmOpen(false);
  }

  return (
    <>
      <article
        className={`
          bg-card border rounded-xl overflow-hidden shadow-sm cursor-pointer
          transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md
          ${selected ? 'ring-2 ring-primary ring-offset-1' : ''}
        `}
        onClick={handleCardClick}
        aria-label={`Formulário: ${form.titulo}`}
      >
        {/* Capa colorida */}
        <div
          className={`relative h-20 ${capaClass ?? ''}`}
          style={capaStyle}
        >
          {/* Checkbox de seleção */}
          {selectMode && (
            <div
              className="absolute top-2 left-2 z-10"
              onClick={(e) => { e.stopPropagation(); onToggleSelect?.(form.id); }}
            >
              <Checkbox
                checked={selected}
                className="bg-white border-white data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                aria-label={`Selecionar ${form.titulo}`}
              />
            </div>
          )}

          {/* Badge de status */}
          <div className="absolute top-2 right-2">
            <StatusBadge status={form.status} />
          </div>
        </div>

        {/* Corpo do card */}
        <div className="p-3.5">
          <h3 className="font-semibold text-sm text-foreground leading-tight mb-0.5 truncate">
            {form.titulo}
          </h3>
          {form.descricao && (
            <p className="text-xs text-muted-foreground mb-2.5 line-clamp-1">{form.descricao}</p>
          )}

          {/* Janela de atividade */}
          {(form.abre_em || form.encerra_em) && (
            <div className="flex items-center gap-1.5 bg-muted/40 border rounded-lg px-2.5 py-1.5 mb-2.5 text-xs">
              <CalendarClock className="h-3.5 w-3.5 text-amber-600 shrink-0" />
              <span className="flex-1 text-muted-foreground leading-tight">
                {form.abre_em && (
                  <span>Abriu <strong className="text-foreground">{formatarData(form.abre_em)}</strong> </span>
                )}
                {form.encerra_em && (
                  <span>· encerra <strong className="text-foreground">{formatarData(form.encerra_em)}</strong></span>
                )}
              </span>
              {contagemTexto && (
                <span className={`font-bold whitespace-nowrap ${urgente ? 'text-destructive' : 'text-amber-600'}`}>
                  {contagemTexto}
                </span>
              )}
            </div>
          )}

          {/* Métricas */}
          <div className="grid grid-cols-3 gap-1.5 mb-3">
            {[
              { label: 'preenchidos', valor: form.total_respostas.toLocaleString('pt-BR') },
              { label: 'visitas', valor: form.total_visitas.toLocaleString('pt-BR') },
              { label: 'conversão', valor: `${conversao}%` },
            ].map((m) => (
              <div key={m.label} className="bg-muted/30 border rounded-lg p-1.5 text-center">
                <strong className="block text-base font-bold font-mono text-primary leading-tight">
                  {m.valor}
                </strong>
                <span className="text-[10px] text-muted-foreground">{m.label}</span>
              </div>
            ))}
          </div>

          {/* Ações */}
          <div
            className="flex gap-1.5 pt-2.5 border-t"
            onClick={(e) => e.stopPropagation()}
          >
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs h-8"
                onClick={handleEditar}
                aria-label={`Editar ${form.titulo}`}
              >
                <Pencil className="h-3 w-3 mr-1" />
                Editar
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs h-8"
              onClick={handleMetricas}
              aria-label={`Ver métricas de ${form.titulo}`}
            >
              <BarChart3 className="h-3 w-3 mr-1" />
              Métricas
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={handleDuplicar}
              disabled={duplicateMutation.isPending}
              aria-label={`Duplicar ${form.titulo}`}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
            {canDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={handleExcluirClick}
                aria-label={`Excluir ${form.titulo}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </article>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir formulário?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>"{form.titulo}"</strong> e todos os seus campos e respostas serão excluídos
              permanentemente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirmExcluir}
              disabled={deleteMutation.isPending}
            >
              Excluir permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
