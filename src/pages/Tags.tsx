import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Plus, Pencil, Trash2, CheckSquare, Search, X, LayoutGrid, List } from 'lucide-react';
import { useTags, useDeleteTag } from '@/hooks/useTags';
import { useTagGroups } from '@/hooks/useTagGroups';
import { usePermissions } from '@/hooks/usePermissions';
import { TagDialog } from '@/components/tags/TagDialog';
import { TagsExportMenu } from '@/components/tags/TagsExportMenu';
import { TagBulkActionsBar } from '@/components/tags/TagBulkActionsBar';
import type { Tag } from '@/hooks/useTags';

export default function Tags() {
  const { can } = usePermissions();
  const { data: tags = [], isLoading } = useTags();
  const { data: groups = [], isLoading: isLoadingGroups } = useTagGroups();
  const deleteTag = useDeleteTag();

  const [activeTab, setActiveTab] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    if (typeof window === 'undefined') return 'grid';
    return (localStorage.getItem('tags_view_mode') as 'grid' | 'list') ?? 'grid';
  });

  const changeViewMode = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('tags_view_mode', mode);
    }
  };

  // Define a aba inicial quando os grupos carregam
  if (!activeTab && groups.length > 0) {
    setActiveTab(groups[0].id);
  }

  const tagsByGroup = useMemo(() => {
    const map = new Map<string, Tag[]>();
    for (const g of groups) map.set(g.id, []);
    for (const tag of tags) {
      const list = map.get(tag.group_id);
      if (list) list.push(tag);
    }
    return map;
  }, [tags, groups]);

  const currentGroupTags = tagsByGroup.get(activeTab) ?? [];

  const filteredCurrentTags = useMemo(() => {
    if (!selectMode || !searchQuery.trim()) return currentGroupTags;
    const q = searchQuery.trim().toLowerCase();
    return currentGroupTags.filter((t) => t.nome.toLowerCase().includes(q));
  }, [currentGroupTags, searchQuery, selectMode]);

  const selectedTags = useMemo(
    () => tags.filter((t) => selectedIds.has(t.id)),
    [tags, selectedIds]
  );

  const handleNewTag = () => {
    setEditingTag(null);
    setDialogOpen(true);
  };

  const handleEditTag = (tag: Tag) => {
    if (selectMode) {
      toggleSelection(tag.id);
      return;
    }
    setEditingTag(tag);
    setDialogOpen(true);
  };

  const handleDeleteTag = async (tag: Tag) => {
    if (!confirm(`Tem certeza que deseja excluir a etiqueta "${tag.nome}"?`)) return;
    await deleteTag.mutateAsync(tag.id);
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const enterSelectMode = () => {
    setSelectMode(true);
    setSelectedIds(new Set());
    setSearchQuery('');
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
    setSearchQuery('');
  };

  const toggleSelectAllVisible = () => {
    const visibleIds = filteredCurrentTags.map((t) => t.id);
    const allSelected = visibleIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const loading = isLoading || isLoadingGroups;

  return (
    <div className="p-6 space-y-6 pb-24">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">Etiquetas</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-md border bg-background p-0.5">
            <Button
              type="button"
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => changeViewMode('grid')}
              className="h-8 px-2 gap-1.5"
              title="Visualização em grade"
            >
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden sm:inline text-xs">Grade</span>
            </Button>
            <Button
              type="button"
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => changeViewMode('list')}
              className="h-8 px-2 gap-1.5"
              title="Visualização em lista"
            >
              <List className="h-4 w-4" />
              <span className="hidden sm:inline text-xs">Lista</span>
            </Button>
          </div>
          {can.exportData() && <TagsExportMenu />}
          {!selectMode && can.editTag() && (
            <Button variant="outline" onClick={enterSelectMode} className="gap-2">
              <CheckSquare className="h-4 w-4" />
              Selecionar
            </Button>
          )}
          {selectMode && (
            <Button variant="outline" onClick={exitSelectMode} className="gap-2">
              <X className="h-4 w-4" />
              Cancelar seleção
            </Button>
          )}
          {can.createTag() && (
            <Button onClick={handleNewTag}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Etiqueta
            </Button>
          )}
        </div>
      </div>

      {selectMode && (
        <div className="flex items-center gap-2 flex-wrap p-3 bg-muted/30 border rounded-lg">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={`Buscar no grupo atual...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={toggleSelectAllVisible}
            disabled={filteredCurrentTags.length === 0}
          >
            {filteredCurrentTags.every((t) => selectedIds.has(t.id)) && filteredCurrentTags.length > 0
              ? 'Desmarcar todas'
              : 'Selecionar todas visíveis'}
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex-wrap h-auto">
            {groups.map((g) => {
              const count = tagsByGroup.get(g.id)?.length ?? 0;
              return (
                <TabsTrigger key={g.id} value={g.id}>
                  {g.label} ({count})
                </TabsTrigger>
              );
            })}
          </TabsList>

          {groups.map((g) => {
            const groupTags = tagsByGroup.get(g.id) ?? [];
            const visibleTags = g.id === activeTab ? filteredCurrentTags : groupTags;
            return (
              <TabsContent key={g.id} value={g.id}>
                {visibleTags.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">
                      {selectMode && searchQuery
                        ? 'Nenhuma etiqueta encontrada'
                        : 'Nenhuma etiqueta nesta categoria'}
                    </p>
                  </div>
                ) : (
                  <div
                    className={
                      viewMode === 'grid'
                        ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4'
                        : 'flex flex-col gap-2'
                    }
                  >
                    {visibleTags.map((tag) => {
                      const isSelected = selectedIds.has(tag.id);
                      return (
                        <Card
                          key={tag.id}
                          className={`transition-all cursor-pointer ${
                            viewMode === 'grid' ? 'hover:shadow-md' : 'hover:bg-accent/40'
                          } ${isSelected ? 'ring-2 ring-primary' : ''}`}
                          onClick={() => {
                            if (selectMode) toggleSelection(tag.id);
                          }}
                        >
                          <CardContent
                            className={`flex items-center gap-3 ${
                              viewMode === 'grid' ? 'p-4' : 'px-4 py-2.5'
                            }`}
                          >
                            {selectMode && (
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleSelection(tag.id)}
                                onClick={(e) => e.stopPropagation()}
                              />
                            )}
                            <div
                              className="w-4 h-4 rounded-full shrink-0"
                              style={{ backgroundColor: tag.cor }}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium line-clamp-2 text-sm leading-tight">
                                {tag.nome}
                              </p>
                            </div>
                            <Badge variant="secondary" className="shrink-0 text-xs">
                              {tag.contact_count}
                            </Badge>
                            {!selectMode && (
                              <div className="flex items-center gap-1 shrink-0">
                                {can.editTag() && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEditTag(tag);
                                    }}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                {can.deleteTag() && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive hover:text-destructive"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteTag(tag);
                                    }}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      )}

      <TagDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        tag={editingTag}
        defaultGroupId={activeTab}
      />

      {selectMode && (
        <TagBulkActionsBar
          selectedTags={selectedTags}
          groups={groups}
          onClearSelection={exitSelectMode}
        />
      )}
    </div>
  );
}
