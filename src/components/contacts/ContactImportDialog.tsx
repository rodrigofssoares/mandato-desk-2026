import { useState, useRef, useEffect } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { normalizePhone, normalizeName, normalizeEmail, phoneComparisonKey } from '@/lib/normalization';
import { importContactSchema, parseBoolean } from '@/lib/contactValidation';
import { logActivity } from '@/lib/activityLog';

interface ContactImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type Phase = 'idle' | 'mapping' | 'preview' | 'preparing' | 'creating' | 'updating' | 'tags' | 'done';

// Campos do sistema que o usuário pode mapear as colunas do arquivo para.
// O valor "__ignore__" significa que a coluna é descartada.
const SYSTEM_FIELDS: { value: string; label: string }[] = [
  { value: '__ignore__', label: '— Ignorar esta coluna —' },
  { value: 'nome_completo', label: 'Nome completo *' },
  { value: 'nome_whatsapp', label: 'Nome no WhatsApp' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'telefone', label: 'Telefone alternativo' },
  { value: 'email', label: 'E-mail' },
  { value: 'canal_whatsapp', label: 'Está no canal do WhatsApp (sim/não)' },
  { value: 'receber_whatsapp', label: 'Aceita WhatsApp (sim/não)' },
  { value: 'multiplicador', label: 'É multiplicador (sim/não)' },
  { value: 'genero', label: 'Gênero' },
  { value: 'data_nascimento', label: 'Data de nascimento' },
  { value: 'endereco', label: 'Endereço / Logradouro' },
  { value: 'numero', label: 'Número' },
  { value: 'complemento', label: 'Complemento' },
  { value: 'bairro', label: 'Bairro' },
  { value: 'cidade', label: 'Cidade' },
  { value: 'uf', label: 'UF / Estado' },
  { value: 'cep', label: 'CEP' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'twitter', label: 'Twitter' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'declarou_voto', label: 'Declarou voto (sim/não)' },
  { value: 'ranking', label: 'Ranking (0 a 10)' },
  { value: 'leader_id', label: 'ID da liderança' },
  { value: 'is_favorite', label: 'Favorito (sim/não)' },
  { value: 'origem', label: 'Origem' },
  { value: 'observacoes', label: 'Observações' },
  { value: 'notas_assessor', label: 'Notas do assessor' },
  { value: 'ultimo_contato', label: 'Último contato' },
  { value: 'etiquetas', label: 'Etiquetas (separadas por vírgula)' },
];

interface ParsedRow {
  lineNumber: number;
  raw: Record<string, string>;
  normalized: Record<string, unknown>;
  action?: 'create' | 'update' | 'duplicate' | 'skip';
  error?: string;
  /** Campos que de fato mudaram (só usado quando action === 'update') */
  updatePayload?: Record<string, unknown>;
  /** Nomes de etiquetas que ainda NÃO estavam no contato (só para update) */
  newTagNames?: string[];
  /** Resumo amigável do que mudou (ex: "Instagram, 1 etiqueta nova") */
  changeSummary?: string;
  /** Contato do banco com o qual esta linha bateu (update/duplicate) */
  matchedContact?: { id: string; nome: string; whatsapp: string | null };
}

interface ImportStats {
  created: number;
  updated: number;
  duplicates: number;
  skipped: number;
  errors: number;
}

// Mapeamento campo-da-planilha → coluna-do-banco, com tipo p/ comparar.
const FIELD_MAP: { row: string; db: string; type: 'text' | 'bool' | 'number'; label: string }[] = [
  { row: 'nome_completo', db: 'nome', type: 'text', label: 'Nome' },
  { row: 'nome_whatsapp', db: 'nome_whatsapp', type: 'text', label: 'Nome WhatsApp' },
  { row: 'email', db: 'email', type: 'text', label: 'E-mail' },
  { row: 'telefone', db: 'telefone', type: 'text', label: 'Telefone' },
  { row: 'genero', db: 'genero', type: 'text', label: 'Gênero' },
  { row: 'endereco', db: 'logradouro', type: 'text', label: 'Endereço' },
  { row: 'numero', db: 'numero', type: 'text', label: 'Número' },
  { row: 'complemento', db: 'complemento', type: 'text', label: 'Complemento' },
  { row: 'bairro', db: 'bairro', type: 'text', label: 'Bairro' },
  { row: 'cidade', db: 'cidade', type: 'text', label: 'Cidade' },
  { row: 'uf', db: 'estado', type: 'text', label: 'UF' },
  { row: 'cep', db: 'cep', type: 'text', label: 'CEP' },
  { row: 'origem', db: 'origem', type: 'text', label: 'Origem' },
  { row: 'observacoes', db: 'observacoes', type: 'text', label: 'Observações' },
  { row: 'notas_assessor', db: 'notas_assessor', type: 'text', label: 'Notas' },
  { row: 'declarou_voto', db: 'declarou_voto', type: 'bool', label: 'Declarou voto' },
  { row: 'canal_whatsapp', db: 'em_canal_whatsapp', type: 'bool', label: 'Canal WhatsApp' },
  { row: 'receber_whatsapp', db: 'aceita_whatsapp', type: 'bool', label: 'Aceita WhatsApp' },
  { row: 'multiplicador', db: 'e_multiplicador', type: 'bool', label: 'Multiplicador' },
  { row: 'data_nascimento', db: 'data_nascimento', type: 'text', label: 'Nascimento' },
  { row: 'instagram', db: 'instagram', type: 'text', label: 'Instagram' },
  { row: 'twitter', db: 'twitter', type: 'text', label: 'Twitter' },
  { row: 'tiktok', db: 'tiktok', type: 'text', label: 'TikTok' },
  { row: 'youtube', db: 'youtube', type: 'text', label: 'YouTube' },
  { row: 'ranking', db: 'ranking', type: 'number', label: 'Ranking' },
  { row: 'leader_id', db: 'leader_id', type: 'text', label: 'Liderança' },
  { row: 'is_favorite', db: 'is_favorite', type: 'bool', label: 'Favorito' },
  { row: 'ultimo_contato', db: 'ultimo_contato', type: 'text', label: 'Último contato' },
];

