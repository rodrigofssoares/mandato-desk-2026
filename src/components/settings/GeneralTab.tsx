import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SlidersHorizontal } from 'lucide-react';

export function GeneralTab() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <SlidersHorizontal className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Geral</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Campos Personalizados</CardTitle>
          <CardDescription>
            Em construção — será preenchida na issue 33 (aba Geral: Campos Personalizados funcional).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Configurações gerais do sistema, preferências de exibição, página inicial default e campos
            personalizados dos contatos aparecerão aqui.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
