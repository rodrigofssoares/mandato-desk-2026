import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Copy, Key, Loader2, RefreshCw, Trash2, Check, Clock } from 'lucide-react';
import { useApiToken, useGenerateToken, useRevokeToken } from '@/hooks/useApiTokens';
import { toast } from 'sonner';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://SEU-PROJETO.supabase.co';
const BASE_API_URL = `${SUPABASE_URL}/functions/v1/api-proxy`;

interface Endpoint {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  description: string;
  body?: string;
}

const endpointGroups: { title: string; endpoints: Endpoint[] }[] = [
  {
    title: 'Contatos',
    endpoints: [
      { method: 'GET', path: '/contacts', description: 'Listar todos os contatos (aceita ?limit, ?offset, ?search)' },
      { method: 'GET', path: '/contacts/{id}', description: 'Buscar um contato pelo ID' },
      {
        method: 'POST',
        path: '/contacts',
        description: 'Criar um novo contato',
        body: JSON.stringify({ name: 'Joao Silva', phone: '(11) 99999-9999', email: 'joao@email.com', city: 'Sao Paulo', state: 'SP' }, null, 2),
      },
      {
        method: 'PATCH',
        path: '/contacts/{id}',
        description: 'Atualizar um contato',
        body: JSON.stringify({ phone: '(11) 88888-8888', neighborhood: 'Centro' }, null, 2),
      },
      { method: 'DELETE', path: '/contacts/{id}', description: 'Excluir um contato' },
    ],
  },
  {
    title: 'Demandas',
    endpoints: [
      { method: 'GET', path: '/demands', description: 'Listar todas as demandas (aceita ?limit, ?offset, ?search)' },
      { method: 'GET', path: '/demands/{id}', description: 'Buscar uma demanda pelo ID' },
      {
        method: 'POST',
        path: '/demands',
        description: 'Criar uma nova demanda',
        body: JSON.stringify({ title: 'Buraco na rua', description: 'Buraco na Rua XV de Novembro', priority: 'high', status: 'open' }, null, 2),
      },
      {
        method: 'PATCH',
        path: '/demands/{id}',
        description: 'Atualizar uma demanda',
        body: JSON.stringify({ status: 'in_progress' }, null, 2),
      },
      { method: 'DELETE', path: '/demands/{id}', description: 'Excluir uma demanda' },
    ],
  },
  {
    title: 'Etiquetas',
    endpoints: [
      { method: 'GET', path: '/tags', description: 'Listar todas as etiquetas (aceita ?search)' },
      { method: 'GET', path: '/tags/{id}', description: 'Buscar uma etiqueta pelo ID' },
      {
        method: 'POST',
        path: '/tags',
        description: 'Criar uma nova etiqueta',
        body: JSON.stringify({ name: 'Saude', category: 'demands', color: '#EF4444' }, null, 2),
      },
      {
        method: 'PATCH',
        path: '/tags/{id}',
        description: 'Atualizar uma etiqueta',
        body: JSON.stringify({ color: '#3B82F6' }, null, 2),
      },
      { method: 'DELETE', path: '/tags/{id}', description: 'Excluir uma etiqueta' },
    ],
  },
];

