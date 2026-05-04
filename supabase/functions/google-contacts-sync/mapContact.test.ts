// Testes unitários para mapContactToPeopleApi (T09)
// Rodados via: deno test supabase/functions/google-contacts-sync/mapContact.test.ts

import { assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { mapContactToPeopleApi, type ContactRow } from './mapContact.ts';

const baseContact: ContactRow = {
  id: '00000000-0000-0000-0000-000000000001',
  nome: 'Maria Silva',
  telefone: '(11) 99999-1234',
  whatsapp: '(11) 98888-5678',
  email: 'maria@exemplo.com',
  logradouro: 'Rua das Flores',
  numero: '42',
  complemento: 'Apto 3',
  bairro: 'Centro',
  cidade: 'Sao Paulo',
  estado: 'SP',
  cep: '01310-100',
  data_nascimento: '1985-03-15',
  observacoes: 'Apoiadora desde 2022',
  notas_assessor: 'Reuniao agendada para maio',
  instagram: 'https://instagram.com/mariasilva',
};

Deno.test('mapContactToPeopleApi — contato completo mapeia todos os 8 campos de D5', () => {
  const result = mapContactToPeopleApi(baseContact);

  // Nome
  assertEquals(result.names?.[0].displayName, 'Maria Silva');
  assertEquals(result.names?.[0].givenName, 'Maria Silva');

  // Telefone (home) e WhatsApp (mobile)
  const telefone = result.phoneNumbers?.find((p) => p.type === 'home');
  const whatsapp = result.phoneNumbers?.find((p) => p.type === 'mobile');
  assertEquals(telefone?.value, '(11) 99999-1234');
  assertEquals(whatsapp?.value, '(11) 98888-5678');

  // Email
  assertEquals(result.emailAddresses?.[0].value, 'maria@exemplo.com');

  // Endereço
  assertEquals(result.addresses?.[0].city, 'Sao Paulo');
  assertEquals(result.addresses?.[0].region, 'SP');
  assertEquals(result.addresses?.[0].postalCode, '01310-100');
  assertEquals(result.addresses?.[0].country, 'Brazil');

  // Aniversário
  assertEquals(result.birthdays?.[0].date.year, 1985);
  assertEquals(result.birthdays?.[0].date.month, 3);
  assertEquals(result.birthdays?.[0].date.day, 15);

  // Biografia concatenada
  assertEquals(
    result.biographies?.[0].value,
    'Apoiadora desde 2022\n---\nReuniao agendada para maio',
  );

  // Instagram
  assertEquals(result.urls?.[0].type, 'instagramProfile');
  assertEquals(result.urls?.[0].value, 'https://instagram.com/mariasilva');
});

Deno.test('mapContactToPeopleApi — telefone tipo home, whatsapp tipo mobile', () => {
  const contact: ContactRow = {
    ...baseContact,
    email: null,
    logradouro: null,
    data_nascimento: null,
    observacoes: null,
    notas_assessor: null,
    instagram: null,
  };
  const result = mapContactToPeopleApi(contact);

  const telefone = result.phoneNumbers?.find((p) => p.type === 'home');
  const whatsapp = result.phoneNumbers?.find((p) => p.type === 'mobile');

  assertEquals(telefone?.type, 'home');
  assertEquals(whatsapp?.type, 'mobile');
});

Deno.test('mapContactToPeopleApi — endereco completo mapeado corretamente', () => {
  const result = mapContactToPeopleApi(baseContact);

  const addr = result.addresses?.[0];
  assertEquals(addr?.city, 'Sao Paulo');
  assertEquals(addr?.region, 'SP');
  assertEquals(addr?.postalCode, '01310-100');
  assertEquals(addr?.country, 'Brazil');
  // streetAddress deve incluir logradouro e numero
  assertEquals(addr?.streetAddress?.includes('Rua das Flores'), true);
  assertEquals(addr?.streetAddress?.includes('42'), true);
});

Deno.test('mapContactToPeopleApi — observacoes e notas_assessor concatenados com separador', () => {
  const result = mapContactToPeopleApi(baseContact);

  const bio = result.biographies?.[0].value ?? '';
  assertEquals(bio.includes('Apoiadora desde 2022'), true);
  assertEquals(bio.includes('\n---\n'), true);
  assertEquals(bio.includes('Reuniao agendada para maio'), true);
});

Deno.test('mapContactToPeopleApi — nome vazio lanca erro', () => {
  const contact: ContactRow = { ...baseContact, nome: '' };
  assertThrows(() => mapContactToPeopleApi(contact), Error, 'nome obrigatorio');
});

Deno.test('mapContactToPeopleApi — nome null lanca erro', () => {
  const contact: ContactRow = { ...baseContact, nome: null };
  assertThrows(() => mapContactToPeopleApi(contact), Error, 'nome obrigatorio');
});

Deno.test('mapContactToPeopleApi — campos sem equivalente na People API nao aparecem no payload', () => {
  const result = mapContactToPeopleApi(baseContact);

  // Os campos ranking, declarou_voto, leader_id nao devem existir no payload
  assertEquals((result as Record<string, unknown>).ranking, undefined);
  assertEquals((result as Record<string, unknown>).declarou_voto, undefined);
  assertEquals((result as Record<string, unknown>).leader_id, undefined);
  assertEquals((result as Record<string, unknown>).is_favorite, undefined);
});
