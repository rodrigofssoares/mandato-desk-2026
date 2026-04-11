# 15 — Setup Vitest + Testes Prioritários

**Tipo:** Funcional (infra + testes)
**Fase:** 1 (antes dos hooks)
**Depende de:** —
**Desbloqueia:** cobertura de testes nas issues 20, 21, 22

## Objetivo
Configurar Vitest + @testing-library/react no Mandato Desk 2026 (que hoje não tem infra de testes) e escrever os 8 testes prioritários que protegem a fundação do merge — helpers puros e hooks críticos.

## Contexto
O projeto NÃO tem teste algum hoje. Nos 28 issues de execução vão ser tocados 4 módulos grandes + migrations do Supabase. Zero cobertura significa que qualquer refatoração futura vira regressão silenciosa. Ao mesmo tempo, tentar testar tudo paralisa o trabalho. A estratégia é **mínima razoável**: só helpers + contratos de hooks críticos.

## Referência do padrão
Copy-paste do projeto irmão **"CRM - Milena -NaMi V2"** (Vitest 3.2.4, jsdom, react-swc — mesma stack do Mandato Desk).

## Parte A — Infra

### A.1 Dependências a instalar
```bash
npm install --save-dev \
  vitest@^3.2.4 \
  @testing-library/react@^16.0.0 \
  @testing-library/jest-dom@^6.6.0 \
  @testing-library/user-event@^14.5.0 \
  jsdom@^20.0.3
```

### A.2 `vitest.config.ts` (novo)
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    css: false, // evita processar Tailwind nos testes
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
```

### A.3 `src/test/setup.ts` (novo)
```ts
import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Limpa DOM entre testes
afterEach(() => cleanup());

// Polyfill matchMedia (shadcn depende)
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Polyfill ResizeObserver (Radix/shadcn depende)
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
```

### A.4 `src/test/queryWrapper.tsx` (novo — helper para hooks com react-query)
```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

export function QueryWrapper({ children }: { children: ReactNode }) {
  const client = createTestQueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
```

### A.5 `src/test/supabaseMock.ts` (novo — helper para mockar Supabase)
```ts
import { vi } from "vitest";

/**
 * Mock builder fluente que imita a chain do Supabase client.
 * Uso:
 *   const sb = mockSupabase();
 *   sb.setTable('boards', [{ id: '1', nome: 'Teste' }]);
 *   vi.mock('@/integrations/supabase/client', () => ({ supabase: sb }));
 */
export function mockSupabase() {
  const tables = new Map<string, any[]>();

  return {
    setTable(name: string, rows: any[]) {
      tables.set(name, rows);
    },
    from: vi.fn((tableName: string) => {
      const rows = tables.get(tableName) ?? [];
      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        order: vi.fn(() => builder),
        single: vi.fn(() => Promise.resolve({ data: rows[0] ?? null, error: null })),
        maybeSingle: vi.fn(() => Promise.resolve({ data: rows[0] ?? null, error: null })),
        insert: vi.fn((row: any) => {
          rows.push(row);
          return builder;
        }),
        update: vi.fn(() => builder),
        delete: vi.fn(() => builder),
        then: (resolve: any) => resolve({ data: rows, error: null }),
      };
      return builder;
    }),
    auth: {
      getUser: vi.fn(() =>
        Promise.resolve({ data: { user: { id: "test-user-id" } }, error: null })
      ),
    },
  };
}
```

### A.6 Scripts em `package.json`
```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest",
  "test:ui": "vitest --ui"
}
```

### A.7 Atualizar `.gitignore`
Adicionar `coverage/` se for usar `--coverage`.

---

## Parte B — 8 Testes Prioritários

### B.1 `src/lib/customFields/__tests__/slugify.test.ts`
```ts
import { describe, it, expect } from "vitest";
import { slugify } from "../slugify";

describe("slugify", () => {
  it("normaliza acentos", () => {
    expect(slugify("Cargo Liderança")).toBe("cargo_lideranca");
    expect(slugify("Território Ativação")).toBe("territorio_ativacao");
  });
  it("troca caracteres especiais por _", () => {
    expect(slugify("Nº Dependentes")).toBe("n_dependentes");
    expect(slugify("E-mail")).toBe("e_mail");
  });
  it("remove _ nas bordas", () => {
    expect(slugify("  espaços  ")).toBe("espacos");
  });
  it("lida com string vazia", () => {
    expect(slugify("")).toBe("");
  });
});
```
**Cobre:** o core da criação de campos personalizados (colisão de chaves é impossível se o slugify for correto).

### B.2 `src/hooks/__tests__/agruparTarefasPorDia.test.ts`
```ts
import { describe, it, expect } from "vitest";
import { agruparTarefasPorDia } from "../useTarefas";

const tarefa = (data: string, concluida = false) => ({
  id: data,
  titulo: "t",
  data_agendada: data,
  concluida,
});

