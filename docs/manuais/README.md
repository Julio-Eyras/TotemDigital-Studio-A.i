# Manuais TotemDigital Studio

**Data:** 2026-08-03  
**Repo:** https://github.com/Julio-Eyras/TotemDigital-Studio.git  
**Branch de referência:** `main`  
**Público:** instalação, operação, administração e desenvolvimento

Esta pasta é o **ponto de entrada operacional e de utilização**.  
A **fonte da verdade de regras/requisitos por módulo** está em [`../modulos/00-INDICE.md`](../modulos/00-INDICE.md) (metodologia EARS + RN + fluxos + aceite). Decisões técnicas: [`../adr/README.md`](../adr/README.md).

**Baseline operacional:** Frontend `2.1.21` · Backend `2.1.15` · Player-AD
`2.11` (build `111`) · branch `main`.

---

## Índice

| # | Documento | Para quem |
|---|-----------|-----------|
| 00 | [Visão geral, pré-requisitos, benefícios e requisitos](./00-VISAO-GERAL-PRE-REQUISITOS-BENEFICIOS.md) | Decisão / onboarding |
| 01 | [Instalação e parâmetros do instalador](./01-INSTALACAO-PARAMETROS.md) | DevOps / sysadmin |
| 02 | [Guia do utilizador — primeira vez](./02-GUIA-PRIMEIRA-VEZ-UTILIZADOR.md) | Operador / dono |
| 03 | [Módulos e formas de trabalho](./03-MODULOS-E-FORMAS-DE-TRABALHO.md) | Todos |
| 04 | [Manual administrativo](./04-MANUAL-ADMINISTRATIVO.md) | `owner_system` / admin |
| 05 | [Manual técnico — modelo E.R., API e serviços](./05-MANUAL-TECNICO-MODELO-ER-API.md) | Desenvolvimento |
| 06 | [Apresentação comercial (software + SaaS)](./06-APRESENTACAO-COMERCIAL-SAAS.md) | Vendas / parceiros / C-level |
| 07 | [Manual do utilizador — Publicar em Totem](./07-MANUAL-PUBLICAR-EM-TOTEM.md) | Operador / dono |

### Catálogo canónico de módulos (negócio)

| Recurso | Caminho |
|---------|---------|
| Índice de módulos | [../modulos/00-INDICE.md](../modulos/00-INDICE.md) |
| Metodologia | [../modulos/00-METODOLOGIA.md](../modulos/00-METODOLOGIA.md) |
| ADRs | [../adr/README.md](../adr/README.md) |

---

## Três modos de produto (resumo)

| Modo | Quem usa | Ideia |
|------|----------|--------|
| **Direct Totem** (`off`) | Uma organização, operação simples | Publicar mídias nos totens da própria org |
| **Multi Lite** (`lite`) | Várias orgs + anunciantes, sem ERP | Receita de propaganda leve; vínculo anunciante↔org via **SPA** |
| **Multi Pro** (`full`) | Agências / operação completa | Planos, contratos, billing, OTA, dispatcher, analytics |

Nunca Direct Totem e multi-agência ao mesmo tempo. Ver [03](./03-MODULOS-E-FORMAS-DE-TRABALHO.md).

---

## Documentação satélite (já no repo)

| Tema | Caminho |
|------|---------|
| Procedimentos completos por modalidade | [../instalacao/README.md](../instalacao/README.md) |
| Handoff multi-agência (continuidade IA/equipa) | [../HANDOFF-MULTI-AGENCIA-CONTINUIDADE.md](../HANDOFF-MULTI-AGENCIA-CONTINUIDADE.md) |
| Instalador (detalhe CLI) | [../INSTALA-TOTEMDIGITAL-SERVER.md](../INSTALA-TOTEMDIGITAL-SERVER.md) |
| Multi-instância prod/dev/teste | [../MULTI-INSTANCIA-PROD-DEV-TESTE.md](../MULTI-INSTANCIA-PROD-DEV-TESTE.md) |
| Dev do zero no VPS | [../VPS-DEV-DO-ZERO-MULTI-AGENCIA.md](../VPS-DEV-DO-ZERO-MULTI-AGENCIA.md) |
| Plano de testes L0/L1/L2 | [../PLANO-TESTES-MULTI-AGENCIA-DEV.md](../PLANO-TESTES-MULTI-AGENCIA-DEV.md) |
| API legada (player/dispatch) | [../technical/01-api.md](../technical/01-api.md) |
| Avaliação comercial 2026 | [../AVALIACAO-COMERCIAL-PRODUTO-TOTEMDIGITAL-STUDIO-2026-07.md](../AVALIACAO-COMERCIAL-PRODUTO-TOTEMDIGITAL-STUDIO-2026-07.md) |

---

## Convenções

- **Organização** = `publisher` (BD/API).  
- **Anunciante** = `subscriber`.  
- **SPA** = `subscriber_publisher_access` (vínculo anunciante → organização).  
- **Complementos** = UI `/settings/system-modules` (módulos de instalação ≠ `flag_smart_*` por utilizador).  
- Schema: ficheiros definitivos em `database/smartchannel-db-v2-refactored-part*.sql` (sem migrations ad-hoc).
