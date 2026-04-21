import { useCallback, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Copy, Key, Loader2, RefreshCw, Trash2, Check, Clock,
  Play, Send, Terminal, FileJson, CheckCircle2, XCircle, AlertCircle,
} from 'lucide-react';
import { useApiToken, useGenerateToken, useRevokeToken } from '@/hooks/useApiTokens';
import { toast } from 'sonner';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://SEU-PROJETO.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
const BASE_API_URL = `${SUPABASE_URL}/functions/v1/api-proxy`;

// ---- Tipos ----

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type Resource = 'contacts' | 'demands' | 'tags';

interface Endpoint {
  method: HttpMethod;
  path: string;
  description: string;
  body?: string;
}

interface PlaygroundResponse {
  status: number;
  statusText: string;
  body: unknown;
  duration: number;
}

// ---- Dados de exemplo por recurso ----

const exampleBodies: Record<Resource, Record<string, string>> = {
  contacts: {
    POST: JSON.stringify({
      name: 'Joao Silva',
      phone: '(11) 99999-9999',
      email: 'joao@email.com',
      city: 'Sao Paulo',
      state: 'SP',
      neighborhood: 'Centro',
      board_id: '(opcional) UUID ou nome do board — ex: Prospecção',
      stage_id: '(opcional) UUID ou nome da etapa — ex: Em andamento',
    }, null, 2),
    PATCH: JSON.stringify({
      phone: '(11) 88888-8888',
      neighborhood: 'Jardim Paulista',
      board_id: '(opcional) UUID ou nome do board — ex: Seguidores',
      stage_id: '(opcional) UUID ou nome da etapa — ex: Preencheu Formulário',
    }, null, 2),
    PUT: JSON.stringify({
      phone: '(11) 88888-8888',
      neighborhood: 'Jardim Paulista',
      board_id: '(opcional) UUID ou nome do board — ex: Seguidores',
      stage_id: '(opcional) UUID ou nome da etapa — ex: Preencheu Formulário',
    }, null, 2),
  },
  demands: {
    POST: JSON.stringify({
      title: 'Buraco na rua',
      description: 'Buraco na Rua XV de Novembro, esquina com Av. Brasil',
      priority: 'high',
      status: 'open',
    }, null, 2),
    PATCH: JSON.stringify({
      status: 'in_progress',
    }, null, 2),
    PUT: JSON.stringify({
      status: 'in_progress',
    }, null, 2),
  },
  tags: {
    POST: JSON.stringify({
      name: 'Saúde',
      category: 'demands',
      color: '#EF4444',
    }, null, 2),
    PATCH: JSON.stringify({
      color: '#3B82F6',
    }, null, 2),
    PUT: JSON.stringify({
      color: '#3B82F6',
    }, null, 2),
  },
};

const byPhoneBodies = {
  PATCH: JSON.stringify({
    notes: 'ja convertido',
    source: 'instagram',
    board_id: 'Prospecção',
    stage_id: 'Em andamento',
  }, null, 2),
}

// Body exemplo para os outros lookups — so com board/stage (movimentar card)
const byLookupBodyMove = JSON.stringify({
  board_id: 'Seguidores',
  stage_id: 'Preencheu Formulário',
}, null, 2)

const resourceLabels: Record<Resource, string> = {
  contacts: 'Contatos',
  demands: 'Demandas',
  tags: 'Etiquetas',
};

const methodDescriptions: Record<HttpMethod, string> = {
  GET: 'Listar / Buscar',
  POST: 'Criar novo',
  PUT: 'Atualizar (PUT)',
  PATCH: 'Atualizar (PATCH)',
  DELETE: 'Excluir',
};

const needsId = (method: HttpMethod) => method === 'PATCH' || method === 'PUT' || method === 'DELETE';
const canHaveId = (method: HttpMethod) => method === 'GET' || needsId(method);
const hasBody = (method: HttpMethod) => method === 'POST' || method === 'PATCH' || method === 'PUT';

// ---- Endpoints de documentacao ----

