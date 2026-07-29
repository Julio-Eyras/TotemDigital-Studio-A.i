# Menu do instalador `install-smartsignage.sh`

Referência das opções interativas do script `scripts/install-smartsignage.sh` (ordem típica num install do zero).

Script: `bash scripts/install-smartsignage.sh`  
Executar como utilizador normal (ex.: `smartchannel`), **não** com `sudo bash` no início.

---

## Caminho recomendado (produção TotemDigital)

| Passo | Escolha |
|-------|---------|
| Modo | **2** — Single-Server PRODUÇÃO |
| Perfil | **1** — Compacto / mono |
| Players | à escolha (ex.: **10** todos, ou **0** só servidor) |
| Exposição HTTP | **2** — site `:80` + painel noutra porta |
| Portas | corporativo **80**, Smart Signage **8080** |
| HTTPS | **2** — Let’s Encrypt (HTTPS unificado na 443) |
| Domínio | `totemdigital.app.br` (ou o domínio público do servidor) |

Resultado esperado:

| Uso | URL |
|-----|-----|
| Site / apresentação | `https://totemdigital.app.br/` |
| Painel | `https://totemdigital.app.br/login` ou `http://IP:8080/login` |
| Player-AD (`serverUrl`) | `https://totemdigital.app.br` (sem porta) |

Fora do script: DNS só com registo **A** (evitar AAAA partido) e firewall Contabo/cloud com **80**, **443** e **8080**.

Ver também: [HTTPS-UNIFICADO-443-SITE-API.md](./HTTPS-UNIFICADO-443-SITE-API.md).

---

## 1. Modo de instalação

| Opção | Descrição |
|-------|-----------|
| **1** | Single-Server DEV (Nginx + Backend local, sem broker MQTT local) — *padrão* |
| **2** | Single-Server PRODUÇÃO (Nginx + Backend + Mosquitto local) |
| **3** | Docker (Produção – PostgreSQL) |
| **4** | Rebuild e Restart (limpa cache, reconstrói builds e reinicia serviços) |

Prompt: `Digite sua escolha (1-4) [padrão: 1]`

---

## 2. Perfil da aplicação

Controla `TOTEMDIGITAL_COMPACT` / `REACT_APP_TOTEMDIGITAL_COMPACT` no `.env`.

| Opção | Descrição |
|-------|-----------|
| **1** | Modo compacto / mono (TotemDigital; menos rotas Pro) — *padrão* |
| **2** | Smart Signage Pro completo (multi-agência; mais API e UI) |

Prompt: `Escolha (1-2) [padrão: 1]`

Pode ser fixado na CLI com `--totemdigital-compact` ou `--smartsignage-pro` (salta este menu).

---

## 3. Seleção de players

Números separados por vírgula (ex.: `1,3,5`), ou atalho.

| Opção | Descrição |
|-------|-----------|
| **1** | webOS (LG) |
| **2** | Android TV |
| **3** | Linux Electron |
| **4** | Linux C++ |
| **5** | Windows Electron |
| **6** | Tizen (Samsung) |
| **7** | SmartDisplayFX Client |
| **8** | Smart FX Interface |
| **9** | Player Web Cache (HTML5 com cache) |
| **10** | Instalar **todos** os players — *padrão* |
| **0** | Não instalar players (apenas servidor) |

Prompt: `Digite os números separados por vírgula … [padrão: 10]`

Com `--skip-menu`: instala todos, salvo `--skip-players` (só servidor).

---

## 4. Exposição HTTP (Nginx)

| Opção | Descrição |
|-------|-----------|
| **1** | Tudo na mesma porta: painel, API e `/player` na porta **80** |
| **2** | Site corporativo (`totemdigital.site`) na **:80** e o painel Smart Signage noutra porta (ex.: **:8080**) — *padrão* |

Prompt: `Opção [2]`

### Se escolher a opção 2 (layout dividido)

Campos adicionais (texto livre, com default):

