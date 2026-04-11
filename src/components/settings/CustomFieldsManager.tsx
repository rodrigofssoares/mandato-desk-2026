import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Loader2, Plus, Pencil, Trash2, FileQuestion } from 'lucide-react';
import {
  useCustomFields,
  useDeleteCustomField,
  type CampoPersonalizado,
  type CampoPersonalizadoTipo,
} from '@/hooks/useCustomFields';
import { CustomFieldFormDialog } from './CustomFieldFormDialog';

const TIPO_LABEL: Record<CampoPersonalizadoTipo, string> = {
  texto: 'Texto',
  numero: 'Número',
  data: 'Data',
  booleano: 'Sim / Não',
  selecao: 'Seleção',
};

export function CustomFieldsManager() {
  const { data: campos = [], isLoading } = useCustomFields();
  const deleteMutation = useDeleteCustomField();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CampoPersonalizado | null>(null);
  const [deleting, setDeleting] = useState<CampoPersonalizado | null>(null);

  const handleNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const handleEdit = (campo: CampoPersonalizado) => {
    setEditing(campo);
    setFormOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteMutation.mutateAsync(deleting.id);
    } catch {
      // toast já disparado no hook
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            Campos extras que aparecem no cartão de contato e podem ser usados como filtro na listagem.
          </p>
        </div>
        <Button onClick={handleNew} className="shrink-0">
          <Plus className="h-4 w-4 mr-2" />
          Adicionar campo
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : campos.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-12 text-center">
          <FileQuestion className="h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-sm font-medium">Nenhum campo personalizado</p>
          <p className="text-xs text-muted-foreground mt-1">
            Crie o primeiro clicando em "Adicionar campo" acima.
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rótulo</TableHead>
                <TableHead>Chave</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Filtrável</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campos.map((campo) => (
                <TableRow key={campo.id}>
                  <TableCell className="font-medium">{campo.rotulo}</TableCell>
                  <TableCell>
                    <code className="text-xs font-mono text-muted-foreground">{campo.chave}</code>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{TIPO_LABEL[campo.tipo]}</Badge>
                    {campo.tipo === 'selecao' && campo.opcoes && (
                      <span className="text-xs text-muted-foreground ml-2">
                        ({campo.opcoes.length} opções)
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {campo.filtravel ? (
                      <Badge variant="outline" className="border-emerald-500 text-emerald-600">
                        Sim
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Não
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(campo)}
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleting(campo)}
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CustomFieldFormDialog open={formOpen} onOpenChange={setFormOpen} campo={editing} />

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir campo "{deleting?.rotulo}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso apagará todos os valores já preenchidos em contatos para esse campo. Essa ação não
              pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir campo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
