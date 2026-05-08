-- ============================================================================
-- 035 — Migra contatos com e_multiplicador=true pra tabela leaders
-- ============================================================================
-- Contexto: a flag contacts.e_multiplicador (migration 004) é legado.
-- A tabela leaders (introduzida no merge nossocrm) é o modelo atual.
-- Esta migration cria um registro em leaders pra cada contato com a flag,
-- já com leader_type_id = "Multiplicador", e linka via contacts.leader_id.
--
-- Idempotente: o filtro `leader_id IS NULL` impede duplicar em re-run.
-- A flag e_multiplicador é PRESERVADA (não há perda de informação histórica).
-- ============================================================================

DO $$
DECLARE
  v_contact RECORD;
  v_leader_id UUID;
  v_multiplicador_type_id UUID;
  v_count INT := 0;
BEGIN
  SELECT id INTO v_multiplicador_type_id
  FROM leader_types
  WHERE slug = 'multiplicador'
  LIMIT 1;

  IF v_multiplicador_type_id IS NULL THEN
    RAISE EXCEPTION 'leader_type "multiplicador" não encontrado em leader_types';
  END IF;

  FOR v_contact IN
    SELECT id, nome, telefone, whatsapp, email, instagram,
           data_nascimento, logradouro, bairro, cidade, created_by
    FROM contacts
    WHERE e_multiplicador = true
      AND leader_id IS NULL
      AND merged_into IS NULL
  LOOP
    INSERT INTO leaders (
      nome,
      leader_type_id,
      whatsapp,
      phone,
      email,
      instagram,
      birth_date,
      address,
      neighborhoods,
      city,
      active,
      created_by
    )
    VALUES (
      v_contact.nome,
      v_multiplicador_type_id,
      v_contact.whatsapp,
      v_contact.telefone,
      v_contact.email,
      v_contact.instagram,
      v_contact.data_nascimento,
      v_contact.logradouro,
      CASE WHEN v_contact.bairro IS NOT NULL AND length(trim(v_contact.bairro)) > 0
           THEN ARRAY[v_contact.bairro]
           ELSE NULL
      END,
      v_contact.cidade,
      true,
      v_contact.created_by
    )
    RETURNING id INTO v_leader_id;

    UPDATE contacts
       SET leader_id = v_leader_id
     WHERE id = v_contact.id;

    v_count := v_count + 1;
  END LOOP;

  RAISE NOTICE '035: migrados % contatos para leaders (tipo Multiplicador)', v_count;
END $$;
