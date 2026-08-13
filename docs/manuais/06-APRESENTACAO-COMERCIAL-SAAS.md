# TotemDigital Studio — Apresentação Comercial (Software + SaaS)

**Documento:** pitch comercial  
**Data:** 2026-08-12 (nota P0 Direct; corpo 2026-08-03)  
**Público:** decisão de compra, parceiros, vendas  
**Produto:** plataforma de sinalização digital e rede de ecrãs  
**Base técnica:** manuais em [`docs/manuais/`](./README.md)  
**PDF:** [06-APRESENTACAO-COMERCIAL-SAAS.pdf](./06-APRESENTACAO-COMERCIAL-SAAS.pdf)

---

## 1. A promessa (30 segundos)

> **Uma plataforma para administrar dezenas ou milhares de totens como uma rede única — do ecrã da loja à operação multi-cidade — com software próprio ou serviço SaaS gerido.**

O TotemDigital Studio liga **conteúdo**, **dispositivos** e **negócio** (quando a rede vende espaço publicitário) num único painel web, com players em campo (Player-AD e linha multiplataforma).

---

## 2. O problema que vendemos a resolver

| Sem plataforma | Com TotemDigital |
|----------------|------------------|
| USB, pendrive, “alguém actualiza a TV” | Publicação remota em minutos |
| Cada loja é um silo | Rede global com inventário central |
| Sem controlo de quem anunciou o quê | Anunciantes, acessos e campanhas auditáveis |
| Crescimento = mais caos | Cresce por organização, local e totem |
| Capex disperso, sem modelo de receita | Direct (operar) → Lite/Pro (monetizar a rede) |

**Quem compra:** redes de retalho, food service, clínicas, shoppings, agências de mídia indoor, operadores de totens e integradores que querem **software + serviço**.

---

## 3. Conceito: administrar uma rede global de totens

Pense na rede como três camadas — a mesma lógica serve 5 ecrãs ou 5.000:

```text
  REDE (instalação / tenant SaaS)
      │
      ├── ORGANIZAÇÕES  (marcas, filiais, parceiros de ponto)
      │       └── LOCAIS / UNIDADES
      │               └── TOTENS / SMART TVs  ← o inventário físico
      │
      └── ANUNCIANTES (opcional)  →  quem paga para aparecer nos ecrãs
```

| Conceito | Valor comercial |
|----------|-----------------|
| **Totem** | O ponto de contacto com o público |
| **Local** | Agrupa ecrãs de um sítio (loja, praça, piso) |
| **Organização** | Dono operacional daquele pedaço da rede |
| **Anunciante** | Cliente de mídia — receita sobre a rede |
| **Campanha / publicação** | O que o público vê, com regras e prioridade |
| **Player** | O software no dispositivo (24/7, cache, heartbeat) |

**Administrar a rede** significa: inventário vivo, publicação central, saúde dos dispositivos e — se o negócio for propaganda — quem pode usar que ecrãs.

---

## 4. Três ofertas no mesmo produto (escada de valor)

Uma codebase, três modos de negócio — o cliente sobe quando a operação exige:

| Oferta | Nome comercial | Ideal para | O que entrega |
|--------|----------------|------------|---------------|
| **Entry** | **TotemDigital Direct** | Um negócio, os seus totens | Publicar mídias nos ecrãs da própria organização |
| **Growth** | **TotemDigital Multi Lite** | Redes e operadores que vendem espaço | Várias organizações + anunciantes + publicar — **sem** ERP pesado |
| **Enterprise** | **TotemDigital Pro** | Agências e operações maduras | Planos, contratos, billing, OTA, analytics, dispatcher |

```text
Direct  →  “Eu controlo as minhas telas.”
Lite    →  “Eu opero uma rede e vendo propaganda.”
Pro     →  “Eu corro uma agência / marketplace indoor.”
```

**Mensagem de venda:** começa simples; o mesmo software cresce consigo — sem migrar de fornecedor.

**P0 / demo SMB (15 min):** vender só **Direct** (Kit Pronto ou Só software). Lite e Pro são **upsell** — não abrir a 1.ª conversa com “rede global / milhares de totens”. Glossário e foco comercial: [`../AVALIACAO-COMERCIAL-PRODUTO-TOTEMDIGITAL-STUDIO-2026-07.md`](../AVALIACAO-COMERCIAL-PRODUTO-TOTEMDIGITAL-STUDIO-2026-07.md) (v1.1).

---

## 5. Como a monetização da rede funciona (história comercial)

### Direct — eficiência operacional

Cliente publica cardápios, promoções e institucional. ROI: menos deslocações, conteúdo sempre actual, imagem profissional.

### Lite — rede + receita publicitária

1. Cadastra organizações e totens  
2. Cadastra anunciantes  
3. Concede acesso anunciante ↔ organização (quem pode usar que rede)  
4. Publica campanhas / quick-publish  

Ideal para quem **já tem pontos de ecrã** e quer vender inserção sem montar ERP de cobrança no dia 1.

