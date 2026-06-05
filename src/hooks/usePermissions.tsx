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

    // Colunas do kanban de Demandas (RAQ-MAND-EM085) — seção própria na matriz
    viewDemandColumns: () => canView('demandas_colunas'),
    createDemandColumn: () => canCreate('demandas_colunas'),
    editDemandColumn: () => canEdit('demandas_colunas'),
    deleteDemandColumn: () => canDelete('demandas_colunas'),
    manageDemandColumns: () =>
      canCreate('demandas_colunas') ||
      canEdit('demandas_colunas') ||
      canDelete('demandas_colunas'),

    // Etiquetas
    viewTags: () => canView('etiquetas'),
    createTag: () => canCreate('etiquetas'),
    editTag: () => canEdit('etiquetas'),
    deleteTag: () => canDelete('etiquetas'),
    bulkDeleteTags: () => canBulkDelete('etiquetas'),

    // Secoes individuais
    viewDashboard: () => canView('dashboard'),
    editDashboardLayout: () => canEdit('dashboard'),
    viewMap: () => canView('mapa'),
    importContacts: () => canView('importacao'),
    exportData: () => canView('relatorios'),
    mergeContacts: () => canEdit('contatos') && canDelete('contatos'),
    accessUsers: () => canView('usuarios'),
    // RAQ-MAND-EM085: excluir permanentemente um usuário (revoga acesso). Default
    // só admin (matriz: usuarios.pode_deletar). A EF delete-user reforça server-side.
    deleteUser: () => canDelete('usuarios'),
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

    // Ordenação de Filtros — restrito por padrão a admin (migration 049)
    accessOrdenacaoFiltros: () => canView('ordenacao_filtros'),
    editOrdenacaoFiltros: () => canEdit('ordenacao_filtros'),

    // WhatsApp — restrito por padrão a admin (migration 049)
    accessWhatsapp: () => canView('whatsapp'),
    editWhatsapp: () => canEdit('whatsapp'),
    // EM082: limpar histórico (canDelete) e recuperar lixeira (canBulkDelete)
    deleteWhatsapp: () => canDelete('whatsapp'),
    bulkDeleteWhatsapp: () => canBulkDelete('whatsapp'),

    // Agente IA — aba de configuração restrita a admin (migration 095)
    // viewAgente: qualquer usuário com permissão de visualização na seção agente_ia
    viewAgente: () => canView('agente_ia'),
    editAgente: () => canEdit('agente_ia'),
  }), [canView, canCreate, canEdit, canDelete, canBulkDelete]);

  return { can, isLoading };
}