const endpointGroups: { title: string; endpoints: Endpoint[] }[] = [
  {
    title: 'Contatos',
    endpoints: [
      { method: 'GET', path: '/contacts', description: 'Listar todos os contatos (aceita ?limit, ?offset, ?search)' },
      { method: 'GET', path: '/contacts/{id}', description: 'Buscar um contato pelo ID' },
      { method: 'POST', path: '/contacts', description: 'Criar um novo contato', body: exampleBodies.contacts.POST },
      { method: 'PATCH', path: '/contacts/{id}', description: 'Atualizar um contato e/ou mover o card no Kanban (board_id + stage_id opcionais)', body: exampleBodies.contacts.PATCH },
      { method: 'PUT', path: '/contacts/{id}', description: 'Atualizar um contato e/ou mover o card no Kanban (alias de PATCH)', body: exampleBodies.contacts.PUT },
      { method: 'DELETE', path: '/contacts/{id}', description: 'Excluir um contato' },
    ],
  },
  {
    title: 'Contatos — lookup alternativo (sem precisar do UUID)',
    endpoints: [
      {
        method: 'PATCH' as HttpMethod,
        path: '/contacts/by-phone/{telefone}',
        description: 'Atualizar contato pelo telefone e/ou mover o card no Kanban. Telefone normalizado automaticamente (+55, espaços, parênteses e hífens removidos).',
        body: byPhoneBodies.PATCH,
      },
      {
        method: 'PUT' as HttpMethod,
        path: '/contacts/by-phone/{telefone}',
        description: 'Alias de PATCH para sistemas que só enviam PUT.',
        body: byPhoneBodies.PATCH,
      },
      {
        method: 'PATCH' as HttpMethod,
        path: '/contacts/by-instagram/{handle}',
        description: 'Atualizar contato pelo @ do Instagram. O @ inicial é removido automaticamente. Match exato.',
        body: byLookupBodyMove,
      },
      {
        method: 'PUT' as HttpMethod,
        path: '/contacts/by-instagram/{handle}',
        description: 'Alias de PATCH para sistemas que só enviam PUT.',
        body: byLookupBodyMove,
      },
      {
        method: 'PATCH' as HttpMethod,
        path: '/contacts/by-name/{nome}',
        description: 'Atualizar contato pelo nome completo (match exato, case-insensitive). Se mais de um contato tiver o mesmo nome, retorna 409 pedindo pra identificar por telefone, Instagram ou UUID.',
        body: byLookupBodyMove,
      },
      {
        method: 'PUT' as HttpMethod,
        path: '/contacts/by-name/{nome}',
        description: 'Alias de PATCH para sistemas que só enviam PUT.',
        body: byLookupBodyMove,
      },
    ],
  },
  {
    title: 'Demandas',
    endpoints: [
      { method: 'GET', path: '/demands', description: 'Listar todas as demandas (aceita ?limit, ?offset, ?search)' },
      { method: 'GET', path: '/demands/{id}', description: 'Buscar uma demanda pelo ID' },
      { method: 'POST', path: '/demands', description: 'Criar uma nova demanda', body: exampleBodies.demands.POST },
      { method: 'PATCH', path: '/demands/{id}', description: 'Atualizar uma demanda', body: exampleBodies.demands.PATCH },
      { method: 'PUT', path: '/demands/{id}', description: 'Atualizar uma demanda (alias de PATCH, para sistemas que so enviam PUT)', body: exampleBodies.demands.PUT },
      { method: 'DELETE', path: '/demands/{id}', description: 'Excluir uma demanda' },
    ],
  },
  {
    title: 'Etiquetas',
    endpoints: [
      { method: 'GET', path: '/tags', description: 'Listar todas as etiquetas (aceita ?search)' },
      { method: 'GET', path: '/tags/{id}', description: 'Buscar uma etiqueta pelo ID' },
      { method: 'POST', path: '/tags', description: 'Criar uma nova etiqueta', body: exampleBodies.tags.POST },
      { method: 'PATCH', path: '/tags/{id}', description: 'Atualizar uma etiqueta', body: exampleBodies.tags.PATCH },
      { method: 'PUT', path: '/tags/{id}', description: 'Atualizar uma etiqueta (alias de PATCH, para sistemas que so enviam PUT)', body: exampleBodies.tags.PUT },
      { method: 'DELETE', path: '/tags/{id}', description: 'Excluir uma etiqueta' },
    ],
  },
];

