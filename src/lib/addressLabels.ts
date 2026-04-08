import jsPDF from 'jspdf';

export interface LabelContact {
  nome: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  origem?: string;
}

interface GenerateLabelsOptions {
  contacts: LabelContact[];
  includeOrigin: boolean;
}

function formatCEP(cep: string): string {
  const digits = cep.replace(/\D/g, '');
  if (digits.length === 8) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return cep;
}

/**
 * Valida se um contato tem endereço completo para etiqueta.
 * Retorna mensagem de erro ou null se válido.
 */
export function validateAddress(contact: Partial<LabelContact>): string | null {
  if (!contact.nome) return 'Falta nome';
  if (!contact.logradouro) return 'Falta logradouro';
  if (!contact.numero) return 'Falta número';
  if (!contact.bairro) return 'Falta bairro';
  if (!contact.cidade) return 'Falta cidade';
  if (!contact.estado) return 'Falta estado/UF';
  if (!contact.cep) return 'Falta CEP';
  return null;
}

/**
 * Gera PDF com etiquetas de endereço — 1 por página A4.
 * Abre diálogo de impressão automaticamente.
 */
export function generateAddressLabels({ contacts, includeOrigin }: GenerateLabelsOptions): void {
  if (contacts.length === 0) return;

  const doc = new jsPDF({ format: 'a4', unit: 'mm' });
  const pageWidth = 210;
  const pageHeight = 297;
  const boxWidth = 120;
  const boxHeight = 55;
  const boxX = (pageWidth - boxWidth) / 2;
  const boxY = (pageHeight - boxHeight) / 2;

  contacts.forEach((contact, index) => {
    if (index > 0) doc.addPage();

    // Borda da caixa
    doc.setDrawColor(180);
    doc.setLineWidth(0.3);
    doc.rect(boxX, boxY, boxWidth, boxHeight);

    const centerX = pageWidth / 2;
    let y = boxY + 12;

    // Linha 1: Nome (16pt bold)
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(contact.nome, centerX, y, { align: 'center' });
    y += 8;

    // Linha 2: Origem/Instituição (14pt, opcional)
    if (includeOrigin && contact.origem) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'normal');
      doc.text(contact.origem, centerX, y, { align: 'center' });
      y += 7;
    }

    // Linha 3: Endereço + número (13pt)
    doc.setFontSize(13);
    doc.setFont('helvetica', 'normal');
    const endereco = `${contact.logradouro}, ${contact.numero}`;
    doc.text(endereco, centerX, y, { align: 'center' });
    y += 7;

    // Linha 4: Bairro + CEP (13pt)
    const bairroCep = `${contact.bairro} - ${formatCEP(contact.cep)}`;
    doc.text(bairroCep, centerX, y, { align: 'center' });
    y += 7;

    // Linha 5: Cidade + UF (13pt)
    const cidadeUf = `${contact.cidade} - ${contact.estado}`;
    doc.text(cidadeUf, centerX, y, { align: 'center' });
  });

  // Abre diálogo de impressão
  doc.autoPrint();
  window.open(doc.output('bloburl'), '_blank');
}
