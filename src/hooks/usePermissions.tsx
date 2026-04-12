import { useMemo } from 'react';
import { useImpersonation } from '@/context/ImpersonationContext';
import { usePermissoes } from '@/hooks/usePermissoes';
import type { Role } from '@/types/permissions';

export function usePermissions() {
  const { activeRole } = useImpersonation();
  const { canView, canCreate, canEdit, canDelete, canBulkDelete, isLoading } = usePermissoes(activeRole as Role);

  const can = useMemo(() => ({
    // Contatos
    viewContacts: () => canView('contatos'),
    createContact: () => canCreate('contatos'),
    editContact: () => canEdit('contatos'),
    deleteContact: () => canDelete('contatos'),
    bulkDeleteContacts: () => canBulkDelete('contatos'),

    // Liderancas
    viewLeaders: () => canView('liderancas'),
    createLeader: () => canCreate('liderancas'),
    editLeader: () => canEdit('liderancas'),
    deleteLeader: () => canDelete('liderancas'),
    bulkDeleteLeaders: () => canBulkDelete('liderancas'),

    // Demandas
    viewDemands: () => canView('demandas'),
    createDemand: () => canCreate('demandas'),
    editDemand: () => canEdit('demandas'),
    deleteDemand: () => canDelete('demandas'),
    bulkDeleteDemands: () => canBulkDelete('demandas'),

    // Etiquetas
    viewTags: () => canView('etiquetas'),
    createTag: () => canCreate('etiquetas'),
    editTag: () => canEdit('etiquetas'),
    deleteTag: () => canDelete('etiquetas'),
    bulkDeleteTags: () => canBulkDelete('etiquetas'),

    // Secoes individuais
    viewDashboard: () => canView('dashboard'),
    viewMap: () => canView('mapa'),
    importContacts: () => canView('importacao'),
    exportData: () => canView('relatorios'),
    mergeContacts: () => canEdit('contatos') && canDelete('contatos'),
    accessUsers: () => canView('usuarios'),
    accessApi: () => canView('api'),
    accessWebhooks: () => canView('webhooks'),
    accessBranding: () => canView('personalizacao'),
    accessGoogle: () => canView('google'),
    accessPermissions: () => canView('permissoes'),

    // Campos de Campanha
    viewCampaignFields: () => canView('campanha'),
    createCampaignField: () => canCreate('campanha'),
    editCampaignField: () => canEdit('campanha'),
    deleteCampaignField: () => canDelete('campanha'),

    // Board (Kanban / funis de contato) — merge-nossocrm issue 99
    viewBoard: () => canView('board'),
    createBoardItem: () => canCreate('board'),
    editBoardItem: () => canEdit('board'),
    deleteBoardItem: () => canDelete('board'),

    // Tarefas — merge-nossocrm issue 99
    viewTarefas: () => canView('tarefas'),
    createTarefa: () => canCreate('tarefas'),
    editTarefa: () => canEdit('tarefas'),
    deleteTarefa: () => canDelete('tarefas'),

    // Configurações (hub /settings como bloco único) — merge-nossocrm issue 99
    accessSettings: () => canView('configuracoes'),
  }), [canView, canCreate, canEdit, canDelete, canBulkDelete]);

  return { can, isLoading };
}
