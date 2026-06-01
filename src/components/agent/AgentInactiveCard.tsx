import { Bot, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface AgentInactiveCardProps {
  adminContact?: string | null;
}

export function AgentInactiveCard({ adminContact }: AgentInactiveCardProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
            <Bot className="h-7 w-7 text-muted-foreground" />
          </div>
          <AlertCircle className="h-6 w-6 text-destructive -mt-2" />
          <div>
            <h2 className="text-lg font-semibold font-display mb-2">
              Agente temporariamente desativado
            </h2>
            <p className="text-sm text-muted-foreground">
              O agente foi desativado pelo administrador. Entre em contato para mais informações.
            </p>
            {adminContact && (
              <p className="text-sm text-primary mt-3 font-medium">{adminContact}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
