// Componente: ChatTagsSection
//
// Exibe e gerencia etiquetas de uma conversa WhatsApp (zapi_chat_tags).
// Etiquetas da conversa são distintas das etiquetas do contato.
// Escritas via Edge Function zapi-chat-tag-update (service_role).
//
// Funcionalidades:
//   - Lista etiquetas aplicadas com badge colorido + botão × para remover
//   - Botão "+" abre popover com busca de tags do CRM
//   - Filtro automático: não exibe tags já aplicadas na conversa
//   - Sem permissão de edição: exibe apenas leitura (sem + e ×)
//
// Referência: RAQ-MAND-EM073 — T45

import { useState } from 'react';
import { Plus, Tag as TagIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useChatTags } from '@/hooks/useChatTags';
import { useTags } from '@/hooks/useTags';

// ─── Props ────────────────────────────────────────────────────────────────────

interface ChatTagsSectionProps {
  chatId: string;
  /** Quando false, exibe somente leitura (sem + e ×). */
  canEdit?: boolean;
}

// ─── ChatTagsSection ──────────────────────────────────────────────────────────

export function ChatTagsSection({ chatId, canEdit = false }: ChatTagsSectionProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);

  const { tagsQuery, addTagMutation, removeTagMutation } = useChatTags(chatId);
  const { data: allTags = [] } = useTags();

  const appliedTags = tagsQuery.data ?? [];
  const appliedTagIds = new Set(appliedTags.map((t) => t.tag_id));

  // Tags disponíveis para adicionar (ainda não aplicadas)
  const availableTags = allTags.filter((t) => !appliedTagIds.has(t.id));

  function handleAdd(tagId: string) {
    setPopoverOpen(false);
    addTagMutation.mutate(tagId);
  }

  function handleRemove(tagId: string) {
    removeTagMutation.mutate(tagId);
  }

  const isLoading = tagsQuery.isLoading;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <TagIcon className="h-3.5 w-3.5 text-muted-foreground" />
          Etiquetas da conversa
        </p>

        {canEdit && (
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                title="Adicionar etiqueta"
                disabled={addTagMutation.isPending}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-64" align="end">
              <Command>
                <CommandInput
                  placeholder="Buscar etiqueta..."
                  className="h-8 text-xs"
                />
                <CommandList>
                  <CommandEmpty>Nenhuma etiqueta disponível.</CommandEmpty>
                  <CommandGroup>
                    {availableTags.map((tag) => (
                      <CommandItem
                        key={tag.id}
                        value={tag.nome}
                        onSelect={() => handleAdd(tag.id)}
                        className="gap-2 text-xs cursor-pointer"
                      >
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: tag.cor }}
                        />
                        <span className="flex-1 truncate">{tag.nome}</span>
                        {tag.group_label && (
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {tag.group_label}
                          </span>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* Lista de etiquetas aplicadas */}
      {isLoading ? (
        <p className="text-[11px] text-muted-foreground">Carregando...</p>
      ) : appliedTags.length === 0 ? (
        <p className="text-[11px] text-muted-foreground italic">Nenhuma etiqueta nesta conversa.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {appliedTags.map((chatTag) => (
            <Badge
              key={chatTag.id}
              variant="outline"
              className="text-[11px] gap-1 pr-1 pl-2 h-5 font-normal"
              style={{
                borderColor: chatTag.tag_cor,
                color: chatTag.tag_cor,
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full shrink-0"
                style={{ backgroundColor: chatTag.tag_cor }}
              />
              {chatTag.tag_nome}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => handleRemove(chatTag.tag_id)}
                  disabled={removeTagMutation.isPending}
                  className="ml-0.5 rounded hover:bg-black/10 transition-colors leading-none h-4 w-4 flex items-center justify-center shrink-0"
                  aria-label={`Remover etiqueta ${chatTag.tag_nome}`}
                  title="Remover etiqueta"
                >
                  ×
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
