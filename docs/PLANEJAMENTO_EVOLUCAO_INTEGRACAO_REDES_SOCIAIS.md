# Planejamento e evolução: integração com redes sociais (Meta / Facebook / Instagram)

**Objetivo do documento:** registrar visão, escopo realista, fases de evolução e dependências técnicas para integrar o ecossistema atual (mídias, campanhas, totens) com publicação e, onde aplicável, métricas em redes sociais — **sem implementação obrigatória** até aprovação explícita do produto.

**Estado:** planejamento (referência para decisão e priorização).

---

## 1. Contexto do sistema atual

O produto concentra-se em **digital signage**:

- Biblioteca de **mídias** (upload, armazenamento em disco, quotas por plano/subscriber).
- **Campanhas**, playlists e distribuição para **totens** / players.
- API REST e painel web para gestão.

Não existe hoje integração nativa com **Meta (Facebook / Instagram)** ou outras redes. Qualquer integração será uma **camada nova** reutilizando o núcleo de mídia e identidade (subscribers, permissões).

---

## 2. O que “integrar e intercambiar” significa na prática

| Direção | Viabilidade com APIs oficiais |
|--------|--------------------------------|
| **Do sistema → rede social** (publicar ou agendar conteúdo já existente na biblioteca) | **Alta** — fluxo natural: escolher mídia, destino (Página / conta IG profissional), disparar publicação. |
| **Da rede social → sistema** (importar stories ou feed de terceiros para totem) | **Muito baixa** — a API da Meta **não** expõe descarga genérica de stories de outras contas para uso em signage. |
| **Conteúdo próprio** (IDs de publicação, estado, erros, métricas básicas) | **Média** — depende de permissões e **App Review**. |

**Conclusão de produto:** o desenho sustentável é **publicação (push) a partir do acervo** e, opcionalmente, **sincronização de estado / métricas** do que **foi publicado pela própria plataforma** — não um “hub bilateral” com stories arbitrárias de Instagram.

---

## 3. Requisitos de negócio e legais (antes do código)

