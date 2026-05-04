// Mapeamento fixo de campos CRM -> Google People API (decisão D5 do PRD).
// Exportado separadamente para permitir testes unitários isolados (T09).

export interface ContactRow {
  id: string;
  nome: string | null;
  telefone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
  data_nascimento?: string | null;
  observacoes?: string | null;
  notas_assessor?: string | null;
  instagram?: string | null;
  google_resource_name?: string | null;
  google_etag?: string | null;
}

export interface PeopleApiPerson {
  names?: { displayName: string; givenName: string; familyName?: string }[];
  phoneNumbers?: { value: string; type: string }[];
  emailAddresses?: { value: string }[];
  addresses?: {
    streetAddress?: string;
    city?: string;
    region?: string;
    postalCode?: string;
    country?: string;
    type?: string;
  }[];
  birthdays?: { date: { year?: number; month: number; day: number } }[];
  biographies?: { value: string; contentType: string }[];
  urls?: { value: string; type: string }[];
  etag?: string;
}

/**
 * Mapeia uma linha da tabela `contacts` para o formato do Google People API.
 * Lança erro se `nome` for nulo ou vazio (campo obrigatório pela People API).
 */
export function mapContactToPeopleApi(contact: ContactRow): PeopleApiPerson {
  if (!contact.nome || contact.nome.trim() === '') {
    throw new Error('nome obrigatorio');
  }

  const person: PeopleApiPerson = {};

  // Nome
  person.names = [
    {
      displayName: contact.nome.trim(),
      givenName: contact.nome.trim(),
    },
  ];

  // Telefones
  const phones: { value: string; type: string }[] = [];
  if (contact.telefone && contact.telefone.trim()) {
    phones.push({ value: contact.telefone.trim(), type: 'home' });
  }
  if (contact.whatsapp && contact.whatsapp.trim()) {
    phones.push({ value: contact.whatsapp.trim(), type: 'mobile' });
  }
  if (phones.length > 0) {
    person.phoneNumbers = phones;
  }

  // Email
  if (contact.email && contact.email.trim()) {
    person.emailAddresses = [{ value: contact.email.trim() }];
  }

  // Endereço
  const hasAddress =
    contact.logradouro ||
    contact.numero ||
    contact.complemento ||
    contact.bairro ||
    contact.cidade ||
    contact.estado ||
    contact.cep;

  if (hasAddress) {
    const streetParts = [contact.logradouro, contact.numero, contact.complemento]
      .filter(Boolean)
      .join(', ');

    person.addresses = [
      {
        streetAddress: streetParts || undefined,
        city: contact.cidade ?? undefined,
        region: contact.estado ?? undefined,
        postalCode: contact.cep ?? undefined,
        country: 'Brazil',
        type: 'home',
      },
    ];
  }

  // Data de nascimento
  if (contact.data_nascimento) {
    // Formato esperado: YYYY-MM-DD
    const parts = contact.data_nascimento.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);
      if (!isNaN(month) && !isNaN(day)) {
        person.birthdays = [
          {
            date: {
              year: year > 0 ? year : undefined,
              month,
              day,
            },
          },
        ];
      }
    }
  }

  // Biografias (observações + notas_assessor concatenados)
  const bioParts: string[] = [];
  if (contact.observacoes && contact.observacoes.trim()) {
    bioParts.push(contact.observacoes.trim());
  }
  if (contact.notas_assessor && contact.notas_assessor.trim()) {
    bioParts.push(contact.notas_assessor.trim());
  }
  if (bioParts.length > 0) {
    person.biographies = [
      {
        value: bioParts.join('\n---\n'),
        contentType: 'TEXT_PLAIN',
      },
    ];
  }

  // Instagram
  if (contact.instagram && contact.instagram.trim()) {
    person.urls = [{ value: contact.instagram.trim(), type: 'instagramProfile' }];
  }

  return person;
}
