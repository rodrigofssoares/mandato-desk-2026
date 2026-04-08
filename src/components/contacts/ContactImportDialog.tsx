import { useState, useRef } from 'react';
import { Upload, Download, Loader2, ClipboardCopy, CheckCircle, AlertCircle, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { normalizePhone, normalizeName, normalizeEmail } from '@/lib/normalization';
import { importContactSchema, parseBoolean } from '@/lib/contactValidation';
import { logActivity } from '@/lib/activityLog';

interface ContactImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type Phase = 'idle' | 'preview' | 'preparing' | 'creating' | 'updating' | 'tags' | 'done';

interface ParsedRow {
  lineNumber: number;
  raw: Record<string, string>;
  normalized: Record<string, unknown>;
  action?: 'create' | 'update' | 'skip';
  error?: string;
}

interface ImportStats {
  created: number;
  updated: number;
  skipped: number;
  errors: number;
}

const HEADER_MAP: Record<string, string> = {
  nome_completo: 'nome_completo',
  nome: 'nome_completo',
  whatsapp: 'whatsapp',
  canal_whatsapp: 'canal_whatsapp',
  whatsapp_habilitado: 'canal_whatsapp',
  em_canal_whatsapp: 'canal_whatsapp',
  canal_do_whatsapp: 'canal_whatsapp',
  nome_whatsapp: 'nome_whatsapp',
  receber_whatsapp: 'receber_whatsapp',
  aceita_whatsapp: 'receber_whatsapp',
  email: 'email',
  telefone: 'telefone',
  genero: 'genero',
  gênero: 'genero',
  endereco: 'endereco',
  endereço: 'endereco',
  logradouro: 'endereco',
  numero: 'numero',
  número: 'numero',
  complemento: 'complemento',
  bairro: 'bairro',
  cidade: 'cidade',
  uf: 'uf',
  estado: 'uf',
  cep: 'cep',
  origem: 'origem',
  observacoes: 'observacoes',
  observações: 'observacoes',
  notas_assessor: 'notas_assessor',
  declarou_voto: 'declarou_voto',
  etiquetas: 'etiquetas',
  tags: 'etiquetas',
  data_nascimento: 'data_nascimento',
  data_de_nascimento: 'data_nascimento',
  nascimento: 'data_nascimento',
  instagram: 'instagram',
  twitter: 'twitter',
  tiktok: 'tiktok',
  youtube: 'youtube',
  ranking: 'ranking',
  leader_id: 'leader_id',
  lideranca_id: 'leader_id',
  liderança_id: 'leader_id',
  favorito: 'is_favorite',
  is_favorite: 'is_favorite',
  multiplicador: 'multiplicador',
  e_multiplicador: 'multiplicador',
  ultimo_contato: 'ultimo_contato',
  último_contato: 'ultimo_contato',
};

const PHASE_LABELS: Record<Phase, string> = {
  idle: '',
  preview: '',
  preparing: 'Preparando...',
  creating: 'Criando novos contatos...',
  updating: 'Atualizando existentes...',
  tags: 'Processando etiquetas...',
  done: 'Concluído!',
};

const PHASE_PROGRESS: Record<Phase, number> = {
  idle: 0,
  preview: 0,
  preparing: 10,
  creating: 40,
  updating: 70,
  tags: 90,
  done: 100,
};

export function ContactImportDialog({ open, onOpenChange, onSuccess }: ContactImportDialogProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [stats, setStats] = useState<ImportStats>({ created: 0, updated: 0, skipped: 0, errors: 0 });
  const [errors, setErrors] = useState<{ line: number; message: string }[]>([]);
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setPhase('idle');
    setParsedRows([]);
    setStats({ created: 0, updated: 0, skipped: 0, errors: 0 });
    setErrors([]);
    setFileName('');
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) reset();
    onOpenChange(open);
  };

  // --- Download Template ---
  const downloadTemplate = async () => {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();

    const headers = [
      'nome_completo', 'nome_whatsapp', 'whatsapp', 'canal_whatsapp', 'receber_whatsapp',
      'multiplicador', 'email', 'telefone', 'genero', 'data_nascimento',
      'endereco', 'numero', 'complemento', 'bairro', 'cidade', 'uf', 'cep',
      'instagram', 'twitter', 'tiktok', 'youtube',
      'declarou_voto', 'ranking', 'leader_id', 'favorito',
      'origem', 'observacoes', 'notas_assessor', 'ultimo_contato', 'etiquetas',
    ];

    // 3 exemplos fictícios
    const examples = [
      [
        'Maria da Silva', 'Maria', '5511999887766', 'sim', 'sim',
        'nao', 'maria@email.com', '5511988776655', 'feminino', '1985-03-20',
        'Rua das Flores', '123', 'Apto 4B', 'Centro', 'São Paulo', 'SP', '01001-000',
        '@mariasilva', '', '', '',
        'sim', '8', '', 'sim',
        'Evento comunitário', 'Moradora ativa do bairro', 'Contato feito na reunião de março', '2026-04-01', 'Liderança, Saúde',
      ],
      [
        'João Santos', '', '5521988776655', 'nao', 'sim',
        'sim', 'joao.santos@gmail.com', '', 'masculino', '1990-07-10',
        'Av. Brasil', '456', '', 'Copacabana', 'Rio de Janeiro', 'RJ', '22041-080',
        '', '@joaosantos', '', '',
        'nao', '5', '', 'nao',
        'Indicação', '', 'Multiplicador na zona sul', '', 'Educação',
      ],
      [
        'Ana Oliveira', 'Aninha', '5531977665544', 'sim', 'nao',
        'nao', '', '5531966554433', 'feminino', '',
        'Rua Minas Gerais', '789', 'Casa 2', 'Savassi', 'Belo Horizonte', 'MG', '30130-150',
        '@anaoliveira', '', '@ana.tiktok', '',
        'sim', '3', '', 'nao',
        'Redes sociais', 'Interessada em projetos de cultura', '', '2026-03-15', 'Cultura, Juventude',
      ],
    ];

    const wsContatos = XLSX.utils.aoa_to_sheet([headers, ...examples]);
    wsContatos['!cols'] = headers.map(() => ({ wch: 22 }));
    XLSX.utils.book_append_sheet(wb, wsContatos, 'Contatos');

    const instructions = [
      ['INSTRUÇÕES DE PREENCHIMENTO'],
      [''],
      ['Este modelo contém 30 campos. Apenas nome_completo e whatsapp são obrigatórios.'],
      ['Os 3 exemplos na aba "Contatos" podem ser apagados antes de importar.'],
      ['Campos com "sim/não" aceitam também: true/false, 1/0, yes/no, s/n.'],
      ['Se o WhatsApp já existe no sistema, o contato será ATUALIZADO (não duplicado).'],
      ['Campos em branco na planilha NÃO sobrescrevem dados já cadastrados.'],
      [''],
      ['Campo', 'Obrigatório', 'Descrição', 'Exemplo'],
      ['nome_completo', 'SIM', 'Nome completo do contato (máx 255 caracteres)', 'Maria da Silva'],
      ['nome_whatsapp', 'Não', 'Nome que aparece no perfil do WhatsApp', 'Maria'],
      ['whatsapp', 'SIM', 'Número com DDD e código do país (apenas dígitos)', '5511999887766'],
      ['canal_whatsapp', 'Não', 'Contato está no canal do WhatsApp? (sim/não)', 'sim'],
      ['receber_whatsapp', 'Não', 'Aceita receber mensagens pelo WhatsApp? (sim/não)', 'sim'],
      ['multiplicador', 'Não', 'É um multiplicador/articulador? (sim/não)', 'nao'],
      ['email', 'Não', 'Endereço de e-mail válido', 'maria@email.com'],
      ['telefone', 'Não', 'Telefone fixo ou celular alternativo (apenas dígitos)', '5511988776655'],
      ['genero', 'Não', 'Gênero: masculino, feminino ou outro', 'feminino'],
      ['data_nascimento', 'Não', 'Data no formato AAAA-MM-DD', '1985-03-20'],
      ['endereco', 'Não', 'Logradouro (rua, avenida, etc.)', 'Rua das Flores'],
      ['numero', 'Não', 'Número do endereço', '123'],
      ['complemento', 'Não', 'Apartamento, bloco, casa, sala, etc.', 'Apto 4B'],
      ['bairro', 'Não', 'Bairro do endereço', 'Centro'],
      ['cidade', 'Não', 'Cidade', 'São Paulo'],
      ['uf', 'Não', 'Sigla do estado (2 letras)', 'SP'],
      ['cep', 'Não', 'CEP com ou sem hífen', '01001-000'],
      ['instagram', 'Não', 'Usuário do Instagram (com ou sem @)', '@mariasilva'],
      ['twitter', 'Não', 'Usuário do Twitter/X (com ou sem @)', '@mariasilva'],
      ['tiktok', 'Não', 'Usuário do TikTok (com ou sem @)', '@mariasilva'],
      ['youtube', 'Não', 'Canal ou usuário do YouTube', '@mariasilva'],
      ['declarou_voto', 'Não', 'Declarou voto? (sim/não)', 'sim'],
      ['ranking', 'Não', 'Nota de engajamento de 0 a 10', '8'],
      ['leader_id', 'Não', 'ID (UUID) da liderança vinculada', ''],
      ['favorito', 'Não', 'Marcar como favorito? (sim/não)', 'sim'],
      ['origem', 'Não', 'Como o contato chegou ao sistema', 'Evento comunitário'],
      ['observacoes', 'Não', 'Observações gerais (máx 2000 caracteres)', 'Moradora ativa'],
      ['notas_assessor', 'Não', 'Notas internas da equipe (máx 2000 caracteres)', 'Acompanhar demanda'],
      ['ultimo_contato', 'Não', 'Data do último contato (AAAA-MM-DD)', '2026-04-01'],
      ['etiquetas', 'Não', 'Etiquetas separadas por vírgula (cria se não existir)', 'Liderança, Saúde'],
    ];
    const wsInstrucoes = XLSX.utils.aoa_to_sheet(instructions);
    wsInstrucoes['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 50 }, { wch: 25 }];
    XLSX.utils.book_append_sheet(wb, wsInstrucoes, 'Instruções');

    XLSX.writeFile(wb, 'template_importacao_contatos.xlsx');
    toast.success('Template baixado');
  };

  // --- Parse File ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    try {
      const XLSX = await import('xlsx');
      const data = new Uint8Array(await file.arrayBuffer());
      const workbook = XLSX.read(data, { type: 'array' });

      // Ignorar aba "Instruções"
      const sheetName = workbook.SheetNames.find(
        (n) => n.toLowerCase() !== 'instruções' && n.toLowerCase() !== 'instrucoes'
      ) ?? workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rawRows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      if (rawRows.length < 2) {
        toast.error('Arquivo vazio ou sem dados');
        return;
      }

      // Map headers
      const headerRow = rawRows[0].map((h) => String(h).trim().toLowerCase().replace(/\s+/g, '_'));
      const mappedHeaders = headerRow.map((h) => HEADER_MAP[h] ?? null);

      const rows: ParsedRow[] = [];
      for (let i = 1; i < rawRows.length; i++) {
        const cells = rawRows[i];
        if (!cells || cells.every((c) => !String(c).trim())) continue; // skip empty

        const raw: Record<string, string> = {};
        const normalized: Record<string, unknown> = {};

        mappedHeaders.forEach((field, idx) => {
          if (!field) return;
          const value = String(cells[idx] ?? '').trim();
          raw[field] = value;
        });

        // Normalize
        if (raw.nome_completo) normalized.nome_completo = normalizeName(raw.nome_completo);
        else normalized.nome_completo = '';
        if (raw.whatsapp) normalized.whatsapp = normalizePhone(raw.whatsapp);
        else normalized.whatsapp = '';
        if (raw.email) normalized.email = normalizeEmail(raw.email);
        if (raw.telefone) normalized.telefone = normalizePhone(raw.telefone);
        if (raw.genero) normalized.genero = raw.genero.toLowerCase();
        if (raw.declarou_voto) normalized.declarou_voto = parseBoolean(raw.declarou_voto);
        if (raw.canal_whatsapp) normalized.canal_whatsapp = parseBoolean(raw.canal_whatsapp);
        if (raw.receber_whatsapp) normalized.receber_whatsapp = parseBoolean(raw.receber_whatsapp);
        if (raw.multiplicador) normalized.multiplicador = parseBoolean(raw.multiplicador);
        if (raw.is_favorite) normalized.is_favorite = parseBoolean(raw.is_favorite);
        if (raw.ranking) {
          const r = parseInt(raw.ranking, 10);
          if (!isNaN(r) && r >= 0 && r <= 10) normalized.ranking = r;
        }

        // Pass through text fields
        ['nome_whatsapp', 'endereco', 'numero', 'complemento', 'bairro', 'cidade', 'uf', 'cep', 'origem', 'observacoes', 'notas_assessor', 'etiquetas', 'data_nascimento', 'instagram', 'twitter', 'tiktok', 'youtube', 'leader_id', 'ultimo_contato'].forEach((f) => {
          if (raw[f]) normalized[f] = raw[f];
        });

        rows.push({ lineNumber: i + 1, raw, normalized });
      }

      setParsedRows(rows);
      setPhase('preview');
      toast.success(`${rows.length} linhas carregadas de "${file.name}"`);
    } catch {
      toast.error('Erro ao ler arquivo');
    }

    e.target.value = '';
  };

  // --- Import ---
  const handleImport = async () => {
    if (parsedRows.length === 0) return;
    const importErrors: { line: number; message: string }[] = [];
    const importStats: ImportStats = { created: 0, updated: 0, skipped: 0, errors: 0 };

    // Phase 1: Prepare
    setPhase('preparing');
    let existingWhatsapps = new Map<string, string>(); // whatsapp -> contact id
    let existingTags = new Map<string, string>(); // tag name -> tag id

    try {
      // Fetch existing contacts
      let offset = 0;
      while (true) {
        const { data } = await supabase
          .from('contacts')
          .select('id, whatsapp')
          .not('whatsapp', 'is', null)
          .range(offset, offset + 999);
        if (!data || data.length === 0) break;
        data.forEach((c) => {
          if (c.whatsapp) existingWhatsapps.set(c.whatsapp, c.id);
        });
        if (data.length < 1000) break;
        offset += 1000;
      }

      // Fetch existing tags
      const { data: tags } = await supabase.from('tags').select('id, nome');
      (tags ?? []).forEach((t) => existingTags.set(t.nome.toLowerCase(), t.id));
    } catch {
      toast.error('Erro ao preparar importação');
      setPhase('idle');
      return;
    }

    // Validate all rows
    const validRows: ParsedRow[] = [];
    for (const row of parsedRows) {
      const result = importContactSchema.safeParse(row.normalized);
      if (!result.success) {
        const msg = result.error.issues.map((i) => i.message).join(', ');
        importErrors.push({ line: row.lineNumber, message: msg });
        importStats.errors++;
        continue;
      }

      const whatsapp = String(row.normalized.whatsapp ?? '');
      if (existingWhatsapps.has(whatsapp)) {
        row.action = 'update';
      } else {
        row.action = 'create';
      }
      validRows.push(row);
    }

    // Phase 2: Create new contacts
    setPhase('creating');
    const toCreate = validRows.filter((r) => r.action === 'create');
    const BATCH = 100;
    for (let i = 0; i < toCreate.length; i += BATCH) {
      const batch = toCreate.slice(i, i + BATCH);
      const inserts = batch.map((r) => {
        const n = r.normalized;
        const obj: Record<string, unknown> = {
          nome: n.nome_completo,
          whatsapp: n.whatsapp,
        };
        if (n.email) obj.email = n.email;
        if (n.telefone) obj.telefone = n.telefone;
        if (n.genero) obj.genero = n.genero;
        if (n.endereco) obj.logradouro = n.endereco;
        if (n.numero) obj.numero = n.numero;
        if (n.complemento) obj.complemento = n.complemento;
        if (n.bairro) obj.bairro = n.bairro;
        if (n.cidade) obj.cidade = n.cidade;
        if (n.uf) obj.estado = n.uf;
        if (n.cep) obj.cep = n.cep;
        if (n.origem) obj.origem = n.origem;
        if (n.observacoes) obj.observacoes = n.observacoes;
        if (n.notas_assessor) obj.notas_assessor = n.notas_assessor;
        if (n.declarou_voto !== undefined) obj.declarou_voto = n.declarou_voto;
        if (n.canal_whatsapp !== undefined) obj.em_canal_whatsapp = n.canal_whatsapp;
        if (n.nome_whatsapp) obj.nome_whatsapp = n.nome_whatsapp;
        if (n.receber_whatsapp !== undefined) obj.aceita_whatsapp = n.receber_whatsapp;
        if (n.multiplicador !== undefined) obj.e_multiplicador = n.multiplicador;
        if (n.data_nascimento) obj.data_nascimento = n.data_nascimento;
        if (n.instagram) obj.instagram = n.instagram;
        if (n.twitter) obj.twitter = n.twitter;
        if (n.tiktok) obj.tiktok = n.tiktok;
        if (n.youtube) obj.youtube = n.youtube;
        if (n.ranking !== undefined) obj.ranking = n.ranking;
        if (n.leader_id) obj.leader_id = n.leader_id;
        if (n.is_favorite !== undefined) obj.is_favorite = n.is_favorite;
        if (n.ultimo_contato) obj.ultimo_contato = n.ultimo_contato;
        return obj;
      });

      const { data: created, error } = await supabase.from('contacts').insert(inserts).select('id, whatsapp');
      if (error) {
        batch.forEach((r) => {
          importErrors.push({ line: r.lineNumber, message: error.message });
          importStats.errors++;
        });
      } else {
        importStats.created += (created?.length ?? 0);
        // Track new IDs for tag linking
        (created ?? []).forEach((c) => {
          if (c.whatsapp) existingWhatsapps.set(c.whatsapp, c.id);
        });
      }
    }

    // Phase 3: Update existing contacts
    setPhase('updating');
    const toUpdate = validRows.filter((r) => r.action === 'update');
    for (const row of toUpdate) {
      const n = row.normalized;
      const whatsapp = String(n.whatsapp ?? '');
      const contactId = existingWhatsapps.get(whatsapp);
      if (!contactId) {
        importStats.skipped++;
        continue;
      }

      // Only update non-empty fields
      const updates: Record<string, unknown> = {};
      if (n.nome_completo) updates.nome = n.nome_completo;
      if (n.email) updates.email = n.email;
      if (n.telefone) updates.telefone = n.telefone;
      if (n.genero) updates.genero = n.genero;
      if (n.endereco) updates.logradouro = n.endereco;
      if (n.numero) updates.numero = n.numero;
      if (n.complemento) updates.complemento = n.complemento;
      if (n.bairro) updates.bairro = n.bairro;
      if (n.cidade) updates.cidade = n.cidade;
      if (n.uf) updates.estado = n.uf;
      if (n.cep) updates.cep = n.cep;
      if (n.origem) updates.origem = n.origem;
      if (n.observacoes) updates.observacoes = n.observacoes;
      if (n.notas_assessor) updates.notas_assessor = n.notas_assessor;
      if (n.declarou_voto !== undefined) updates.declarou_voto = n.declarou_voto;
      if (n.canal_whatsapp !== undefined) updates.em_canal_whatsapp = n.canal_whatsapp;
      if (n.nome_whatsapp) updates.nome_whatsapp = n.nome_whatsapp;
      if (n.receber_whatsapp !== undefined) updates.aceita_whatsapp = n.receber_whatsapp;
      if (n.multiplicador !== undefined) updates.e_multiplicador = n.multiplicador;
      if (n.data_nascimento) updates.data_nascimento = n.data_nascimento;
      if (n.instagram) updates.instagram = n.instagram;
      if (n.twitter) updates.twitter = n.twitter;
      if (n.tiktok) updates.tiktok = n.tiktok;
      if (n.youtube) updates.youtube = n.youtube;
      if (n.ranking !== undefined) updates.ranking = n.ranking;
      if (n.leader_id) updates.leader_id = n.leader_id;
      if (n.is_favorite !== undefined) updates.is_favorite = n.is_favorite;
      if (n.ultimo_contato) updates.ultimo_contato = n.ultimo_contato;

      if (Object.keys(updates).length === 0) {
        importStats.skipped++;
        continue;
      }

      const { error } = await supabase.from('contacts').update(updates).eq('id', contactId);
      if (error) {
        importErrors.push({ line: row.lineNumber, message: error.message });
        importStats.errors++;
      } else {
        importStats.updated++;
      }
    }

    // Phase 4: Tags
    setPhase('tags');
    for (const row of validRows) {
      const tagStr = String(row.normalized.etiquetas ?? '');
      if (!tagStr.trim()) continue;

      const whatsapp = String(row.normalized.whatsapp ?? '');
      const contactId = existingWhatsapps.get(whatsapp);
      if (!contactId) continue;

      const tagNames = tagStr.split(',').map((t) => t.trim()).filter(Boolean);
      for (const tagName of tagNames) {
        let tagId = existingTags.get(tagName.toLowerCase());

        // Create tag if not exists
        if (!tagId) {
          const { data: newTag, error } = await supabase
            .from('tags')
            .insert({ nome: tagName, categoria: 'geral' })
            .select('id')
            .single();
          if (error) {
            importErrors.push({ line: row.lineNumber, message: `Erro ao criar etiqueta "${tagName}": ${error.message}` });
            continue;
          }
          tagId = newTag.id;
          existingTags.set(tagName.toLowerCase(), tagId);
        }

        // Link
        await supabase
          .from('contact_tags')
          .upsert({ contact_id: contactId, tag_id: tagId }, { onConflict: 'contact_id,tag_id' });
      }
    }

    // Phase 5: Done
    setPhase('done');
    setStats(importStats);
    setErrors(importErrors);

    await logActivity({
      type: 'import',
      entity_type: 'contact',
      description: `Importação: ${importStats.created} criados, ${importStats.updated} atualizados, ${importStats.errors} erros. Arquivo: ${fileName}`,
    });

    onSuccess?.();
  };

  const copyErrors = () => {
    const text = errors.map((e) => `Linha ${e.line}: ${e.message}`).join('\n');
    navigator.clipboard.writeText(text);
    toast.success('Erros copiados para a área de transferência');
  };

  const totalValid = parsedRows.length;
  const totalInvalid = errors.length;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importar Contatos
          </DialogTitle>
          <DialogDescription>
            Importe contatos de um arquivo CSV ou XLSX. WhatsApp duplicado atualiza o contato existente.
          </DialogDescription>
        </DialogHeader>

        {/* Idle: Upload area */}
        {phase === 'idle' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button variant="outline" onClick={downloadTemplate} className="gap-2">
                <Download className="h-4 w-4" />
                Baixar Template
              </Button>
              <Button onClick={() => fileInputRef.current?.click()} className="gap-2">
                <Upload className="h-4 w-4" />
                Selecionar Arquivo
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Formatos aceitos: CSV (separador ; ou ,) e Excel (.xlsx, .xls)
            </p>
          </div>
        )}

        {/* Preview */}
        {phase === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="secondary">
                <FileSpreadsheet className="h-3 w-3 mr-1" />
                {fileName}
              </Badge>
              <Badge variant="default">{totalValid} linhas</Badge>
            </div>

            {/* Preview table: first 5 rows */}
            <div className="max-h-48 overflow-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>WhatsApp</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Bairro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.slice(0, 5).map((row) => (
                    <TableRow key={row.lineNumber}>
                      <TableCell className="text-xs text-muted-foreground">{row.lineNumber}</TableCell>
                      <TableCell className="text-sm">{String(row.normalized.nome_completo ?? '')}</TableCell>
                      <TableCell className="text-sm">{String(row.normalized.whatsapp ?? '')}</TableCell>
                      <TableCell className="text-sm">{String(row.normalized.email ?? '-')}</TableCell>
                      <TableCell className="text-sm">{String(row.normalized.bairro ?? '-')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {parsedRows.length > 5 && (
              <p className="text-xs text-muted-foreground">
                ...e mais {parsedRows.length - 5} linhas
              </p>
            )}

            <div className="flex gap-2">
              <Button onClick={handleImport} className="gap-2">
                <Upload className="h-4 w-4" />
                Importar {totalValid} contatos
              </Button>
              <Button variant="outline" onClick={reset}>
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* Importing */}
        {['preparing', 'creating', 'updating', 'tags'].includes(phase) && (
          <div className="space-y-4 py-4">
            <Progress value={PHASE_PROGRESS[phase]} className="h-2" />
            <p className="text-sm text-center text-muted-foreground">
              {PHASE_LABELS[phase]}
            </p>
          </div>
        )}

        {/* Done */}
        {phase === 'done' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">Importação concluída!</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-700">{stats.created}</p>
                <p className="text-xs text-green-600">Criados</p>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-700">{stats.updated}</p>
                <p className="text-xs text-blue-600">Atualizados</p>
              </div>
              <div className="text-center p-3 bg-yellow-50 rounded-lg">
                <p className="text-2xl font-bold text-yellow-700">{stats.skipped}</p>
                <p className="text-xs text-yellow-600">Ignorados</p>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <p className="text-2xl font-bold text-red-700">{stats.errors}</p>
                <p className="text-xs text-red-600">Erros</p>
              </div>
            </div>

            {/* Errors list */}
            {errors.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-red-600">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">{errors.length} erros</span>
                  </div>
                  <Button variant="outline" size="sm" onClick={copyErrors} className="gap-2">
                    <ClipboardCopy className="h-3 w-3" />
                    Copiar erros
                  </Button>
                </div>
                <div className="max-h-32 overflow-auto border rounded-lg">
                  <Table>
                    <TableBody>
                      {errors.slice(0, 50).map((e, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs w-16">Linha {e.line}</TableCell>
                          <TableCell className="text-xs text-red-600">{e.message}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Fechar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
