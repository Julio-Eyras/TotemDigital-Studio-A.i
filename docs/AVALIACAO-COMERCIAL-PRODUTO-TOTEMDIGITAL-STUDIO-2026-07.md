# TotemDigital Studio — Avaliação Comercial e de Produto

**Versão do documento:** 1.1  
**Data:** 12 de agosto de 2026  
**Origem:** v1.0 (23/07/2026) — actualizado ao eixo operacional `main`  
**Repositório:** [Julio-Eyras/TotemDigital-Studio](https://github.com/Julio-Eyras/TotemDigital-Studio)  
**Branch de referência / default:** `main`  
**Produção:** https://totemdigital.app.br  
**Autor:** Julio Cesar Eyras (J.C.E.) / Eyras Sistemas e Soluções  
**Licença:** proprietária — todos os direitos reservados ([LICENSE](../LICENSE) · [NOTICE](../NOTICE))  
**Marcas no ecossistema:** TotemDigital · SmartSignage Pro · Player-AD  
**PDF:** [AVALIACAO-COMERCIAL-PRODUTO-TOTEMDIGITAL-STUDIO-2026-07.pdf](./AVALIACAO-COMERCIAL-PRODUTO-TOTEMDIGITAL-STUDIO-2026-07.pdf)  

### Baseline operacional (ago/2026)

| Componente | Versão |
|------------|--------|
| Frontend | 2.1.21 |
| Backend | 2.1.15 |
| Player-AD (Android) | 2.12 (build 112) |

Um código, **três modos** — nunca Direct Totem e multi-agência ao mesmo tempo:

| Modo | Nome comercial | Ideia |
|------|----------------|--------|
| **Direct Totem** (`off` / `single_publisher`) | TotemDigital Direct | Uma organização; publicar nos próprios totens |
| **Multi Lite** (`lite`) | TotemDigital Multi Lite | Várias orgs + anunciantes; sem planos/billing |
| **Multi Pro** (`full`) | TotemDigital Pro | Agência completa (planos, contratos, billing, OTA, …) |

---

## 0. Glossário comercial (nomes canónicos)

Usar **estes** nomes em venda, landing e proposta. Não misturar “Starter / Entry / monousuário” sem o modo.

| Modo de produto | SKU de venda | O que o cliente compra |
|-----------------|--------------|-------------------------|
| **Direct** | **Kit Pronto** | TV box homologada + Player-AD 2.12 + painel Direct + instalação + treino 1h + assinatura |
| **Direct** | **Só software** | Painel Direct + Player-AD (cliente já tem box Android) + assinatura |
| **Direct** | **2ª tela** | Novo totem na mesma org; desconto só no setup, não no MRR |
| **Lite** | **Rede** | Multi-loja / anunciantes sem ERP de cobrança |
| **Pro** | **Mídia Indoor** | Contratos, billing, OTA, analytics, operação de agência |

**Pitch de 15 min (P0):** só **Direct** + Kit Pronto ou Só software.  
**Lite / Pro:** 2.º slide / upsell — ver [apresentação SaaS](./manuais/06-APRESENTACAO-COMERCIAL-SAAS.md), não a primeira conversa SMB.

**Preços:** ainda **a fechar** numa página comercial viva. Este documento **não inventa** valores de lista; KPIs de MRR na §8 são orientativos.

---

## 1. Sumário executivo

O **TotemDigital Studio** é uma plataforma completa de **sinalização digital** (digital signage) para publicar, distribuir e operar conteúdo visual em **totens**, **TVs** e **telas comerciais**, com painel administrativo web, backend multi-tenant, motor de dispatch e players nativos (destaque: **Player-AD** em Android).

Na superfície, a promessa de produto é simples:

> **Publique cardápios, promoções e anúncios nas suas telas em minutos.**

Por baixo, há uma arquitetura madura (campanhas, playlists, contratos, billing, dispatcher, heartbeat, Wi‑Fi de campo, controlo remoto, OTA, kit hardware/TV box) que permite evoluir de SMB local (**Direct**) para operação de rede (**Lite**) e marketplace de mídia indoor (**Pro**).

**Veredito em uma frase:** produto tecnicamente **forte e diferenciado** no stack self-hosted + player Android portrait; comercialmente ainda **subexplorado** — o foco imediato é oferta **Direct** (“Publicar em Totem”) + **Kit Pronto** + ciclo de venda curto em negócios locais, sem abandonar a espinha dorsal multi-tenant.

---

## 2. O que é o projeto

| Camada | Papel |
|--------|--------|
| **TotemDigital** | Marca e linha de produto focada em totens / Direct / identidade visual |
| **SmartSignage Pro** | Plataforma multi-tenant (admin + API + PostgreSQL + billing/contratos) — modos Lite/Pro |
| **Player-AD** | Player Android nativo (Kotlin/ExoPlayer) para TV box / totem 24/7 — versão de campo **2.12 / 112** |
| **Player-AD-Installer** | `Instala-Player-TotemDigital.apk` — instala o player + logos opcionais |
| **player-web / Player-LXN / WOS** | Linhas alternativas de player (browser, Linux, webOS) |
| **install-pendrive** | Kit de instalação de campo (APK, config, ADB, manuais) |
| **totemdigital.app.br** | Produção operacional (`main`) |
| **totemdigital.site / corporate-site** | Presença web e apresentações comerciais |
| **Visual.Interface / TotemDigital.BV** | Biblioteca visual / mini CMS (evolução; integração parcial) |

### Stack principal

- **Frontend:** React 18 + TypeScript + MUI (2.1.21)  
- **Backend:** Node.js + Express + TypeScript (2.1.15)  
- **Base de dados:** PostgreSQL (schema v2 refatorado + seeds v6 como fonte da verdade)  
- **Proxy:** Nginx  
- **Player operacional de referência:** Player-AD 2.12 — portrait 9:16, kiosk, cache offline, heartbeat, comandos remotos, **Wi‑Fi no aparelho**  
- **Instalação servidor:** `scripts/Instala-TotemDigital-Server.sh` (`TDI_GIT_BRANCH=main`; `--modo producao` / `--modo atualizar`)  
- **Campo:** kit USB + instalador APK  

### Fluxo operacional central

```text
Biblioteca / Campanha / Playlist / Publicação direta (Direct)
        ↓
   Dispatcher (DispatchPlan)
        ↓
   Player-AD 2.12 (ou player web)
        ↓
Heartbeat · remote_commands (incl. configure_wifi) · screenshots · eventos
```

---

## 3. Capacidades (o que o sistema já entrega)

### 3.1 Operação de conteúdo

- Biblioteca de mídias (upload, thumbs, preview, rotação/normalização de entrega)
- Publicação direta em totem (**Publicar em Totem**) com multi-seleção e reordenação — **oferta P0**
- Playlists, campanhas, vinhetas e mix de playlists (mais visíveis em Lite/Pro)
- Templates / quick-publish e cardápio por cliente (linha Studio / anunciantes — **P1**, não pitch SMB)
- Horário de tela por totem (display schedule) e controlo remoto
- Painel Direct documentado com capturas reais ([manuais de telas 08–11](./manuais/telas/README.md))

### 3.2 Dispositivos e campo

- Cadastro de totens / Smart TVs / locais / organizações (publishers)
- Player-AD 2.12: kiosk, portrait, cache offline, fallback local, config por JSON/UIN
- **Wi‑Fi no aparelho:** 3 toques no ecrã → scan/ligar (DebugConfig); kiosk relaxado em debug
- **Remoto:** comando `configure_wifi` (além de heartbeat / remote_commands existentes)
- Kit pendrive (APK release, config de exemplo, scripts ADB, bootanimation)
- **Instala-Player-TotemDigital.apk** (player + logos opcionais)
- OTA updates e ferramentas de diagnóstico ADB documentadas
- Specs de hardware / procurement de TV box (documentação ODM)
- **HDMI-CEC:** **não viável** na TV_BOX_3 de referência (firmware sem `hdmi_control` / `/dev/cec*`). Não prometer “ligar/desligar a TV” via CEC. Alternativa comercial: horário de tela no player + IR/tomada inteligente se o cliente pedir.

### 3.3 Plataforma e negócio

- Três modos de produto no mesmo código (Direct / Lite / Pro)
- Multi-tenancy e papéis (admin, organização, anunciante)
- Contratos (publisher / subscriber) e billing estruturado no modelo de dados (**base técnica; ainda não empacotado para venda**)
- Dispatcher com gerir, estatísticas, monitor, debug e timeline
- Analytics / relatórios / admin tools (Pro / operador)
- Autenticação JWT, rate limit, 2FA (configurável), instalação automatizada
- Mini-livreto prod / DEV / TESTE: instalar do zero ou actualizar **sem perder dados**

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

Meta operacional 90 dias: **≤ 15 min** no piloto (wizard / checklist Direct ainda em consolidação).

### 4.3 Objetivos técnicos

1. Manter o Player-AD 2.12 estável 24/7 em portrait com cache, Wi‑Fi de campo e recuperação offline.  
2. Preservar schema/instalador como fonte da verdade (sem “patches” temporários); branch operacional **`main`**.  
3. Simplificar a **oferta Direct** sem destruir a arquitetura Lite/Pro.  
4. Integrar gradualmente Visual.Interface / identidade TotemDigital no admin (login + sidebar primeiro).  
5. Corrigir gates de permissão que quebram a demo Direct (`owner_system` em Complementos e Configurações → Dispatcher).  

### 4.4 Objetivos comerciais (12–24 meses)

| Horizonte | Objetivo |
|-----------|----------|
| **0–90 dias** | Oferta empacotada **Kit Pronto Direct** + 10–20 clientes piloto pagantes; **1 preço público** (setup + MRR/tela) |
| **6–12 meses** | MRR sustentável via assinatura por tela/organização; rede de instaladores |
| **12–24 meses** | Upsell Lite/Pro (anunciantes × publishers) e white-label para redes |

---

## 5. Público-alvo

### 5.1 Primário (ciclo curto — prioridade comercial)

| Segmento | Dor | Valor percebido | Oferta |
|----------|-----|-----------------|--------|
| Restaurantes, lancherias, cafés, bares, hamburguerias | Cardápio/promoção desatualizados; USB | Actualizar preço/oferta remoto em minutos | **Direct** Kit / Só software |
| Mercados e lojas locais | Ofertas de gôndola / fila / vitrine | Totem 9:16 com conteúdo fresco | **Direct** |
| Recepção de empresas / clínicas | Comunicação institucional estática | Painel gerido sem TI pesada | **Direct** |
| Operadores de totens de anúncio indoor | Monetizar espaço + uptime | Player estável + dispatch + status remoto | **Lite** (upsell) |

### 5.2 Secundário (ticket maior)

- Redes de varejo / farmácias / franchises multi-loja → **Lite / Rede**  
- Shoppings e operadores de mídia DOOH indoor → **Pro** (ciclo longo, P3)  
- Hotéis, hospitais, educação (informação + marca)  
- Integradores / MSPs que querem white-label → **P2**  

### 5.3 Personas

1. **Dono do negócio local** — quer “aparecer moderno” e mudar promo sem técnico.  
2. **Operador de rede de telas** — quer inventário, uptime, controlo remoto e receita.  
3. **Anunciante regional** — quer comprar inventário sem gerir hardware.  
4. **Integrador/instalador** — quer kit USB + APK instalador + ADB + margem de serviço.  

---

## 6. Pontos fortes

1. **Stack vertical completo** — do painel ao player Android, instalador APK e kit de campo.  
2. **Player-AD 2.12 operacional** — kiosk, portrait, cache, heartbeat, remoto, schedule, **Wi‑Fi no aparelho**.  
3. **Três modos no mesmo código** — Direct / Lite / Pro sem migrar de fornecedor.  
4. **Direct como caminho comercial simples** — “Publicar em Totem” sobre a mesma base.  
5. **Self-hosted / controlo de dados** — diferencial vs SaaS estrangeiros; licença **proprietária**.  
6. **Documentação e instaladores** — manuais 00–07, telas 08–11 (PDF), mini-livreto `main`, Player-AD 2.12.  
7. **Identidade de marca** — TotemDigital / Amarelo Petróleo (materiais; UI do painel ainda parcial).  
8. **Extensibilidade** — mix, FX, OTA, analytics, múltiplos players.  
9. **Prova de campo** — fluxo real servidor ↔ TV box documentado e iterado em produção (`totemdigital.app.br`).  

---

## 7. Pontos negativos e riscos

| Área | Problema | Impacto |
|------|----------|---------|
| **Complexidade cognitiva** | Admin rico (campanhas, mix, dispatcher, billing) vs promessa “5 minutos” | Fricção na venda SMB |
| **Dois pitches no repo** | Doc 07 / este doc = P0 local; [06 SaaS](./manuais/06-APRESENTACAO-COMERCIAL-SAAS.md) = rede global | Mensagem diluída se misturados na 1.ª demo |
| **Débito de UX/tema** | Identidade TotemDigital ainda parcial no admin | Branding fraco no primeiro ecrã |
| **Gate de permissão (bug)** | Complementos e Configurações → Dispatcher bloqueiam `owner_system` / Owner System | Demo “sou dono e não consigo”; **corrigir em código** (não é limitação de produto) |
| **Integrações incompletas** | Visual.Interface / BV não totalmente no backend principal | Feature story vs realidade |
| **Superfície técnica** | Muitos players e pastas legadas no monorepo | Custo de manutenção / onboarding |
| **Billing comercial** | Modelo de dados avançado; GTM e **pricing ainda por fechar** | Receita recorrente lenta |
| **Dependência de campo** | Hardware Android/TV box variável; portrait/ADB/OEM | Suporte e SLA caros — homologar **1–2 boxes** |
| **HDMI-CEC** | Firmware da TV_BOX_3 sem CEC | Não vender power TV remoto via HDMI |
| **Deploy / ops** | Instalação Linux poderosa mas sensível | Mitigado pelo mini-livreto `main`; ainda exige disciplina de backup |
| **Concorrência** | Players SaaS globais (onboarding polished) | Percepção “mais difícil” |
| **Foco comercial** | Excesso de docs/features vs funil de venda curto | Time disperso |
| **Docs comerciais antigos** | [DOCUMENTACAO-COMERCIAL-TECNICA.md](./DOCUMENTACAO-COMERCIAL-TECNICA.md) (jan/2026) fala em open source e preços obsoletos | **Não usar em proposta**; ver aviso no próprio ficheiro |

---

## 8. Metas mensuráveis (sugeridas)

### 8.1 Produto

| KPI | Meta 90 dias | Meta 12 meses |
|-----|--------------|---------------|
| Tempo até 1ª publicação em tela real (piloto) | ≤ 15 min (meta aspiracional 5 min) | ≤ 5 min no fluxo guiado |
| Uptime player piloto | ≥ 98% | ≥ 99,5% |
| Tickets de instalação “quebrada” | −50% vs baseline | Kit 2.12 + checklist + 1–2 boxes homologadas |
| NPS / satisfação piloto | ≥ 40 | ≥ 50 |
| Gate `owner_system` (Complementos / Dispatcher settings) | Corrigido | Estável |

### 8.2 Comercial

| KPI | Meta 90 dias | Meta 12 meses |
|-----|--------------|---------------|
| Clientes pagantes | 10–20 | 80–150 |
| MRR | R$ 8–20 mil *(orientativo)* | R$ 60–120 mil *(orientativo)* |
| Ticket médio | R$ 200–600 / org ou /tela *(orientativo)* | Mix assinatura + kit |
| Pipeline qualificável | 50 leads | Funil contínuo com parceiros |
| Preço público Direct | **Publicado** (setup + MRR/tela) | Revisão trimestral |

*(Calibrar com pricing real e CAC. Não usar estes números como lista de preço.)*

---

## 9. Plano de divulgação

### 9.1 Narrativa (mensagem única — P0)

**Headline:** Telas que vendem sozinhas — publique no totem em minutos.  
**Prova:** Demo ao vivo (Player-AD 2.12 + painel Direct) + antes/depois de cardápio.  
**CTA:** Agendar instalação piloto / pedir orçamento do **Kit Pronto**.  
**Não dizer na 1.ª conversa:** dispatcher, mix, billing, “plataforma Pro”, HDMI-CEC, Visual.Interface 100%.

Lite/Pro só no verso do one-pager ou 2.º encontro.

### 9.2 Canais (priorizados)

| Canal | Acção | Frequência |
|-------|------|------------|
| **Demo presencial** | Visita a restaurantes/lojas com TV box | Semanal |
| **WhatsApp Business** | Catálogo + vídeo 30–60s do totem | Diário (leads) |
| **Instagram / Reels** | Clipes do totem em funcionamento (Amarelo Petróleo) | 3–5×/semana |
| **Landing** (`totemdigital.site`) | Oferta Kit Pronto + formulário + cases | Sempre on |
| **Parceiros locais** | Gráficas, instaladores de câmeras/alarme, provedores | Mensal |
| **Eventos regionais** | Feiras gastronómicas / varejo | Trimestral |
| **Conteúdo SEO** | “cardápio digital totem”, “sinalização digital restaurante” | Contínuo |
| **LinkedIn B2B** | Redes e integradores (ticket maior / Lite) | 2×/semana |

### 9.3 Materiais

- One-pager executivo (hardware + Player-AD 2.12 + Wi‑Fi de campo)  
- Vídeo demo 60s + case 1 página  
- Kit pendrive / ZIP + **Instala-Player-TotemDigital.apk**  
- Apresentação Amarelo Petróleo (já no site)  
- Roteiro demo 15 min: login → Biblioteca → Publicar em Totem (PDFs [08–09](./manuais/telas/README.md))  
- Tabela Direct / Lite / Pro no **verso** do one-pager  
- Tabela de preços simples (3 números: setup kit · MRR 1 tela · MRR tela extra) — **a preencher**

### 9.4 Calendário 90 dias (resumo)

1. **Semanas 1–2:** fechar oferta e **preço piloto**; landing alinhada; corrigir gate `owner_system`; 5 demos.  
2. **Semanas 3–6:** 15–25 demos; 5–10 pilotos; reels semanais; kit 2.12 versionado.  
3. **Semanas 7–12:** cases; canal de instaladores; upsell 2ª tela.  

---

## 10. Plano de venda

### 10.1 Pacotes comerciais (mapeados aos modos)

| Pacote (SKU) | Modo | Inclui | Modelo | Preço |
|--------------|------|--------|--------|-------|
| **Só software** | Direct | 1 totem/tela + painel Direct + suporte básico | Assinatura / tela | *a definir* |
| **Kit Pronto** | Direct | Só software + TV box homologada + instalação + treino 1h (Wi‑Fi no local) | Setup único + assinatura | *a definir* |
| **2ª tela** | Direct | Novo totem na mesma org | Setup (c/ desconto) + MRR cheio | *a definir* |
| **Rede** | Lite | Multi-loja, roles, anunciantes, monitorização | Assinatura por org + telas | *a definir* |
| **Mídia Indoor** | Pro | Publisher + anunciantes + revenue share + billing | Comissão + SaaS | *a definir* |

Página comercial viva: actualizar **esta tabela** quando o preço piloto fechar (não espalhar números em docs antigos).

### 10.2 Processo de venda (SMB / Direct)

```text
Lead → Demo 15 min (ao vivo, só Direct) → Proposta 1 página → Piloto 7–14 dias
    → Fecho (Kit Pronto ou Só software) → Onboarding → Upsell 2ª tela / cardápio
    → (mais tarde) Lite se o cliente vender espaço
```

**Roteiro da demo (15 min)**

1. Login no painel Direct  
2. Biblioteca — upload de 1 imagem/vídeo  
3. Publicar em Totem — seleccionar totem, gravar  
4. Totem muda (Player-AD)  
5. Opcional técnico (só se o cliente perguntar): Monitor Dispatcher, Wi‑Fi 3 toques  

**Objeção comum → resposta**

| Objeção | Resposta |
|---------|----------|
| “Já uso pen drive” | Custo de ir lá toda vez; remoto + horário de tela |
| “É caro” | Comparar a 1 falha de promoção / hora de funcionário |
| “Não entendo de TI” | Kit Pronto + fluxo Publicar em Totem |
| “E se cair a internet?” | Cache + fallback local no Player-AD |
| “Dá para desligar a TV à distância?” | Horário de tela no player; CEC **não** neste hardware; IR/tomada se precisar |

### 10.3 Canais de venda

1. **Direto** (fundador/owner) — SMB local, **Direct**.  
2. **Parceiro instalador** — margem no hardware + setup; **não** vende Lite/Pro.  
3. **White-label / integrador** — redes (médio prazo).  

### 10.4 Política comercial mínima

- Contrato simples (assinatura + SLA de suporte horário comercial).  
- Garantia de instalação no Kit Pronto.  
- Sem desconto eterno: desconto só no setup, não no MRR.  
- Licença **proprietária** — sem open source, sem sublicenciamento implícito.  

---

## 11. Relação de focos comerciais

Ordem recomendada de **foco de receita** (do mais próximo ao mais estratégico):

| # | Foco comercial | Porquê agora | Oferta âncora | Prioridade |
|---|----------------|--------------|---------------|------------|
| **1** | **Totem Direct para food service / loja local** | Ciclo curto, demo óbvia, Player-AD 2.12 maduro | Publicar em Totem + Kit Pronto | **P0** |
| **2** | **Hardware + instalação (kit TV box)** | Margem no setup; reduz churn técnico | TV box homologada + pendrive + APK instalador + Wi‑Fi | **P0** |
| **3** | **Assinatura recorrente por tela** | Base de MRR previsível | Só software / Kit / 2ª tela | **P0** |
| **4** | **Cardápio digital / templates** | Aumenta valor percebido no nicho food | Quick-publish + 2–3 templates | **P1** |
| **5** | **Serviços profissionais** | Cash imediato; nutre produto | Instalação, treino, custom | **P1** |
| **6** | **Redes multi-loja / franchise** | Ticket maior; usa Lite | Pacote Rede | **P1** |
| **7** | **Marketplace anunciante × publisher** | Escala de receita de mídia | Pro + billing + contratos | **P2** |
| **8** | **White-label / OEM para integradores** | Escala indireta | Branding + API | **P2** |
| **9** | **DOOH / shopping / enterprise** | Ticket alto, ciclo longo | Enterprise + SLA | **P3** |
| **10** | **IA / FX / holograph (inovação)** | Diferenciação futura, não fecho atual | Add-ons premium | **P3** |

### O que **não** deve ser foco comercial nos próximos 90 dias

- Vender “plataforma completa SmartSignage Pro” como primeira conversa SMB.  
- Empurrar dispatcher/mix/IA antes do cliente publicar a primeira mídia.  
- Prometer HDMI-CEC, Visual.Interface 100% ou billing “já vendável”.  
- Abrir frentes enterprise DOOH sem cases locais.  

---

## 12. Recomendações estratégicas

1. **Uma oferta, uma demo, um CTA** — “Kit TotemDigital Pronto” (Direct) com preço público.  
2. **Esconder complexidade** — onboarding Direct; Lite/Pro só para operadores.  
3. **Fechar o gap marca ↔ UI** — Amarelo Petróleo no login + sidebar (com autorização).  
4. **Padronizar campo** — 1–2 modelos de TV box + kit 2.12 versionado (pendrive + APK instalador).  
5. **Medir funil** — demos → pilotos → pagos → 2ª tela.  
6. **Documentar pricing** numa página comercial viva (actualizar **este** doc a cada trimestre).  
7. **Corrigir gate `owner_system`** antes de escalar demos (Complementos + Configurações → Dispatcher).  
8. **Dois documentos, dois públicos** — este doc + manuais = P0/ops; [06](./manuais/06-APRESENTACAO-COMERCIAL-SAAS.md) = upsell rede/SaaS. Não fundir num pitch genérico.

### Ordem de implementação (próximos passos internos)

```text
1. Este doc v1.1 + glossário                    ← feito (ago/2026)
2. Corrigir gate owner_system (código)          ← desbloqueia demo
3. Preço piloto + one-pager                     ← fecha venda
4. Roteiro demo 15 min + PDFs de telas          ← operação comercial
5. Kit 2.12 versionado + 1 TV box homologada    ← campo
6. Wizard / checklist 1ª publicação (Direct)    ← produto
7. Templates cardápio                           ← P1, após 5–10 pilotos
8. Lite/Pro só como upsell documentado
```

---

## 13. Conclusão

O TotemDigital Studio já é, na prática, um **produto de sinalização digital de ponta a ponta**, com diferenciação real no **Player-AD 2.12 + operação Direct portrait** e uma base **Lite/Pro** capaz de escalar para redes e marketplace.

O eixo operacional é **`main`** (produção `totemdigital.app.br`). O risco principal não é “falta de feature”: é **dispersão comercial e cognitiva**. A vitória nos próximos meses está em **vender e operar bem o P0** (Direct + kit + assinatura), usando a arquitectura profunda como vantagem competitiva silenciosa — não como pitch inicial.

---

## Anexo A — Mapa rápido de módulos (para vendas técnicas)

| Módulo | Estado comercial |
|--------|------------------|
| Publicar em Totem (Direct) | Pronto para oferta P0 — telas 01–09 documentadas |
| Biblioteca de mídias | Pronto — telas 10–14 |
| Organização / locais / totens / usuários | Pronto — telas 15–19 |
| Player-AD 2.12 + pendrive + APK instalador | Pronto (Wi‑Fi local + remoto) |
| Controlo remoto / schedule | Pronto / em consolidação |
| Dispatcher (gerir / monitor / debug) | Diferencial operador (P1–P2); sidebar ok; **settings tab com gate a corrigir** |
| Complementos (modo Direct/Lite/Pro) | Crítico para ops; **gate `owner_system` a corrigir** |
| Contratos & billing | Base técnica; empacotar comercialmente (Pro) |
| Playlist Mix / Dispatcher avançado | Diferencial operador (P1–P2) |
| Configurações (Geral, APK, Logs, Mídias, 2FA, Senha) | Pronto para admin — telas 27–34 |
| Visual.Interface / BV | Evolução (não prometer integrado 100%) |
| HDMI-CEC | **Não oferecer** neste hardware de referência |
| Players webOS / Tizen / Electron | Opcional / sob demanda |

## Anexo B — Referências internas (actualizadas)

| Tema | Caminho |
|------|---------|
| Índice de manuais | [`docs/manuais/README.md`](./manuais/README.md) |
| Telas Direct (capturas + PDF) | [`docs/manuais/telas/README.md`](./manuais/telas/README.md) |
| Pitch SaaS / rede (upsell, não P0) | [`docs/manuais/06-APRESENTACAO-COMERCIAL-SAAS.md`](./manuais/06-APRESENTACAO-COMERCIAL-SAAS.md) |
| Mini-livreto prod/DEV/TESTE (`main`) | [`docs/instalacao/05-MINI-LIVRETO-MAIN-PROD-DEV-TESTE.md`](./instalacao/05-MINI-LIVRETO-MAIN-PROD-DEV-TESTE.md) |
| Player-AD utilizador | [`docs/player-apk/01-MANUAL-USUARIO.md`](./player-apk/01-MANUAL-USUARIO.md) |
| Player-AD instalação/config | [`Player-AD/docs/MANUAL-USUARIO-INSTALACAO-CONFIGURACAO.md`](../Player-AD/docs/MANUAL-USUARIO-INSTALACAO-CONFIGURACAO.md) |
| Visão de produto | [`docs/PRODUCT_VISION_TOTEM_DIGITAL_V3X.md`](./PRODUCT_VISION_TOTEM_DIGITAL_V3X.md) |
| Handoff continuidade (jul/2026) | [`docs/HANDOFF-CONTINUIDADE-PRODUTO-2026-07-21.md`](./HANDOFF-CONTINUIDADE-PRODUTO-2026-07-21.md) |
| Hardware 1-pager | [`docs/hardware/1-PAGER-EXECUTIVO.md`](./hardware/1-PAGER-EXECUTIVO.md) |
| Análise billing | [`docs/ANALISE_BILLING_MODELO_NEGOCIO.md`](./ANALISE_BILLING_MODELO_NEGOCIO.md) |
| Kit pendrive | [`install-pendrive/README.md`](../install-pendrive/README.md) |
| README raiz | [`README.md`](../README.md) |
| Doc comercial-técnico jan/2026 | [`DOCUMENTACAO-COMERCIAL-TECNICA.md`](./DOCUMENTACAO-COMERCIAL-TECNICA.md) — **obsoleto para proposta** |

---

## Changelog

| Ver. | Data | Notas |
|------|------|--------|
| 1.0 | 23/07/2026 | Avaliação inicial; branch `SmartSignage-direc-totem`. |
| 1.1 | 12/08/2026 | Eixo `main`; Direct/Lite/Pro; Player-AD 2.12 (Wi‑Fi, instalador APK); HDMI-CEC fora; licença proprietária; glossário SKU; riscos de gate e docs antigos; anexos e manuais de telas. **Sem preços inventados.** |

---

*Documento vivo do repositório TotemDigital-Studio — Agosto/2026. Actualizar a cada trimestre ou quando fechar pricing.*