describe("agruparTarefasPorDia", () => {
  it("separa atrasadas, hoje, amanhã, semana, próximas", () => {
    const hoje = new Date();
    const ontem = new Date(hoje); ontem.setDate(hoje.getDate() - 1);
    const amanha = new Date(hoje); amanha.setDate(hoje.getDate() + 1);
    const semanaProx = new Date(hoje); semanaProx.setDate(hoje.getDate() + 3);
    const longeDemais = new Date(hoje); longeDemais.setDate(hoje.getDate() + 30);

    const grupos = agruparTarefasPorDia([
      tarefa(ontem.toISOString()),
      tarefa(hoje.toISOString()),
      tarefa(amanha.toISOString()),
      tarefa(semanaProx.toISOString()),
      tarefa(longeDemais.toISOString()),
    ]);

    expect(grupos.atrasadas).toHaveLength(1);
    expect(grupos.hoje).toHaveLength(1);
    expect(grupos.amanha).toHaveLength(1);
    expect(grupos.estaSemana).toHaveLength(1);
    expect(grupos.proximas).toHaveLength(1);
  });

  it("tarefas concluídas não vão para atrasadas", () => {
    const ontem = new Date(); ontem.setDate(ontem.getDate() - 1);
    const grupos = agruparTarefasPorDia([tarefa(ontem.toISOString(), true)]);
    expect(grupos.atrasadas).toHaveLength(0);
  });
});
```

### B.3 `src/hooks/__tests__/useBoards.test.tsx`
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { mockSupabase } from "@/test/supabaseMock";
import { QueryWrapper } from "@/test/queryWrapper";

const sb = mockSupabase();
vi.mock("@/integrations/supabase/client", () => ({ supabase: sb }));

import { useBoards } from "../useBoards";

describe("useBoards", () => {
  beforeEach(() => {
    sb.setTable("boards", [
      { id: "1", nome: "Seguidores", tipo_entidade: "contact" },
      { id: "2", nome: "Ação de Rua", tipo_entidade: "contact" },
    ]);
  });

  it("retorna lista de boards", async () => {
    const { result } = renderHook(() => useBoards(), { wrapper: QueryWrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0].nome).toBe("Seguidores");
  });
});
```

### B.4 `src/hooks/__tests__/useBoardItems.move.test.tsx`
Testa `useMoveItem`: dado um item, mutation chama `update` com `stage_id` novo e `moved_at = agora`. Ver mock de `.update` recebe args corretos.

### B.5 `src/hooks/__tests__/useTarefas.test.tsx`
Testa que `useTarefas({ periodo: 'hoje' })` filtra corretamente via `.gte`/`.lte` chamadas no mock.

### B.6 `src/hooks/__tests__/useCustomFields.test.tsx`
Testa que `useCreateCustomField({ rotulo: 'Foo Bar' })` chama `.insert` com `chave: 'foo_bar'` (slugify integrado).

### B.7 `src/components/board/__tests__/BoardCard.test.tsx`
Teste simples de componente: renderiza dados do contato, badge de "parado há X dias" aparece quando `moved_at` > 5 dias atrás, não aparece quando < 5 dias.

### B.8 `src/components/contacts/__tests__/CustomFieldInput.test.tsx`
Dado um `campo.tipo = 'data'`, renderiza DatePicker. Dado `tipo = 'selecao'`, renderiza Select com as opções. Cobre a polimorfia por tipo — ponto sensível.

---

## Parte C — Integração com CI
- Adicionar `npm run test` como etapa obrigatória antes de `npm run build`
- Se tiver GitHub Actions: rodar `npm run test -- --reporter=verbose` no CI
- **Não quebrar a main por falha de teste no início** — setar `"test": "vitest run --passWithNoTests"` temporariamente se necessário durante os primeiros commits

## Critérios de Aceite
- [ ] `npm run test` executa sem erro mesmo sem nenhum teste
- [ ] `vitest.config.ts`, `src/test/setup.ts`, `src/test/queryWrapper.tsx`, `src/test/supabaseMock.ts` criados
- [ ] 8 testes prioritários escritos e **todos passando**
- [ ] `npm run test` mostra "8 passed"
- [ ] `npm run build` continua funcionando sem regressão
- [ ] Helpers de teste documentados em comentário no topo de cada arquivo

## Como testar
```bash
npm install
npm run test        # roda e sai (CI mode)
npm run test:watch  # modo watch interativo
```

## Dívidas técnicas aceitas
- Sem cobertura de código (%). Adicionar `--coverage` em iteração futura.
- Sem snapshot tests.
- Componentes complexos (Board, Tarefas, Settings) não têm testes nesta issue — só hooks e helpers. Testes de UI ficam como follow-up opcional por módulo.
- Testes E2E (Playwright) ficam totalmente fora de escopo deste merge.

## Referências
- Setup copiado de: `C:/Users/Sporte/Antigravity/CRM - Milena -NaMi V2/vitest.config.ts` + `src/test/setup.ts`
- Padrão de mock Supabase adaptado de: `C:/Users/Sporte/Antigravity/Nosso CRM - Thales Laray/` (vi.hoisted pattern)
