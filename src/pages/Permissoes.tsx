import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Loader2, Shield, RotateCcw, AlertTriangle } from 'lucide-react';
import { usePermissoesAll, useUpdatePermissao, useSeedPermissoes, type PermissaoPerfil } from '@/hooks/usePermissoesAdmin';
import { useImpersonation } from '@/context/ImpersonationContext';
import { ROLES, ROLE_LABELS, SECOES, SECAO_LABELS, type Role, type Secao } from '@/types/permissions';

type PermField = 'pode_ver' | 'pode_criar' | 'pode_editar' | 'pode_deletar' | 'pode_deletar_em_massa' | 'so_proprio';

const FIELD_LABELS: Record<PermField, string> = {
  pode_ver: 'Ver',
  pode_criar: 'Criar',
  pode_editar: 'Editar',
  pode_deletar: 'Deletar',
  pode_deletar_em_massa: 'Excluir em massa',
  so_proprio: 'Só próprio',
};

const PERM_FIELDS: PermField[] = ['pode_ver', 'pode_criar', 'pode_editar', 'pode_deletar', 'pode_deletar_em_massa', 'so_proprio'];

export default function Permissoes() {
  const [roleFilter, setRoleFilter] = useState<'todos' | Role>('todos');
  const { data: permissoes = [], isLoading } = usePermissoesAll();
  const updatePermissao = useUpdatePermissao();
  const seedPermissoes = useSeedPermissoes();
  const { isImpersonating, impersonatedRole } = useImpersonation();

  const visibleRoles = useMemo(() => {
    if (roleFilter === 'todos') return [...ROLES];
    return [roleFilter];
  }, [roleFilter]);

  const permMap = useMemo(() => {
    const map = new Map<string, PermissaoPerfil>();
    for (const p of permissoes) {
      map.set(`${p.role}:${p.secao}`, p);
    }
    return map;
  }, [permissoes]);

  const getPermissao = (role: Role, secao: Secao) => permMap.get(`${role}:${secao}`);

  const handleToggle = (perm: PermissaoPerfil, field: PermField) => {
    if (perm.role === 'admin') return;
    updatePermissao.mutate({
      id: perm.id,
      field,
      value: !perm[field],
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-bold">Permissões</h1>
            <p className="text-sm text-muted-foreground">
              Configure as permissões de acesso por cargo
            </p>
          </div>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm">
              <RotateCcw className="h-4 w-4 mr-2" />
              Restaurar Padrão
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Restaurar permissões padrão?</AlertDialogTitle>
              <AlertDialogDescription>
                Todas as permissões customizadas serão perdidas e substituídas pelos valores padrão.
                Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => seedPermissoes.mutate()}
                disabled={seedPermissoes.isPending}
              >
                {seedPermissoes.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Restaurar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {isImpersonating && (
        <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
          <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0" />
          <span className="text-yellow-800">
            Você está personificando o cargo <strong>{ROLE_LABELS[impersonatedRole as Role] ?? impersonatedRole}</strong>.
            As alterações na matriz afetam as permissões reais de todos os usuários.
          </span>
        </div>
      )}

      <Tabs value={roleFilter} onValueChange={(v) => setRoleFilter(v as 'todos' | Role)}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="todos">Todos os Cargos</TabsTrigger>
          {ROLES.map((role) => (
            <TabsTrigger key={role} value={role}>
              {ROLE_LABELS[role]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="border rounded-lg overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-background z-10 min-w-[160px]">
                  Seção
                </TableHead>
                {visibleRoles.map((role) => (
                  <TableHead
                    key={role}
                    className="text-center min-w-[160px]"
                    colSpan={1}
                  >
                    <Badge
                      variant="secondary"
                      className={role === 'admin' ? 'bg-purple-100 text-purple-800' : ''}
                    >
                      {ROLE_LABELS[role]}
                    </Badge>
                    {role === 'admin' && (
                      <p className="text-xs text-muted-foreground mt-1 font-normal">
                        (acesso total)
                      </p>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {SECOES.map((secao) => (
                <TableRow key={secao}>
                  <TableCell className="sticky left-0 bg-background z-10 font-medium">
                    {SECAO_LABELS[secao]}
                  </TableCell>
                  {visibleRoles.map((role) => {
                    const perm = getPermissao(role, secao);
                    const isAdmin = role === 'admin';
                    return (
                      <TableCell key={`${role}:${secao}`} className="text-center">
                        {perm ? (
                          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
                            {PERM_FIELDS.map((field) => (
                              <label
                                key={field}
                                className="flex items-center gap-1 text-xs cursor-pointer select-none"
                              >
                                <Checkbox
                                  checked={isAdmin ? true : perm[field]}
                                  disabled={isAdmin}
                                  onCheckedChange={() => handleToggle(perm, field)}
                                  className={
                                    isAdmin
                                      ? 'opacity-50'
                                      : perm[field]
                                        ? 'border-green-500 data-[state=checked]:bg-green-500'
                                        : ''
                                  }
                                />
                                <span className={perm[field] || isAdmin ? 'text-foreground' : 'text-muted-foreground'}>
                                  {FIELD_LABELS[field]}
                                </span>
                              </label>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}