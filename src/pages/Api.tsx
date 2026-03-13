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
import { Copy, Key, Loader2, RefreshCw, Trash2, Check } from 'lucide-react';
import { useApiToken, useGenerateToken, useRevokeToken } from '@/hooks/useApiTokens';
import { toast } from 'sonner';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://SEU-PROJETO.supabase.co';

interface Endpoint {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  description: string;
}

const endpointGroups: { title: string; endpoints: Endpoint[] }[] = [
  {
    title: 'Contatos',
    endpoints: [
      { method: 'GET', path: '/rest/v1/contacts', description: 'Listar todos os contatos' },
      { method: 'POST', path: '/rest/v1/contacts', description: 'Criar um novo contato' },
      { method: 'PATCH', path: '/rest/v1/contacts?id=eq.{id}', description: 'Atualizar um contato' },
      { method: 'DELETE', path: '/rest/v1/contacts?id=eq.{id}', description: 'Excluir um contato' },
    ],
  },
  {
    title: 'Demandas',
    endpoints: [
      { method: 'GET', path: '/rest/v1/demands', description: 'Listar todas as demandas' },
      { method: 'POST', path: '/rest/v1/demands', description: 'Criar uma nova demanda' },
      { method: 'PATCH', path: '/rest/v1/demands?id=eq.{id}', description: 'Atualizar uma demanda' },
      { method: 'DELETE', path: '/rest/v1/demands?id=eq.{id}', description: 'Excluir uma demanda' },
    ],
  },
  {
    title: 'Etiquetas',
    endpoints: [
      { method: 'GET', path: '/rest/v1/tags', description: 'Listar todas as etiquetas' },
      { method: 'POST', path: '/rest/v1/tags', description: 'Criar uma nova etiqueta' },
      { method: 'PATCH', path: '/rest/v1/tags?id=eq.{id}', description: 'Atualizar uma etiqueta' },
      { method: 'DELETE', path: '/rest/v1/tags?id=eq.{id}', description: 'Excluir uma etiqueta' },
    ],
  },
  {
    title: 'Usuarios',
    endpoints: [
      { method: 'GET', path: '/rest/v1/profiles', description: 'Listar todos os usuarios' },
    ],
  },
];

const methodColors: Record<string, string> = {
  GET: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  POST: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  PATCH: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  DELETE: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

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
              <p className="text-xs text-muted-foreground">
                Criado em: {new Date(token.created_at).toLocaleDateString('pt-BR')}
              </p>
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

      {/* Documentation */}
      <Card>
        <CardHeader>
          <CardTitle>Documentacao</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Base URL: <code className="bg-muted px-2 py-1 rounded text-xs">{SUPABASE_URL}</code>
          </p>

          <Accordion type="multiple" className="w-full">
            {endpointGroups.map((group) => (
              <AccordionItem key={group.title} value={group.title}>
                <AccordionTrigger>{group.title}</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4">
                    {group.endpoints.map((endpoint) => {
                      const curlCmd = `curl -X ${endpoint.method} '${SUPABASE_URL}${endpoint.path}' \\
  -H "apikey: SEU_TOKEN" \\
  -H "Authorization: Bearer SEU_TOKEN" \\
  -H "Content-Type: application/json"`;

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
                            <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
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
    </div>
  );
}
