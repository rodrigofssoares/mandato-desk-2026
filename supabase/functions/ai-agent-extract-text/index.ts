// Edge Function: ai-agent-extract-text
//
// Extrai texto de arquivos enviados pelo admin (PDF, DOCX, TXT) e persiste
// em ai_agent_attachments para injeção no system_prompt em runtime.
//
// POST multipart:
//   file: arquivo (PDF, DOCX, TXT, máx 5 MB)
//   agent_id: UUID
//
// → { ok: boolean, attachment_id?: UUID, char_count?: number,
//     tokens_estimated?: number, error?: string }
//
// Estratégia de extração:
//   TXT  — leitura direta UTF-8
//   DOCX — descompacta ZIP, extrai word/document.xml, regex <w:t> tags
//   PDF  — se provider OpenAI configurado: usa OpenAI Files API para extração;
//           caso contrário: retorna erro orientando usuário a converter pra TXT/DOCX
//
// Segurança:
//   - JWT + role admin obrigatório
//   - Tamanho máx 5 MB validado antes de ler
//   - Extensão (.pdf/.docx/.txt) validada
//   - Limite de 10 arquivos por agente (validado + trigger no banco)
//   - Filename sanitizado (sem path traversal)
//   - Rate limit: 1 req/s por admin (anti-DoS de processamento pesado)
//
// RAQ-MAND-EM075 — Onda 2

import { corsHeaders, jsonResponse, requireAdmin } from '../_shared/admin-guard.ts';
import { sanitizeForLog } from '../_shared/ai-security.ts';

const MAX_FILE_BYTES       = 5 * 1024 * 1024;  // 5 MB (input comprimido)
const MAX_DECOMPRESSED     = 20 * 1024 * 1024; // 20 MB (output descomprimido — zip bomb guard)
const MAX_TEXT_CHARS       = 100_000;           // salvaguarda: truncar em 100K chars
const ATTACHMENTS_LIMIT    = 10;
const UUID_REGEX           = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Rate limit: 1 req a cada 2 segundos por admin (não usa tabela — in-memory per invocation)
// Implementado via timestamp check de last-call armazenado em ai_rate_limit
async function isExtractRateLimited(
  admin: import('https://esm.sh/@supabase/supabase-js@2').SupabaseClient,
  userId: string,
): Promise<boolean> {
  const since = new Date(Date.now() - 2_000).toISOString();
  const { count } = await admin
    .from('ai_rate_limit')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('ef_name', 'ai-agent-extract-text')
    .gte('called_at', since);
  return (count ?? 0) >= 1;
}

// ── Sanitização de filename ───────────────────────────────────────────────────
// Previne path traversal mesmo que o nome seja apenas armazenado como string.

