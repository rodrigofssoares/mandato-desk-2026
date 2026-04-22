const INSTAGRAM_PLACEHOLDER = '{{full_name}}';

export function getContactDisplayName(contact: {
  nome?: string | null;
  instagram?: string | null;
}): string {
  const nome = contact.nome?.trim() ?? '';
  const isPlaceholder = nome === '' || nome.includes(INSTAGRAM_PLACEHOLDER);
  if (!isPlaceholder) return nome;

  const handle = contact.instagram?.trim();
  if (handle) return handle.startsWith('@') ? handle : `@${handle}`;

  return nome || '(sem nome)';
}
