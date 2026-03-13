import { useState, useMemo, useCallback } from 'react';
import { LayoutGrid, List, Plus, Search, Loader2, Users, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Skeleton } from '@/components/ui/skeleton';
import { useContacts, useDeleteContact, type ContactFilters as Filters, type Contact } from '@/hooks/useContacts';
import { usePermissions } from '@/hooks/usePermissions';
import { ContactCard } from '@/components/contacts/ContactCard';
import { ContactListItem } from '@/components/contacts/ContactListItem';
import { ContactDialog } from '@/components/contacts/ContactDialog';
import { ContactFilters } from '@/components/contacts/ContactFilters';
import { ContactsPagination } from '@/components/contacts/ContactsPagination';
import { ExportMenu } from '@/components/contacts/ExportMenu';

type ViewMode = 'grid' | 'list';

export default function Contacts() {
  const { can } = usePermissions();

  // State
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filters, setFilters] = useState<Filters>({
    page: 1,
    per_page: 50,
    sort_by: 'created_desc',
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [deletingContact, setDeletingContact] = useState<Contact | null>(null);

  // Debounce search
  const debounceRef = useMemo(() => ({ timer: null as ReturnType<typeof setTimeout> | null }), []);

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchInput(value);
      if (debounceRef.timer) clearTimeout(debounceRef.timer);
      debounceRef.timer = setTimeout(() => {
        setDebouncedSearch(value);
        setFilters((prev) => ({ ...prev, search: value || undefined, page: 1 }));
      }, 300);
    },
    [debounceRef]
  );

  // Query
  const queryFilters = useMemo(
    () => ({ ...filters, search: debouncedSearch || undefined }),
    [filters, debouncedSearch]
  );
  const { data: result, isLoading } = useContacts(queryFilters);
  const contacts = result?.data ?? [];
  const totalCount = result?.count ?? 0;

  const deleteMutation = useDeleteContact();

  // Handlers
  const openCreate = () => {
    setEditingContact(null);
    setDialogOpen(true);
  };

  const openEdit = (contact: Contact) => {
    setEditingContact(contact);
    setDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingContact) return;
    await deleteMutation.mutateAsync(deletingContact.id);
    setDeletingContact(null);
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Contatos</h1>
          <Badge variant="secondary" className="text-sm">
            {isLoading ? '...' : totalCount}
          </Badge>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {can.exportData() && <ExportMenu filters={queryFilters} />}

          {can.createContact() && (
            <Button size="sm" onClick={openCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Contato
            </Button>
          )}
        </div>
      </div>

      {/* Search + Sort + View Toggle */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, e-mail ou WhatsApp..."
            className="pl-9"
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>

        <Select
          value={filters.sort_by ?? 'created_desc'}
          onValueChange={(v) => setFilters((prev) => ({ ...prev, sort_by: v as Filters['sort_by'], page: 1 }))}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created_desc">Mais recentes</SelectItem>
            <SelectItem value="created_asc">Mais antigos</SelectItem>
            <SelectItem value="name_asc">Nome A-Z</SelectItem>
            <SelectItem value="name_desc">Nome Z-A</SelectItem>
            <SelectItem value="favorites_first">Favoritos primeiro</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center border rounded-md">
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="icon"
            className="h-9 w-9 rounded-r-none"
            onClick={() => setViewMode('grid')}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="icon"
            className="h-9 w-9 rounded-l-none"
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <ContactFilters filters={filters} onChange={setFilters} />

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Card key={i} className="p-4">
                  <div className="flex gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                      <Skeleton className="h-3 w-2/3" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))
          )}
        </div>
      ) : contacts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold">Nenhum contato encontrado</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            {debouncedSearch || Object.keys(filters).length > 4
              ? 'Tente ajustar os filtros ou o termo de busca.'
              : 'Comece adicionando seu primeiro contato.'}
          </p>
          {can.createContact() && !debouncedSearch && (
            <Button className="mt-4 gap-2" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Novo Contato
            </Button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {contacts.map((contact) => (
            <ContactCard
              key={contact.id}
              contact={contact}
              onEdit={openEdit}
              onDelete={setDeletingContact}
              onClick={openEdit}
            />
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden">
          {/* List header */}
          <div className="flex items-center gap-4 px-4 py-2 border-b bg-muted/50 text-xs font-medium text-muted-foreground">
            <span className="w-7" />
            <span className="flex-1">Nome</span>
            <span className="w-36 hidden md:block">WhatsApp</span>
            <span className="w-48 hidden lg:block">E-mail</span>
            <span className="w-48 hidden xl:block">Etiquetas</span>
            <span className="w-24 text-right hidden sm:block">Criado em</span>
            <span className="w-16" />
          </div>
          {contacts.map((contact) => (
            <ContactListItem
              key={contact.id}
              contact={contact}
              onEdit={openEdit}
              onDelete={setDeletingContact}
              onClick={openEdit}
            />
          ))}
        </Card>
      )}

      {/* Pagination */}
      {totalCount > 0 && (
        <ContactsPagination
          page={filters.page ?? 1}
          perPage={filters.per_page ?? 50}
          total={totalCount}
          onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))}
          onPerPageChange={(per_page) => setFilters((prev) => ({ ...prev, per_page, page: 1 }))}
        />
      )}

      {/* Create/Edit Dialog */}
      <ContactDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingContact(null);
        }}
        contact={editingContact}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingContact} onOpenChange={(open) => !open && setDeletingContact(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir contato</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deletingContact?.nome}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