function sanitizeFilename(name: string): string {
  return name
    .replace(/[/\\<>:"|?*\x00-\x1f]/g, '_') // caracteres perigosos
    .replace(/\.\./g, '_')                   // path traversal
    .slice(0, 255);                          // limite de comprimento
}

// ── Extração de texto ─────────────────────────────────────────────────────────

function extractTxt(buffer: Uint8Array): string {
  return new TextDecoder('utf-8', { fatal: false }).decode(buffer);
}

// PEN-009: limite de iterações no scan byte-a-byte para prevenir DoS via arquivo malformado
// Admin comprometido pode subir ZIP com magic bytes válidos mas sem headers internos,
// forçando 5M iterações × 5 MB = ~3s de CPU por upload bloqueando a EF.
const MAX_PK_SCAN_ITERATIONS = 100_000;

// Localiza uma entry específica no ZIP (Local File Header)
function extractZipEntry(zip: Uint8Array, entryName: string): Uint8Array | null {
  const nameBytes = new TextEncoder().encode(entryName);
  const PK = 0x04034b50; // Local file header signature

  let pos = 0;
  let iterations = 0;
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);

  while (pos + 30 <= zip.byteLength) {
    // PEN-009: early-exit se o scanner ultrapassar o limite de iterações
    if (++iterations > MAX_PK_SCAN_ITERATIONS) {
      throw new Error('zip_scan_limit_exceeded');
    }

    const sig = view.getUint32(pos, true);
    if (sig !== PK) {
      pos++;
      continue;
    }

    const compressionMethod = view.getUint16(pos + 8, true);
    const compressedSize    = view.getUint32(pos + 18, true);
    const filenameLen       = view.getUint16(pos + 26, true);
    const extraLen          = view.getUint16(pos + 28, true);

    const fileNameStart = pos + 30;
    const fileNameEnd   = fileNameStart + filenameLen;
    const dataStart     = fileNameEnd + extraLen;

    if (fileNameEnd > zip.byteLength) break;

    const fileNameBuf = zip.slice(fileNameStart, fileNameEnd);

    if (bytesEqual(fileNameBuf, nameBytes)) {
      if (compressionMethod === 0) {
        // Stored (sem compressão)
        return zip.slice(dataStart, dataStart + compressedSize);
      } else if (compressionMethod === 8) {
        // Deflate
        return zip.slice(dataStart, dataStart + compressedSize);
      }
      return null;
    }

    pos = dataStart + compressedSize;
  }

  return null;
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

async function decompressDeflateAsync(compressed: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  const reader = ds.readable.getReader();

  await writer.write(compressed);
  await writer.close();

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.length;
    // ZIP bomb guard: aborta se output exceder 20 MB
    if (totalBytes > MAX_DECOMPRESSED) {
      await reader.cancel().catch(() => null);
      throw new Error('docx_too_large_decompressed');
    }
    chunks.push(value);
  }

  const result = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

async function extractDocxAsync(buffer: Uint8Array): Promise<string> {
  const nameBytes = new TextEncoder().encode('word/document.xml');
  const PK = 0x04034b50;

  let pos = 0;
  let iterations = 0;
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  let xmlBytes: Uint8Array | null = null;
  let compressionMethod = 0;

  while (pos + 30 <= buffer.byteLength) {
    // PEN-009: early-exit no scan de DOCX também
    if (++iterations > MAX_PK_SCAN_ITERATIONS) {
      throw new Error('zip_scan_limit_exceeded');
    }

    const sig = view.getUint32(pos, true);
    if (sig !== PK) {
      pos++;
      continue;
    }

    compressionMethod            = view.getUint16(pos + 8, true);
    const compressedSize         = view.getUint32(pos + 18, true);
    const filenameLen            = view.getUint16(pos + 26, true);
    const extraLen               = view.getUint16(pos + 28, true);

    const fileNameStart = pos + 30;
    const fileNameEnd   = fileNameStart + filenameLen;
    const dataStart     = fileNameEnd + extraLen;

    if (fileNameEnd > buffer.byteLength) break;

    const fileNameBuf = buffer.slice(fileNameStart, fileNameEnd);

    if (bytesEqual(fileNameBuf, nameBytes)) {
      xmlBytes = buffer.slice(dataStart, dataStart + compressedSize);
      break;
    }

    pos = dataStart + compressedSize;
  }

  if (!xmlBytes) {
    throw new Error('Arquivo DOCX inválido: não contém word/document.xml');
  }

  let xmlDecoded: Uint8Array;
  if (compressionMethod === 8) {
    xmlDecoded = await decompressDeflateAsync(xmlBytes);
  } else {
    xmlDecoded = xmlBytes; // stored
  }

  const xml = new TextDecoder('utf-8', { fatal: false }).decode(xmlDecoded);

  const matches = xml.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g);
  const parts: string[] = [];
  let prevWasSpace = false;

  for (const match of matches) {
    const text = match[1];
    if (text.length === 0) continue;
    if (!prevWasSpace && parts.length > 0) parts.push(' ');
    parts.push(text);
    prevWasSpace = text.endsWith(' ');
  }

  return parts.join('');
}

// ── Validação de magic bytes ──────────────────────────────────────────────────
// Previne file-type spoofing: um arquivo .pdf com payload ZIP (ou vice-versa)
// é rejeitado antes de qualquer processamento.
//
//   PDF  : %PDF-  → 0x25 0x50 0x44 0x46 0x2D
//   DOCX : PK\x03\x04 (ZIP) → 0x50 0x4B 0x03 0x04
//   TXT  : sem magic bytes — valida que os primeiros 512 bytes são UTF-8 válido
//
// Retorna null se OK, ou string descrevendo o problema.

function validateMagicBytes(buffer: Uint8Array, fileType: string): string | null {
  if (fileType === 'pdf') {
    // %PDF- (5 bytes)
    if (
      buffer.length < 5 ||
      buffer[0] !== 0x25 || // %
      buffer[1] !== 0x50 || // P
      buffer[2] !== 0x44 || // D
      buffer[3] !== 0x46 || // F
      buffer[4] !== 0x2D    // -
    ) {
      return 'Arquivo não é um PDF válido (magic bytes incorretos)';
    }
    return null;
  }

  if (fileType === 'docx') {
    // PK\x03\x04 — ZIP local file header (4 bytes)
    if (
      buffer.length < 4 ||
      buffer[0] !== 0x50 || // P
      buffer[1] !== 0x4B || // K
      buffer[2] !== 0x03 ||
      buffer[3] !== 0x04
    ) {
      return 'Arquivo não é um DOCX/ZIP válido (magic bytes incorretos)';
    }
    return null;
  }

  if (fileType === 'txt') {
    // Valida que os primeiros 512 bytes são UTF-8 válido usando fatal=true
    const sample = buffer.slice(0, Math.min(512, buffer.length));
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(sample);
    } catch {
      return 'Arquivo TXT contém bytes inválidos (não é UTF-8)';
    }
    return null;
  }

  return null; // tipo desconhecido: não bloquear (a validação de extensão já cobrirá)
}

