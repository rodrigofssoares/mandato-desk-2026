/**
 * ESPELHO DA FUNÇÃO SQL `calc_contact_ranking_score` em `037_compute_contact_ranking.sql`
 *
 * ATENÇÃO: qualquer alteração nos pesos ou critérios DEVE ser aplicada
 * simultaneamente aqui e na migration SQL. As duas implementações precisam
 * permanecer idênticas para que o preview otimista na UI bata com o valor
 * que o banco grava.
 *
 * Uso principal: preview em tempo real no ContactDialog enquanto o usuário
 * edita campos antes de salvar. O valor definitivo vem sempre do banco
 * (calculado pelo trigger PostgreSQL).
 *
 * @see supabase/migrations/037_compute_contact_ranking.sql
 */

/**
 * Subconjunto mínimo dos campos de `contacts` necessários para o cálculo.
 * Todos opcionais para aceitar dados parciais (form em edição, contato recém-criado).
 */
export interface ContactLike {
  whatsapp?: string | null;
  telefone?: string | null;
  email?: string | null;
  data_nascimento?: string | null;
  leader_id?: string | null;
  declarou_voto?: boolean | null;
  e_multiplicador?: boolean | null;
  aceita_whatsapp?: boolean | null;
  em_canal_whatsapp?: boolean | null;
  instagram?: string | null;
  twitter?: string | null;
  tiktok?: string | null;
  youtube?: string | null;
  cep?: string | null;
  logradouro?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
}

/** Um item individual dentro do breakdown de categoria */
export interface RankingItem {
  label: string;
  peso: number;
  marcado: boolean;
}

/** Resultado de uma categoria de pontuação */
export interface RankingCategoria {
  /** Ex: 'A', 'B', 'C', 'D', 'E' */
  categoria: string;
  label: string;
  pontosObtidos: number;
  pontosMaximos: number;
  itens: RankingItem[];
}

/** Resultado completo do cálculo, com score bruto e ranking derivado */
export interface RankingBreakdown {
  /** Score bruto interno (0-100) */
  score: number;
  /** Ranking derivado (0-10): LEAST(FLOOR(score / 10), 10) */
  ranking: number;
  categorias: RankingCategoria[];
}

function preenchido(valor: string | null | undefined): boolean {
  return valor !== null && valor !== undefined && valor.trim() !== '';
}

/**
 * Calcula o ranking de engajamento de um contato.
 *
 * @param contact - Dados do contato (parciais — campos ausentes equivalem a vazio/false)
 * @param campaignValues - Mapa de field_id → boolean indicando se o campo está marcado
 * @param totalCampaignFields - Total de campos de campanha ativos no tenant
 *   (zero = categoria E contribui 0 pts, sem divisão por zero)
 * @returns Breakdown completo com score bruto, ranking 0-10 e detalhamento por categoria
 */
