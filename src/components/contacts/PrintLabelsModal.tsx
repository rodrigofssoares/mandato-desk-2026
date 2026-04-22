import { useState, useEffect } from 'react';
import { Printer, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { generateAddressLabels, validateAddress, type LabelContact } from '@/lib/addressLabels';
import { getContactDisplayName } from '@/lib/contactDisplay';
import type { ContactFilters } from '@/hooks/useContacts';

interface PrintLabelsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: ContactFilters;
}

interface InvalidContact {
  nome: string;
  motivo: string;
}

export function PrintLabelsModal({ open, onOpenChange, filters }: PrintLabelsModalProps) {
  const [validContacts, setValidContacts] = useState<LabelContact[]>([]);
  const [invalidContacts, setInvalidContacts] = useState<InvalidContact[]>([]);
  const [includeOrigin, setIncludeOrigin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showInvalid, setShowInvalid] = useState(false);

  useEffect(() => {
    if (!open) return;
    loadContacts();
  }, [open]);

  const loadContacts = async () => {
    setIsLoading(true);
    try {
      let allData: any[] = [];
      let offset = 0;
      const batchSize = 1000;

      while (true) {
        let query = supabase
          .from('contacts')
          .select('nome, instagram, logradouro, numero, complemento, bairro, cidade, estado, cep, origem');

        if (filters.search?.trim()) {
          const term = `%${filters.search.trim()}%`;
          query = query.or(`nome.ilike.${term},email.ilike.${term},whatsapp.ilike.${term}`);
        }
        if (filters.is_favorite) query = query.eq('is_favorite', true);
        if (filters.declarou_voto === true) query = query.eq('declarou_voto', true);
        if (filters.declarou_voto === false) query = query.eq('declarou_voto', false);
        if (filters.leader_id) query = query.eq('leader_id', filters.leader_id);

        query = query.order('nome', { ascending: true }).range(offset, offset + batchSize - 1);

        const { data, error } = await query;
        if (error) throw error;
        if (!data || data.length === 0) break;
        allData = allData.concat(data);
        if (data.length < batchSize) break;
        offset += batchSize;
      }

      const valid: LabelContact[] = [];
      const invalid: InvalidContact[] = [];

      for (const c of allData) {
        const err = validateAddress(c);
        if (err) {
          invalid.push({ nome: getContactDisplayName(c) || '(sem nome)', motivo: err });
        } else {
          valid.push(c as LabelContact);
        }
      }

      setValidContacts(valid);
      setInvalidContacts(invalid);
    } catch (err) {
      toast.error('Erro ao carregar contatos');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerate = () => {
    setIsGenerating(true);
    try {
      generateAddressLabels({ contacts: validContacts, includeOrigin });
      toast.success(`PDF gerado com ${validContacts.length} etiquetas`);
    } catch (err) {
      toast.error('Erro ao gerar PDF');
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Etiquetas de Endereço
          </DialogTitle>
          <DialogDescription>
            Gera PDF com etiquetas de endereço para impressão (1 por página A4).
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Resumo */}
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="default" className="bg-green-100 text-green-800">
                {validContacts.length} com endereço completo
              </Badge>
              {invalidContacts.length > 0 && (
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                  {invalidContacts.length} ignorados
                </Badge>
              )}
            </div>

            {/* Opções */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="include-origin"
                checked={includeOrigin}
                onCheckedChange={(checked) => setIncludeOrigin(checked === true)}
              />
              <label htmlFor="include-origin" className="text-sm cursor-pointer">
                Incluir campo de instituição/origem na etiqueta
              </label>
            </div>

            {/* Contatos ignorados */}
            {invalidContacts.length > 0 && (
              <Collapsible open={showInvalid} onOpenChange={setShowInvalid}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2 text-yellow-700">
                    <AlertTriangle className="h-4 w-4" />
                    {showInvalid ? 'Ocultar' : 'Ver'} contatos ignorados ({invalidContacts.length})
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="max-h-48 overflow-y-auto border rounded-lg mt-2">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Motivo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invalidContacts.map((c, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-sm">{c.nome}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{c.motivo}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Botão gerar */}
            <Button
              onClick={handleGenerate}
              disabled={validContacts.length === 0 || isGenerating}
              className="w-full gap-2"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Printer className="h-4 w-4" />
              )}
              Gerar PDF ({validContacts.length} etiquetas)
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