// ── Extração de PDF via OpenAI Files API ─────────────────────────────────────

async function extractPdfViaOpenAI(buffer: Uint8Array, filename: string, apiKey: string): Promise<string> {
  // Passo 1: Upload do arquivo para OpenAI Files API
  const formData = new FormData();
  formData.append('purpose', 'assistants');
  formData.append(
    'file',
    new Blob([buffer], { type: 'application/pdf' }),
    filename,
  );

  const uploadRes = await fetch('https://api.openai.com/v1/files', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}` },
    body: formData,
    signal: AbortSignal.timeout(30_000),
  });

  if (!uploadRes.ok) {
    const status = uploadRes.status;
    await uploadRes.text().catch(() => null);
    throw new Error(`OpenAI Files upload falhou: ${status}`);
  }

  const uploadData = await uploadRes.json() as { id: string };
  const fileId = uploadData.id;

  try {
    // Passo 2: Recupera conteúdo do arquivo
    const contentRes = await fetch(`https://api.openai.com/v1/files/${fileId}/content`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(20_000),
    });

    if (!contentRes.ok) {
      await contentRes.text().catch(() => null);
      throw new Error('OpenAI Files content falhou');
    }

    const text = await contentRes.text();
    return text;
  } finally {
    // Limpa o arquivo do OpenAI (best-effort)
    fetch(`https://api.openai.com/v1/files/${fileId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${apiKey}` },
    }).catch(() => null);
  }
}

