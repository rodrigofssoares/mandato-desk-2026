import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Loader2, Paintbrush, Save, Sun, Moon, Monitor, Upload, X, User } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useBranding, useUpdateBranding, useUploadPoliticianPhoto } from '@/hooks/useBranding';

export default function Branding() {
  const { data: branding, isLoading } = useBranding();
  const updateBranding = useUpdateBranding();
  const uploadPhoto = useUploadPoliticianPhoto();
  const { theme, setTheme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [politicianName, setPoliticianName] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  useEffect(() => {
    if (branding) {
      setPoliticianName(branding.politician_name || '');
      setPhotoUrl(branding.politician_photo_url || null);
      setPhotoPreview(branding.politician_photo_url || null);
    }
  }, [branding]);

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      return;
    }

    // Preview local imediato
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    // Upload para Supabase Storage
    const url = await uploadPhoto.mutateAsync(file);
    setPhotoUrl(url);
  };

  const handleRemovePhoto = () => {
    setPhotoUrl(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSave = () => {
    updateBranding.mutate({
      mandate_name: branding?.mandate_name ?? 'Meu Mandato',
      primary_color: branding?.primary_color ?? '#0B63D1',
      politician_name: politicianName,
      politician_photo_url: photoUrl,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const themeOptions = [
    { value: 'light', label: 'Claro', icon: Sun, description: 'Fundo branco com texto escuro' },
    { value: 'dark', label: 'Escuro', icon: Moon, description: 'Fundo escuro com texto claro' },
    { value: 'system', label: 'Sistema', icon: Monitor, description: 'Segue a configuração do seu dispositivo' },
  ];

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Paintbrush className="h-6 w-6" />
        <div>
          <h1 className="text-2xl font-bold">Personalização</h1>
          <p className="text-sm text-muted-foreground">Configure a aparência do sistema</p>
        </div>
      </div>

      {/* Tema */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tema</CardTitle>
          <CardDescription>Escolha entre tema claro ou escuro</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {themeOptions.map((opt) => {
              const isActive = theme === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setTheme(opt.value)}
                  className={`
                    flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all
                    ${isActive
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                      : 'border-border hover:border-muted-foreground/30 hover:bg-muted/50'
                    }
                  `}
                >
                  {/* Mini preview */}
                  <div className={`
                    w-full aspect-video rounded-md border overflow-hidden relative
                    ${opt.value === 'dark' ? 'bg-zinc-900 border-zinc-700' : ''}
                    ${opt.value === 'light' ? 'bg-white border-zinc-200' : ''}
                    ${opt.value === 'system' ? 'bg-gradient-to-r from-white to-zinc-900 border-zinc-400' : ''}
                  `}>
                    {/* Sidebar mini */}
                    <div className={`
                      absolute left-0 top-0 bottom-0 w-1/4
                      ${opt.value === 'dark' ? 'bg-zinc-800' : ''}
                      ${opt.value === 'light' ? 'bg-zinc-100' : ''}
                      ${opt.value === 'system' ? 'bg-zinc-300' : ''}
                    `} />
                    {/* Header mini */}
                    <div className={`
                      absolute left-1/4 top-0 right-0 h-1/5
                      ${opt.value === 'dark' ? 'bg-zinc-800/50' : ''}
                      ${opt.value === 'light' ? 'bg-zinc-50' : ''}
                      ${opt.value === 'system' ? 'bg-zinc-200' : ''}
                    `} />
                  </div>
                  <div className="text-center">
                    <opt.icon className="h-4 w-4 mx-auto mb-1" />
                    <span className="text-sm font-medium">{opt.label}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Foto e Nome do Político */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Identificação do Mandato</CardTitle>
          <CardDescription>
            A foto e o nome do político serão exibidos no topo da barra lateral, substituindo o ícone padrão
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Upload de foto */}
          <div className="space-y-3">
            <Label>Foto do Político</Label>
            <div className="flex items-center gap-4">
              {/* Avatar preview */}
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center overflow-hidden bg-muted">
                  {photoPreview ? (
                    <img
                      src={photoPreview}
                      alt="Foto do político"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                {photoPreview && (
                  <button
                    onClick={handleRemovePhoto}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center hover:bg-destructive/90"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadPhoto.isPending}
                >
                  {uploadPhoto.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  {photoPreview ? 'Trocar foto' : 'Enviar foto'}
                </Button>
                <span className="text-xs text-muted-foreground">
                  PNG, JPG ou SVG. Máximo 2MB.
                </span>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml"
                onChange={handlePhotoSelect}
                className="hidden"
              />
            </div>
          </div>

          {/* Nome do político */}
          <div className="space-y-2">
            <Label htmlFor="politician-name">Nome do Político</Label>
            <Input
              id="politician-name"
              value={politicianName}
              onChange={(e) => setPoliticianName(e.target.value)}
              placeholder="Ex: Raquel Canuto"
            />
            <p className="text-xs text-muted-foreground">
              Será exibido abaixo da foto na barra lateral
            </p>
          </div>

          {/* Preview da sidebar */}
          <div className="space-y-2">
            <Label>Preview na Sidebar</Label>
            <div className="border rounded-lg p-4 bg-sidebar text-sidebar-foreground w-56">
              <div className="flex flex-col items-center gap-2 py-2">
                <div className="w-14 h-14 rounded-full border-2 border-primary/30 overflow-hidden bg-muted flex items-center justify-center">
                  {photoPreview ? (
                    <img
                      src={photoPreview}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold leading-tight">
                    {politicianName || 'Nome do Político'}
                  </p>
                  <p className="text-[11px] text-muted-foreground font-medium">
                    Mandato Desk
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Botão salvar */}
          <div className="flex gap-3 pt-2">
            <Button onClick={handleSave} disabled={updateBranding.isPending}>
              {updateBranding.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
