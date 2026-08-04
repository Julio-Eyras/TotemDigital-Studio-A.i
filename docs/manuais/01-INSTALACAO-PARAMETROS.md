# 01 — Instalação e parâmetros do instalador

**Script oficial:** `scripts/Instala-TotemDigital-Server.sh`  
**Assistente interactivo:** `scripts/run-instala-totemdigital-prompt.sh`  
**Motor (não editar no dia-a-dia):** `scripts/install-smartsignage.sh`  
**Doc detalhado legado/complementar:** [../INSTALA-TOTEMDIGITAL-SERVER.md](../INSTALA-TOTEMDIGITAL-SERVER.md)

---

## 1. Mapas de pastas no VPS (crítico)

| Caminho | Função |
|---------|--------|
| `~/TotemDigital-Studio` | Clone **produção** — não misturar branch multi experimental |
| `~/TotemDigital-Studio-multiagencia` | Clone de trabalho da branch MultiAgência (correr instalador) |
| `~/TotemDigital-Studio-dev` | Código da instância **dev** |
| `/opt/smart-signage` | Deploy produção |
| `/opt/totemdigital-dev` | Deploy **dev** |
| BD `smartsignage` | Produção |
| BD `smartsignage_dev` | Dev |

---

## 2. Modos (`--modo`)

| Modo | Flag | O que faz | BD |
|------|------|-----------|-----|
| Produção | `producao` | Stack completa + HTTPS | Pode recriar em fluxo limpo |
| Actualizar | `atualizar` | Pull opcional, build BE/FE, `.env`, Nginx | **Não apaga** |
| Reparar | `reparar` | Aspas `.env`, URLs HTTPS, Nginx | Não toca |
| Docker | `docker` | Via Compose | Conforme compose |
| Wipe | `wipe` | Reinstalação limpa | **Apaga** (confirmação; bloqueado com `--sim`) |

---

## 3. Instâncias (`--instancia`)

| ID | Domínio típico | Porta API | Painel HTTP | Serviço |
|----|----------------|-----------|-------------|---------|
| `producao` (default) | `totemdigital.app.br` | 3000 | 8080 | `smart-signage` |
| `dev` | `dev.totemdigital.app.br` | 3001 | 8081 | `smart-signage-dev` |
| `teste` | `test.totemdigital.app.br` | 3002 | 8082 | `smart-signage-test` |

Ver [../MULTI-INSTANCIA-PROD-DEV-TESTE.md](../MULTI-INSTANCIA-PROD-DEV-TESTE.md).

---

## 4. Parâmetros CLI (referência)

| Opção | Descrição |
|-------|-----------|
| `--modo <nome>` | `producao` \| `atualizar` \| `reparar` \| `docker` \| `wipe` |
| `--instancia <id>` | `producao` \| `dev` \| `teste` |
| `--dominio <fqdn>` / `--domain` | FQDN (defaults por instância) |
| `--email <addr>` | Let's Encrypt + owner |
| `--owner-user` | Utilizador admin owner |
| `--owner-name` | Nome da organização owner |
| `--com-mqtt` | Mosquitto (SmartDisplayFX) |
| `--com-players` | Copia artefactos de players |
| `--com-seeds` | Seeds demo |
| `--git-pull` | No modo actualizar: `git pull` no clone |
| `--sim` / `--yes` | Não interactivo (wipe **recusado**) |
| `--dry-run` | Mostra plano, não executa |
| `--ajuda` / `-h` | Ajuda |

Variável útil:

```bash
export TDI_GIT_BRANCH=TotemDigital-MultiAgencia
```

---

## 5. Exemplos práticos

### 5.1 Produção (não interactivo)

```bash
cd ~/TotemDigital-Studio
git pull
bash scripts/Instala-TotemDigital-Server.sh --modo producao --sim \
  --dominio totemdigital.app.br \
  --email admin@totemdigital.app.br \
  --owner-user ismael \
  --owner-name "Totem Digital"
```

### 5.2 Instalar `dev` do zero (branch multi)

```bash
cd ~/TotemDigital-Studio-multiagencia
export TDI_GIT_BRANCH=TotemDigital-MultiAgencia
bash scripts/Instala-TotemDigital-Server.sh \
  --modo producao --instancia dev --sim \
  --email admin@totemdigital.app.br \
  --owner-user ismael
```

### 5.3 Actualizar `dev` após push

```bash
cd ~/TotemDigital-Studio-multiagencia && git pull --ff-only
export TDI_GIT_BRANCH=TotemDigital-MultiAgencia
bash scripts/Instala-TotemDigital-Server.sh \
  --modo atualizar --instancia dev --git-pull --sim \
  --email admin@totemdigital.app.br \
  --owner-user ismael \
  --domain dev.totemdigital.app.br
```

### 5.4 Assistente (perguntas / defaults-dev)

```bash
bash scripts/run-instala-totemdigital-prompt.sh
bash scripts/run-instala-totemdigital-prompt.sh --defaults-dev
```

### 5.5 Dry-run

```bash
bash scripts/Instala-TotemDigital-Server.sh --dry-run --modo producao --instancia dev --sim
```

---

## 6. O que o instalador garante (pós-passos)

1. `.env` com aspas correctas (`fix-env-shell-quoting.sh`)
2. `FINANCIAL_PUBLIC_APP_URL=https://<domínio>`
3. Nginx HTTPS unificado (`apply-https-unified-443.sh`)
4. Em **actualizar**: rebuild FE com `REACT_APP_API_URL=https://domínio/api`
5. Em wipe/dev: alinhar password PG ao `.env` (fix recente no instalador)

---

## 7. Schema e seeds (v6)

- Schema definitivo: `database/smartchannel-db-v2-refactored-part*.sql`
- Apply: `database/apply-schema-v2.sh` (via instalador)
- Seeds / validação: `database/carga-inicial-v6.sql`, `database/validate-v6.js`, `database/check-and-load-v6.js`
- **Não** criar migrations temporárias fora dos ficheiros part*

---

## 8. Logins seed típicos (`dev`)

| Utilizador | Password | Nota |
|------------|----------|------|
| `dev` | `dev123` | Operação / testes |
| `dev.publisher` | `dev123` | Perfil org |
| Owner criado no install | conforme `--owner-user` | Admin sistema |

URL: `https://dev.totemdigital.app.br/login`

---

## 9. Checklist pós-instalação

1. `systemctl status smart-signage` ou `smart-signage-dev`
2. `curl -I https://<domínio>` → 200
3. Login no painel
4. Complementos → escolher modo (Direct / lite / Pro)
5. Smoke: org → mídia → publicar (Direct) **ou** anunciante → SPA → publicar (Lite)

---

## 10. Problemas frequentes

| Sintoma | Acção |
|---------|--------|
| Schema falha auth PG após wipe | Alinhar `ALTER ROLE` à `DB_PASSWORD` do `.env` |
| Front antigo | Confirmar rebuild + hard refresh |
| 403 `MODULE_DISABLED` | Esperado para módulos off no Lite (billing/OTA/…) |
| Branch errada no clone `*-dev` | `git checkout TotemDigital-MultiAgencia && git pull` |

Mais: [../HANDOFF-MULTI-AGENCIA-CONTINUIDADE.md](../HANDOFF-MULTI-AGENCIA-CONTINUIDADE.md) · [../VPS-DEV-DO-ZERO-MULTI-AGENCIA.md](../VPS-DEV-DO-ZERO-MULTI-AGENCIA.md)