function computeRowDiff(
  existing: Record<string, unknown>,
  normalized: Record<string, unknown>
): { payload: Record<string, unknown>; changedLabels: string[] } {
  const payload: Record<string, unknown> = {};
  const changedLabels: string[] = [];
  for (const { row, db, type, label } of FIELD_MAP) {
    const newVal = normalized[row];
    // Só consideramos campos com valor não-vazio na planilha —
    // planilha vazia NUNCA sobrescreve o banco.
    if (newVal === undefined || newVal === null || newVal === '') continue;

    const oldVal = existing[db];
    let changed = false;
    if (type === 'bool') {
      changed = Boolean(newVal) !== Boolean(oldVal);
    } else if (type === 'number') {
      changed = Number(newVal) !== Number(oldVal ?? NaN);
    } else {
      const nStr = String(newVal).trim();
      const oStr = String(oldVal ?? '').trim();
      changed = nStr !== oStr;
    }
    if (changed) {
      payload[db] = newVal;
      changedLabels.push(label);
    }
  }
  return { payload, changedLabels };
}

function parseTagNames(raw: unknown): string[] {
  const s = String(raw ?? '').trim();
  if (!s) return [];
  return s.split(',').map((t) => t.trim()).filter(Boolean);
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
  mapping: '',
  preview: '',
  preparing: 'Preparando...',
  creating: 'Criando novos contatos...',
  updating: 'Atualizando existentes...',
  tags: 'Processando etiquetas...',
  done: 'Concluído!',
};

const PHASE_PROGRESS: Record<Phase, number> = {
  idle: 0,
  mapping: 0,
  preview: 0,
  preparing: 10,
  creating: 40,
  updating: 70,
  tags: 90,
  done: 100,
};

// Chave para persistir o estado da importação em sessionStorage.
// Sobrevive a Alt+Tab, mudança de rota, F5 acidental — qualquer cenário em
// que o componente desmonta sem o usuário ter explicitamente fechado o
// dialog. Limite de ~4.5MB para caber em quotas típicas (5-10MB) — para
// arquivos maiores, salvamos só o mapping de colunas (re-upload necessário).
const STORAGE_KEY = 'mdesk:contact-import-state-v1';
const STORAGE_LIMIT_BYTES = 4_500_000;

