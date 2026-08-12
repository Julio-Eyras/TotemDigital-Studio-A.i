# 03 — Módulos e formas de trabalho

Este documento explica **o que cada módulo faz**, como o **master switch** os combina, e as **formas de trabalho** recomendadas.

Para **requisitos, regras de negócio, fluxos e aceite por módulo**, usar o catálogo canónico:  
[../modulos/00-INDICE.md](../modulos/00-INDICE.md) · metodologia [../modulos/00-METODOLOGIA.md](../modulos/00-METODOLOGIA.md).

---

## 1. Dois conceitos que não se misturam

| Conceito | Onde vive | Significado |
|----------|-----------|-------------|
| **Módulos de instalação** | `system_settings.installation.modules` | Complementos de **produto** da máquina |
| **Flags de utilizador** | `flag_smart_*` | Permissões **por utilizador** (menu fino) |

A UI **Complementos** gere o primeiro. Roles/flags gerem o segundo.

---

## 2. Master switch (modos)

UI: `/settings/system-modules`  
API: `PUT /api/installation/multi-agency` com `{ "mode": "off" | "lite" | "full" }`

| Modo UI | `mode` | Perfil | Direct Totem |
|---------|--------|--------|--------------|
| Direct Totem | `off` | `single_publisher` | **ON** |
| Multi Lite | `lite` | `multi_agency` | **OFF** |
| Multi Pro | `full` | `multi_agency` | **OFF** |

**Regra:** Direct e multi-agência **nunca** juntos.

OFF **não apaga** dados. Purge é acção separada e explícita.

---

## 3. Catálogo de módulos

### Núcleo (sempre on)

| ID | Título |
|----|--------|
| `core_publish` | Publicar em Totem / mídias |
| `organization` | Organização, locais, totens |

### UX

| ID | Título | Notas |
|----|--------|-------|
| `direct_totem_mode` | UI Direct Totem | On no modo `off` |
| `simple_totem_mode` | Totem simples | Esconde complexidade |

### Comercial / conteúdo

| ID | Título | Lite | Pro |
|----|--------|:----:|:---:|
| `multi_agency` | Várias organizações | on | on |
| `subscribers` | Anunciantes | on | on |
| `quick_publish` | Publicar em tela / cardápio | on | on |
| `campaigns` | Campanhas | on | on |
| `devices` | Smart TVs / players | on | on |
| `plans` | Planos e acessos | **off** | on |
| `contracts` | Contratos | **off** | on |
| `billing` | Financeiro | **off** | on |
| `commercial_reports` | Relatórios comerciais | **off** | on |
| `subscriber_portal` | Portal + subdomínios | opcional | opcional |

### Ops

| ID | Título | Lite | Pro |
|----|--------|:----:|:---:|
| `playlists_advanced` | Playlists avançadas / mix | off | on |
| `ota` | OTA | off | on |
| `dispatcher_admin` | Dispatcher / debug mensageria | **on** (todos os modos) | **on** |
| `analytics` | Analytics / IA | off | on |
| `smart_display_fx` | SmartDisplayFX | opcional | opcional |

O **Dispatcher** (monitor/debug de tráfego) é módulo **locked**: fica activo em Direct Totem, Multi Lite e Multi Pro.

Código-fonte: `backend/src/policy/installationModules.ts` (`INSTALLATION_MODULE_CATALOG`, presets lite/full/core).

---

## 4. Duas cadeias comerciais (importante)

### 4.1 Inventário (sempre)

```text
publisher → locals → totems
```

O plano **não** “põe” o totem na org. O totem pertence ao local da org.

### 4.2 Autorização anunciante → rede

**Pro (planos):**

```text
subscriber → contrato (plan_id)
          → plan_publisher_access → publisher
          → plan_local_access → local
          → totems
```

**Lite (SPA directo):**

```text
subscriber → subscriber_publisher_access (access_type=override)
          → publisher → locals → totems
```

Quick-publish, dispatcher e playlist engine aceitam **ambos** os caminhos (UNION / fallback).

---

## 5. Formas de trabalho recomendadas

### Forma 1 — Operador Direct (loja / um cliente)

1. Modo Direct  
2. Manter 1 org, locais, totens  
3. Biblioteca + Publicar em Totem  
4. Sem anunciantes  

### Forma 2 — Rede Lite (várias orgs, propaganda simples)

1. Modo **lite**  
2. Cadastrar orgs e inventário  
3. Cadastrar anunciantes  
4. **Anunciante ↔ Organização** para cada par comercial  
5. Mídias + Publicar em tela / campanhas leves  
6. Sem ecrãs de planos/billing (403 esperado se alguém for à API)

### Forma 3 — Agência Pro

1. Modo **Pro**  
2. Planos com limites e acessos a publishers/locais  
3. Contratos por anunciante  
4. Campanhas com contrato; billing; OTA; dispatcher  
5. Portal por slug se necessário  

### Forma 4 — Laboratório (mesmo VPS)

1. Instância `dev` isolada  
2. Branch `main`  
3. Smoke Lite + Pro + OFF sem tocar produção  

Guia de install/update: [../instalacao/05-MINI-LIVRETO-MAIN-PROD-DEV-TESTE.md](../instalacao/05-MINI-LIVRETO-MAIN-PROD-DEV-TESTE.md).

---

## 6. Menu e gates

- Paths UI → módulo: `frontend/src/utils/installationModuleAccess.ts`  
- API → `requireModule('…')` nas rotas  
- Exemplo: `/api/plans` exige `plans`; no Lite → **403 MODULE_DISABLED**

Contentores de menu com filhos visíveis **não** desaparecem só porque o path-pai está off (ex.: Complementos).

---

## 7. Workers e hot-reload

Ao mudar módulos (especialmente billing / playlists / multi_agency / subscribers / dispatcher):

- Backend tenta **reconciliar workers** sem restart  
- Se falhar, a UI pede `systemctl restart smart-signage[-dev]`

Detalhe: `backend/src/startup/operationalWorkersLifecycle.ts`

---

## 8. Quando usar cada modo (decisão rápida)

| Situação | Modo |
|----------|------|
| Um cliente, só os seus totens | Direct |
| Várias orgs + anunciantes, sem facturação no sistema | **Lite** |
| Agência com planos, contratos e cobrança | **Pro** |
| Precisa OTA / analytics / dispatcher admin | **Pro** |

---

## 9. Ver também

- Admin: [04-MANUAL-ADMINISTRATIVO.md](./04-MANUAL-ADMINISTRATIVO.md)  
- Técnico E.R./API: [05-MANUAL-TECNICO-MODELO-ER-API.md](./05-MANUAL-TECNICO-MODELO-ER-API.md)
