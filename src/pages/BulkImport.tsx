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
import { Input } from '@/components/ui/input';
import { Loader2, Upload, FileSpreadsheet, CheckCircle, XCircle, ClipboardCopy, RefreshCw, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { normalizePhone, normalizeName, phoneComparisonKey } from '@/lib/normalization';
import * as XLSX from 'xlsx';

type ImportMode = 'add' | 'delete' | 'edit' | 'tag';

interface ParsedContact {
  nome: string;
  whatsapp?: string;
  email?: string;
  status?: 'pending' | 'success' | 'error' | 'not_found' | 'duplicate';
  error?: string;
}

export default function BulkImport() {
  const [mode, setMode] = useState<ImportMode>('add');
  const [rawText, setRawText] = useState('');
  const [parsed, setParsed] = useState<ParsedContact[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<{ success: number; failed: number } | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const parseText = useCallback((text: string) => {
    const lines = text.trim().split('\n').filter((l) => l.trim());
    const contacts: ParsedContact[] = lines.map((line) => {
      const parts = line.includes('\t')
        ? line.split('\t').map((p) => p.trim())
        : line.split(',').map((p) => p.trim());

      return {
        nome: normalizeName(parts[0] || ''),
        whatsapp: parts[1] ? normalizePhone(parts[1]) : undefined,
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

        const startIdx = rows[0]?.[0]?.toLowerCase?.().includes('nom') ? 1 : 0;

        const contacts: ParsedContact[] = rows.slice(startIdx).map((row) => ({
          nome: normalizeName(String(row[0] ?? '').trim()),
          whatsapp: row[1] ? normalizePhone(String(row[1]).trim()) : undefined,
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
    e.target.value = '';
  };

  const handleExecute = async () => {
    if (parsed.length === 0) return;

    setIsProcessing(true);
    let success = 0;
    let failed = 0;
    let duplicates = 0;
    const updated = [...parsed];

    // Pré-carrega contatos existentes para match por chave normalizada.
    // Um contato pode aparecer em até 2 chaves (telefone e whatsapp).
    const { data: existing, error: preloadError } = await supabase
      .from('contacts')
      .select('id, telefone, whatsapp');
    if (preloadError) {
      toast.error(`Erro ao carregar contatos existentes: ${preloadError.message}`);
      setIsProcessing(false);
      return;
    }
    const existingByKey = new Map<string, { id: string }>();
    for (const row of existing ?? []) {
      const tk = phoneComparisonKey(row.telefone);
      const wk = phoneComparisonKey(row.whatsapp);
      if (tk && !existingByKey.has(tk)) existingByKey.set(tk, { id: row.id });
      if (wk && !existingByKey.has(wk)) existingByKey.set(wk, { id: row.id });
    }

    if (mode === 'add') {
      // Set de chaves já inseridas neste batch (evita duplicata dentro da própria planilha)
      const batchKeys = new Set<string>();

      for (let i = 0; i < updated.length; i++) {
        const c = updated[i];
        try {
          const key = phoneComparisonKey(c.whatsapp);

          if (key && (existingByKey.has(key) || batchKeys.has(key))) {
            updated[i] = { ...c, status: 'duplicate', error: 'Telefone já cadastrado' };
            duplicates++;
            setParsed([...updated]);
            continue;
          }

          const insertData: Record<string, unknown> = { nome: c.nome };
          if (c.whatsapp) insertData.whatsapp = c.whatsapp;
          if (c.email) insertData.email = c.email;

          const { data: inserted, error } = await supabase
            .from('contacts')
            .insert(insertData)
            .select('id')
            .single();
          if (error) throw error;

          if (key) {
            batchKeys.add(key);
            if (inserted?.id) existingByKey.set(key, { id: inserted.id });
          }

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
          // Lookup por chave normalizada (whatsapp/telefone em qualquer formato),
          // com fallback p/ email e nome quando telefone não foi informado.
          const key = phoneComparisonKey(c.whatsapp);
          let foundId: string | null = null;

          if (key) {
            foundId = existingByKey.get(key)?.id ?? null;
          } else if (c.email) {
            const { data } = await supabase.from('contacts').select('id').eq('email', c.email).maybeSingle();
            foundId = data?.id ?? null;
          } else {
            const { data } = await supabase.from('contacts').select('id').eq('nome', c.nome).maybeSingle();
            foundId = data?.id ?? null;
          }

          if (!foundId) {
            updated[i] = { ...c, status: 'not_found', error: 'Contato não encontrado' };
            failed++;
          } else {
            const { error } = await supabase.from('contacts').delete().eq('id', foundId);
            if (error) throw error;
            updated[i] = { ...c, status: 'success' };
            success++;
          }
        } catch (err: any) {
          updated[i] = { ...c, status: 'error', error: err.message };
          failed++;
        }
        setParsed([...updated]);
      }
    } else if (mode === 'edit') {
      for (let i = 0; i < updated.length; i++) {
        const c = updated[i];
        try {
          if (!c.whatsapp) throw new Error('WhatsApp necessário para editar');

          const key = phoneComparisonKey(c.whatsapp);
          const foundId = key ? existingByKey.get(key)?.id ?? null : null;

          if (!foundId) {
            updated[i] = { ...c, status: 'not_found', error: 'Contato não encontrado' };
            failed++;
          } else {
            const updateData: Record<string, unknown> = { nome: c.nome };
            if (c.email) updateData.email = c.email;
            const { error } = await supabase.from('contacts').update(updateData).eq('id', foundId);
            if (error) throw error;
            updated[i] = { ...c, status: 'success' };
            success++;
          }
        } catch (err: any) {
          updated[i] = { ...c, status: 'error', error: err.message };
          failed++;
        }
        setParsed([...updated]);
      }
    } else if (mode === 'tag') {
      // Busca o grupo "Relacionamentos" (obrigatorio para novas tags apos migration 009)
      const { data: relGroup } = await supabase
        .from('tag_groups')
        .select('id')
        .eq('slug', 'relacionamentos')
        .single();
      const relGroupId = relGroup?.id;

      for (let i = 0; i < updated.length; i++) {
        const c = updated[i];
        try {
          const tagName = c.nome;
          let { data: tag } = await supabase
            .from('tags')
            .select('id')
            .eq('nome', tagName)
            .maybeSingle();

          if (!tag) {
            const { data: newTag, error: tagErr } = await supabase
              .from('tags')
              .insert({ nome: tagName, group_id: relGroupId })
              .select('id')
              .single();
            if (tagErr) throw tagErr;
            tag = newTag;
          }

          if (!c.whatsapp) throw new Error('WhatsApp do contato necessário');

          const key = phoneComparisonKey(c.whatsapp);
          const foundId = key ? existingByKey.get(key)?.id ?? null : null;

          if (!foundId) {
            updated[i] = { ...c, status: 'not_found', error: 'Contato não encontrado' };
            failed++;
          } else {
            await supabase
              .from('contact_tags')
              .upsert({ contact_id: foundId, tag_id: tag!.id }, { onConflict: 'contact_id,tag_id' });
            updated[i] = { ...c, status: 'success' };
            success++;
          }
        } catch (err: any) {
          updated[i] = { ...c, status: 'error', error: err.message };
          failed++;
        }
        setParsed([...updated]);
      }
    }

    setResults({ success, failed: failed + duplicates });
    setIsProcessing(false);
    const dupMsg = duplicates > 0 ? `, ${duplicates} duplicados ignorados` : '';
    toast.success(`Importação concluída: ${success} sucesso, ${failed} falhas${dupMsg}`);
  };

  const errorItems = parsed.filter((c) => c.status === 'error');
  const notFoundItems = parsed.filter((c) => c.status === 'not_found');
  const duplicateItems = parsed.filter((c) => c.status === 'duplicate');

  const copyErrors = () => {
    const items = [...errorItems, ...notFoundItems];
    const text = items
      .map((c) => `${c.nome},${c.whatsapp ?? ''},${c.email ?? ''} — ${c.error ?? 'Não encontrado'}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    toast.success('Erros copiados para a área de transferência');
  };

  const reimportErrors = () => {
    const items = [...errorItems, ...notFoundItems];
    const text = items
      .map((c) => `${c.nome},${c.whatsapp ?? ''},${c.email ?? ''}`)
      .join('\n');
    setRawText(text);
    parseText(text);
    toast.success('Erros carregados para re-importação');
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
        <h1 className="text-2xl font-bold">Importação em Massa</h1>
      </div>

      <Tabs value={mode} onValueChange={(v) => { setMode(v as ImportMode); setParsed([]); setRawText(''); setResults(null); }}>
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
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">
                          Preview: {parsed.length} registros
                        </p>
                        <Badge variant="secondary">{parsed.length} registros</Badge>
                      </div>
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
                                {c.status === 'not_found' && (
                                  <Badge variant="outline" className="text-yellow-700 border-yellow-400" title={c.error}>
                                    Não encontrado
                                  </Badge>
                                )}
                                {c.status === 'duplicate' && (
                                  <Badge variant="outline" className="text-orange-700 border-orange-400" title={c.error}>
                                    Duplicado
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

                    {/* Action buttons */}
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        onClick={() => setShowConfirm(true)}
                        disabled={isProcessing || parsed.length === 0}
                      >
                        {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        {action}
                      </Button>

                      {/* Error actions */}
                      {results && (errorItems.length > 0 || notFoundItems.length > 0) && (
                        <>
                          <Button variant="outline" size="sm" onClick={copyErrors} className="gap-2">
                            <ClipboardCopy className="h-4 w-4" />
                            Copiar erros
                          </Button>
                          <Button variant="outline" size="sm" onClick={reimportErrors} className="gap-2">
                            <RefreshCw className="h-4 w-4" />
                            Re-importar erros
                          </Button>
                        </>
                      )}
                    </div>

                    {/* Not found section */}
                    {results && notFoundItems.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-yellow-700">
                          <AlertTriangle className="h-4 w-4" />
                          <span className="text-sm font-medium">{notFoundItems.length} não encontrados</span>
                        </div>
                        <div className="max-h-32 overflow-y-auto border border-yellow-200 rounded-lg">
                          <Table>
                            <TableBody>
                              {notFoundItems.map((c, i) => (
                                <TableRow key={i}>
                                  <TableCell className="text-sm">{c.nome}</TableCell>
                                  <TableCell className="text-sm text-muted-foreground">{c.whatsapp ?? '-'}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}

                    {/* Duplicate section */}
                    {results && duplicateItems.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-orange-700">
                          <AlertTriangle className="h-4 w-4" />
                          <span className="text-sm font-medium">
                            {duplicateItems.length} duplicados ignorados (já existiam no sistema)
                          </span>
                        </div>
                        <div className="max-h-32 overflow-y-auto border border-orange-200 rounded-lg">
                          <Table>
                            <TableBody>
                              {duplicateItems.map((c, i) => (
                                <TableRow key={i}>
                                  <TableCell className="text-sm">{c.nome}</TableCell>
                                  <TableCell className="text-sm text-muted-foreground">{c.whatsapp ?? '-'}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Confirmation dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar operação</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja {modeLabels[mode].tab.toLowerCase()} {parsed.length} contatos?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowConfirm(false); handleExecute(); }}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
