-- RAQ-MAND-EM054 — Suporte a campo de vídeo nos formulários
--
-- Why: usuário pediu poder enviar vídeo (além de imagem/GIF) como elemento do form.
-- Adiciona o tipo 'video' ao CHECK de formulario_campos e libera mimes de vídeo
-- (+ aumenta o teto de tamanho) no bucket público 'formularios'.
-- Reference: RAQ-MAND-EM054
-- Rollback:
--   ALTER TABLE public.formulario_campos DROP CONSTRAINT formulario_campos_tipo_check;
--   (recriar sem 'video') + UPDATE storage.buckets ... (remover mimes de vídeo)

-- 1. Adiciona 'video' ao CHECK de tipo
ALTER TABLE public.formulario_campos
  DROP CONSTRAINT IF EXISTS formulario_campos_tipo_check;

ALTER TABLE public.formulario_campos
  ADD CONSTRAINT formulario_campos_tipo_check CHECK (tipo IN (
    'texto_curto', 'paragrafo', 'telefone', 'email',
    'cpf', 'escolha_unica', 'checkboxes', 'lista',
    'data', 'imagem', 'video', 'secao'
  ));

-- 2. Libera mimes de vídeo no bucket + aumenta o teto p/ 50 MB (vídeos são maiores)
UPDATE storage.buckets
SET file_size_limit = 52428800,  -- 50 MB
    allowed_mime_types = ARRAY[
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'video/mp4', 'video/webm', 'video/quicktime'
    ]
WHERE id = 'formularios';