### Pro — operação comercial completa

Planos (limites e cobertura de rede), contratos, faturamento, actualizações OTA, monitorização avançada. Ideal para **SaaS white-label** ou operação multi-cliente com SLA.

---

## 6. O que o comprador “vê” (capacidades)

| Capacidade | Benefício na conversa de venda |
|------------|--------------------------------|
| Painel web central | Uma consola para toda a rede |
| Publicação rápida | Time-to-screen em minutos |
| Inventário org → local → totem | Escala geográfica sem perder controlo |
| Anunciantes + acessos | Modelo de mídia indoor |
| Player Android (Player-AD) | Campo 24/7, portrait, cache offline |
| Heartbeat / remoto | Menos “caixa preta” no chão |
| Self-hosted **ou** SaaS gerido | Flexibilidade de compliance e Capex/Opex |
| Multi-instância (prod / homolog) | Segurança para quem exige ambientes separados |

---

## 7. Modelos de comercialização (software + serviços)

### 7.1 Software (licença / on-premise)

| Item | Descrição |
|------|-----------|
| Licença de plataforma | Direct, Lite ou Pro (por instalação / por escala de totens) |
| Instalação e go-live | Servidor, HTTPS, seed, formação |
| Players | APK / kit de campo (Player-AD) |
| Manutenção anual | Actualizações, suporte, hotfixes |

### 7.2 SaaS (serviço recorrente)

| Item | Descrição |
|------|-----------|
| Hosting gerido | Painel + API + BD + backups |
| Plano por ecrãs / orgs | Escada Direct → Lite → Pro no mesmo tenant |
| Operação assistida | Monitorização, onboarding de totens |
| Add-ons | Portal por subdomínio, OTA, analytics (Pro) |

### 7.3 Serviços profissionais (margem alta)

- Desenho de rede (cidades, shoppings, franquias)  
- Integração com conteúdo / cardápio / CRM  
- Treino de operadores e agências  
- Kit hardware + instalação física (parceiro / integrador)  
- White-label (marca do cliente no painel e players)

**Pitch de parceiro:** “Vocês vendem a rede e o serviço; nós fornecemos a plataforma que escala.”

---

## 8. Argumentos competitivos (inteligentes, sem hype)

1. **Rede como produto** — não é só “player de vídeo”; é inventário + publicação + (opcional) marketplace de anunciantes.  
2. **Escada comercial nativa** — Direct/Lite/Pro no mesmo software evita “trocar de sistema” no crescimento.  
3. **Lite sem ERP** — vende propaganda rápido; Pro entra quando a cobrança e o contrato importam.  
4. **Campo real** — player Android de operação contínua, não apenas demo web.  
5. **Controlo de dados** — on-prem para quem exige; SaaS para quem quer Opex previsível.  
6. **Administração multi-totem séria** — organizações, locais, acessos e campanhas com regras claras.

---

## 9. Jornada de compra sugerida (vendas)

| Fase | Acção | Resultado |
|------|-------|-----------|
| 1. Discovery | Quantos ecrãs? Uma marca ou rede? Vendem espaço? | Escolher Direct / Lite / Pro |
| 2. Pilot | 5–20 totens em `dev` ou tenant piloto | Prova em 1–2 semanas |
| 3. Go-live | Produção + formação + kit players | Rede operacional |
| 4. Expand | Novas orgs / cidades / anunciantes | Upsell Lite→Pro ou mais ecrãs |
| 5. Retain | SLA SaaS + roadmap | Recorrência |

**Pergunta de fecho:**  
*“Quer só operar as suas telas, ou transformar a rede num canal de receita publicitária?”*

---

## 10. Uma slide mental (para reunião)

| | |
|--|--|
| **Produto** | TotemDigital Studio — rede de sinalização digital |
| **Core** | Inventário global de totens + publicação central |
| **Crescimento** | Anunciantes na mesma plataforma (Lite → Pro) |
| **Entrega** | Software licenciado **ou** SaaS + serviços |
| **Campo** | Player-AD e ecossistema multiplataforma |
| **Diferença** | Da loja única à agência indoor — sem mudar de stack |

---

## 11. Próximos passos (CTA)

1. Agendar demo — **SMB:** Direct 15 min; **rede:** Direct vs Lite em 20 min  
2. Dimensionar: nº de totens, cidades, anunciantes previstos  
3. Proposta: Kit Pronto / Só software **ou** (upsell) Lite/Pro SaaS + go-live  
4. Pilot em ambiente isolado (`dev`) antes da produção  

Documentação operacional e técnica: [`docs/manuais/README.md`](./README.md)  
Avaliação comercial e de produto (v1.1, ago/2026): [`../AVALIACAO-COMERCIAL-PRODUTO-TOTEMDIGITAL-STUDIO-2026-07.md`](../AVALIACAO-COMERCIAL-PRODUTO-TOTEMDIGITAL-STUDIO-2026-07.md)

---

*TotemDigital Studio — administre a rede; moneteze os ecrãs; escale o serviço.*
