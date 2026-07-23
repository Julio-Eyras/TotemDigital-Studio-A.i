# TotemDigital Studio — Avaliação Comercial e de Produto

**Versão do documento:** 1.0  
**Data:** 23 de julho de 2026  
**Repositório:** [Julio-Eyras/TotemDigital-Studio](https://github.com/Julio-Eyras/TotemDigital-Studio)  
**Branch de referência:** `SmartSignage-direc-totem`  
**Marcas no ecossistema:** TotemDigital · SmartSignage Pro · Player-AD  

---

## 1. Sumário executivo

O **TotemDigital Studio** é uma plataforma completa de **sinalização digital** (digital signage) para publicar, distribuir e operar conteúdo visual em **totens**, **TVs** e **telas comerciais**, com painel administrativo web, backend multi-tenant, motor de dispatch e players nativos (destaque: **Player-AD** em Android).

Na superfície, a promessa de produto é simples:

> **Publique cardápios, promoções e anúncios nas suas telas em minutos.**

Por baixo, há uma arquitetura madura (campanhas, playlists, contratos, billing, dispatcher, heartbeat, controlo remoto, OTA, kit hardware/TV box) que permite evoluir de SMB local para operação de rede e marketplace de mídia indoor.

**Veredito em uma frase:** produto tecnicamente **forte e diferenciado** no stack self-hosted + player Android portrait; comercialmente ainda **subexplorado** — o foco imediato deve ser oferta monousuário “Publicar em Totem”, kit hardware + instalação, e ciclo de venda curto em negócios locais, sem abandonar a espinha dorsal multi-tenant.

---

## 2. O que é o projeto

| Camada | Papel |
|--------|--------|
| **TotemDigital** | Marca e linha de produto focada em totens / monousuário / identidade visual |
| **SmartSignage Pro** | Plataforma multi-tenant (admin + API + PostgreSQL + billing/contratos) |
| **Player-AD** | Player Android nativo (Kotlin/ExoPlayer) para TV box / totem 24/7 |
| **player-web / Player-LXN / WOS** | Linhas alternativas de player (browser, Linux, webOS) |
| **install-pendrive** | Kit de instalação de campo (APK, config, ADB, manuais) |
| **totemdigital.site / corporate-site** | Presença web e apresentações comerciais |
| **Visual.Interface / TotemDigital.BV** | Biblioteca visual / mini CMS (evolução; integração parcial) |

### Stack principal

- **Frontend:** React 18 + TypeScript + MUI  
- **Backend:** Node.js + Express + TypeScript  
- **Base de dados:** PostgreSQL (schema v2 refatorado como fonte da verdade)  
- **Proxy:** Nginx  
- **Player operacional de referência:** Player-AD (portrait 9:16, kiosk, cache offline, heartbeat, comandos remotos)  
- **Instalação:** scripts Linux (`install-smartsignage.sh`), Docker, kit USB  

### Fluxo operacional central

```text
Biblioteca / Campanha / Playlist / Publicação direta
        ↓
   Dispatcher (DispatchPlan)
        ↓
   Player-AD (ou player web)
        ↓
Heartbeat · remote_commands · screenshots · eventos
```

---

## 3. Capacidades (o que o sistema já entrega)

### 3.1 Operação de conteúdo

- Biblioteca de mídias (upload, thumbs, preview, rotação/normalização de entrega)
- Publicação direta em totem (**Publicar em Totem**) com multi-seleção e reordenação
- Playlists, campanhas, vinhetas e mix de playlists
- Templates / quick-publish e cardápio por cliente (linha Studio / anunciantes)
- Horário de tela por totem (display schedule) e controlo remoto

### 3.2 Dispositivos e campo

- Cadastro de totens / Smart TVs / locais / organizações (publishers)
- Player-AD: kiosk, portrait, cache offline, fallback local, config por JSON/UIN
- Kit pendrive (APK release, config de exemplo, scripts ADB, bootanimation)
- OTA updates e ferramentas de diagnóstico ADB documentadas
- Specs de hardware / procurement de TV box (documentação ODM)

### 3.3 Plataforma e negócio

- Multi-tenancy e papéis (admin, organização, anunciante)
- Contratos (publisher / subscriber) e billing estruturado no modelo de dados
- Dispatcher com monitor, debug e timeline
- Analytics / relatórios / admin tools
- Autenticação JWT, rate limit, instalação automatizada

### 3.4 Extensões e ecossistema

- Site corporativo e demos de identidade (**Amarelo Petróleo**)
- SmartDisplayFX / holograph-engine (camadas experimentais / avançadas)
- Electron / Linux / webOS como opções de player além do Android

---

## 4. Objetivos do produto

### 4.1 Objetivo de negócio

Tornar-se a **plataforma operacional padrão** para negócios locais e redes que precisam de **telas sempre no ar**, com publicação rápida e operação remota, vendendo software + serviço + (opcional) kit hardware.

### 4.2 Objetivo de produto (norte)

> Um cliente novo deve conseguir **publicar algo numa tela real em menos de 5 minutos**.

### 4.3 Objetivos técnicos

1. Manter o Player-AD estável 24/7 em portrait com cache e recuperação offline.  
2. Preservar schema/instalador como fonte da verdade (sem “patches” temporários).  
3. Simplificar a **oferta** (UX monousuário) sem destruir a arquitetura multi-tenant.  
4. Integrar gradualmente Visual.Interface / identidade TotemDigital no admin.  

### 4.4 Objetivos comerciais (12–24 meses)

| Horizonte | Objetivo |
|-----------|----------|
| **0–90 dias** | Oferta empacotada “Totem pronto” (software + TV box + instalação) e 10–20 clientes piloto pagantes |
| **6–12 meses** | MRR sustentável via assinatura por tela/organização; rede de instaladores |
| **12–24 meses** | Upsell marketplace (anunciantes × publishers) e white-label para redes |

---

## 5. Público-alvo

### 5.1 Primário (ciclo curto — prioridade comercial)

| Segmento | Dor | Valor percebido |
|----------|-----|-----------------|
| Restaurantes, lancherias, cafés, bares, hamburguerias | Cardápio/promoção desatualizados; dependência de designer/USB | Atualizar preço/oferta remoto em minutos |
| Mercados e lojas locais | Ofertas de gôndola / fila / vitrine | Totem 9:16 com conteúdo sempre fresco |
| Recepção de empresas / clínicas | Comunicação institucional estática | Painel gerido sem TI pesada |
| Operadores de totens de anúncio indoor | Monetizar espaço + uptime | Player estável + dispatch + status remoto |

### 5.2 Secundário (ticket maior)

- Redes de varejo / farmácias / franchises multi-loja  
- Shoppings e operadores de mídia DOOH indoor  
- Hotéis, hospitais, educação (informação + marca)  
- Integradores / MSPs que querem white-label  

### 5.3 Personas

1. **Dono do negócio local** — quer “aparecer moderno” e mudar promo sem técnico.  
2. **Operador de rede de telas** — quer inventário, uptime, controlo remoto e receita.  
3. **Anunciante regional** — quer comprar inventário sem gerir hardware.  
4. **Integrador/instalador** — quer kit USB + ADB + margem de serviço.  

---

## 6. Pontos fortes

1. **Stack vertical completo** — do painel ao player Android e kit de campo, não só “um CMS”.  
2. **Player-AD operacional** — kiosk, portrait, cache, heartbeat, controlo remoto, schedule de tela.  
3. **Arquitetura multi-tenant real** — publishers, subscribers, contratos, billing, dispatcher.  
4. **Modo monousuário** — caminho comercial simples (“Publicar em Totem”) sobre a mesma base.  
5. **Self-hosted / controlo de dados** — diferencial vs SaaS estrangeiros para clientes sensíveis.  
6. **Documentação e instaladores** — scripts, manuais Player-AD, specs hardware, pendrive.  
7. **Identidade de marca** — TotemDigital / Amarelo Petróleo com materiais de apresentação.  
8. **Extensibilidade** — mix, FX, OTA, analytics, múltiplos players.  
9. **Prova de campo** — fluxo real servidor ↔ TV box documentado e iterado.  

---

## 7. Pontos negativos e riscos

| Área | Problema | Impacto |
|------|----------|---------|
| **Complexidade cognitiva** | Admin rico (campanhas, mix, dispatcher, billing) vs promessa “5 minutos” | Fricção na venda SMB |
| **Dois produtos numa casa** | SmartSignage Pro “enterprise” + TotemDigital “simples” | Mensagem comercial diluída |
| **Débito de UX/tema** | Identidade TotemDigital ainda parcialmente pendente no admin | Branding fraco no primeiro ecrã |
| **Integrações incompletas** | Visual.Interface / BV não totalmente no backend principal | Feature story vs realidade |
| **Superfície técnica** | Muitos players e pastas legadas no monorepo | Custo de manutenção / onboarding |
| **Billing comercial** | Modelo de dados avançado; go-to-market e pricing ainda pouco empacotados | Receita recorrente lenta |
| **Dependência de campo** | Hardware Android/TV box variável; portrait/ADB/OEM | Suporte e SLA caros |
| **Deploy / ops** | Instalação Linux poderosa mas sensível (Node, Nginx, Postgres, builds) | Tempo de setup e erros de versão |
| **Concorrência** | Players SaaS globais (com onboarding polished) | Percepção “mais difícil” |
| **Foco comercial** | Excesso de docs/features vs funil de venda curto | Time disperso |

---

## 8. Metas mensuráveis (sugeridas)

### 8.1 Produto

| KPI | Meta 90 dias | Meta 12 meses |
|-----|--------------|---------------|
| Tempo até 1ª publicação em tela real (piloto) | ≤ 15 min (meta aspiracional 5 min) | ≤ 5 min no fluxo guiado |
| Uptime player piloto | ≥ 98% | ≥ 99,5% |
| Tickets de instalação “quebrada” | −50% vs baseline | Kit + checklist padrão |
| NPS / satisfação piloto | ≥ 40 | ≥ 50 |

### 8.2 Comercial

| KPI | Meta 90 dias | Meta 12 meses |
|-----|--------------|---------------|
| Clientes pagantes | 10–20 | 80–150 |
| MRR | R$ 8–20 mil | R$ 60–120 mil |
| Ticket médio | R$ 200–600 / org ou /tela | Mix assinatura + kit |
| Pipeline qualificável | 50 leads | Funil contínuo com parceiros |

*(Valores orientativos — calibrar com pricing real e CAC.)*

---

## 9. Plano de divulgação

### 9.1 Narrativa (mensagem única)

**Headline:** Telas que vendem sozinhas — publique no totem em minutos.  
**Prova:** Demo ao vivo (Player-AD + painel) + antes/depois de cardápio.  
**CTA:** Agendar instalação piloto / pedir orçamento do kit.

### 9.2 Canais (priorizados)

| Canal | Ação | Frequência |
|-------|------|------------|
| **Demo presencial** | Visita a restaurantes/lojas com TV box | Semanal |
| **WhatsApp Business** | Catálogo + vídeo 30–60s do totem | Diário (leads) |
| **Instagram / Reels** | Clipes do totem em funcionamento (Amarelo Petróleo) | 3–5×/semana |
| **Landing** (`totemdigital.site`) | Oferta kit + formulário + cases | Sempre on |
| **Parceiros locais** | Gráficas, instaladores de câmeras/alarme, provedores | Mensal |
| **Eventos regionais** | Feiras gastronómicas / varejo | Trimestral |
| **Conteúdo SEO** | “cardápio digital totem”, “sinalização digital restaurante” | Contínuo |
| **LinkedIn B2B** | Redes e integradores (ticket maior) | 2×/semana |

### 9.3 Materiais

- One-pager executivo (hardware + Player-AD)  
- Vídeo demo 60s + case 1 página  
- Kit pendrive / ZIP de instalação  
- Apresentação Amarelo Petróleo (já no site)  
- Tabela de preços simples (3 pacotes — ver secção 10)

### 9.4 Calendário 90 dias (resumo)

1. **Semanas 1–2:** fechar oferta e pricing; landing alinhada; 5 demos.  
2. **Semanas 3–6:** 15–25 demos; 5–10 pilotos; reels semanais.  
3. **Semanas 7–12:** cases; canal de instaladores; upsell 2ª tela.  

---

## 10. Plano de venda

### 10.1 Pacotes comerciais sugeridos

| Pacote | Inclui | Modelo |
|--------|--------|--------|
| **Starter** | 1 totem/tela + painel monousuário + suporte básico | Assinatura mensal / tela |
| **Kit Pronto** | Starter + TV box configurada + instalação + treino 1h | Setup único + assinatura |
| **Rede** | Multi-loja, roles, contratos, monitorização | Assinatura por org + telas |
| **Mídia Indoor** | Publisher + anunciantes + revenue share | Comissão + SaaS |

### 10.2 Processo de venda (SMB)

```text
Lead → Demo 15 min (ao vivo) → Proposta 1 página → Piloto 7–14 dias
    → Fecho (kit ou só software) → Onboarding → Upsell 2ª tela / cardápio
```

**Objeção comum → resposta**

| Objeção | Resposta |
|---------|----------|
| “Já uso pen drive” | Custo de ir lá toda vez; remoto + horário de tela |
| “É caro” | Comparar a 1 falha de promoção / hora de funcionário |
| “Não entendo de TI” | Kit instalado + fluxo Publicar em Totem |
| “E se cair a internet?” | Cache + fallback local no Player-AD |

### 10.3 Canais de venda

1. **Direto** (fundador/owner) — SMB local.  
2. **Parceiro instalador** — margem no hardware + setup.  
3. **White-label / integrador** — redes (médio prazo).  

### 10.4 Política comercial mínima

- Contrato simples (assinatura + SLA de suporte horário comercial).  
- Garantia de instalação no Kit Pronto.  
- Sem desconto eterno: desconto só no setup, não no MRR.  

---

## 11. Relação de focos comerciais

Ordem recomendada de **foco de receita** (do mais próximo ao mais estratégico):

| # | Foco comercial | Porquê agora | Oferta âncora | Prioridade |
|---|----------------|--------------|---------------|------------|
| **1** | **Totem monousuário para food service / loja local** | Ciclo curto, demo óbvia, Player-AD maduro | Publicar em Totem + Kit Pronto | **P0** |
| **2** | **Hardware + instalação (kit TV box)** | Margem no setup; reduz churn técnico | TV box + pendrive + config | **P0** |
| **3** | **Assinatura recorrente por tela** | Base de MRR previsível | Starter / Rede | **P0** |
| **4** | **Cardápio digital / templates** | Aumenta valor percebido no nicho food | Quick-publish + menu catalog | **P1** |
| **5** | **Serviços profissionais** | Cash imediato; nutre produto | Instalação, treino, custom | **P1** |
| **6** | **Redes multi-loja / franchise** | Ticket maior; usa multi-tenant | Pacote Rede | **P1** |
| **7** | **Marketplace anunciante × publisher** | Escala de receita de mídia | Billing + contratos | **P2** |
| **8** | **White-label / OEM para integradores** | Escala indireta | Branding + API | **P2** |
| **9** | **DOOH / shopping / enterprise** | Ticket alto, ciclo longo | Enterprise + SLA | **P3** |
| **10** | **IA / FX / holograph (inovação)** | Diferenciação futura, não fecho atual | Add-ons premium | **P3** |

### O que **não** deve ser foco comercial nos próximos 90 dias

- Vender “plataforma completa SmartSignage Pro” como primeira conversa SMB.  
- Empurrar dispatcher/mix/IA antes do cliente publicar a primeira mídia.  
- Abrir frentes enterprise DOOH sem cases locais.  

---

## 12. Recomendações estratégicas

1. **Uma oferta, uma demo, um CTA** — “Kit TotemDigital Pronto” com preço público.  
2. **Esconder complexidade** — onboarding monousuário; admin avançado só para operadores.  
3. **Fechar o gap marca ↔ UI** — aplicar Amarelo Petróleo no painel (com autorização).  
4. **Padronizar campo** — 1–2 modelos de TV box + kit pendrive versionado.  
5. **Medir funil** — demos → pilotos → pagos → 2ª tela.  
6. **Documentar pricing** numa página comercial viva (atualizar este doc a cada trimestre).  

---

## 13. Conclusão

O TotemDigital Studio já é, na prática, um **produto de sinalização digital de ponta a ponta**, com diferenciação real no **Player-AD + operação de totem portrait** e uma base **multi-tenant** capaz de escalar para redes e marketplace.

O risco principal não é “falta de feature”: é **dispersão comercial e cognitiva**. A vitória nos próximos meses está em **vender e operar bem o foco P0** (negócio local + kit + assinatura), usando a arquitetura profunda como vantagem competitiva silenciosa — não como pitch inicial.

---

## Anexo A — Mapa rápido de módulos (para vendas técnicas)

| Módulo | Estado comercial |
|--------|------------------|
| Publicar em Totem | Pronto para oferta P0 |
| Biblioteca de mídias | Pronto |
| Player-AD + pendrive | Pronto |
| Controlo remoto / schedule | Pronto / em consolidação |
| Contratos & billing | Base técnica; empacotar comercialmente |
| Playlist Mix / Dispatcher avançado | Diferencial operador (P1–P2) |
| Visual.Interface / BV | Evolução (não prometer integrado 100%) |
| Players webOS / Tizen / Electron | Opcional / sob demanda |

## Anexo B — Referências internas

- `docs/PRODUCT_VISION_TOTEM_DIGITAL_V3X.md`  
- `docs/DOCUMENTACAO-COMERCIAL-TECNICA.md`  
- `docs/HANDOFF-CONTINUIDADE-PRODUTO-2026-07-21.md`  
- `docs/hardware/1-PAGER-EXECUTIVO.md`  
- `docs/ANALISE_BILLING_MODELO_NEGOCIO.md`  
- `install-pendrive/README.md`  

---

*Documento gerado para o repositório TotemDigital-Studio — Julho/2026.*
