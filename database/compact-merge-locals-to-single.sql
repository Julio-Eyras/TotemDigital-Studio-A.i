-- =============================================================================
-- compact-merge-locals-to-single.sql
-- Migração opcional: quando se deseja deliberadamente colapsar vários locais do
-- mesmo publisher num único registro (ex.: limpeza legada). O modo compacto
-- admite VÁRIOS locais; a restrição é apenas UM publisher — não é obrigatório
-- executar este script em instalações compactas normais.
--
-- Escolha do local mantido:
--   1) Menor local_id entre os que já têm totem (publisher alvo);
--   2) Se não houver totem, menor local_id do publisher.
--
-- Atualiza antes de apagar:
--   - totems.local_id
--   - campaign_locals (garante par campaign_id + local mantido; remove duplicatas lógicas)
--   - dispatcher_decisions.local_id (quando apontava a local removido)
--
-- Uso (exemplo):
--   psql -v ON_ERROR_STOP=1 -U smartsignage -d smartsignage -f database/compact-merge-locals-to-single.sql
--
-- Se existir mais de um publisher ATIVO, edite target_publisher_id abaixo (não deixe NULL).
-- =============================================================================

DO $$
DECLARE
  -- NULL = usar o único publisher ativo. Se houver vários ativos, defina o id aqui (ex.: 1).
  target_publisher_id INTEGER := NULL;

  v_keep INTEGER;
  active_pub_count INTEGER;
BEGIN
  IF target_publisher_id IS NULL THEN
    SELECT COUNT(*)::int INTO active_pub_count
    FROM publishers
    WHERE COALESCE(is_active, true);

    IF active_pub_count = 0 THEN
      RAISE EXCEPTION 'compact-merge-locals: nenhum publisher ativo.';
    END IF;

    IF active_pub_count > 1 THEN
      RAISE EXCEPTION
        'compact-merge-locals: há % publishers ativos. Defina target_publisher_id no início do script.',
        active_pub_count;
    END IF;

    SELECT p.publisher_id INTO target_publisher_id
    FROM publishers p
    WHERE COALESCE(p.is_active, true)
    ORDER BY p.publisher_id ASC
    LIMIT 1;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM publishers WHERE publisher_id = target_publisher_id) THEN
    RAISE EXCEPTION 'compact-merge-locals: publisher_id=% não existe.', target_publisher_id;
  END IF;

  SELECT COALESCE(
    (
      SELECT MIN(t.local_id)
      FROM totems t
      INNER JOIN locals l ON l.local_id = t.local_id
      WHERE l.publisher_id = target_publisher_id
    ),
    (
      SELECT MIN(l2.local_id)
      FROM locals l2
      WHERE l2.publisher_id = target_publisher_id
    )
  ) INTO v_keep;

  IF v_keep IS NULL THEN
    RAISE NOTICE 'compact-merge-locals: publisher % sem linhas em locals; nada a fazer.', target_publisher_id;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM locals
    WHERE publisher_id = target_publisher_id AND local_id <> v_keep
  ) THEN
    RAISE NOTICE 'compact-merge-locals: publisher % já tem apenas o local_id %.',
      target_publisher_id, v_keep;
    RETURN;
  END IF;

  UPDATE totems t
  SET local_id = v_keep
  FROM locals l
  WHERE t.local_id = l.local_id
    AND l.publisher_id = target_publisher_id
    AND t.local_id <> v_keep;

  INSERT INTO campaign_locals (campaign_id, local_id, is_active)
  SELECT DISTINCT cl.campaign_id, v_keep, COALESCE(cl.is_active, true)
  FROM campaign_locals cl
  INNER JOIN locals l ON l.local_id = cl.local_id
  WHERE l.publisher_id = target_publisher_id
    AND cl.local_id <> v_keep
  ON CONFLICT (campaign_id, local_id) DO NOTHING;

  DELETE FROM campaign_locals cl
  USING locals l
  WHERE cl.local_id = l.local_id
    AND l.publisher_id = target_publisher_id
    AND cl.local_id <> v_keep;

  UPDATE dispatcher_decisions d
  SET local_id = v_keep
  FROM locals l
  WHERE d.local_id = l.local_id
    AND l.publisher_id = target_publisher_id
    AND d.local_id <> v_keep;

  DELETE FROM locals
  WHERE publisher_id = target_publisher_id
    AND local_id <> v_keep;

  RAISE NOTICE 'compact-merge-locals: publisher % consolidado no local_id % (demais locais removidos).',
    target_publisher_id, v_keep;
END $$;
