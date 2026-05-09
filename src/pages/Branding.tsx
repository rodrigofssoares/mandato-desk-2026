import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Loader2, Paintbrush, Save, Crown, Gem, Upload, X, User } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useBranding, useUpdateBranding, useUploadPoliticianPhoto } from '@/hooks/useBranding';
import { useUpdateThemePreference } from '@/hooks/useUpdateThemePreference';
import type { ThemePreference } from '@/context/AuthContext';
import { PageHeader, PanelHeader } from '@/components/ui-system';

export default function Branding() {
  const { data: branding, isLoading } = useBranding();
  const updateBranding = useUpdateBranding();
  const uploadPhoto = useUploadPoliticianPhoto();
  const { theme } = useTheme();
  const { apply: applyTheme } = useUpdateThemePreference();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [politicianName, setPoliticianName] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [metaVotos, setMetaVotos] = useState<string>('');

  useEffect(() => {
    if (branding) {
      setPoliticianName(branding.politician_name || '');
      setPhotoUrl(branding.politician_photo_url || null);
      setPhotoPreview(branding.politician_photo_url || null);
      setMetaVotos(branding.meta_votos != null ? String(branding.meta_votos) : '');
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
    const trimmed = metaVotos.trim();
    const parsed = trimmed === '' ? null : parseInt(trimmed, 10);
    const metaVotosNum = parsed != null && !Number.isNaN(parsed) && parsed >= 0 ? parsed : null;
    updateBranding.mutate({
      mandate_name: branding?.mandate_name ?? 'Meu Mandato',
      primary_color: branding?.primary_color ?? '#0B63D1',
      politician_name: politicianName,
      politician_photo_url: photoUrl,
      meta_votos: metaVotosNum,
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
    {
      value: 'navy-institucional', label: 'Navy Institucional', icon: Crown,
      description: 'Azul profundo + dourado · formal',
      preview: { bg: '#F4F6F9', sidebar: '#F8FAFD', primary: '#1B3A6B', accent: '#C99A3D', text: '#0E1F38' },
    },
    {
      value: 'burgundy-institucional', label: 'Burgundy Institucional', icon: Gem,
      description: 'Vinho + dourado warm · clássico',
      preview: { bg: '#FAF6F0', sidebar: '#FCFAF5', primary: '#7B1E2E', accent: '#D4A446', text: '#2C1518' },
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <PageHeader
        eyebrow="Configuração"
        title="Personalização"
        description="Configure a aparência do sistema."
        icon={Paintbrush}
        iconVariant="accent"
      />

      {/* Tema */}
      <Card>
        <PanelHeader
          title="Tema"
          description="Escolha a aparência do sistema."
          icon={Paintbrush}
          iconVariant="primary"
        />
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {themeOptions.map((opt) => {
              const isActive = theme === opt.value;
              const p = opt.preview;
              return (
                <button
                  key={opt.value}
                  onClick={() => applyTheme(opt.value as ThemePreference)}
                  className={`
                    flex flex-col items-center gap-3 p-5 rounded-xl border-2 transition-all
                    ${isActive
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                      : 'border-border hover:border-muted-foreground/30 hover:bg-muted/50'
                    }
                  `}
                >
                  {/* Mini preview com cores reais */}
                  <div
                    className="w-full aspect-video rounded-lg border overflow-hidden relative"
                    style={{ background: p.bg, borderColor: `${p.text}15` }}
                  >
                    {/* Sidebar mini */}
                    <div
                      className="absolute left-0 top-0 bottom-0 w-1/4"
                      style={{ background: p.sidebar, borderRight: `1px solid ${p.text}10` }}
                    />
                    {/* Header mini */}
                    <div
                      className="absolute left-1/4 top-0 right-0 h-1/5"
                      style={{ background: p.sidebar, borderBottom: `1px solid ${p.text}10` }}
                    />
                    {/* Content dots — primary + accent + secondary */}
                    <div className="absolute left-[30%] top-[30%] right-[8%] flex gap-1">
                      <div className="h-2 flex-1 rounded-sm" style={{ background: p.primary }} />
                      <div className="h-2 flex-1 rounded-sm" style={{ background: p.accent }} />
                      <div className="h-2 flex-1 rounded-sm" style={{ background: `${p.primary}30` }} />
                    </div>
                    {/* Faixa accent (selo) */}
                    <div className="absolute right-[8%] top-[8%] w-3 h-3 rounded-full" style={{ background: p.accent }} />
                  </div>
                  <div className="text-center">
                    <opt.icon className="h-4 w-4 mx-auto mb-1" />
                    <span className="text-sm font-semibold">{opt.label}</span>
                    <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
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
        <PanelHeader
          title="Identificação do Mandato"
          description="A foto e o nome do político serão exibidos no topo da barra lateral, substituindo o ícone padrão."
          icon={User}
          iconVariant="primary"
        />
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

          <div className="space-y-2">
            <Label htmlFor="meta-votos">Meta de Votos</Label>
            <Input
              id="meta-votos"
              type="number"
              min={0}
              step={1}
              value={metaVotos}
              onChange={(e) => setMetaVotos(e.target.value)}
              placeholder="Ex: 5000"
            />
            <p className="text-xs text-muted-foreground">
              Deixe em branco para ocultar o progresso no dashboard.
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