const methodColors: Record<string, string> = {
  GET: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  POST: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  PATCH: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  DELETE: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

const contactFields = [
  { campo: 'name', tipo: 'string', obrigatorio: true, descricao: 'Nome completo do contato' },
  { campo: 'phone', tipo: 'string', obrigatorio: false, descricao: 'Telefone/WhatsApp' },
  { campo: 'email', tipo: 'string', obrigatorio: false, descricao: 'E-mail' },
  { campo: 'cpf', tipo: 'string', obrigatorio: false, descricao: 'CPF' },
  { campo: 'birth_date', tipo: 'date', obrigatorio: false, descricao: 'Data de nascimento (YYYY-MM-DD)' },
  { campo: 'gender', tipo: 'string', obrigatorio: false, descricao: 'Genero' },
  { campo: 'zip_code', tipo: 'string', obrigatorio: false, descricao: 'CEP' },
  { campo: 'address', tipo: 'string', obrigatorio: false, descricao: 'Logradouro' },
  { campo: 'number', tipo: 'string', obrigatorio: false, descricao: 'Numero' },
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
  { campo: 'voter_registration', tipo: 'string', obrigatorio: false, descricao: 'Titulo de eleitor' },
  { campo: 'electoral_zone', tipo: 'string', obrigatorio: false, descricao: 'Zona eleitoral' },
  { campo: 'electoral_section', tipo: 'string', obrigatorio: false, descricao: 'Secao eleitoral' },
  { campo: 'political_group', tipo: 'string', obrigatorio: false, descricao: 'Grupo politico' },
  { campo: 'notes', tipo: 'string', obrigatorio: false, descricao: 'Observacoes' },
  { campo: 'leader_id', tipo: 'uuid', obrigatorio: false, descricao: 'ID do articulador vinculado' },
  { campo: 'source', tipo: 'string', obrigatorio: false, descricao: 'Origem do contato' },
  { campo: 'occupation', tipo: 'string', obrigatorio: false, descricao: 'Profissao' },
  { campo: 'em_canal_whatsapp', tipo: 'boolean', obrigatorio: false, descricao: 'Esta no canal do WhatsApp' },
  { campo: 'e_multiplicador', tipo: 'boolean', obrigatorio: false, descricao: 'E multiplicador' },
];

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
                    Ultimo uso: {new Date(token.last_used_at).toLocaleString('pt-BR')}
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

      {/* Como usar */}
      <Card>
        <CardHeader>
          <CardTitle>Como Usar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 text-sm">
            <p><strong>URL Base:</strong></p>
            <div className="flex items-center gap-2">
              <code className="bg-muted px-3 py-1.5 rounded text-xs block">{BASE_API_URL}</code>
              <CopyButton text={BASE_API_URL} />
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <p><strong>Autenticacao:</strong></p>
            <p className="text-muted-foreground">
              Adicione o header <code className="bg-muted px-1.5 py-0.5 rounded text-xs">Authorization: Bearer {'<seu_token>'}</code> em todas as requisicoes.
            </p>
          </div>

          <div className="space-y-2 text-sm">
            <p><strong>Exemplo rapido:</strong></p>
            <div className="relative">
              <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">{`curl ${BASE_API_URL}/contacts \\
  -H "Authorization: Bearer ${tokenForCurl}" \\
  -H "Content-Type: application/json"`}</pre>
              <div className="absolute top-2 right-2">
                <CopyButton text={`curl ${BASE_API_URL}/contacts \\\n  -H "Authorization: Bearer ${tokenForCurl}" \\\n  -H "Content-Type: application/json"`} />
              </div>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <p><strong>Parametros de listagem (GET):</strong></p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 text-xs">
              <li><code className="bg-muted px-1 rounded">?limit=100</code> — Quantidade por pagina (max 1000)</li>
              <li><code className="bg-muted px-1 rounded">?offset=0</code> — Deslocamento para paginacao</li>
              <li><code className="bg-muted px-1 rounded">?search=joao</code> — Busca textual (nome, telefone, email)</li>
              <li><code className="bg-muted px-1 rounded">?order=name.asc</code> — Ordenacao (campo.asc ou campo.desc)</li>
              <li><code className="bg-muted px-1 rounded">?city=eq.Sao Paulo</code> — Filtro por coluna (eq, neq, gt, gte, lt, lte, ilike)</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Endpoints */}
      <Card>
        <CardHeader>
          <CardTitle>Endpoints</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full">
            {endpointGroups.map((group) => (
              <AccordionItem key={group.title} value={group.title}>
                <AccordionTrigger>{group.title}</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4">
                    {group.endpoints.map((endpoint) => {
                      const curlParts = [`curl -X ${endpoint.method} '${BASE_API_URL}${endpoint.path}'`];
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
                            <pre className="bg-muted p-3 rounded text-xs overflow-x-auto whitespace-pre-wrap">
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

      {/* Campos aceitos para contatos */}
      <Card>
        <CardHeader>
          <CardTitle>Campos Aceitos — Contatos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-medium">Campo</th>
                  <th className="text-left py-2 pr-4 font-medium">Tipo</th>
                  <th className="text-left py-2 pr-4 font-medium">Obrigatorio</th>
                  <th className="text-left py-2 font-medium">Descricao</th>
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
                        <span className="text-muted-foreground">Nao</span>
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

      {/* Codigos de resposta */}
      <Card>
        <CardHeader>
          <CardTitle>Codigos de Resposta</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex gap-3 items-center">
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">200</Badge>
              <span className="text-muted-foreground">Sucesso (GET, PATCH, DELETE)</span>
            </div>
            <div className="flex gap-3 items-center">
              <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">201</Badge>
              <span className="text-muted-foreground">Criado com sucesso (POST)</span>
            </div>
            <div className="flex gap-3 items-center">
              <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">400</Badge>
              <span className="text-muted-foreground">Requisicao invalida (campo ausente, recurso invalido)</span>
            </div>
            <div className="flex gap-3 items-center">
              <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">401</Badge>
              <span className="text-muted-foreground">Token invalido ou ausente</span>
            </div>
            <div className="flex gap-3 items-center">
              <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">404</Badge>
              <span className="text-muted-foreground">Registro nao encontrado</span>
            </div>
            <div className="flex gap-3 items-center">
              <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">409</Badge>
              <span className="text-muted-foreground">Registro duplicado</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