| Campo | Default típico |
|-------|----------------|
| IP público ou domínio | IP da máquina (`hostname -I`) |
| Porta HTTP do site corporativo | **80** |
| Porta HTTP do Smart Signage (painel, `/api`, `/player`) | **8080** |
| Diretório raiz do site corporativo | valor de `CORPORATE_WEB_ROOT` |

Se as duas portas coincidirem, o instalador volta ao layout único (tudo na 80).

Com `--skip-menu`, o default é layout dividido **80 + 8080** (salvo `SMARTSIGNAGE_SINGLE_PORT=true`).

---

## 5. HTTPS (SSL/TLS)

### 5a. Com layout dividido (secção 4 = opção 2)

Não há HTTPS autoassinado neste ramo. Let’s Encrypt unifica site + painel/API na **443**.

| Opção | Descrição |
|-------|-----------|
| **1** | Sem HTTPS (apenas HTTP nas portas 80 / 8080) |
| **2** | Let’s Encrypt — HTTPS unificado na **443** — *padrão* |

Prompt: `Digite sua escolha (1-2) [padrão: 2]`

Com Let’s Encrypt:

- Porta **80** redireciona para HTTPS (ACME HTTP-01 mantido)
- Porta **8080** continua em HTTP (acesso por IP/LAN sem certificado)
- Player-AD: `serverUrl = https://SEU_DOMINIO` (sem porta)

### 5b. Sem layout dividido (tudo na :80)

| Opção | Descrição |
|-------|-----------|
| **1** | Sem HTTPS (apenas HTTP – porta 80) — *padrão* |
| **2** | HTTPS com certificado autoassinado (testes/desenvolvimento) |
| **3** | HTTPS com Let’s Encrypt (produção – requer domínio público) |

Prompt: `Digite sua escolha (1-3) [padrão: 1]`

### Detalhes Let’s Encrypt (quando aplicável)

| Campo | Notas |
|-------|--------|
| Domínio | Ex.: `totemdigital.app.br` (default sugerido) |
| E-mail | Opcional (notificações Let’s Encrypt) |
| Confirmações | Se DNS falhar, pergunta se continua mesmo assim (`s/N`) |

Variáveis úteis com `--skip-menu`:

- `SMARTSIGNAGE_LETSENCRYPT=true`
- `SMARTSIGNAGE_DOMAIN_NAME=totemdigital.app.br`
- `SMARTSIGNAGE_SYSTEM_HTTP_PORT=8080`

---

## 6. Outros prompts (não numerados)

| Tema | Prompt típico | Default |
|------|---------------|---------|
| Owner / organização | utilizador admin, nome, contacto, e-mail | valores do seed / env |
| Limites padrão | storage GB, campanhas, totens, mídias, playlists | valores do seed |
| DNS local | Configurar DNS local para publishers/subscribers? | **N** |
| Install anterior | Remover completamente a instalação anterior? | **N** |
| Seeds | Carregar dados seeds? | **N** |
| Kiosk (quando aplicável) | Instalar modo Kiosk? | **S** |
| Orientação kiosk | normal / left / right / inverted | left (portrait) |

---

## Flags úteis (sem menu completo)

| Flag / env | Efeito |
|------------|--------|
| `--skip-menu` | Usa defaults (single-server, layout 80+8080, sem HTTPS LE salvo env) |
| `--mode single-server-prod` | Equivale ao modo produção + pula menu de modo |
| `--apply-le-https-only` | Só reaplica Nginx HTTPS unificado na 443 (cert LE já emitido) |
| `scripts/apply-https-unified-443.sh` | Atalho de reparo (user normal; não precisa de install completo) |
| `--skip-players` | Com `--skip-menu`: não copia players |
| `--totemdigital-compact` / `--smartsignage-pro` | Fixa o perfil sem perguntar |

---

## Relação com reparo pós-install

Num install **do zero** com as escolhas da secção “Caminho recomendado”, o Nginx HTTPS unificado (site na `/`, painel em `/login`, API na 443) já é aplicado pelo fluxo normal (`setup_letsencrypt` → template dividido).

O script `scripts/apply-https-unified-443.sh` serve para **corrigir** um servidor já instalado (cert emitido, Nginx desatualizado), não é obrigatório num zero limpo com Git actualizado.
