import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Paintbrush, RotateCcw, Save } from 'lucide-react';
import { useBranding, useUpdateBranding } from '@/hooks/useBranding';

export default function Branding() {
  const { data: branding, isLoading } = useBranding();
  const updateBranding = useUpdateBranding();

  const [mandateName, setMandateName] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#0B63D1');

  useEffect(() => {
    if (branding) {
      setMandateName(branding.mandate_name);
      setPrimaryColor(branding.primary_color);
    }
  }, [branding]);

  const handleSave = () => {
    updateBranding.mutate({ mandate_name: mandateName, primary_color: primaryColor });
  };

  const handleReset = () => {
    setMandateName('Meu Mandato');
    setPrimaryColor('#0B63D1');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Paintbrush className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Personalizacao</h1>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Identidade Visual</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Nome do Mandato */}
          <div className="space-y-2">
            <Label htmlFor="mandate-name">Nome do Mandato</Label>
            <Input
              id="mandate-name"
              value={mandateName}
              onChange={(e) => setMandateName(e.target.value)}
              placeholder="Meu Mandato"
            />
          </div>

          {/* Cor Primaria */}
          <div className="space-y-2">
            <Label htmlFor="primary-color">Cor Primaria</Label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                id="primary-color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-12 h-10 rounded border cursor-pointer"
              />
              <Input
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                placeholder="#0B63D1"
                className="w-32"
                maxLength={7}
              />
              <div
                className="w-10 h-10 rounded-md border"
                style={{ backgroundColor: primaryColor }}
              />
            </div>
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <Label>Preview</Label>
            <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-md flex items-center justify-center text-white text-sm font-bold"
                  style={{ backgroundColor: primaryColor }}
                >
                  {mandateName.charAt(0).toUpperCase()}
                </div>
                <span className="font-semibold">{mandateName || 'Meu Mandato'}</span>
              </div>
              <div className="flex gap-2">
                <button
                  className="px-4 py-2 rounded-md text-white text-sm font-medium"
                  style={{ backgroundColor: primaryColor }}
                >
                  Botao Primario
                </button>
                <button
                  className="px-4 py-2 rounded-md text-sm font-medium border"
                  style={{ color: primaryColor, borderColor: primaryColor }}
                >
                  Botao Secundario
                </button>
              </div>
              <div
                className="h-2 rounded-full"
                style={{ backgroundColor: primaryColor, opacity: 0.3 }}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button onClick={handleSave} disabled={updateBranding.isPending}>
              {updateBranding.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar
            </Button>
            <Button variant="outline" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Restaurar Padrao
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