- **Conta Meta:** aplicação registada em [Meta for Developers](https://developers.facebook.com/).
- **Ativos do cliente:** Página do Facebook; Instagram **Business** ou **Creator** associado à Página.
- **Política de privacidade e termos** acessíveis (requisitos comuns da Meta para apps em produção).
- **Responsabilidade pelo conteúdo** publicado (cliente vs operador da plataforma).
- **Proteção de dados:** tokens OAuth e identificadores de contas — armazenamento seguro (encriptação em repouso), base legal se RGPD/LGPD aplicável.

---

## 4. Visão técnica de encaixe (alto nível)

### 4.1 Componentes sugeridos (futuros)

| Componente | Função |
|------------|--------|
| **OAuth Meta** | Fluxo de autorização por subscriber (ou tenant); troca de `code` por tokens; refresh. |
| **Serviço de publicação** | Mapear `media_id` → requisitos da API (URL pública ou upload em container); chamar Graph API / Instagram Content Publishing. |
| **Fila de jobs** | Uploads e publicações longas; retries; respeito a rate limits. |
| **Armazenamento de credenciais** | IDs de página / `instagram_business_account_id`; tokens encriptados; revogação. |
| **UI** | “Ligar conta”; escolher destino; ação “Publicar também em…” na mídia/campanha; estados e erros legíveis. |

### 4.2 Infraestrutura

- Muitos fluxos da Meta exigem **URL HTTPS pública** acessível para o vídeo/imagem **ou** uso do fluxo de reserva/container com upload conforme documentação atual.
- Servidor **apenas em rede interna** sem exposição controlada de URLs ou object storage público **bloqueia** a integração típica.

### 4.3 Formato de mídia

- Signage costuma usar **16:9**; **Stories** e parte de **Reels** favorecem **9:16**.
- Plano de evolução deve decidir: **letterbox**, **crop**, ou **obrigar template** no upload/editor — possivelmente passo de **transcodificação** (ex.: FFmpeg ou serviço externo) para garantir limites de duração, bitrate e resolução aceites pela Meta.

---

## 5. APIs relevantes (referência)

- **Facebook Graph API** — publicação em **Página** (vídeo, post), conforme endpoints e versão da API em vigor.
- **Instagram Graph API** — publicação para contas profissionais ligadas à Página (fluxo de criação de **container** + `publish`).
- Permissões e revisão: exemplos históricos incluem `pages_manage_posts`, `instagram_content_publish`, entre outras — **validar sempre a documentação oficial** no momento da implementação.

**App Review:** em produção, permissões sensíveis exigem submissão com descrição de uso, screencasts e políticas — impacto direto no calendário.

---

## 6. Roadmap sugerido (fases)

### Fase 0 — Decisão de escopo (sem desenvolvimento)

- Definir destinos mínimos: só **Facebook Page**, só **Instagram feed**, **Reels**, **Stories**, ou combinação.
- Definir se há **agendamento** na v1 ou apenas “publicar agora”.
- Aceitar limitações de “pull” de conteúdo de terceiros.

### Fase 1 — Fundações

- App Meta em modo desenvolvimento; fluxo OAuth; armazenamento seguro de tokens.
- Um fluxo **mínimo** (ex.: vídeo/image para **Facebook Page** OU um único tipo no Instagram).
- Logs e tratamento de erro visíveis para suporte.

### Fase 2 — Produto

- UI de ligação de conta e seleção de Página / conta Instagram.
- Ação na biblioteca de mídias (e opcionalmente na campanha): “Publicar em…”.
- Fila assíncrona e reprocessamento em falha transitória.

### Fase 3 — Evolução

- **Reels / Stories** (conforme prioridade e exigências de formato).
- **Agendamento** alinhado a endpoints suportados.
- **Métricas básicas** (impressões/alcance) se houver valor e permissões aprovadas.
- Políticas de quota e limites por plano (monetização / fair use).

---

## 7. Estimativas de esforço (alinhamento com rede social)

**Unidade:** dias-pessoa de desenvolvimento (inclui testes manuais básicos e documentação mínima de operação). **Não** inclui tempo de resposta da Meta no **App Review** (tipicamente **1–6+ semanas** de calendário, imprevisível).

**Premissas:** equipa já familiar com o stack do projeto (Node backend, React frontend, Postgres); uma app Meta por ambiente; um perfil de integração “por subscriber” ou equivalente.

### 7.1 Por fase (ordem do roadmap)

| Fase | Conteúdo principal | Esforço (faixa) | Notas |
|------|-------------------|-----------------|--------|
| **Fase 0** | Decisão de escopo, permissões-alvo, política de privacidade/termos, desenho de dados (tokens, destinos) | **2–5** | Maior parte é produto/legal; técnico participa para cortar escopo inviável. |
| **Fase 1** | App Meta dev, OAuth (callback HTTPS), persistência encriptada de tokens, **um** fluxo mínimo (ex.: foto ou vídeo curto → **Facebook Page** *ou* IG feed via container), logs de erro | **8–15** | Primeira integração com API Meta costuma consumir tempo em leitura de docs e depuração de permissões. |
| **Fase 2** | UI ligar conta / escolher Página e IG, ação “Publicar” na mídia, fila assíncrona + retries, estados na UI | **10–18** | Depende de já existir URL pública ou pipeline de upload aceite pela Meta. |
| **Fase 3** | Reels/Stories (formato 9:16), agendamento, métricas básicas, limites por plano | **15–35+** | Muito dependente do que entra no pacote: só Reels é menos que Stories + transcodificação + agendamento + insights. |

**Soma indicativa (Fases 1–2, produto utilizável internamente / beta):** **~18–33** dias-pessoa.

**Soma indicativa (Fases 1–3, pacote mais completo):** **~35–70+** dias-pessoa (a parte superior se incluir transcodificação robusta, agendamento e App Review iterativo).

### 7.2 Incrementos opcionais (somar ao acima)

| Incremento | Esforço (faixa) |
|--------------|-----------------|
| **Transcodificação** (FFmpeg no worker ou serviço cloud) para normalizar vídeo para limites Meta + 9:16 | **5–12** |
| **URLs assinadas / CDN** para ficheiros grandes (se hoje só path interno) | **3–8** |
| **Segunda rede** (ex.: LinkedIn ou X) com OAuth e publicação separados | **+40–80%** do esforço da *primeira* rede (reutiliza padrões, mas APIs e revisões são distintas) |
| **App Review** (preparação: screencast, políticas, resposta a pedidos da Meta) | **2–8** dias-pessoa **espalhados** + espera de calendário |

### 7.3 Desdobramento mínimo (Fase 1) — tarefas típicas

| Área | Dias-pessoa (faixa) |
|------|---------------------|
| Backend: OAuth + refresh + modelo de dados | 3–6 |
| Backend: chamada Graph + tratamento erros/rate limit | 2–5 |
| Infra: callback OAuth + URL pública de mídia (ou upload resumable) | 2–4 |
| Frontend: fluxo “conectar” + estado | 1–3 |
| Testes e hardening mínimo | 1–2 |

### 7.4 Como usar estas estimativas

- **Paralelizar:** com 2 devs (backend + frontend), o calendário de calendário encolhe, mas o risco de bloqueio no App Review mantém-se.
- **Reduzir escopo:** Fase 1 **só Facebook Page** (sem Instagram) tende a ficar no **limite inferior** da Fase 1.
- **Aumentar escopo:** Instagram + vídeos longos + stories sem pipeline de vídeo quase sempre empurra para o **limite superior** ou além.

---

## 8. Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| Reprovação ou demora no App Review | Escopo mínimo de permissões; documentação clara do caso de uso. |
| Rate limits e instabilidade | Filas, backoff, idempotência onde aplicável. |
| Incompatibilidade de formato | Validação pré-publicação; transcodificação ou mensagens explícitas ao utilizador. |
| Tokens expostos | Encriptação, rotação, revogação na UI; auditoria. |
| Expectativa de “importar stories de qualquer conta” | Alinhar stakeholders com o que a API **não** suporta. |

---

## 9. Critérios de aceitação (exemplo para v1)

- Utilizador autorizado liga uma **Página** (e, se no escopo, **Instagram Business**) ao seu contexto (subscriber/tenant).
- A partir de uma mídia elegível, consegue **disparar publicação** e ver estado: sucesso, falha com mensagem útil, ID externo quando existir.
- Tokens não aparecem em claro na UI nem em logs padrão.
- Documentação interna descreve como revogar acesso e reautenticar.

---

## 10. Próximos passos recomendados

1. Aprovar **escopo da Fase 1** (destinos e tipos de mídia).
2. Validar **infraestrutura** (HTTPS, URLs públicas ou estratégia de bucket).
3. Abrir **app Meta** e mapear permissões exatas para esse escopo.
4. Só então: desenho detalhado de schema (tabelas de ligação / secrets), endpoints e contratos de API internos — **alterações no repositório** após aprovação explícita.

---

## 11. Histórico de revisões do documento

| Data | Notas |
|------|--------|
| 2026-05-01 | Criação do documento com base no planejamento de integração Meta (Facebook / Instagram). |
| 2026-05-01 | Secção 7: estimativas de esforço (dias-pessoa) e renumeramento das secções seguintes. |

---

*Este ficheiro é um guia de planejamento; a documentação oficial da Meta prevalece sobre detalhes de endpoints e permissões.*
