import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Plus, Pencil, Trash2 } from 'lucide-react';
import { useTags, useDeleteTag } from '@/hooks/useTags';
import { usePermissions } from '@/hooks/usePermissions';
import { TagDialog } from '@/components/tags/TagDialog';
import { TagsExportMenu } from '@/components/tags/TagsExportMenu';
import type { Tag } from '@/hooks/useTags';

const categoryMap: Record<string, { label: string; value: string }> = {
  geral: { label: 'Geral', value: 'geral' },
  professionals: { label: 'Profissionais', value: 'professionals' },
  relationships: { label: 'Relacionamentos', value: 'relationships' },
  demands: { label: 'Demandas', value: 'demands' },
};

export default function Tags() {
  const [activeTab, setActiveTab] = useState('geral');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const { can } = usePermissions();
  const { data: tags = [], isLoading } = useTags();
  const deleteTag = useDeleteTag();

  const filteredTags = tags.filter((t) => t.categoria === activeTab);

  const handleNewTag = () => {
    setEditingTag(null);
    setDialogOpen(true);
  };

  const handleEditTag = (tag: Tag) => {
    setEditingTag(tag);
    setDialogOpen(true);
  };

  const handleDeleteTag = async (tag: Tag) => {
    if (!confirm(`Tem certeza que deseja excluir a etiqueta "${tag.nome}"?`)) return;
    await deleteTag.mutateAsync(tag.id);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Etiquetas</h1>
        {can.exportData() && <TagsExportMenu />}
        {can.createTag() && (
          <Button onClick={handleNewTag}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Etiqueta
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            {Object.entries(categoryMap).map(([key, { label }]) => {
              const count = tags.filter((t) => t.categoria === key).length;
              return (
                <TabsTrigger key={key} value={key}>
                  {label} ({count})
                </TabsTrigger>
              );
            })}
          </TabsList>

          {Object.keys(categoryMap).map((category) => (
            <TabsContent key={category} value={category}>
              {filteredTags.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">
                    Nenhuma etiqueta nesta categoria
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {filteredTags.map((tag) => (
                    <Card key={tag.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4 flex items-center gap-3">
                        <div
                          className="w-4 h-4 rounded-full shrink-0"
                          style={{ backgroundColor: tag.cor }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium line-clamp-2 text-sm leading-tight">{tag.nome}</p>
                        </div>
                        <Badge variant="secondary" className="shrink-0 text-xs">
                          {tag.contact_count}
                        </Badge>
                        <div className="flex items-center gap-1 shrink-0">
                          {can.editTag() && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleEditTag(tag)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {can.deleteTag() && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => handleDeleteTag(tag)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}

      <TagDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        tag={editingTag}
        defaultCategory={activeTab}
      />
    </div>
  );
}
