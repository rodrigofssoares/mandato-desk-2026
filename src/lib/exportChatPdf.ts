// ─── exportChatPdf (T53 — C31) ───────────────────────────────────────────────
// Gera um PDF com o histórico de mensagens de uma conversa.
// Puramente client-side via jspdf + jspdf-autotable. Sem EF, sem upload.
//
// Pattern: usado em fluxo-financeiro-pro e health-insights-hub.

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ZapiMessage } from '@/hooks/useZapiMessages';
import type { ZapiChat } from '@/hooks/useZapiChats';
import { formatPhone } from '@/lib/zapi-format';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  try {
    return format(new Date(iso), "dd/MM/yy HH:mm", { locale: ptBR });
  } catch {
    return iso;
  }
}

/** Retorna o remetente da mensagem: "Atendente" ou nome/telefone do contato. */
function getSender(msg: ZapiMessage, chat: ZapiChat): string {
  if (msg.direction === 'outbound') return 'Atendente';
  return chat.contact_name ?? chat.whatsapp_name ?? formatPhone(chat.phone);
}

/** Converte uma mensagem para texto legível para o PDF. */
function getMessageText(msg: ZapiMessage): string {
  // Mensagem apagada
  if (msg.deleted_at) return '[Mensagem apagada]';

  // Mensagem editada — usa edited_body se disponível
  const body = msg.edited_body ?? msg.body;
  const mediaType = (msg as { media_type?: string }).media_type ?? 'text';
  const prefix = msg.edited_body ? '[Editado] ' : '';

  switch (mediaType) {
    case 'image':
      return `${prefix}[Imagem]${body ? `: ${body}` : ''}`;
    case 'video':
      return `${prefix}[Vídeo]${body ? `: ${body}` : ''}`;
    case 'audio':
      return `${prefix}[Áudio]`;
    case 'document': {
      const meta = (msg as { media_metadata?: { file_name?: string } }).media_metadata;
      const fileName = meta?.file_name ?? '';
      return `${prefix}[Documento${fileName ? `: ${fileName}` : ''}]`;
    }
    case 'sticker':
      return `${prefix}[Figurinha]`;
    case 'location': {
      const meta = (msg as { media_metadata?: { address?: string } }).media_metadata;
      return `${prefix}[Localização${meta?.address ? `: ${meta.address}` : ''}]`;
    }
    case 'contact':
      return `${prefix}[Contato]`;
    case 'poll':
      return `${prefix}[Enquete]${body ? `: ${body}` : ''}`;
    case 'reaction':
      return `${prefix}[Reação]`;
    default:
      return body ? `${prefix}${body.slice(0, 500)}` : '[Mensagem]';
  }
}

// ─── Função principal ─────────────────────────────────────────────────────────

/**
 * Gera e faz o download de um PDF com o histórico de mensagens.
 * @param chat - Conversa (ZapiChat)
 * @param messages - Mensagens em ordem cronológica crescente
 * @param accountName - Nome da conta Z-API (para o cabeçalho)
 */
export function exportChatToPdf(
  chat: ZapiChat,
  messages: ZapiMessage[],
  accountName?: string,
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const contactDisplayName = chat.contact_name ?? chat.whatsapp_name ?? formatPhone(chat.phone);
  const exportDate = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  const fileName = `conversa_${contactDisplayName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;

  // ── Cabeçalho ──────────────────────────────────────────────────────────────

  // Linha 1: título
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Mandato Desk 2026 — Histórico de Conversa', 15, 18);

  // Linha 2: conta e data
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120);
  doc.text(
    `Conta: ${accountName ?? 'N/A'}   |   Exportado em: ${exportDate}`,
    15,
    25,
  );

  // ── Dados do eleitor ──────────────────────────────────────────────────────

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30);
  doc.text('Dados do contato', 15, 34);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Nome: ${contactDisplayName}`, 15, 40);
  doc.text(`Telefone: ${formatPhone(chat.phone)}`, 15, 46);
  if (chat.contact_name && chat.whatsapp_name && chat.contact_name !== chat.whatsapp_name) {
    doc.text(`WhatsApp: ${chat.whatsapp_name}`, 15, 52);
  }

  // Linha separadora
  doc.setDrawColor(200);
  doc.line(15, 56, 195, 56);

  // ── Tabela de mensagens ───────────────────────────────────────────────────

  // Ordenar mensagens por data crescente
  const sortedMessages = [...messages].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  const rows = sortedMessages.map((msg) => [
    formatDateTime(msg.created_at),
    getSender(msg, chat),
    getMessageText(msg),
  ]);

  autoTable(doc, {
    startY: 60,
    head: [['Data/Hora', 'De', 'Mensagem']],
    body: rows,
    headStyles: {
      fillColor: [40, 40, 60],
      fontSize: 9,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 8,
      cellPadding: 2,
    },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 35 },
      2: { cellWidth: 'auto' },
    },
    alternateRowStyles: { fillColor: [248, 248, 252] },
    margin: { left: 15, right: 15 },
    didDrawPage: (data) => {
      // Rodapé em cada página
      const pageCount = doc.getNumberOfPages();
      const currentPage = data.pageNumber;
      doc.setFontSize(8);
      doc.setTextColor(160);
      doc.text(
        `Exportado em ${exportDate} — Página ${currentPage} de ${pageCount}`,
        15,
        doc.internal.pageSize.height - 8,
      );
    },
  });

  doc.save(fileName);
}
