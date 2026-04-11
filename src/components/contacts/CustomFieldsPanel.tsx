import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Save, FileQuestion, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  useCustomFields,
  useContactCustomValues,
  useSaveContactCustomValues,
  type ValoresContato,
} from '@/hooks/useCustomFields';
import { CustomFieldInput } from './CustomFieldInput';

interface CustomFieldsPanelProps {
  /** ID do contato. Quando ausente (modo criação), o painel mostra um aviso. */
  contactId: string | null | undefined;
}

export function CustomFieldsPanel({ contactId }: CustomFieldsPanelProps) {
  const { data: campos = [], isLoading: camposLoading } = useCustomFields();
  const { data: valoresIniciais, isLoading: valoresLoading } = useContactCustomValues(contactId);
  const saveMutation = useSaveContactCustomValues();

  const [values, setValues] = useState<ValoresContato>({});

  // Hidrata o state local com os valores do contato sempre que mudar
  useEffect(() => {
    setValues(valoresIniciais ?? {});
  }, [valoresIniciais]);

  const handleChange = (campoId: string, value: string | number | boolean | null) => {
    setValues((prev) => ({ ...prev, [campoId]: value }));
  };

  const handleSave = async () => {
    if (!contactId) return;
    try {
      await saveMutation.mutateAsync({ contactId, values, campos });
    } catch {
      // toast no hook
    }
  };

  if (!contactId) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center">
        <FileQuestion className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm font-medium">Salve o contato primeiro</p>
        <p className="text-xs text-muted-foreground mt-1">
          Os campos personalizados ficam disponíveis após o contato ser criado.
        </p>
      </div>
    );
  }

  if (camposLoading || valoresLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (campos.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center">
        <Sparkles className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm font-medium">Nenhum campo personalizado configurado</p>
        <p className="text-xs text-muted-foreground mt-1 mb-3">
          Crie campos extras para enriquecer os contatos.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link to="/settings?tab=geral">Configurar em Settings → Geral</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-4 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 rounded-md bg-violet-500/10 flex items-center justify-center">
            <Sparkles className="h-3.5 w-3.5 text-violet-400" />
          </div>
          <span className="text-xs font-semibold text-muted-foreground">Campos personalizados</span>
        </div>

        {campos.map((campo) => (
          <div key={campo.id} className="space-y-1.5">
            <Label htmlFor={`cf-${campo.id}`}>{campo.rotulo}</Label>
            <CustomFieldInput
              campo={campo}
              value={values[campo.id] ?? null}
              onChange={(v) => handleChange(campo.id, v)}
              disabled={saveMutation.isPending}
            />
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <Button type="button" onClick={handleSave} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Salvar campos personalizados
        </Button>
      </div>
    </div>
  );
}