export function ContactImportDialog({ open, onOpenChange, onSuccess }: ContactImportDialogProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [stats, setStats] = useState<ImportStats>({ created: 0, updated: 0, duplicates: 0, skipped: 0, errors: 0 });
  const [errors, setErrors] = useState<{ line: number; message: string; raw?: Record<string, string> }[]>([]);
  const [fileName, setFileName] = useState('');
  // Estado da fase 'mapping': dados brutos do arquivo + conciliação de
  // colunas (a planilha pode ter cabeçalhos diferentes do template).
  const [rawSheet, setRawSheet] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState<{ fileHeader: string; systemField: string }[]>([]);
  const [restored, setRestored] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Persistência: restaura estado do sessionStorage quando o dialog abre ---
  useEffect(() => {
    if (!open || restored) return;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) { setRestored(true); return; }
      const s = JSON.parse(raw);
      if (s.phase && s.phase !== 'idle' && s.phase !== 'done') {
        if (s.fileName) setFileName(s.fileName);
        if (Array.isArray(s.columnMapping)) setColumnMapping(s.columnMapping);
        if (Array.isArray(s.rawSheet) && s.rawSheet.length > 0) setRawSheet(s.rawSheet);
        if (Array.isArray(s.parsedRows) && s.parsedRows.length > 0) setParsedRows(s.parsedRows);
        setPhase(s.phase);
        const msg = s.rawSheet?.length
          ? 'Estado anterior da importação restaurado'
          : `Mapeamento de "${s.fileName}" restaurado — re-upload do arquivo para continuar`;
        toast.success(msg);
      }
    } catch {
      // estado corrompido — ignora
    } finally {
      setRestored(true);
    }
  }, [open, restored]);

  // --- Persistência: salva mudanças no sessionStorage durante o trabalho ---
  useEffect(() => {
    if (!open) return;
    if (phase === 'idle' || phase === 'done') {
      try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
      return;
    }
    // Tenta salvar o estado completo; se exceder a quota, fallback p/ só
    // metadata (fileName + columnMapping) — usuário re-upload o arquivo
    // mas não precisa remapear as colunas.
    try {
      const full = JSON.stringify({ phase, fileName, columnMapping, rawSheet, parsedRows });
      if (full.length <= STORAGE_LIMIT_BYTES) {
        sessionStorage.setItem(STORAGE_KEY, full);
        return;
      }
    } catch { /* fall through */ }
    try {
      const lite = JSON.stringify({ phase: 'idle', fileName, columnMapping, rawSheet: [], parsedRows: [] });
      sessionStorage.setItem(STORAGE_KEY, lite);
    } catch { /* desiste */ }
  }, [open, phase, fileName, columnMapping, rawSheet, parsedRows]);

  const reset = () => {
    setPhase('idle');
    setParsedRows([]);
    setStats({ created: 0, updated: 0, duplicates: 0, skipped: 0, errors: 0 });
    setErrors([]);
    setFileName('');
    setRawSheet([]);
    setColumnMapping([]);
    setRestored(false);
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
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
  // Passo 1: abre o arquivo e determina o mapeamento de colunas. Se todas
  // forem auto-detectadas, vai direto p/ preview. Se houver qualquer coluna
  // com cabeçalho desconhecido, entra na fase 'mapping' para o usuário
  // conciliar manualmente.
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    try {
      const XLSX = await import('xlsx');
      const data = new Uint8Array(await file.arrayBuffer());
      const workbook = XLSX.read(data, { type: 'array' });

      const sheetName = workbook.SheetNames.find(
        (n) => n.toLowerCase() !== 'instruções' && n.toLowerCase() !== 'instrucoes'
      ) ?? workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rawRows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      if (rawRows.length < 2) {
        toast.error('Arquivo vazio ou sem dados');
        return;
      }

      // Auto-detecção por HEADER_MAP (cabeçalhos normalizados em lowercase_underscore)
      const headerRow = rawRows[0].map((h) => String(h).trim());
      const mapping = headerRow.map((h) => {
        const norm = h.toLowerCase().replace(/\s+/g, '_');
        const guess = HEADER_MAP[norm];
        return { fileHeader: h, systemField: guess ?? '__ignore__' };
      });

      setRawSheet(rawRows);
      setColumnMapping(mapping);

      const unmapped = mapping.filter((m) => m.systemField === '__ignore__');
      const allAutoMapped = unmapped.length === 0;

      if (allAutoMapped) {
        // Tudo bateu com template — segue direto
        applyMappingAndPreview(rawRows, mapping);
        toast.success(`${rawRows.length - 1} linhas carregadas de "${file.name}"`);
      } else {
        // Pede confirmação do usuário
        setPhase('mapping');
        toast.info(
          `${unmapped.length} coluna${unmapped.length > 1 ? 's' : ''} não reconhecida${unmapped.length > 1 ? 's' : ''} — confirme o mapeamento`
        );
      }
    } catch (err: any) {
      toast.error(`Erro ao ler arquivo: ${err?.message ?? 'desconhecido'}`);
    }

    e.target.value = '';
  };

  // Passo 2: aplica um mapeamento de colunas (dicionário fileHeader → campo
  // de sistema) em cima do rawSheet e produz parsedRows. Idempotente — pode
  // ser chamado novamente se o usuário quiser re-mapear.
  const applyMappingAndPreview = (
    sheet: string[][],
    mapping: { fileHeader: string; systemField: string }[]
  ) => {
    const rows: ParsedRow[] = [];
    for (let i = 1; i < sheet.length; i++) {
      const cells = sheet[i];
      if (!cells || cells.every((c) => !String(c).trim())) continue;

      const raw: Record<string, string> = {};
      const normalized: Record<string, unknown> = {};

      mapping.forEach((m, idx) => {
        if (!m.systemField || m.systemField === '__ignore__') return;
        const value = String(cells[idx] ?? '').trim();
        if (!value) return;
        raw[m.systemField] = value;
      });

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

      ['nome_whatsapp', 'endereco', 'numero', 'complemento', 'bairro', 'cidade', 'uf', 'cep', 'origem', 'observacoes', 'notas_assessor', 'etiquetas', 'data_nascimento', 'instagram', 'twitter', 'tiktok', 'youtube', 'leader_id', 'ultimo_contato'].forEach((f) => {
        if (raw[f]) normalized[f] = raw[f];
      });

      rows.push({ lineNumber: i + 1, raw, normalized });
    }

    setParsedRows(rows);
    setPhase('preview');
  };

  const confirmMapping = () => {
    // Validação mínima: precisa ter nome_completo
    const hasNome = columnMapping.some((m) => m.systemField === 'nome_completo');
    if (!hasNome) {
      toast.error('Aponte pelo menos uma coluna para "Nome completo *" antes de continuar');
      return;
    }
    // Avisa sobre colisões (2+ colunas mapeando para o mesmo campo) — último vence
    const fieldCounts = new Map<string, number>();
    for (const m of columnMapping) {
      if (m.systemField === '__ignore__') continue;
      fieldCounts.set(m.systemField, (fieldCounts.get(m.systemField) ?? 0) + 1);
    }
    const collisions = [...fieldCounts.entries()].filter(([, c]) => c > 1).map(([f]) => f);
    if (collisions.length > 0) {
      toast.error(`Há ${collisions.length} campo(s) com mais de uma coluna apontada: ${collisions.join(', ')}. Corrija antes de continuar.`);
      return;
    }
    applyMappingAndPreview(rawSheet, columnMapping);
    toast.success(`${rawSheet.length - 1} linhas preparadas — revise o preview`);
  };

  const updateMapping = (index: number, systemField: string) => {
    setColumnMapping((prev) => prev.map((m, i) => (i === index ? { ...m, systemField } : m)));
  };

  // --- Import ---
  const handleImport = async () => {
    if (parsedRows.length === 0) return;
    const importErrors: { line: number; message: string; raw?: Record<string, string> }[] = [];
    const importStats: ImportStats = { created: 0, updated: 0, duplicates: 0, skipped: 0, errors: 0 };

    // Phase 1: Prepare
    setPhase('preparing');
    const existingById = new Map<string, Record<string, unknown>>(); // id -> contato completo
    const existingByKey = new Map<string, string>(); // phoneKey -> id
    const existingTags = new Map<string, string>(); // tag name (lower) -> tag id
    const tagsByContact = new Map<string, Set<string>>(); // contact id -> set de tag names (lower)

    try {
      // 1. Contatos existentes — dados completos, paginado p/ atravessar bases grandes
      let offset = 0;
      while (true) {
        const { data, error } = await supabase
          .from('contacts')
          .select('*')
          .range(offset, offset + 999);
        if (error) throw error;
        if (!data || data.length === 0) break;
        for (const c of data) {
          existingById.set(c.id, c as Record<string, unknown>);
          const wk = phoneComparisonKey(c.whatsapp);
          const tk = phoneComparisonKey(c.telefone);
          if (wk && !existingByKey.has(wk)) existingByKey.set(wk, c.id);
          if (tk && !existingByKey.has(tk)) existingByKey.set(tk, c.id);
        }
        if (data.length < 1000) break;
        offset += 1000;
      }

      // 2. Tags já existentes (catálogo)
      const { data: tags } = await supabase.from('tags').select('id, nome');
      (tags ?? []).forEach((t) => existingTags.set(t.nome.toLowerCase(), t.id));

      // 3. Tags ligadas a cada contato — usado p/ detectar se a etiqueta da
      //    planilha é realmente nova ou já está no contato.
      offset = 0;
      while (true) {
        const { data, error } = await supabase
          .from('contact_tags')
          .select('contact_id, tags!inner(nome)')
          .range(offset, offset + 999);
        if (error) throw error;
        if (!data || data.length === 0) break;
        for (const row of data as Array<{ contact_id: string; tags: { nome: string } | { nome: string }[] }>) {
          const tagObj = Array.isArray(row.tags) ? row.tags[0] : row.tags;
          const tagName = tagObj?.nome?.toLowerCase();
          if (!tagName) continue;
          const set = tagsByContact.get(row.contact_id) ?? new Set<string>();
          set.add(tagName);
          tagsByContact.set(row.contact_id, set);
        }
        if (data.length < 1000) break;
        offset += 1000;
      }
    } catch (err: any) {
      toast.error(`Erro ao preparar importação: ${err.message ?? 'desconhecido'}`);
      setPhase('idle');
      return;
    }

    // 1ª passada: valida schema por linha e descobre grupos de linhas que
    // apontam p/ o mesmo contato (mesma chave normalizada dentro da planilha).
    // Linhas duplicadas dentro do arquivo precisam ser MESCLADAS (e não
    // simplesmente puladas), senão perdemos dados novos que aparecem só na
    // 2ª/3ª ocorrência.
    type PreparedRow = { row: ParsedRow; key: string };
    const prepared: PreparedRow[] = [];
    for (const row of parsedRows) {
      const result = importContactSchema.safeParse(row.normalized);
      if (!result.success) {
        const msg = result.error.issues.map((i) => i.message).join(', ');
        importErrors.push({ line: row.lineNumber, message: msg, raw: row.raw });
        importStats.errors++;
        row.action = 'skip';
        continue;
      }
      const key = phoneComparisonKey(String(row.normalized.whatsapp ?? ''));
      prepared.push({ row, key });
    }

    // Agrupa por chave de telefone. Linhas sem whatsapp cada uma vira um grupo
    // próprio (não dá pra mesclar sem identificador único).
    const groupsByKey = new Map<string, PreparedRow[]>();
    const lonely: PreparedRow[] = [];
    for (const p of prepared) {
      if (!p.key) { lonely.push(p); continue; }
      const arr = groupsByKey.get(p.key) ?? [];
      arr.push(p);
      groupsByKey.set(p.key, arr);
    }

    // Mescla um grupo de linhas em um único row consolidado: último valor
    // não-vazio ganha; etiquetas são a união.
    const mergeGroup = (group: PreparedRow[]): ParsedRow => {
      if (group.length === 1) return group[0].row;
      const head = group[0].row;
      const merged: Record<string, unknown> = { ...head.normalized };
      const tagSet = new Set<string>(parseTagNames(head.normalized.etiquetas));
      for (let i = 1; i < group.length; i++) {
        const r = group[i].row;
        for (const [k, v] of Object.entries(r.normalized)) {
          if (k === 'etiquetas') continue;
          if (v === undefined || v === null || v === '') continue;
          merged[k] = v;
        }
        parseTagNames(r.normalized.etiquetas).forEach((t) => tagSet.add(t));
        // Marca as linhas subsequentes como 'skip' (duplicadas do arquivo);
        // os dados delas já foram absorvidos pelo row consolidado.
        r.action = 'skip';
        importStats.skipped++;
      }
      if (tagSet.size > 0) merged.etiquetas = [...tagSet].join(',');
      return { ...head, normalized: merged };
    };

    const validRows: ParsedRow[] = [];

    // Decide ação de cada linha consolidada
    const processRow = (row: ParsedRow, key: string) => {
      const existingId = key ? existingByKey.get(key) : undefined;
      if (!existingId) {
        row.action = 'create';
        validRows.push(row);
        return;
      }

      // Já existe: compara campos + etiquetas p/ decidir "duplicate" x "update"
      const existing = existingById.get(existingId) ?? {};
      const { payload, changedLabels } = computeRowDiff(existing, row.normalized);

      const currentTags = tagsByContact.get(existingId) ?? new Set<string>();
      const rowTagNames = parseTagNames(row.normalized.etiquetas);
      const newTagNames = rowTagNames.filter((n) => !currentTags.has(n.toLowerCase()));

      row.matchedContact = {
        id: existingId,
        nome: String(existing.nome ?? ''),
        whatsapp: (existing.whatsapp as string | null) ?? null,
      };

      if (Object.keys(payload).length === 0 && newTagNames.length === 0) {
        row.action = 'duplicate';
        importStats.duplicates++;
      } else {
        row.action = 'update';
        row.updatePayload = payload;
        row.newTagNames = newTagNames;
        const bits: string[] = [];
        if (changedLabels.length > 0) bits.push(changedLabels.join(', '));
        if (newTagNames.length > 0) {
          bits.push(`${newTagNames.length} etiqueta${newTagNames.length > 1 ? 's' : ''} nova${newTagNames.length > 1 ? 's' : ''}`);
        }
        row.changeSummary = bits.join(' · ');
        importStats.updated++;
        validRows.push(row);
      }
    };

    // Grupos com whatsapp
    for (const [key, group] of groupsByKey.entries()) {
      const consolidated = mergeGroup(group);
      processRow(consolidated, key);
    }

    // Linhas sem whatsapp: sem chave = sempre create (schema já exige whatsapp,
    // então na prática isso vira erro de validação; defensivo).
    for (const p of lonely) {
      processRow(p.row, '');
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
          // whatsapp é opcional — vazio vira null para respeitar unique/null
          whatsapp: n.whatsapp && String(n.whatsapp).trim() !== '' ? n.whatsapp : null,
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
          importErrors.push({ line: r.lineNumber, message: error.message, raw: r.raw });
          importStats.errors++;
        });
      } else {
        importStats.created += (created?.length ?? 0);
        // Track new IDs for tag linking (keyed pela chave normalizada)
        (created ?? []).forEach((c) => {
          const key = phoneComparisonKey(c.whatsapp);
          if (key) existingByKey.set(key, c.id);
        });
      }
    }

    // Phase 3: Update existing contacts — aplica SÓ o delta já calculado.
    // (updated foi incrementado na decisão; aqui só aplica e coleta erros.)
    setPhase('updating');
    const toUpdate = validRows.filter((r) => r.action === 'update' && Object.keys(r.updatePayload ?? {}).length > 0);
    const UPDATE_PARALLEL = 20;
    for (let i = 0; i < toUpdate.length; i += UPDATE_PARALLEL) {
      const group = toUpdate.slice(i, i + UPDATE_PARALLEL);
      await Promise.all(
        group.map(async (row) => {
          const key = phoneComparisonKey(String(row.normalized.whatsapp ?? ''));
          const contactId = key ? existingByKey.get(key) : undefined;
          const payload = row.updatePayload ?? {};
          if (!contactId || Object.keys(payload).length === 0) return;

          const { error } = await supabase.from('contacts').update(payload).eq('id', contactId);
          if (error) {
            importErrors.push({ line: row.lineNumber, message: error.message, raw: row.raw });
            importStats.errors++;
            importStats.updated--; // reverte o incremento feito na decisão
          }
        })
      );
    }

    // Phase 4: Tags — batch em 2 passos
    //   (a) cria todas as tags ausentes de uma só vez;
    //   (b) upsert das ligações contact_tags em lotes.
    // Criamos tags para qualquer row não-skippada que tenha etiquetas na
    // planilha (create/update/duplicate — upsert pula links já existentes).
    setPhase('tags');

    const { data: geralGroup } = await supabase
      .from('tag_groups')
      .select('id')
      .eq('slug', 'geral')
      .single();
    const geralGroupId = geralGroup?.id;

    // (a) descobre nomes de tags que ainda não existem no catálogo
    const allRequestedTagNames = new Set<string>();
    for (const row of validRows) {
      if (row.action === 'skip') continue;
      parseTagNames(row.normalized.etiquetas).forEach((n) => allRequestedTagNames.add(n));
    }
    // Também precisamos considerar rows 'duplicate' — elas não viraram validRows,
    // então re-iteramos parsedRows para pegar suas etiquetas (se algum dia a
    // planilha tiver tags "novas" em contatos duplicados, isso cobre).
    for (const row of parsedRows) {
      if (row.action !== 'duplicate') continue;
      parseTagNames(row.normalized.etiquetas).forEach((n) => allRequestedTagNames.add(n));
    }

    const missingTagNames = [...allRequestedTagNames].filter(
      (n) => !existingTags.has(n.toLowerCase())
    );
    if (missingTagNames.length > 0) {
      const newTagRows = missingTagNames.map((nome) => ({ nome, group_id: geralGroupId }));
      const { data: newTags, error: createTagsErr } = await supabase
        .from('tags')
        .insert(newTagRows)
        .select('id, nome');
      if (createTagsErr) {
        importErrors.push({ line: 0, message: `Erro ao criar etiquetas novas: ${createTagsErr.message}` });
      } else {
        (newTags ?? []).forEach((t) => existingTags.set(t.nome.toLowerCase(), t.id));
      }
    }

    // (b) monta lista de pares (contact_id, tag_id) e faz upsert em lotes
    const linkPairs: { contact_id: string; tag_id: string }[] = [];
    for (const row of parsedRows) {
      if (row.action !== 'create' && row.action !== 'update') continue;
      const key = phoneComparisonKey(String(row.normalized.whatsapp ?? ''));
      const contactId = key ? existingByKey.get(key) : undefined;
      if (!contactId) continue;

      const tagNames = parseTagNames(row.normalized.etiquetas);
      for (const name of tagNames) {
        const tagId = existingTags.get(name.toLowerCase());
        if (tagId) linkPairs.push({ contact_id: contactId, tag_id: tagId });
      }
    }

    const TAG_BATCH = 1000;
    for (let i = 0; i < linkPairs.length; i += TAG_BATCH) {
      const batch = linkPairs.slice(i, i + TAG_BATCH);
      const { error } = await supabase
        .from('contact_tags')
        .upsert(batch, { onConflict: 'contact_id,tag_id' });
      if (error) {
        importErrors.push({ line: 0, message: `Erro ao vincular etiquetas (lote ${i}): ${error.message}` });
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

  /**
   * Baixa um XLSX contendo TODOS os erros com os dados originais de cada
   * linha + uma coluna "erro" com o motivo + uma coluna "linha_original"
   * pra referência. O arquivo segue o mesmo layout do template, então
   * depois de corrigir os erros você pode reimportar direto.
   */
  const downloadErrors = async () => {
    if (errors.length === 0) {
      toast.error('Nenhum erro para baixar');
      return;
    }
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();

    const headers = [
      'erro', 'linha_original',
      'nome_completo', 'nome_whatsapp', 'whatsapp', 'canal_whatsapp', 'receber_whatsapp',
      'multiplicador', 'email', 'telefone', 'genero', 'data_nascimento',
      'endereco', 'numero', 'complemento', 'bairro', 'cidade', 'uf', 'cep',
      'instagram', 'twitter', 'tiktok', 'youtube',
      'declarou_voto', 'ranking', 'leader_id', 'favorito',
      'origem', 'observacoes', 'notas_assessor', 'ultimo_contato', 'etiquetas',
    ];

    const rows = errors.map((e) => {
      const raw = e.raw ?? {};
      return [
        e.message,
        e.line,
        raw.nome_completo ?? '',
        raw.nome_whatsapp ?? '',
        raw.whatsapp ?? '',
        raw.canal_whatsapp ?? '',
        raw.receber_whatsapp ?? '',
        raw.multiplicador ?? '',
        raw.email ?? '',
        raw.telefone ?? '',
        raw.genero ?? '',
        raw.data_nascimento ?? '',
        raw.endereco ?? '',
        raw.numero ?? '',
        raw.complemento ?? '',
        raw.bairro ?? '',
        raw.cidade ?? '',
        raw.uf ?? '',
        raw.cep ?? '',
        raw.instagram ?? '',
        raw.twitter ?? '',
        raw.tiktok ?? '',
        raw.youtube ?? '',
        raw.declarou_voto ?? '',
        raw.ranking ?? '',
        raw.leader_id ?? '',
        raw.is_favorite ?? '',
        raw.origem ?? '',
        raw.observacoes ?? '',
        raw.notas_assessor ?? '',
        raw.ultimo_contato ?? '',
        raw.etiquetas ?? '',
      ];
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = headers.map((h) => ({ wch: h === 'erro' ? 40 : 18 }));
    XLSX.utils.book_append_sheet(wb, ws, 'Erros');

    const baseName = fileName.replace(/\.(xlsx|xls|csv)$/i, '') || 'importacao';
    XLSX.writeFile(wb, `${baseName}_erros.xlsx`);
    toast.success(`${errors.length} erros exportados em ${baseName}_erros.xlsx`);
  };

  const totalValid = parsedRows.length;
  const totalInvalid = errors.length;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-3xl max-h-[85vh] overflow-y-auto"
        // Impede fechar acidentalmente ao clicar fora (Alt+Tab retornando o
        // foco ao browser, clique em barras de rolagem, etc.) ou ao apertar
        // Escape. O usuário fecha só via o X do dialog ou os botões
        // "Cancelar"/"Fechar" — para não perder o mapeamento/preview em
        // andamento.
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importar Contatos
          </DialogTitle>
          <DialogDescription>
            Importe contatos de um arquivo CSV ou XLSX. Se o WhatsApp já existir no sistema (em qualquer formato), o contato é atualizado. Contatos sem WhatsApp são criados mesmo assim.
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

        {/* Mapping: conciliação de colunas quando o arquivo tem cabeçalhos fora do padrão */}
        {phase === 'mapping' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="secondary">
                <FileSpreadsheet className="h-3 w-3 mr-1" />
                {fileName}
              </Badge>
              <Badge variant="outline">{rawSheet.length - 1} linhas</Badge>
            </div>

            <div className="text-sm text-muted-foreground space-y-1">
              <p>Algumas colunas do seu arquivo não foram reconhecidas automaticamente.</p>
              <p>Para cada uma, escolha a qual campo do sistema corresponde — ou marque <strong>"Ignorar"</strong> se a coluna não deve ser importada.</p>
              <p><strong>Nome completo *</strong> é obrigatório. WhatsApp é opcional — sem ele o contato é criado mas não dá para detectar duplicatas.</p>
            </div>

            <div className="max-h-[45vh] overflow-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-48">Coluna do arquivo</TableHead>
                    <TableHead className="w-40">Exemplo (linha 2)</TableHead>
                    <TableHead>Campo no sistema</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {columnMapping.map((m, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium text-sm break-all">{m.fileHeader || <span className="text-muted-foreground italic">(sem título)</span>}</TableCell>
                      <TableCell className="text-xs text-muted-foreground break-all max-w-[12rem]">
                        {rawSheet[1]?.[i] ? String(rawSheet[1][i]).slice(0, 40) : '—'}
                      </TableCell>
                      <TableCell>
                        <Select value={m.systemField} onValueChange={(v) => updateMapping(i, v)}>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SYSTEM_FIELDS.map((f) => (
                              <SelectItem key={f.value} value={f.value}>
                                {f.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-2">
              <Button onClick={confirmMapping} className="gap-2 w-full sm:w-auto">
                <CheckCircle className="h-4 w-4" />
                Confirmar mapeamento
              </Button>
              <Button variant="outline" onClick={reset} className="w-full sm:w-auto">
                Cancelar
              </Button>
            </div>
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
                    <TableHead className="hidden sm:table-cell">WhatsApp</TableHead>
                    <TableHead className="hidden md:table-cell">Email</TableHead>
                    <TableHead className="hidden lg:table-cell">Bairro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.slice(0, 5).map((row) => (
                    <TableRow key={row.lineNumber}>
                      <TableCell className="text-xs text-muted-foreground">{row.lineNumber}</TableCell>
                      <TableCell className="text-sm break-words max-w-[140px] sm:max-w-none">{String(row.normalized.nome_completo ?? '')}</TableCell>
                      <TableCell className="text-sm hidden sm:table-cell">{String(row.normalized.whatsapp ?? '')}</TableCell>
                      <TableCell className="text-sm hidden md:table-cell break-all">{String(row.normalized.email ?? '-')}</TableCell>
                      <TableCell className="text-sm hidden lg:table-cell">{String(row.normalized.bairro ?? '-')}</TableCell>
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

            <div className="flex flex-col-reverse sm:flex-row gap-2">
              <Button onClick={handleImport} className="gap-2 w-full sm:w-auto">
                <Upload className="h-4 w-4" />
                Importar {totalValid} contatos
              </Button>
              <Button variant="outline" onClick={reset} className="w-full sm:w-auto">
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

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-700">{stats.created}</p>
                <p className="text-xs text-green-600">Criados</p>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-700">{stats.updated}</p>
                <p className="text-xs text-blue-600">Atualizados</p>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded-lg">
                <p className="text-2xl font-bold text-orange-700">{stats.duplicates}</p>
                <p className="text-xs text-orange-600">Duplicados</p>
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

            {/* Updated rows (o que mudou) */}
            {parsedRows.some((r) => r.action === 'update') && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-blue-700">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    {parsedRows.filter((r) => r.action === 'update').length} contatos atualizados
                  </span>
                </div>
                <div className="max-h-40 overflow-auto border border-blue-200 rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs w-14">Linha</TableHead>
                        <TableHead className="text-xs">Contato (banco)</TableHead>
                        <TableHead className="text-xs">O que mudou</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedRows
                        .filter((r) => r.action === 'update')
                        .slice(0, 50)
                        .map((r, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-xs w-14">{r.lineNumber}</TableCell>
                            <TableCell className="text-sm">
                              <div className="font-medium">{r.matchedContact?.nome ?? String(r.normalized.nome_completo ?? '')}</div>
                              <div className="text-xs text-muted-foreground">{r.matchedContact?.whatsapp ?? '—'}</div>
                            </TableCell>
                            <TableCell className="text-xs text-blue-700">{r.changeSummary ?? '—'}</TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Duplicados */}
            {parsedRows.some((r) => r.action === 'duplicate') && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-orange-700">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    {parsedRows.filter((r) => r.action === 'duplicate').length} duplicados ignorados — todos os campos da planilha já estavam idênticos no banco
                  </span>
                </div>
                <div className="max-h-40 overflow-auto border border-orange-200 rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs w-14">Linha</TableHead>
                        <TableHead className="text-xs">Da planilha</TableHead>
                        <TableHead className="text-xs">Já existia no banco</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedRows
                        .filter((r) => r.action === 'duplicate')
                        .slice(0, 50)
                        .map((r, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-xs w-14">{r.lineNumber}</TableCell>
                            <TableCell className="text-sm">
                              <div>{String(r.normalized.nome_completo ?? '')}</div>
                              <div className="text-xs text-muted-foreground">{String(r.normalized.whatsapp ?? '')}</div>
                            </TableCell>
                            <TableCell className="text-sm">
                              <div className="font-medium">{r.matchedContact?.nome ?? '—'}</div>
                              <div className="text-xs text-muted-foreground">{r.matchedContact?.whatsapp ?? '—'}</div>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Errors list */}
            {errors.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 text-red-600">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">{errors.length} erros</span>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button variant="default" size="sm" onClick={downloadErrors} className="gap-2">
                      <Download className="h-3 w-3" />
                      Baixar planilha com erros
                    </Button>
                    <Button variant="outline" size="sm" onClick={copyErrors} className="gap-2">
                      <ClipboardCopy className="h-3 w-3" />
                      Copiar
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  A planilha baixada tem todas as {errors.length} linhas com uma coluna "erro" + os dados originais.
                  Depois de corrigir, você pode reimportar esse mesmo arquivo direto.
                </p>
                <div className="max-h-40 overflow-auto border rounded-lg">
                  <Table>
                    <TableBody>
                      {errors.slice(0, 100).map((e, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs w-16">{e.line > 0 ? `Linha ${e.line}` : '—'}</TableCell>
                          <TableCell className="text-xs">
                            {e.raw?.nome_completo ? (
                              <span className="text-muted-foreground mr-2">{e.raw.nome_completo}</span>
                            ) : null}
                            <span className="text-red-600">{e.message}</span>
                          </TableCell>
                        </TableRow>
                      ))}
                      {errors.length > 100 && (
                        <TableRow>
                          <TableCell colSpan={2} className="text-xs text-center text-muted-foreground py-2">
                            ...e mais {errors.length - 100} erros — baixe a planilha para ver todos
                          </TableCell>
                        </TableRow>
                      )}
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
