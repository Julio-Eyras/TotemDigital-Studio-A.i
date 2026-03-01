# Associação de Campanhas a Publishers e Totens

**Data:** 2026-02-20  
**Problema:** Cliente não consegue atrelar campanhas a publishers e totens conforme o plano e contrato da campanha.

---

## 🔍 Diagnóstico

### Fluxo de Acesso

O acesso de um **subscriber** (assinante) a **publishers** ocorre por:

1. **Contrato ativo** (`subscriber_contracts`) com `plan_id`
2. **Plano com acesso** (`plan_publisher_access`) define quais publishers o plano pode usar
3. **subscriber_publisher_access** materializa esse acesso (populado por reconciliação)

### Mensagem de Erro na Interface

> "Nenhum publisher acessível encontrado. Verifique o contrato e o plano do subscriber."

Essa mensagem aparece quando a API `/api/subscriber-access/:subscriberId/publishers` retorna lista vazia.

### Causas Comuns

1. **subscriber_publisher_access vazio** – A reconciliação (`reconcile_plan_publisher_access`) pode não ter rodado após a criação/ativação do contrato.
2. **Contrato sem plan_id** – O contrato vinculado à campanha não tem plano associado.
3. **plan_publisher_access sem entradas** – O plano do contrato não tem publishers configurados em "Planos & Acessos" (Plan Publisher Access).
4. **Contrato inativo ou expirado** – Status diferente de `active` ou `end_date` no passado.

---

## ✅ Correções Aplicadas

### 1. Fallback via Contrato/Plano (Backend)

No `subscriberAccessService.getAccessiblePublishersWithDetails`:

- **Antes:** Só consultava `subscriber_publisher_access_active`.
- **Agora:** Se a lista vier vazia, usa um fallback que busca publishers através de:
  - Contratos ativos do subscriber
  - `plan_publisher_access` com `is_allowed = true` para o `plan_id` do contrato

Assim, mesmo sem reconciliação, o subscriber vê os publishers permitidos pelo plano do contrato.

### 2. Carregamento ao Abrir Edição (Frontend)

- **Antes:** Ao clicar em "Editar" a partir do modal de detalhes da campanha, os publishers acessíveis não eram carregados.
- **Agora:** Ao abrir a edição (card ou modal de detalhes), `loadAccessiblePublishers(subscriberId)` é chamado para usuários não-admin.

---

## 📋 Checklist para Configuração Correta

### Admin – Planos e Publishers

1. **Planos & Acessos** → configurar `plan_publisher_access`:
   - Para cada plano que deve ter acesso a publishers, adicionar entradas com `is_allowed = true`.

### Contrato do Subscriber

2. O contrato da campanha deve ter:
   - `status = 'active'`
   - `plan_id` preenchido
   - `end_date` nulo ou no futuro

### Totens

3. Totens são vinculados indiretamente:
   - A campanha associa **publishers**
   - Totens pertencem a **locais** dos publishers
   - A aba "Totens" mostra totens dos publishers associados à campanha
   - Se não há publishers, não há totens exibidos.

---

## 🔧 Executar Reconciliação (Opcional)

Para preencher `subscriber_publisher_access` a partir de `plan_publisher_access` e contratos ativos:

```bash
# Via API (requer autenticação admin)
curl -X POST http://192.168.1.110/api/subscriber-access/plan-publisher/reconcile \
  -H "Authorization: Bearer <token>"
```

Ou via SQL:

```sql
SELECT reconcile_all_plan_publisher_access();
```

---

## 📝 Resumo

- **Publishers:** Agora há fallback via contrato + plano quando `subscriber_publisher_access` está vazio.
- **Totens:** Aparecem quando a campanha tem publishers associados; os totens são dos locais desses publishers.
- **Configuração:** Garantir que planos tenham publishers configurados em Plan Publisher Access e que contratos tenham `plan_id`.

---

## Playlists por Totem – por que aparece "Nenhuma playlist encontrada"?

A tela **Playlists por Totem** mostra a **playlist consolidada gerada pelo motor** para cada totem (tabela `totem_playlists`). Essa playlist **não** é a mesma que as playlists do assinante: é o resultado da **geração** que junta campanhas ativas dos subscribers que têm acesso ao publisher daquele totem.

Para aparecer algo na lista:

1. **Campanhas criadas e ativas** – do subscriber, com playlists/mídias do **mesmo** subscriber.
2. **Campanhas vinculadas a publishers** – a campanha deve ter os publishers associados (onde o totem está).
3. **Motor executado** – a playlist consolidada do totem precisa ser **gerada/regenerada** (botão "Atualizar" na tela ou job que preenche `totem_playlists`).

Se a campanha não foi criada (por exemplo, erro 400 por playlist de outro subscriber) ou não tem publishers associados, o motor não inclui nada para aquele totem e a lista fica vazia.
