// EM054-v2 — Aba Resultados: tabela de respostas com exportação CSV
import { useMemo } from 'react';
import { Download, AlertCircle, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import { useFormularioRespostas } from '@/hooks/useFormularios';
import { FIELD_TYPES_DECORATIVOS, type Formulario, type FormularioCampo } from '@/types/formularios';
import { downloadFile, rowsToCSV } from '@/lib/exportUtils';

interface ResultadosPanelProps {
  formulario: Formulario;
  campos: FormularioCampo[];
}

// Formata data/hora para pt-BR
function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Resolve o valor de um campo numa resposta
function resolverValor(valor: string | string[] | undefined): string {
  if (valor === undefined || valor === null) return '—';
  if (Array.isArray(valor)) return valor.length > 0 ? valor.join(', ') : '—';
  return valor.trim() === '' ? '—' : valor;
}

export function ResultadosPanel({ formulario, campos }: ResultadosPanelProps) {
  const navigate = useNavigate();
  const { data: respostas = [], isLoading, error } = useFormularioRespostas(formulario.id);

  // Apenas campos não-decorativos viram colunas
  const camposVisiveis = useMemo(
    () => campos.filter((c) => !FIELD_TYPES_DECORATIVOS.includes(c.tipo)),
    [campos]
  );

  function exportarCSV() {
    if (respostas.length === 0) return;

    const rows = respostas.map((r) => {
      const row: Record<string, unknown> = {
        'Data/hora': formatarDataHora(r.created_at),
        Contato: r.contato_nome ?? '—',
      };
      for (const campo of camposVisiveis) {
        row[campo.rotulo || campo.id] = resolverValor(r.dados[campo.id]);
      }
      return row;
    });

    const csv = rowsToCSV(rows);
    const nome = `${formulario.titulo.replace(/[^a-z0-9]/gi, '_')}_respostas.csv`;
    downloadFile(csv, nome, 'text/csv;charset=utf-8;');
  }

  // ── Estados visuais ─────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="p-6 space-y-3" aria-busy="true" aria-label="Carregando respostas">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="m-6 p-4 rounded-lg border border-destructive/30 bg-destructive/5 text-sm">
        <div className="flex items-center gap-2 text-destructive font-medium mb-1">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Erro ao carregar respostas
        </div>
        <p className="text-xs text-muted-foreground">{(error as Error).message}</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold">Respostas</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {respostas.length === 0
              ? 'Nenhuma resposta ainda'
              : `${respostas.length} resposta${respostas.length !== 1 ? 's' : ''} recebida${respostas.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        {respostas.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={exportarCSV}
            aria-label="Exportar respostas como CSV"
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Exportar CSV
          </Button>
        )}
      </div>

      {/* Estado vazio */}
      {respostas.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 rounded-xl border border-dashed text-center">
          <Inbox className="h-10 w-10 text-muted-foreground/50" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium">Nenhuma resposta ainda</p>
            <p className="text-xs text-muted-foreground mt-1">
              As respostas aparecem aqui assim que o formulário for submetido.
            </p>
          </div>
        </div>
      )}

      {/* Tabela */}
      {respostas.length > 0 && (
        <div className="rounded-xl border overflow-x-auto">
          <table className="w-full text-xs" aria-label={`Respostas do formulário ${formulario.titulo}`}>
            <thead>
              <tr className="border-b bg-muted/40">
                <th
                  scope="col"
                  className="text-left px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap"
                >
                  Data/hora
                </th>
                <th
                  scope="col"
                  className="text-left px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap"
                >
                  Contato
                </th>
                {camposVisiveis.map((campo) => (
                  <th
                    key={campo.id}
                    scope="col"
                    className="text-left px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap max-w-[160px]"
                  >
                    <span className="truncate block max-w-[160px]" title={campo.rotulo || campo.id}>
                      {campo.rotulo || '(sem rótulo)'}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {respostas.map((resposta) => (
                <tr
                  key={resposta.id}
                  className={`border-b last:border-0 hover:bg-muted/20 transition-colors ${
                    resposta.status === 'erro'
                      ? 'bg-destructive/5 border-destructive/20'
                      : ''
                  }`}
                >
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      {resposta.status === 'erro' && (
                        <Badge
                          variant="destructive"
                          className="text-[10px] px-1 py-0 h-4"
                          title={resposta.erro ?? 'Erro no processamento'}
                        >
                          Erro
                        </Badge>
                      )}
                      {formatarDataHora(resposta.created_at)}
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {resposta.contact_id ? (
                      <button
                        type="button"
                        className="text-primary underline hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                        onClick={() => navigate(`/contacts?id=${resposta.contact_id}`)}
                        aria-label={`Ver contato ${resposta.contato_nome ?? resposta.contact_id}`}
                      >
                        {resposta.contato_nome ?? resposta.contact_id}
                      </button>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  {camposVisiveis.map((campo) => (
                    <td
                      key={campo.id}
                      className="px-3 py-2 max-w-[200px]"
                    >
                      <span
                        className="block truncate"
                        title={resolverValor(resposta.dados[campo.id])}
                      >
                        {resolverValor(resposta.dados[campo.id])}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
