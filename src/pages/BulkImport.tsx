import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Loader2, Upload, FileSpreadsheet, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

type ImportMode = 'add' | 'delete' | 'edit' | 'tag';

interface ParsedContact {
  nome: string;
  whatsapp?: string;
  email?: string;
  status?: 'pending' | 'success' | 'error';
  error?: string;
}

export default function BulkImport() {
  const [mode, setMode] = useState<ImportMode>('add');
  const [rawText, setRawText] = useState('');
  const [parsed, setParsed] = useState<ParsedContact[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<{ success: number; failed: number } | null>(null);

  const parseText = useCallback((text: string) => {
    const lines = text.trim().split('\n').filter((l) => l.trim());
    const contacts: ParsedContact[] = lines.map((line) => {
      const parts = line.includes('\t')
        ? line.split('\t').map((p) => p.trim())
        : line.split(',').map((p) => p.trim());

      return {
        nome: parts[0] || '',
        whatsapp: parts[1] || undefined,
        email: parts[2] || undefined,
        status: 'pending' as const,
      };
    });
    setParsed(contacts);
    setResults(null);
  }, []);

  const handleTextChange = (text: string) => {
    setRawText(text);
    if (text.trim()) {
      parseText(text);
    } else {
      setParsed([]);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        // Skip header row if first cell looks like a header
        const startIdx = rows[0]?.[0]?.toLowerCase?.().includes('nom') ? 1 : 0;

        const contacts: ParsedContact[] = rows.slice(startIdx).map((row) => ({
          nome: String(row[0] ?? '').trim(),
          whatsapp: row[1] ? String(row[1]).trim() : undefined,
          email: row[2] ? String(row[2]).trim() : undefined,
          status: 'pending' as const,
        })).filter((c) => c.nome);

        setParsed(contacts);
        setResults(null);
        toast.success(`${contacts.length} contatos carregados do arquivo`);
      } catch {
        toast.error('Erro ao ler arquivo');
      }
    };
    reader.readAsArrayBuffer(file);
    // Reset input
    e.target.value = '';
  };

  const handleExecute = async () => {
    if (parsed.length === 0) return;

    setIsProcessing(true);
    let success = 0;
    let failed = 0;
    const updated = [...parsed];

    if (mode === 'add') {
      for (let i = 0; i < updated.length; i++) {
        const c = updated[i];
        try {
          const insertData: Record<string, unknown> = { nome: c.nome };
          if (c.whatsapp) insertData.whatsapp = c.whatsapp;
          if (c.email) insertData.email = c.email;

          const { error } = await supabase.from('contacts').insert(insertData);
          if (error) throw error;

          updated[i] = { ...c, status: 'success' };
          success++;
        } catch (err: any) {
          updated[i] = { ...c, status: 'error', error: err.message };
          failed++;
        }
        setParsed([...updated]);
      }
    } else if (mode === 'delete') {
      for (let i = 0; i < updated.length; i++) {
        const c = updated[i];
        try {
          let query = supabase.from('contacts').delete();
          if (c.whatsapp) {
            query = query.eq('whatsapp', c.whatsapp);
          } else if (c.email) {
            query = query.eq('email', c.email);
          } else {
            query = query.eq('nome', c.nome);
          }
          const { error } = await query;
          if (error) throw error;

          updated[i] = { ...c, status: 'success' };
          success++;
        } catch (err: any) {
          updated[i] = { ...c, status: 'error', error: err.message };
          failed++;
        }
        setParsed([...updated]);
      }
    } else if (mode === 'edit') {
      // Edit mode: match by whatsapp, update nome and email
      for (let i = 0; i < updated.length; i++) {
        const c = updated[i];
        try {
          if (!c.whatsapp) throw new Error('WhatsApp necessario para editar');
          const updateData: Record<string, unknown> = { nome: c.nome };
          if (c.email) updateData.email = c.email;

          const { error } = await supabase
            .from('contacts')
            .update(updateData)
            .eq('whatsapp', c.whatsapp);
          if (error) throw error;

          updated[i] = { ...c, status: 'success' };
          success++;
        } catch (err: any) {
          updated[i] = { ...c, status: 'error', error: err.message };
          failed++;
        }
        setParsed([...updated]);
      }
    } else if (mode === 'tag') {
      // Tag mode: nome is tag name, whatsapp is contact identifier
      for (let i = 0; i < updated.length; i++) {
        const c = updated[i];
        try {
          // Find or create tag
          const tagName = c.nome;
          let { data: tag } = await supabase
            .from('tags')
            .select('id')
            .eq('nome', tagName)
            .maybeSingle();

          if (!tag) {
            const { data: newTag, error: tagErr } = await supabase
              .from('tags')
              .insert({ nome: tagName, categoria: 'relationships' })
              .select('id')
              .single();
            if (tagErr) throw tagErr;
            tag = newTag;
          }

          // Find contact
          if (!c.whatsapp) throw new Error('WhatsApp do contato necessario');
          const { data: contact } = await supabase
            .from('contacts')
            .select('id')
            .eq('whatsapp', c.whatsapp)
            .maybeSingle();

          if (!contact) throw new Error('Contato nao encontrado');

          // Link
          await supabase
            .from('contact_tags')
            .upsert({ contact_id: contact.id, tag_id: tag!.id }, { onConflict: 'contact_id,tag_id' });

          updated[i] = { ...c, status: 'success' };
          success++;
        } catch (err: any) {
          updated[i] = { ...c, status: 'error', error: err.message };
          failed++;
        }
        setParsed([...updated]);
      }
    }

    setResults({ success, failed });
    setIsProcessing(false);
    toast.success(`Importacao concluida: ${success} sucesso, ${failed} falhas`);
  };

  const modeLabels: Record<ImportMode, { tab: string; action: string; hint: string }> = {
    add: {
      tab: 'Adicionar',
      action: 'Importar',
      hint: 'Formato: nome,whatsapp,email (um por linha)',
    },
    delete: {
      tab: 'Deletar',
      action: 'Executar',
      hint: 'Formato: nome,whatsapp,email (localiza por whatsapp ou email)',
    },
    edit: {
      tab: 'Editar',
      action: 'Executar',
      hint: 'Formato: nome,whatsapp,email (localiza por whatsapp, atualiza nome/email)',
    },
    tag: {
      tab: 'Etiquetar',
      action: 'Executar',
      hint: 'Formato: nome_etiqueta,whatsapp_contato',
    },
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <FileSpreadsheet className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Importacao em Massa</h1>
      </div>

      <Tabs value={mode} onValueChange={(v) => setMode(v as ImportMode)}>
        <TabsList>
          {Object.entries(modeLabels).map(([key, { tab }]) => (
            <TabsTrigger key={key} value={key}>
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>

        {Object.entries(modeLabels).map(([key, { action, hint }]) => (
          <TabsContent key={key} value={key}>
            <Card>
              <CardHeader>
                <CardTitle>{modeLabels[key as ImportMode].tab}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{hint}</p>

                <div className="flex gap-2">
                  <label className="cursor-pointer">
                    <Input
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                    <Button variant="outline" asChild>
                      <span>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload CSV/XLSX
                      </span>
                    </Button>
                  </label>
                </div>

                <Textarea
                  placeholder={hint}
                  value={rawText}
                  onChange={(e) => handleTextChange(e.target.value)}
                  rows={8}
                  className="font-mono text-sm"
                />

                {/* Preview */}
                {parsed.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">
                        Preview: {parsed.length} registros
                      </p>
                      {results && (
                        <div className="flex gap-3 text-sm">
                          <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle className="h-4 w-4" />
                            {results.success}
                          </span>
                          <span className="flex items-center gap-1 text-red-600">
                            <XCircle className="h-4 w-4" />
                            {results.failed}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="max-h-64 overflow-y-auto border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>#</TableHead>
                            <TableHead>Nome</TableHead>
                            <TableHead>WhatsApp</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {parsed.slice(0, 100).map((c, i) => (
                            <TableRow key={i}>
                              <TableCell className="text-xs">{i + 1}</TableCell>
                              <TableCell className="text-sm">{c.nome}</TableCell>
                              <TableCell className="text-sm">{c.whatsapp ?? '-'}</TableCell>
                              <TableCell className="text-sm">{c.email ?? '-'}</TableCell>
                              <TableCell>
                                {c.status === 'success' && (
                                  <Badge className="bg-green-100 text-green-800">OK</Badge>
                                )}
                                {c.status === 'error' && (
                                  <Badge variant="destructive" title={c.error}>
                                    Erro
                                  </Badge>
                                )}
                                {c.status === 'pending' && (
                                  <Badge variant="secondary">Pendente</Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    <Button
                      onClick={handleExecute}
                      disabled={isProcessing || parsed.length === 0}
                    >
                      {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      {action}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
