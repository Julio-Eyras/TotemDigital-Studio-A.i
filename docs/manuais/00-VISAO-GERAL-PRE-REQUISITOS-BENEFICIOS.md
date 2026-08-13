# 00 — Visão geral, pré-requisitos, benefícios e requisitos

**TotemDigital Studio** é uma plataforma de sinalização digital (digital signage) para gerir organizações, locais, totens/Smart TVs, mídias e (opcionalmente) anunciantes e campanhas comerciais.

**Autor:** Julio Cesar Eyras (J.C.E.) / Eyras Sistemas e Soluções  
**Licença:** proprietária — todos os direitos reservados.

---

## 1. O que o sistema resolve

- Centralizar **conteúdo** (vídeos, imagens, HTML/board) e **publicação** nos ecrãs.
- Operar **uma** organização (Direct Totem) ou **várias** (multi-agência).
- No multi: ligar **anunciantes** à rede de ecrãs das organizações e entregar campanhas no player.
- Escala: instâncias isoladas no mesmo VPS (`producao` / `dev` / `teste`).

---

## 2. Benefícios

| Benefício | Detalhe |
|-----------|---------|
| Um código, três modos | Direct / Lite / Pro sem forks de produto |
| OFF sem perda de dados | Desligar multi-agência arquiva o menu/API; dados ficam |
| Lite sem ERP | Propaganda com anunciantes sem planos/billing/OTA |
| Pro completo | Planos, contratos, faturamento, OTA, analytics (Dispatcher em todos os modos) |
| Instalador unificado | HTTPS, Nginx, systemd, BD, rebuild FE/BE |
| Isolamento de ambientes | Dev/teste não tocam na BD/paths de produção |

---

## 3. Pré-requisitos

### 3.1 Servidor (produção ou VPS)

| Item | Requisito típico |
|------|------------------|
| SO | Ubuntu 22.04 / 24.04 LTS |
| Utilizador | Não-root (ex.: `smartchannel`) com `sudo` |
| Node.js | v20 LTS |
| PostgreSQL | 14+ |
| Nginx | Presente |
| DNS | Registo **A** do domínio → IPv4 do VPS |
| Portas | **22**, **80**, **443**; painel HTTP auxiliar (**8080** prod / **8081** dev / **8082** teste) |
| Git | Acesso ao GitHub (SSH ou HTTPS+PAT) |
| Disco / RAM | Conforme volume de mídias (SSD recomendado) |

### 3.2 Cliente / operador

| Item | Requisito |
|------|-----------|
| Browser | Chrome/Edge/Firefox actual |
| Conta | Utilizador criado no seed ou pelo admin |
| Totens | Player-AD (Android) ou player da plataforma configurado com `serverUrl` + UIN |

### 3.3 Desenvolvimento

| Item | Requisito |
|------|-----------|
| Repo | `TotemDigital-Studio` |
| Branch operacional | `main` |
| Ferramentas | Node 20, npm, PostgreSQL local ou remoto |

---

## 4. Requisitos de produto por modo

| Capacidade | Direct | Lite | Pro |
|------------|:------:|:----:|:---:|
| Orgs / locais / totens | 1 org | várias | várias |
| Biblioteca de mídias | sim | sim | sim |
| Publicar da própria org | sim | sim | sim |
| Anunciantes | não* | **sim** | sim |
| Publicar anunciante → totens | — | via **SPA** | via **plano+contrato** (e SPA) |
| Planos / contratos / billing | não | **não** | sim |
| OTA / analytics | não | não | sim |
| Dispatcher (debug mensageria) | **sim** | **sim** | **sim** |
| Portal por subdomínio | não | opcional avançado | opcional |

\* Em Direct o foco é a org implícita; módulos comerciais ficam off.

---

## 5. Arquitectura lógica (camadas)

```text
┌─────────────────────────────────────────────────────────┐
│  Frontend (React) — painel web                          │
├─────────────────────────────────────────────────────────┤
│  Backend (Node/Express) — /api  + workers                │
├─────────────────────────────────────────────────────────┤
│  PostgreSQL — schema v2 (part*.sql)                      │
├─────────────────────────────────────────────────────────┤
│  Players (Player-AD, etc.) — dispatch / heartbeat        │
└─────────────────────────────────────────────────────────┘
         │
    Nginx :443 (UI+API) · systemd (smart-signage / -dev)
```

---

## 6. Papéis principais (negócio)

| Papel | Entidade técnica | Função |
|-------|------------------|--------|
| Organização | `publishers` | Dona de locais e totens |
| Unidade / local | `locals` | Agrupa totens de um sítio |
| Totem / ecrã | `totems` / players | Dispositivo de exibição |
| Anunciante | `subscribers` | Cliente de propaganda |
| Utilizador | `users` + roles | Quem opera o painel |
| Plano / contrato | `plans`, `*_contracts` | Só Pro (ERP comercial) |
| Acesso Lite | `subscriber_publisher_access` | Anunciante → org (SPA) |

---

## 7. Segurança e responsabilidades

- Só `owner_system` / `admin_sql` alteram o **modo** em Complementos.
- Purge comercial **nunca** é chamado ao desligar multi-agência (só acção explícita).
- Produção e `dev` no mesmo VPS usam **paths e BDs distintos** — não misturar clones.
- Segredos (`.env`, tokens Cloudflare) não entram em commits.

---

## 8. Próximo passo

1. Instalar / actualizar: [01-INSTALACAO-PARAMETROS.md](./01-INSTALACAO-PARAMETROS.md)  
2. Primeiro login: [02-GUIA-PRIMEIRA-VEZ-UTILIZADOR.md](./02-GUIA-PRIMEIRA-VEZ-UTILIZADOR.md)