const methodColors: Record<string, string> = {
  GET: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  POST: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  PUT: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  PATCH: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  DELETE: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

const contactFields = [
  { campo: 'name', tipo: 'string', obrigatorio: true, descricao: 'Nome completo do contato' },
  { campo: 'phone', tipo: 'string', obrigatorio: false, descricao: 'Telefone/WhatsApp' },
  { campo: 'email', tipo: 'string', obrigatorio: false, descricao: 'E-mail' },
  { campo: 'cpf', tipo: 'string', obrigatorio: false, descricao: 'CPF' },
  { campo: 'birth_date', tipo: 'date', obrigatorio: false, descricao: 'Data de nascimento (YYYY-MM-DD)' },
  { campo: 'gender', tipo: 'string', obrigatorio: false, descricao: 'Gênero' },
  { campo: 'zip_code', tipo: 'string', obrigatorio: false, descricao: 'CEP' },
  { campo: 'address', tipo: 'string', obrigatorio: false, descricao: 'Logradouro' },
  { campo: 'number', tipo: 'string', obrigatorio: false, descricao: 'Número' },
  { campo: 'complement', tipo: 'string', obrigatorio: false, descricao: 'Complemento' },
  { campo: 'neighborhood', tipo: 'string', obrigatorio: false, descricao: 'Bairro' },
  { campo: 'city', tipo: 'string', obrigatorio: false, descricao: 'Cidade' },
  { campo: 'state', tipo: 'string', obrigatorio: false, descricao: 'Estado (UF)' },
  { campo: 'latitude', tipo: 'number', obrigatorio: false, descricao: 'Latitude' },
  { campo: 'longitude', tipo: 'number', obrigatorio: false, descricao: 'Longitude' },
  { campo: 'instagram', tipo: 'string', obrigatorio: false, descricao: 'Instagram' },
  { campo: 'facebook', tipo: 'string', obrigatorio: false, descricao: 'Facebook' },
  { campo: 'twitter', tipo: 'string', obrigatorio: false, descricao: 'Twitter/X' },
  { campo: 'declarou_voto', tipo: 'boolean', obrigatorio: false, descricao: 'Declarou voto' },
  { campo: 'is_favorite', tipo: 'boolean', obrigatorio: false, descricao: 'Favorito' },
  { campo: 'voter_registration', tipo: 'string', obrigatorio: false, descricao: 'Título de eleitor' },
  { campo: 'electoral_zone', tipo: 'string', obrigatorio: false, descricao: 'Zona eleitoral' },
  { campo: 'electoral_section', tipo: 'string', obrigatorio: false, descricao: 'Seção eleitoral' },
  { campo: 'political_group', tipo: 'string', obrigatorio: false, descricao: 'Grupo político' },
  { campo: 'notes', tipo: 'string', obrigatorio: false, descricao: 'Observações' },
  { campo: 'leader_id', tipo: 'uuid', obrigatorio: false, descricao: 'ID do articulador vinculado' },
  { campo: 'source', tipo: 'string', obrigatorio: false, descricao: 'Origem do contato' },
  { campo: 'occupation', tipo: 'string', obrigatorio: false, descricao: 'Profissão' },
  { campo: 'em_canal_whatsapp', tipo: 'boolean', obrigatorio: false, descricao: 'Está no canal do WhatsApp' },
  { campo: 'e_multiplicador', tipo: 'boolean', obrigatorio: false, descricao: 'É multiplicador' },
  { campo: 'board_id', tipo: 'uuid', obrigatorio: false, descricao: 'UUID ou nome do board — vincula o contato automaticamente (apenas POST)' },
  { campo: 'stage_id', tipo: 'uuid', obrigatorio: false, descricao: 'UUID ou nome da etapa do board. Se ausente, usa a primeira etapa' },
];

// ---- Metadados do builder de payload ----

type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'uuid';

interface FieldMeta {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  postOnly?: boolean;
  placeholder?: string;
}

const contactFieldsMeta: FieldMeta[] = contactFields.map((f) => ({
  key: f.campo,
  label: f.descricao,
  type: f.tipo as FieldType,
  required: f.obrigatorio,
  postOnly: f.campo === 'board_id' || f.campo === 'stage_id',
  placeholder:
    f.campo === 'board_id'
      ? 'UUID ou nome do board (ex: Prospecção)'
      : f.campo === 'stage_id'
        ? 'UUID ou nome da etapa (ex: Em andamento)'
        : f.tipo === 'uuid'
          ? '550e8400-e29b-41d4-a716-446655440000'
          : f.tipo === 'date'
            ? 'YYYY-MM-DD'
            : f.campo === 'phone'
              ? '(11) 99999-9999'
              : f.campo === 'email'
                ? 'nome@exemplo.com'
                : f.campo === 'latitude' || f.campo === 'longitude'
                  ? '0.000000'
                  : '',
}));

const fieldTypeBadgeClass: Record<FieldType, string> = {
  string: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
  number: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  boolean: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  date: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  uuid: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
};

function defaultValueFor(type: FieldType): string | number | boolean {
  switch (type) {
    case 'boolean':
      return false;
    case 'number':
      return '';
    default:
      return '';
  }
}

function fieldValueToJson(type: FieldType, raw: unknown): unknown {
  if (type === 'boolean') return Boolean(raw);
  if (type === 'number') {
    if (raw === '' || raw === null || raw === undefined) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : raw;
  }
  if (raw === undefined || raw === null) return '';
  return raw;
}

// ---- Componentes auxiliares ----

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopy}>
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}

