# Pendências — banco Supabase (pós-apagão de 18/05/2026)

> Contexto: em 18/05/2026 o sistema ficou fora do ar — o banco saturou na
> instância mínima. Resolvido subindo o compute para Small e enxugando o banco
> (migration `085`: purga do `webhook_logs` 215 MB → 744 kB; banco 267 MB → 54 MB;
> crons de minuto reduzidos para 2 min). Estas são as pendências que sobraram.

---

## 1. Downgrade da instância: Small → Micro

- **O quê:** o banco está rodando na instância **Small** (~US$15/mês) desde o
  apagão. Já dá para voltar para a **Micro** (1 GB, ~US$10/mês) — o banco enxuto
  (54 MB) cabe com folga.
- **Como:** painel Supabase → Settings → Compute and Disk → selecionar **Micro**
  → Save. Reinicia o banco (~2-5 min fora do ar) — fazer em horário de baixo uso.
- **Atenção:** a **Nano** NÃO está disponível (projeto está no plano pago Pro;
  Nano é só do plano gratuito). Micro é o piso.
- **Status:** pendente — aguardando o Rodrigo escolher o horário.

## 2. ANTES de conectar mais WhatsApps (~5-10 contas)

Hoje há **1 WhatsApp** conectado. Escalar para ~10 sem os ajustes abaixo
**recria o apagão**. Fazer ANTES de conectar as contas:

- **Reduzir retenção de `zapi_webhook_log`** — hoje 90 dias (cron
  `zapi-purge-webhook-logs`). Com 10 contas chegaria a ~600 MB. Baixar para
  7-14 dias.
- **Reduzir retenção de `zapi_messages`** — hoje 90 dias (cron
  `zapi-purge-messages`). Avaliar 30-45 dias.
- **Subir a instância** conforme a movimentação esperada (gabinete ativo em
  campanha → Small ou Medium).
- **Testar com carga real** — conectar 2-3 contas primeiro, medir, extrapolar.

## 3. Itens opcionais de higiene (sem urgência)

- `google_sync_logs` e `zapi_audit_log` **não têm cron de purga** — crescem
  indefinidamente. Hoje pequenas (2,4 MB e 48 kB). Criar purga eventualmente.
- Revisar os **14 triggers da tabela `contacts`** — possível consolidação;
  o trigger `webhooks_contacts_dispatch` é o que inflou o `webhook_logs`
  durante os syncs do Google Contacts.
- Re-checar o **`pg_stat_statements`** alguns dias após o apagão (o restart
  zerou o histórico) para confirmar que não há query lenta residual.

---

## Referências

- Migration aplicada: `supabase/migrations/085_webhook_logs_purge_and_cron_throttle.sql`
- Scripts operacionais usados: `RODRIGO/manutencao-banco-2026-05-18/`
- Commit: `ed5e8e5` na branch `rodrigo/feature/RAQ-MAND-EM073-...`
