-- =============================================
-- VALIDAÇÃO DE INTEGRIDADE REFERENCIAL - Seeds
-- Smart Signage Pro v2.1 - PLANO_MELHORIAS item 8
--
-- Executar APÓS carga-inicial-v6.sql (ou seeds) para validar FKs.
-- Esperado: 0 linhas em cada consulta de inconsistência.
-- =============================================

\echo '========================================='
\echo ' Validação de Integridade - Seeds v6'
\echo '========================================='

-- 1. locals.publisher_id deve existir em publishers
\echo '[1] locals com publisher_id inválido (esperado: 0 linhas)'
SELECT l.local_id, l.name, l.publisher_id
FROM locals l
LEFT JOIN publishers p ON p.publisher_id = l.publisher_id
WHERE p.publisher_id IS NULL;
\echo ''

-- 2. totems.local_id deve existir em locals
\echo '[2] totems com local_id inválido (esperado: 0 linhas)'
SELECT t.totem_id, t.identifier, t.local_id
FROM totems t
LEFT JOIN locals l ON l.local_id = t.local_id
WHERE l.local_id IS NULL;
\echo ''

-- 3. smart_tvs.totem_id deve existir em totems
\echo '[3] smart_tvs com totem_id inválido (esperado: 0 linhas)'
SELECT st.smart_tv_id, st.identifier, st.totem_id
FROM smart_tvs st
LEFT JOIN totems t ON t.totem_id = st.totem_id
WHERE t.totem_id IS NULL;
\echo ''

-- 4. medias.subscriber_id deve existir em subscribers
\echo '[4] medias com subscriber_id inválido (esperado: 0 linhas)'
SELECT m.media_id, m.name, m.subscriber_id
FROM medias m
LEFT JOIN subscribers s ON s.subscriber_id = m.subscriber_id
WHERE s.subscriber_id IS NULL;
\echo ''

-- 5. users.publisher_id / subscriber_id devem existir quando preenchidos
\echo '[5] users com publisher_id ou subscriber_id inválido (esperado: 0 linhas)'
SELECT u.id, u.username, u.publisher_id, u.subscriber_id
FROM users u
LEFT JOIN publishers p ON p.publisher_id = u.publisher_id AND u.publisher_id IS NOT NULL
LEFT JOIN subscribers s ON s.subscriber_id = u.subscriber_id AND u.subscriber_id IS NOT NULL
WHERE (u.publisher_id IS NOT NULL AND p.publisher_id IS NULL)
   OR (u.subscriber_id IS NOT NULL AND s.subscriber_id IS NULL);
\echo ''

-- 6. campaign_totems - campaign_id e totem_id válidos
\echo '[6] campaign_totems com FKs inválidas (esperado: 0 linhas)'
SELECT ct.campaign_id, ct.totem_id
FROM campaign_totems ct
LEFT JOIN campaigns c ON c.campaign_id = ct.campaign_id
LEFT JOIN totems t ON t.totem_id = ct.totem_id
WHERE c.campaign_id IS NULL OR t.totem_id IS NULL;
\echo ''

-- 7. subscriber_contracts.subscriber_id
\echo '[7] subscriber_contracts com subscriber_id inválido (esperado: 0 linhas)'
SELECT sc.contract_id, sc.subscriber_id
FROM subscriber_contracts sc
LEFT JOIN subscribers s ON s.subscriber_id = sc.subscriber_id
WHERE sc.subscriber_id IS NOT NULL AND s.subscriber_id IS NULL;
\echo ''

-- 8. publisher_contracts.publisher_id
\echo '[8] publisher_contracts com publisher_id inválido (esperado: 0 linhas)'
SELECT pc.contract_id, pc.publisher_id
FROM publisher_contracts pc
LEFT JOIN publishers p ON p.publisher_id = pc.publisher_id
WHERE pc.publisher_id IS NOT NULL AND p.publisher_id IS NULL;
\echo ''

\echo '========================================='
\echo ' Validação concluída. Verifique saída acima.'
\echo ' Cada bloco deve retornar 0 linhas.'
\echo '========================================='