function StatusBadge({ status }: { status: number }) {
  if (status >= 200 && status < 300) {
    return (
      <div className="flex items-center gap-1.5 text-green-600">
        <CheckCircle2 className="h-4 w-4" />
        <span className="font-mono font-bold">{status}</span>
        <span className="text-xs">Sucesso</span>
      </div>
    );
  }
  if (status >= 400 && status < 500) {
    return (
      <div className="flex items-center gap-1.5 text-yellow-600">
        <AlertCircle className="h-4 w-4" />
        <span className="font-mono font-bold">{status}</span>
        <span className="text-xs">{status === 401 ? 'Não autorizado' : status === 404 ? 'Não encontrado' : 'Erro do cliente'}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 text-red-600">
      <XCircle className="h-4 w-4" />
      <span className="font-mono font-bold">{status}</span>
      <span className="text-xs">Erro do servidor</span>
    </div>
  );
}

// ---- Payload Builder ----

interface PayloadBuilderProps {
  fields: FieldMeta[];
  method: HttpMethod;
  selection: Record<string, boolean>;
  values: Record<string, unknown>;
  onToggle: (key: string, checked: boolean) => void;
  onValueChange: (key: string, value: unknown) => void;
  onSelectAll: () => void;
  onClear: () => void;
}

function PayloadBuilder({
  fields,
  method,
  selection,
  values,
  onToggle,
  onValueChange,
  onSelectAll,
  onClear,
}: PayloadBuilderProps) {
  const visibleFields = fields.filter((f) => !f.postOnly || method === 'POST');
  const selectedCount = visibleFields.filter((f) => f.required || selection[f.key]).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Marque os campos que você vai enviar:</span>
          <Badge variant="secondary" className="text-[10px]">
            {selectedCount} de {visibleFields.length}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onSelectAll} className="h-7 text-xs">
            Marcar todos
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onClear} className="h-7 text-xs">
            Limpar
          </Button>
        </div>
      </div>

      <ScrollArea className="h-[360px] border rounded-md">
        <div className="p-2 space-y-1.5">
          {visibleFields.map((f) => {
            const isSelected = f.required || !!selection[f.key];
            return (
              <div
                key={f.key}
                className={`flex items-start gap-3 p-2 rounded-md transition-colors ${
                  isSelected ? 'bg-muted/60' : 'hover:bg-muted/30'
                }`}
              >
                <Checkbox
                  id={`fb-${f.key}`}
                  checked={isSelected}
                  disabled={f.required}
                  onCheckedChange={(c) => onToggle(f.key, c === true)}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0 space-y-2">
                  <Label
                    htmlFor={`fb-${f.key}`}
                    className={`flex items-center gap-2 flex-wrap ${f.required ? '' : 'cursor-pointer'}`}
                  >
                    <span className="font-mono text-xs">{f.key}</span>
                    {f.required && <span className="text-red-500 text-xs">*</span>}
                    <Badge className={`${fieldTypeBadgeClass[f.type]} text-[10px] px-1.5 py-0 font-normal`}>
                      {f.type}
                    </Badge>
                    {f.postOnly && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                        só POST
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground truncate">{f.label}</span>
                  </Label>
                  {isSelected && (
                    <FieldValueInput
                      field={f}
                      value={values[f.key]}
                      onChange={(v) => onValueChange(f.key, v)}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

function FieldValueInput({
  field,
  value,
  onChange,
}: {
  field: FieldMeta;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  if (field.type === 'boolean') {
    const checked = Boolean(value);
    return (
      <div className="flex items-center gap-2">
        <Switch checked={checked} onCheckedChange={onChange} />
        <span className="text-xs text-muted-foreground font-mono">
          {checked ? 'true' : 'false'}
        </span>
      </div>
    );
  }
  if (field.type === 'number') {
    return (
      <Input
        type="number"
        value={(value as string | number | undefined) ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        className="font-mono text-sm h-8"
      />
    );
  }
  if (field.type === 'date') {
    return (
      <Input
        type="date"
        value={(value as string | undefined) ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="font-mono text-sm h-8"
      />
    );
  }
  return (
    <Input
      value={(value as string | undefined) ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder}
      className="font-mono text-sm h-8"
    />
  );
}

// ---- Playground ----

function ApiPlayground({ tokenValue }: { tokenValue: string | null }) {
  const [resource, setResource] = useState<Resource>('contacts');
  const [method, setMethod] = useState<HttpMethod>('GET');
  const [resourceId, setResourceId] = useState('');
  const [queryParams, setQueryParams] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [response, setResponse] = useState<PlaygroundResponse | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Estado do builder de payload (contacts)
  const [contactsSelection, setContactsSelection] = useState<Record<string, boolean>>({});
  const [contactsValues, setContactsValues] = useState<Record<string, unknown>>({});

  const useBuilder = resource === 'contacts' && hasBody(method);

  // Atualizar body de exemplo ao trocar recurso/metodo
  const handleResourceChange = (val: Resource) => {
    setResource(val);
    setResponse(null);
    if (hasBody(method) && val !== 'contacts') {
      setBody(exampleBodies[val]?.[method] || '{}');
    }
  };

  const handleMethodChange = (val: HttpMethod) => {
    setMethod(val);
    setResponse(null);
    setJsonError(null);
    if (hasBody(val) && resource !== 'contacts') {
      setBody(exampleBodies[resource]?.[val] || '{}');
    } else if (!hasBody(val)) {
      setBody('');
    }
    if (!canHaveId(val)) {
      setResourceId('');
    }
  };

  const toggleContactField = useCallback((key: string, checked: boolean) => {
    setContactsSelection((prev) => ({ ...prev, [key]: checked }));
    setContactsValues((prev) => {
      if (!checked) return prev;
      if (prev[key] !== undefined) return prev;
      const meta = contactFieldsMeta.find((m) => m.key === key);
      if (!meta) return prev;
      return { ...prev, [key]: defaultValueFor(meta.type) };
    });
  }, []);

  const setContactFieldValue = useCallback((key: string, value: unknown) => {
    setContactsValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const selectAllContactFields = useCallback(() => {
    setContactsSelection(() => {
      const all: Record<string, boolean> = {};
      for (const meta of contactFieldsMeta) {
        if (meta.postOnly && method !== 'POST') continue;
        all[meta.key] = true;
      }
      return all;
    });
    setContactsValues((prev) => {
      const next = { ...prev };
      for (const meta of contactFieldsMeta) {
        if (meta.postOnly && method !== 'POST') continue;
        if (next[meta.key] === undefined) next[meta.key] = defaultValueFor(meta.type);
      }
      return next;
    });
  }, [method]);

  const clearContactFields = useCallback(() => {
    setContactsSelection({});
  }, []);

  // Validar JSON em tempo real
  const handleBodyChange = (val: string) => {
    setBody(val);
    if (!val.trim()) {
      setJsonError(null);
      return;
    }
    try {
      JSON.parse(val);
      setJsonError(null);
    } catch {
      setJsonError('JSON inválido');
    }
  };

  // Body derivado do builder (para contacts)
  const builderBody = useMemo(() => {
    if (!useBuilder) return null;
    const obj: Record<string, unknown> = {};
    for (const meta of contactFieldsMeta) {
      if (meta.postOnly && method !== 'POST') continue;
      const selected = meta.required || !!contactsSelection[meta.key];
      if (!selected) continue;
      obj[meta.key] = fieldValueToJson(meta.type, contactsValues[meta.key]);
    }
    return JSON.stringify(obj, null, 2);
  }, [useBuilder, method, contactsSelection, contactsValues]);

  const effectiveBody = useBuilder ? (builderBody ?? '') : body;

  // Construir URL final
  const fullUrl = useMemo(() => {
    let url = `${BASE_API_URL}/${resource}`;
    if (resourceId.trim() && canHaveId(method)) {
      url += `/${resourceId.trim()}`;
    }
    if (queryParams.trim() && method === 'GET') {
      url += `?${queryParams.trim()}`;
    }
    return url;
  }, [resource, method, resourceId, queryParams]);

  // Gerar curl
  const curlCommand = useMemo(() => {
    const parts = [`curl -X ${method} '${fullUrl}'`];
    parts.push(`  -H "apikey: ${SUPABASE_ANON_KEY || 'SUA_ANON_KEY'}"`);
    if (tokenValue) {
      parts.push(`  -H "Authorization: Bearer ${tokenValue}"`);
    } else {
      parts.push(`  -H "Authorization: Bearer SEU_TOKEN"`);
    }
    parts.push(`  -H "Content-Type: application/json"`);
    if (hasBody(method) && effectiveBody.trim()) {
      // Escapar aspas simples no body para o curl
      const escapedBody = effectiveBody.replace(/'/g, "'\\''");
      parts.push(`  -d '${escapedBody}'`);
    }
    return parts.join(' \\\n');
  }, [method, fullUrl, tokenValue, effectiveBody]);

  // Enviar requisicao real
  const handleSend = async () => {
    if (!tokenValue) {
      toast.error('Gere um token primeiro para testar a API');
      return;
    }

    if (hasBody(method) && effectiveBody.trim()) {
      try {
        JSON.parse(effectiveBody);
      } catch {
        toast.error('Corrija o JSON antes de enviar');
        return;
      }
    }

    if (needsId(method) && !resourceId.trim()) {
      toast.error('Informe o ID do registro para esta operação');
      return;
    }

    setSending(true);
    setResponse(null);
    const start = performance.now();

    try {
      const fetchOptions: RequestInit = {
        method,
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${tokenValue}`,
          'Content-Type': 'application/json',
        },
      };

      if (hasBody(method) && effectiveBody.trim()) {
        fetchOptions.body = effectiveBody;
      }

      const res = await fetch(fullUrl, fetchOptions);
      const duration = Math.round(performance.now() - start);

      let responseBody: unknown;
      const text = await res.text();
      try {
        responseBody = JSON.parse(text);
      } catch {
        responseBody = text;
      }

      setResponse({
        status: res.status,
        statusText: res.statusText,
        body: responseBody,
        duration,
      });
    } catch (err) {
      const duration = Math.round(performance.now() - start);
      setResponse({
        status: 0,
        statusText: 'Erro de rede',
        body: { error: err instanceof Error ? err.message : 'Falha na conexão' },
        duration,
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Terminal className="h-5 w-5" />
          Playground — Testar API
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Seletores de recurso e metodo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Recurso</Label>
            <Select value={resource} onValueChange={(v) => handleResourceChange(v as Resource)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(resourceLabels) as Resource[]).map((r) => (
                  <SelectItem key={r} value={r}>{resourceLabels[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Operação</Label>
            <Select value={method} onValueChange={(v) => handleMethodChange(v as HttpMethod)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as HttpMethod[]).map((m) => (
                  <SelectItem key={m} value={m}>
                    <span className="flex items-center gap-2">
                      <Badge className={`${methodColors[m]} text-[10px] px-1.5 py-0`}>{m}</Badge>
                      {methodDescriptions[m]}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ID do registro */}
        {canHaveId(method) && (
          <div className="space-y-2">
            <Label>
              ID do registro
              {needsId(method) && <span className="text-red-500 ml-1">*</span>}
              {method === 'GET' && <span className="text-muted-foreground text-xs ml-2">(opcional — deixe vazio para listar todos)</span>}
            </Label>
            <Input
              placeholder="ex: 550e8400-e29b-41d4-a716-446655440000"
              value={resourceId}
              onChange={(e) => setResourceId(e.target.value)}
              className="font-mono text-sm"
            />
          </div>
        )}

        {/* Query params para GET */}
        {method === 'GET' && !resourceId.trim() && (
          <div className="space-y-2">
            <Label>
              Parâmetros de busca
              <span className="text-muted-foreground text-xs ml-2">(opcional)</span>
            </Label>
            <Input
              placeholder="ex: search=joao&limit=10&order=name.asc"
              value={queryParams}
              onChange={(e) => setQueryParams(e.target.value)}
              className="font-mono text-sm"
            />
          </div>
        )}

        {/* Body — builder (contacts) ou textarea (demais recursos) */}
        {hasBody(method) && useBuilder && (
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <FileJson className="h-4 w-4" />
              Montagem do payload
            </Label>
            <PayloadBuilder
              fields={contactFieldsMeta}
              method={method}
              selection={contactsSelection}
              values={contactsValues}
              onToggle={toggleContactField}
              onValueChange={setContactFieldValue}
              onSelectAll={selectAllContactFields}
              onClear={clearContactFields}
            />
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                Pré-visualização do corpo (JSON gerado)
              </Label>
              <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto whitespace-pre-wrap border font-mono leading-relaxed max-h-[200px] overflow-y-auto">
                {effectiveBody || '{}'}
              </pre>
            </div>
          </div>
        )}

        {hasBody(method) && !useBuilder && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <FileJson className="h-4 w-4" />
                Corpo da requisição (JSON)
              </Label>
              {jsonError && (
                <span className="text-xs text-red-500 flex items-center gap-1">
                  <XCircle className="h-3 w-3" /> {jsonError}
                </span>
              )}
            </div>
            <Textarea
              value={body}
              onChange={(e) => handleBodyChange(e.target.value)}
              className="font-mono text-sm min-h-[160px] resize-y"
              placeholder='{"campo": "valor"}'
            />
          </div>
        )}

        {/* Curl gerado */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Terminal className="h-4 w-4" />
            Curl gerado — copie para usar em outro sistema
          </Label>
          <div className="relative">
            <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap border font-mono leading-relaxed">
              {curlCommand}
            </pre>
            <div className="absolute top-2 right-2">
              <CopyButton text={curlCommand} />
            </div>
          </div>
        </div>

        {/* Botao de enviar */}
        <div className="flex items-center gap-3">
          <Button
            onClick={handleSend}
            disabled={sending || !tokenValue}
            className="gap-2"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {sending ? 'Enviando...' : 'Enviar Requisição'}
          </Button>
          {!tokenValue && (
            <span className="text-xs text-muted-foreground">
              Gere um token acima para poder testar
            </span>
          )}
        </div>

        {/* Resposta */}
        {response && (
          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center justify-between">
              <StatusBadge status={response.status} />
              <span className="text-xs text-muted-foreground">
                {response.duration}ms
              </span>
            </div>
            <div className="relative">
              <pre className={`p-4 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap border font-mono leading-relaxed max-h-[400px] overflow-y-auto ${
                response.status >= 200 && response.status < 300
                  ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800'
                  : response.status >= 400
                    ? 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800'
                    : 'bg-muted border'
              }`}>
                {typeof response.body === 'string'
                  ? response.body
                  : JSON.stringify(response.body, null, 2)}
              </pre>
              <div className="absolute top-2 right-2">
                <CopyButton text={typeof response.body === 'string' ? response.body : JSON.stringify(response.body, null, 2)} />
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---- Pagina Principal ----

export default function Api() {
  const { data: token, isLoading } = useApiToken();
  const generateToken = useGenerateToken();
  const revokeToken = useRevokeToken();

  const maskedToken = token?.token
    ? token.token.slice(0, 8) + '...' + token.token.slice(-8)
    : null;

  const tokenForCurl = token?.token || 'SEU_TOKEN';

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Key className="h-6 w-6" />
        <h1 className="text-2xl font-bold">API</h1>
      </div>

      {/* Token section */}
      <Card>
        <CardHeader>
          <CardTitle>Token de Acesso</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : token ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Input value={maskedToken ?? ''} readOnly className="font-mono text-sm" />
                <CopyButton text={token.token} />
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>
                  Criado em: {new Date(token.created_at).toLocaleDateString('pt-BR')}
                </span>
                {token.last_used_at && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Último uso: {new Date(token.last_used_at).toLocaleString('pt-BR')}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => generateToken.mutate()}
                  disabled={generateToken.isPending}
                >
                  {generateToken.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Gerar Novo Token
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => revokeToken.mutate()}
                  disabled={revokeToken.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Revogar
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Nenhum token ativo. Gere um token para acessar a API.
              </p>
              <Button
                onClick={() => generateToken.mutate()}
                disabled={generateToken.isPending}
              >
                {generateToken.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Key className="h-4 w-4 mr-2" />
                )}
                Gerar Token
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Playground */}
      <ApiPlayground tokenValue={token?.token ?? null} />

      {/* Tabs: Documentacao + Campos */}
      <Tabs defaultValue="como-usar" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto gap-1">
          <TabsTrigger value="como-usar" className="text-xs sm:text-sm">Como Usar</TabsTrigger>
          <TabsTrigger value="endpoints" className="text-xs sm:text-sm">Endpoints</TabsTrigger>
          <TabsTrigger value="campos" className="text-xs sm:text-sm">Campos</TabsTrigger>
          <TabsTrigger value="respostas" className="text-xs sm:text-sm">Respostas</TabsTrigger>
        </TabsList>

        {/* Como usar */}
        <TabsContent value="como-usar">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2 text-sm">
                <p><strong>URL Base:</strong></p>
                <div className="flex items-center gap-2">
                  <code className="bg-muted px-3 py-1.5 rounded text-xs block">{BASE_API_URL}</code>
                  <CopyButton text={BASE_API_URL} />
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <p><strong>Autenticação:</strong></p>
                <p className="text-muted-foreground">
                  Todas as requisições precisam de dois headers:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 text-xs mt-1">
                  <li><code className="bg-muted px-1 rounded">apikey</code> — Chave pública do projeto (fixa, já preenchida nos exemplos)</li>
                  <li><code className="bg-muted px-1 rounded">Authorization: Bearer {'<seu_token>'}</code> — Seu token pessoal gerado acima</li>
                </ul>
              </div>

              <div className="space-y-2 text-sm">
                <p><strong>Exemplo rápido:</strong></p>
                <div className="relative">
                  <pre className="bg-muted p-3 rounded text-xs overflow-x-auto font-mono">{`curl ${BASE_API_URL}/contacts \\
  -H "apikey: ${SUPABASE_ANON_KEY}" \\
  -H "Authorization: Bearer ${tokenForCurl}" \\
  -H "Content-Type: application/json"`}</pre>
                  <div className="absolute top-2 right-2">
                    <CopyButton text={`curl ${BASE_API_URL}/contacts \\\n  -H "apikey: ${SUPABASE_ANON_KEY}" \\\n  -H "Authorization: Bearer ${tokenForCurl}" \\\n  -H "Content-Type: application/json"`} />
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <p><strong>Parâmetros de listagem (GET):</strong></p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 text-xs">
                  <li><code className="bg-muted px-1 rounded">?limit=100</code> — Quantidade por página (máx 1000)</li>
                  <li><code className="bg-muted px-1 rounded">?offset=0</code> — Deslocamento para paginação</li>
                  <li><code className="bg-muted px-1 rounded">?search=joao</code> — Busca textual (nome, telefone, email)</li>
                  <li><code className="bg-muted px-1 rounded">?order=name.asc</code> — Ordenação (campo.asc ou campo.desc)</li>
                  <li><code className="bg-muted px-1 rounded">?city=eq.São Paulo</code> — Filtro por coluna (eq, neq, gt, gte, lt, lte, ilike)</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Endpoints */}
        <TabsContent value="endpoints">
          <Card>
            <CardContent className="pt-6">
              <Accordion type="multiple" className="w-full">
                {endpointGroups.map((group) => (
                  <AccordionItem key={group.title} value={group.title}>
                    <AccordionTrigger>{group.title}</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4">
                        {group.endpoints.map((endpoint) => {
                          const curlParts = [`curl -X ${endpoint.method} '${BASE_API_URL}${endpoint.path}'`];
                          curlParts.push(`  -H "apikey: ${SUPABASE_ANON_KEY}"`);
                          curlParts.push(`  -H "Authorization: Bearer ${tokenForCurl}"`);
                          curlParts.push(`  -H "Content-Type: application/json"`);
                          if (endpoint.body) {
                            curlParts.push(`  -d '${endpoint.body}'`);
                          }
                          const curlCmd = curlParts.join(' \\\n');

                          return (
                            <div
                              key={`${endpoint.method}-${endpoint.path}`}
                              className="border rounded-lg p-4 space-y-2"
                            >
                              <div className="flex items-center gap-2">
                                <Badge className={methodColors[endpoint.method]}>
                                  {endpoint.method}
                                </Badge>
                                <code className="text-sm">{endpoint.path}</code>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {endpoint.description}
                              </p>
                              <div className="relative">
                                <pre className="bg-muted p-3 rounded text-xs overflow-x-auto whitespace-pre-wrap font-mono">
                                  {curlCmd}
                                </pre>
                                <div className="absolute top-2 right-2">
                                  <CopyButton text={curlCmd} />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Campos aceitos */}
        <TabsContent value="campos">
          <Card>
            <CardContent className="pt-6">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-4 font-medium">Campo</th>
                      <th className="text-left py-2 pr-4 font-medium">Tipo</th>
                      <th className="text-left py-2 pr-4 font-medium">Obrigatório</th>
                      <th className="text-left py-2 font-medium">Descrição</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contactFields.map((field) => (
                      <tr key={field.campo} className="border-b last:border-0">
                        <td className="py-1.5 pr-4 font-mono">{field.campo}</td>
                        <td className="py-1.5 pr-4 text-muted-foreground">{field.tipo}</td>
                        <td className="py-1.5 pr-4">
                          {field.obrigatorio ? (
                            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Sim</Badge>
                          ) : (
                            <span className="text-muted-foreground">Não</span>
                          )}
                        </td>
                        <td className="py-1.5 text-muted-foreground">{field.descricao}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Codigos de resposta */}
        <TabsContent value="respostas">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-3 text-sm">
                <div className="flex gap-3 items-center">
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 w-12 justify-center">200</Badge>
                  <span className="text-muted-foreground">Sucesso (GET, PUT, PATCH, DELETE)</span>
                </div>
                <div className="flex gap-3 items-center">
                  <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 w-12 justify-center">201</Badge>
                  <span className="text-muted-foreground">Criado com sucesso (POST)</span>
                </div>
                <div className="flex gap-3 items-center">
                  <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 w-12 justify-center">400</Badge>
                  <span className="text-muted-foreground">Requisição inválida (campo ausente, recurso inválido)</span>
                </div>
                <div className="flex gap-3 items-center">
                  <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 w-12 justify-center">401</Badge>
                  <span className="text-muted-foreground">Token inválido ou ausente</span>
                </div>
                <div className="flex gap-3 items-center">
                  <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 w-12 justify-center">404</Badge>
                  <span className="text-muted-foreground">Registro não encontrado</span>
                </div>
                <div className="flex gap-3 items-center">
                  <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 w-12 justify-center">409</Badge>
                  <span className="text-muted-foreground">Registro duplicado</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