export function computeRankingScore(
  contact: ContactLike,
  campaignValues: Record<string, boolean> = {},
  totalCampaignFields: number = 0
): RankingBreakdown {
  // -------------------------------------------------------------------------
  // Categoria A — Status de campanha (máx 50 pts)
  // -------------------------------------------------------------------------
  const itensA: RankingItem[] = [
    { label: 'Declarou voto',       peso: 20, marcado: contact.declarou_voto === true },
    { label: 'É multiplicador',     peso: 15, marcado: contact.e_multiplicador === true },
    { label: 'Aceita WhatsApp',     peso: 10, marcado: contact.aceita_whatsapp === true },
    { label: 'No canal WhatsApp',   peso:  5, marcado: contact.em_canal_whatsapp === true },
  ];
  const ptsA = itensA.reduce((acc, i) => acc + (i.marcado ? i.peso : 0), 0);

  // -------------------------------------------------------------------------
  // Categoria B — Dados de contato e pessoais (máx 25 pts)
  // -------------------------------------------------------------------------
  const itensB: RankingItem[] = [
    { label: 'WhatsApp preenchido',        peso: 8, marcado: preenchido(contact.whatsapp) },
    { label: 'Articulador vinculado',      peso: 7, marcado: contact.leader_id != null && contact.leader_id !== '' },
    { label: 'E-mail preenchido',          peso: 4, marcado: preenchido(contact.email) },
    { label: 'Data de nascimento',         peso: 3, marcado: preenchido(contact.data_nascimento) },
    { label: 'Telefone preenchido',        peso: 3, marcado: preenchido(contact.telefone) },
  ];
  const ptsB = itensB.reduce((acc, i) => acc + (i.marcado ? i.peso : 0), 0);

  // -------------------------------------------------------------------------
  // Categoria C — Endereço (máx 15 pts)
  // -------------------------------------------------------------------------
  const temBairroECidade = preenchido(contact.bairro) && preenchido(contact.cidade);
  const itensC: RankingItem[] = [
    { label: 'Bairro + cidade',    peso: 7, marcado: temBairroECidade },
    { label: 'CEP',                peso: 4, marcado: preenchido(contact.cep) },
    { label: 'Estado',             peso: 2, marcado: preenchido(contact.estado) },
    { label: 'Logradouro',         peso: 2, marcado: preenchido(contact.logradouro) },
  ];
  const ptsC = itensC.reduce((acc, i) => acc + (i.marcado ? i.peso : 0), 0);

  // -------------------------------------------------------------------------
  // Categoria D — Redes sociais (máx 5 pts)
  // Instagram vale +3; twitter, tiktok, youtube — +1 cada, máx 2 extras
  // -------------------------------------------------------------------------
  const temInstagram = preenchido(contact.instagram);
  let redesExtras = 0;
  if (preenchido(contact.twitter))  redesExtras += 1;
  if (preenchido(contact.tiktok))   redesExtras += 1;
  if (preenchido(contact.youtube))  redesExtras += 1;
  const extrasLimitados = Math.min(redesExtras, 2);

  const itensD: RankingItem[] = [
    { label: 'Instagram',    peso: 3, marcado: temInstagram },
    { label: 'Twitter/X',    peso: 1, marcado: preenchido(contact.twitter) },
    { label: 'TikTok',       peso: 1, marcado: preenchido(contact.tiktok) },
    { label: 'YouTube',      peso: 1, marcado: preenchido(contact.youtube) },
  ];

  // Pontuação respeitando o cap: instagram=3 + min(extras, 2)
  const ptsD = (temInstagram ? 3 : 0) + extrasLimitados;

  // -------------------------------------------------------------------------
  // Categoria E — Campos de campanha customizáveis (máx 5 pts)
  // -------------------------------------------------------------------------
  const camposAtivos = Object.values(campaignValues).filter(Boolean).length;
  let ptsE = 0;
  if (totalCampaignFields > 0) {
    const ptsPorCampo = Math.floor(5 / totalCampaignFields);
    ptsE = Math.min(camposAtivos * ptsPorCampo, 5);
  }

  const itensE: RankingItem[] = [
    {
      label: `${camposAtivos} de ${totalCampaignFields} campos ativos`,
      peso: 5,
      marcado: ptsE > 0,
    },
  ];

  // -------------------------------------------------------------------------
  // Score final
  // -------------------------------------------------------------------------
  const scoreTotal = ptsA + ptsB + ptsC + ptsD + ptsE;
  const ranking = Math.min(Math.floor(scoreTotal / 10), 10);

  return {
    score: scoreTotal,
    ranking,
    categorias: [
      {
        categoria: 'A',
        label: 'Status de campanha',
        pontosObtidos: ptsA,
        pontosMaximos: 50,
        itens: itensA,
      },
      {
        categoria: 'B',
        label: 'Dados de contato e pessoais',
        pontosObtidos: ptsB,
        pontosMaximos: 25,
        itens: itensB,
      },
      {
        categoria: 'C',
        label: 'Endereço',
        pontosObtidos: ptsC,
        pontosMaximos: 15,
        itens: itensC,
      },
      {
        categoria: 'D',
        label: 'Redes sociais',
        pontosObtidos: ptsD,
        pontosMaximos: 5,
        itens: itensD,
      },
      {
        categoria: 'E',
        label: 'Campos de campanha',
        pontosObtidos: ptsE,
        pontosMaximos: 5,
        itens: itensE,
      },
    ],
  };
}