// ── Handler principal ─────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse(405, { error: 'Método não permitido' });

  try {
    // ── 1. Autenticação + role admin ─────────────────────────────────────────
    const guard = await requireAdmin(req);
    if (guard instanceof Response) return guard;

    if (guard.callerLevel < 100) {
      return jsonResponse(403, { error: 'Apenas administradores podem enviar arquivos' });
    }

    const { admin, callerId } = guard;

    // ── 2. Rate limit (1 req / 2s por admin) ────────────────────────────────
    if (await isExtractRateLimited(admin, callerId)) {
      return jsonResponse(429, { error: 'Aguarde 2 segundos entre envios de arquivo' });
    }

    // Registra a chamada antes de processar
    await admin
      .from('ai_rate_limit')
      .insert({ user_id: callerId, ef_name: 'ai-agent-extract-text' })
      .catch(() => null);

    // ── 3. Parse multipart ───────────────────────────────────────────────────
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return jsonResponse(400, { error: 'Requisição deve ser multipart/form-data' });
    }

    const fileField   = formData.get('file');
    const agentIdRaw  = formData.get('agent_id');

    if (!fileField || !(fileField instanceof File)) {
      return jsonResponse(400, { error: 'Campo file obrigatório' });
    }
    if (!agentIdRaw || typeof agentIdRaw !== 'string' || !UUID_REGEX.test(agentIdRaw)) {
      return jsonResponse(400, { error: 'agent_id inválido' });
    }

    const agentId = agentIdRaw.trim();
    const file = fileField as File;

    // ── 4. Validação de tamanho ──────────────────────────────────────────────
    if (file.size > MAX_FILE_BYTES) {
      return jsonResponse(400, { error: `Arquivo muito grande. Máximo: 5 MB (enviado: ${(file.size / 1024 / 1024).toFixed(1)} MB)` });
    }

    // ── 5. Validação de extensão ─────────────────────────────────────────────
    const rawName = file.name || 'arquivo';
    const ext = rawName.split('.').pop()?.toLowerCase() ?? '';

    if (!['pdf', 'docx', 'txt'].includes(ext)) {
      return jsonResponse(400, { error: 'Tipo não suportado. Use PDF, DOCX ou TXT.' });
    }

    const filename = sanitizeFilename(rawName);

    // ── 6. Valida que agente existe e limite de 10 arquivos ──────────────────
    const { data: agentRow, error: agentErr } = await admin
      .from('ai_agents')
      .select('id')
      .eq('id', agentId)
      .maybeSingle();

    if (agentErr || !agentRow) {
      return jsonResponse(404, { error: 'Agente não encontrado' });
    }

    const { count: attachCount, error: countErr } = await admin
      .from('ai_agent_attachments')
      .select('id', { count: 'exact', head: true })
      .eq('agent_id', agentId);

    if (countErr) {
      return jsonResponse(500, { error: 'Erro ao verificar limite de arquivos' });
    }

    if ((attachCount ?? 0) >= ATTACHMENTS_LIMIT) {
      return jsonResponse(400, { error: `Limite de ${ATTACHMENTS_LIMIT} documentos atingido. Remova um para adicionar outro.` });
    }

    // ── 7. Cria entry de attachment com status='processing' ──────────────────
    const { data: attachment, error: insertErr } = await admin
      .from('ai_agent_attachments')
      .insert({
        agent_id:       agentId,
        filename:       filename,
        file_type:      ext,
        file_size_bytes: file.size,
        status:         'processing',
        created_by:     callerId,
      })
      .select('id')
      .single();

    if (insertErr || !attachment) {
      console.error('ai-agent-extract-text: insert falhou', insertErr?.code);
      return jsonResponse(500, { error: 'Erro ao criar registro do arquivo' });
    }

    const attachmentId = attachment.id as string;

    // ── 8. Lê o buffer do arquivo ────────────────────────────────────────────
    const buffer = new Uint8Array(await file.arrayBuffer());

    // ── 8b. Valida magic bytes (previne file-type spoofing) ──────────────────
    const magicError = validateMagicBytes(buffer, ext);
    if (magicError) {
      // Marca attachment como erro antes de retornar
      await admin
        .from('ai_agent_attachments')
        .update({ status: 'error', error_message: magicError })
        .eq('id', attachmentId);
      return jsonResponse(400, { ok: false, error: 'invalid_file_type', hint: magicError });
    }

    // ── 9. Extrai texto conforme tipo ────────────────────────────────────────
    let extractedText: string;

    try {
      if (ext === 'txt') {
        extractedText = extractTxt(buffer);
      } else if (ext === 'docx') {
        extractedText = await extractDocxAsync(buffer);
      } else {
        // PDF: tenta via OpenAI Files API se provider OpenAI estiver configurado
        const { data: cred } = await admin
          .from('ai_provider_credentials')
          .select('api_key, is_active')
          .eq('provider', 'openai')
          .maybeSingle();

        if (!cred || !cred.is_active || !cred.api_key) {
          // Sem OpenAI configurado: atualiza status e orienta o usuário
          await admin
            .from('ai_agent_attachments')
            .update({ status: 'error', error_message: 'PDF requer OpenAI configurado. Converta para DOCX ou TXT.' })
            .eq('id', attachmentId);

          return jsonResponse(400, {
            ok: false,
            error: 'pdf_not_supported_without_openai',
            hint: 'Configure uma chave OpenAI em Conexões para habilitar extração de PDF, ou converta o arquivo para DOCX ou TXT.',
          });
        }

        extractedText = await extractPdfViaOpenAI(buffer, filename, cred.api_key as string);
      }
    } catch (extractErr) {
      const msg = extractErr instanceof Error ? extractErr.message : String(extractErr);
      console.error('ai-agent-extract-text: extração falhou', sanitizeForLog(msg));

      // ZIP bomb: DOCX expandiu além de 20 MB após descompressão
      if (msg === 'docx_too_large_decompressed') {
        await admin
          .from('ai_agent_attachments')
          .update({ status: 'error', error_message: 'DOCX muito grande após descompressão (máx 20 MB). Reduza o arquivo.' })
          .eq('id', attachmentId);
        return jsonResponse(400, { ok: false, error: 'docx_too_large_decompressed', hint: 'O DOCX expande para mais de 20 MB após descompressão. Converta para TXT ou reduza o conteúdo.' });
      }

      await admin
        .from('ai_agent_attachments')
        .update({ status: 'error', error_message: 'Falha na extração de texto. Tente outro formato.' })
        .eq('id', attachmentId);

      return jsonResponse(422, { ok: false, error: 'extraction_failed', hint: 'Falha ao extrair texto. Tente converter para TXT.' });
    }

    // ── 10. Trunca se necessário + estima tokens ──────────────────────────────
    const truncated = extractedText.length > MAX_TEXT_CHARS
      ? extractedText.slice(0, MAX_TEXT_CHARS) + '\n[...texto truncado em 100.000 caracteres]'
      : extractedText;

    const charCount       = truncated.length;
    const tokensEstimated = Math.ceil(charCount / 4); // aprox 4 chars por token

    // ── 11. Persiste texto extraído com status='ready' ───────────────────────
    const { error: updateErr } = await admin
      .from('ai_agent_attachments')
      .update({
        extracted_text:   truncated,
        tokens_estimated: tokensEstimated,
        status:           'ready',
      })
      .eq('id', attachmentId);

    if (updateErr) {
      console.error('ai-agent-extract-text: update texto falhou', updateErr.code);
      return jsonResponse(500, { ok: false, error: 'Erro ao salvar texto extraído' });
    }

    console.log('ai-agent-extract-text: ok', {
      caller: callerId,
      agentId,
      ext,
      charCount,
      tokensEstimated,
    });

    return jsonResponse(200, {
      ok: true,
      attachment_id:    attachmentId,
      char_count:       charCount,
      tokens_estimated: tokensEstimated,
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack?.split('\n').slice(0, 4).join(' | ') : '';
    console.error('ai-agent-extract-text crash:', sanitizeForLog(msg), '|', sanitizeForLog(stack ?? ''));
    return jsonResponse(500, { error: `Erro interno: ${msg}`, _debug_stack: stack });
  }
});
