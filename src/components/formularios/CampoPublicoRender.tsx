// EM054 — Renderizador de campo público (sem auth, sem lógica de negócio)
import { type ChangeEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { type CampoPublico } from '@/types/formularios';

// ── Helpers de máscara simples ─────────────────────────────────────────────

function mascararTelefone(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function mascararCpf(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

// ── Props ──────────────────────────────────────────────────────────────────

export interface CampoPublicoRenderProps {
  campo: CampoPublico;
  valor: string | string[];
  erro: string | null;
  corPrimaria: string;
  raio: string;
  onChange: (valor: string | string[]) => void;
}

// ── Estilos inline baseados no tema ──────────────────────────────────────

function inputStyle(corPrimaria: string, raio: string, temErro: boolean) {
  return {
    borderRadius: raio,
    borderColor: temErro ? '#ef4444' : undefined,
    outlineColor: corPrimaria,
  } as React.CSSProperties;
}

// ── Componente principal ─────────────────────────────────────────────────

export function CampoPublicoRender({
  campo,
  valor,
  erro,
  corPrimaria,
  raio,
  onChange,
}: CampoPublicoRenderProps) {
  const temErro = !!erro;
  const valorStr = typeof valor === 'string' ? valor : '';
  const valorArr = Array.isArray(valor) ? valor : [];

  // ── Seção decorativa ────────────────────────────────────────────────────
  if (campo.tipo === 'secao') {
    const sub = typeof campo.config?.subtitulo === 'string' ? campo.config.subtitulo : null;
    return (
      <div className="pt-4 pb-1">
        <h3
          className="text-base font-semibold"
          style={{ color: corPrimaria }}
        >
          {campo.rotulo}
        </h3>
        {sub && <p className="text-sm text-muted-foreground mt-0.5">{sub}</p>}
        <hr className="mt-2" style={{ borderColor: `${corPrimaria}33` }} />
      </div>
    );
  }

  // ── Imagem decorativa ───────────────────────────────────────────────────
  if (campo.tipo === 'imagem') {
    const src = typeof campo.config?.url === 'string' ? campo.config.url : null;
    if (!src) return null;
    return (
      <div className="my-3">
        <img
          src={src}
          alt={campo.rotulo || 'Imagem do formulário'}
          className="w-full object-contain rounded"
          style={{ maxHeight: 300, borderRadius: raio }}
        />
        {campo.rotulo && (
          <p className="text-xs text-muted-foreground mt-1 text-center">{campo.rotulo}</p>
        )}
      </div>
    );
  }

  // ── Rótulo compartilhado (campos com input) — só renderiza se houver texto ──
  const temRotulo = !!campo.rotulo?.trim();
  const rotulo = temRotulo ? (
    <Label
      htmlFor={`campo-${campo.id}`}
      className="text-sm font-semibold block mb-1.5"
    >
      {campo.rotulo}
      {campo.obrigatorio && (
        <span className="text-red-500 ml-1" aria-hidden="true">*</span>
      )}
    </Label>
  ) : null;

  const ajuda = campo.ajuda ? (
    <p id={`ajuda-${campo.id}`} className="text-xs text-muted-foreground mt-1">
      {campo.ajuda}
    </p>
  ) : null;

  const erroEl = temErro ? (
    <p role="alert" className="text-xs text-red-500 mt-1">{erro}</p>
  ) : null;

  const ariaDesc = campo.ajuda ? `ajuda-${campo.id}` : undefined;

  // ── Parágrafo ───────────────────────────────────────────────────────────
  if (campo.tipo === 'paragrafo') {
    return (
      <div>
        {rotulo}
        <textarea
          id={`campo-${campo.id}`}
          aria-describedby={ariaDesc}
          aria-invalid={temErro}
          value={valorStr}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
          placeholder={campo.ajuda ?? 'Sua resposta...'}
          maxLength={campo.max_chars ?? undefined}
          rows={4}
          className="w-full border rounded-md px-3 py-2 text-sm bg-background text-foreground resize-y focus:outline-none focus:ring-2 transition-colors"
          style={{
            borderRadius: raio,
            borderColor: temErro ? '#ef4444' : undefined,
          }}
        />
        {ajuda}
        {erroEl}
      </div>
    );
  }

  // ── Escolha única (radios) ─────────────────────────────────────────────
  if (campo.tipo === 'escolha_unica') {
    return (
      <fieldset aria-describedby={ariaDesc}>
        {temRotulo && (
          <legend className="text-sm font-semibold mb-2">
            {campo.rotulo}
            {campo.obrigatorio && (
              <span className="text-red-500 ml-1" aria-hidden="true">*</span>
            )}
          </legend>
        )}
        <div className="space-y-2">
          {campo.opcoes.map((op) => (
            <label
              key={op.value}
              className="flex items-center gap-3 p-2.5 border rounded-md cursor-pointer hover:bg-muted/40 transition-colors"
              style={{
                borderRadius: raio,
                borderColor:
                  valorStr === op.value ? corPrimaria : undefined,
                backgroundColor:
                  valorStr === op.value ? `${corPrimaria}10` : undefined,
              }}
            >
              <input
                type="radio"
                name={`campo-${campo.id}`}
                value={op.value}
                checked={valorStr === op.value}
                onChange={() => onChange(op.value)}
                className="sr-only"
              />
              {/* Anel visual do radio */}
              <span
                className="inline-flex items-center justify-center w-4 h-4 rounded-full border-2 flex-shrink-0"
                style={{
                  borderColor:
                    valorStr === op.value ? corPrimaria : '#d1d5db',
                }}
                aria-hidden="true"
              >
                {valorStr === op.value && (
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: corPrimaria }}
                  />
                )}
              </span>
              <span className="text-sm">{op.label}</span>
            </label>
          ))}
        </div>
        {ajuda}
        {erroEl}
      </fieldset>
    );
  }

  // ── Checkboxes ────────────────────────────────────────────────────────
  if (campo.tipo === 'checkboxes') {
    const toggle = (v: string) => {
      const atual = valorArr;
      onChange(
        atual.includes(v) ? atual.filter((x) => x !== v) : [...atual, v]
      );
    };
    return (
      <fieldset aria-describedby={ariaDesc}>
        {temRotulo && (
          <legend className="text-sm font-semibold mb-2">
            {campo.rotulo}
            {campo.obrigatorio && (
              <span className="text-red-500 ml-1" aria-hidden="true">*</span>
            )}
          </legend>
        )}
        <div className="space-y-2">
          {campo.opcoes.map((op) => {
            const checked = valorArr.includes(op.value);
            return (
              <label
                key={op.value}
                className="flex items-center gap-3 p-2.5 border rounded-md cursor-pointer hover:bg-muted/40 transition-colors"
                style={{
                  borderRadius: raio,
                  borderColor: checked ? corPrimaria : undefined,
                  backgroundColor: checked ? `${corPrimaria}10` : undefined,
                }}
              >
                <Checkbox
                  id={`campo-${campo.id}-${op.value}`}
                  checked={checked}
                  onCheckedChange={() => toggle(op.value)}
                  style={
                    checked
                      ? ({
                          '--checkbox-color': corPrimaria,
                        } as React.CSSProperties)
                      : undefined
                  }
                />
                <span className="text-sm">{op.label}</span>
              </label>
            );
          })}
        </div>
        {ajuda}
        {erroEl}
      </fieldset>
    );
  }

  // ── Lista suspensa (select) ───────────────────────────────────────────
  if (campo.tipo === 'lista') {
    return (
      <div>
        {rotulo}
        <select
          id={`campo-${campo.id}`}
          aria-describedby={ariaDesc}
          aria-invalid={temErro}
          value={valorStr}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}
          className="w-full border rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 transition-colors"
          style={inputStyle(corPrimaria, raio, temErro)}
        >
          <option value="">Selecione...</option>
          {campo.opcoes.map((op) => (
            <option key={op.value} value={op.value}>
              {op.label}
            </option>
          ))}
        </select>
        {ajuda}
        {erroEl}
      </div>
    );
  }

  // ── Data ──────────────────────────────────────────────────────────────
  if (campo.tipo === 'data') {
    return (
      <div>
        {rotulo}
        <Input
          id={`campo-${campo.id}`}
          type="date"
          aria-describedby={ariaDesc}
          aria-invalid={temErro}
          value={valorStr}
          onChange={(e) => onChange(e.target.value)}
          style={inputStyle(corPrimaria, raio, temErro)}
        />
        {ajuda}
        {erroEl}
      </div>
    );
  }

  // ── Telefone com máscara ──────────────────────────────────────────────
  if (campo.tipo === 'telefone') {
    return (
      <div>
        {rotulo}
        <Input
          id={`campo-${campo.id}`}
          type="tel"
          inputMode="numeric"
          aria-describedby={ariaDesc}
          aria-invalid={temErro}
          placeholder="(00) 0 0000-0000"
          value={valorStr}
          maxLength={16}
          onChange={(e) => onChange(mascararTelefone(e.target.value))}
          style={inputStyle(corPrimaria, raio, temErro)}
        />
        {ajuda}
        {erroEl}
      </div>
    );
  }

  // ── CPF com máscara ───────────────────────────────────────────────────
  if (campo.tipo === 'cpf') {
    return (
      <div>
        {rotulo}
        <Input
          id={`campo-${campo.id}`}
          type="text"
          inputMode="numeric"
          aria-describedby={ariaDesc}
          aria-invalid={temErro}
          placeholder="000.000.000-00"
          value={valorStr}
          maxLength={14}
          onChange={(e) => onChange(mascararCpf(e.target.value))}
          style={inputStyle(corPrimaria, raio, temErro)}
        />
        {ajuda}
        {erroEl}
      </div>
    );
  }

  // ── E-mail ───────────────────────────────────────────────────────────
  if (campo.tipo === 'email') {
    return (
      <div>
        {rotulo}
        <Input
          id={`campo-${campo.id}`}
          type="email"
          inputMode="email"
          aria-describedby={ariaDesc}
          aria-invalid={temErro}
          placeholder="seu@email.com"
          value={valorStr}
          maxLength={campo.max_chars ?? undefined}
          onChange={(e) => onChange(e.target.value)}
          style={inputStyle(corPrimaria, raio, temErro)}
        />
        {ajuda}
        {erroEl}
      </div>
    );
  }

  // ── Texto curto (fallback para tipos desconhecidos) ───────────────────
  return (
    <div>
      {rotulo}
      <Input
        id={`campo-${campo.id}`}
        type="text"
        aria-describedby={ariaDesc}
        aria-invalid={temErro}
        placeholder={campo.ajuda ?? ''}
        value={valorStr}
        maxLength={campo.max_chars ?? undefined}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle(corPrimaria, raio, temErro)}
      />
      {ajuda}
      {erroEl}
    </div>
  );
}
