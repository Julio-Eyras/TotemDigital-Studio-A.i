# Handoff — Multi-agência TotemDigital (continuidade para outra IA / equipa)

**Data:** 2026-08-02  
**Repo:** https://github.com/Julio-Eyras/TotemDigital-Studio.git  
**Branch de trabalho:** `TotemDigital-MultiAgencia`  
**Não confundir com:** pasta de **produção** no VPS (`~/TotemDigital-Studio` → `/opt/smart-signage`)  
**Instância de laboratório:** `dev` → `dev.totemdigital.app.br` · `/opt/totemdigital-dev` · BD `smartsignage_dev`

Este documento é a **fonte de continuidade**: objectivos, decisões, o que já está feito, procedimentos operacionais, armadilhas e próximos passos. Os docs satélite listados no fim detalham tópicos; **comece por aqui**.

---

## 1. Objectivo do projecto (nesta fase)

Entregar um **modo multi-agência (Pro)** alternativo ao **Direct Totem**, na mesma codebase, com:

1. **Master switch** claro: Direct Totem **ou** multi-agência (lite/Pro) — nunca os dois menus ao mesmo tempo.
2. **OFF sem apagar dados** (arquivo silencioso); purge só explícito.
3. **Portal multi-tenant** por slug (DNS/Nginx/JWT), opcional.
4. **Instância `dev` isolada** no mesmo VPS da produção (clone, BD, portas, Nginx próprios).
5. Workers comerciais que **ligam/desligam em hot-reload** quando o modo muda (Etapa F).

Produto alvo: instalação que o cliente opera como **TotemDigital Direct** (núcleo) ou **TotemDigital Pro** (várias organizações + comercial).

---

## 2. Decisões de produto (válidas — não reabrir sem pedido)

| ID | Decisão |
|----|---------|
| **A** | Dois produtos: Direct Totem **ou** Pro multi-agência |
| **B** | `multi_agency_lite` — várias orgs + publicar/mídias/devices, **sem** billing/campanhas/playlists — **implementado** (`mode: lite`) |
| **C** | Pro + Direct Totem ON juntos — **proibido** |
| **D1** | Ao desligar multi-agência, Direct Totem volta automaticamente |
| **D2** | Portal e SmartDisplayFX **fora** do botão master (só avançado / secção Portal) |
| **D3** | OFF **não apaga** dados |
| **D4** | Só `owner_system` / `admin_sql` mudam o modo |
| **D5** | Módulos individuais em “Opções avançadas” (colapsado) |
| **D6** | A agora · B implementado · C proibido |

**Regra de schema (repo):** alterações de BD nos ficheiros definitivos (`database/smartchannel-db-v2-refactored-part*.sql`), **não** migrations temporárias. Seeds/instalador alinhados.  
**Regra de flags:** `installation.modules` ≠ `flag_smart_*` (por utilizador).

---

## 3. Estado actual (o que já existe)

### 3.1 Master switch + presets

- API: `PUT /api/installation/multi-agency`  
  - Body moderno: `{ "mode": "off" | "lite" | "full" }`  
  - Legado: `{ "enabled": true|false }` (= full / off)
- UI: `/settings/system-modules` — select **Direct Totem (off) / lite / Pro**
- Policy: `backend/src/policy/installationModules.ts`  
  - `applyMultiAgencyMode`, `buildMultiAgencyLitePreset`, `resolveMultiAgencyMode`
- Persistência: `installation.modules` + `installation.profile` (`single_publisher` | `multi_agency`)
- Bootstrap: ao activar lite/full com 0 orgs → cria org owner; seed 2ª agência demo se configurado

### 3.2 Workers (Etapas E/F)

- `backend/src/startup/operationalWorkersLifecycle.ts` — reconcile Bull/billing/playlists/alertas
- Hot-reload ao mudar módulos; se falhar → UI pede `systemctl restart`
- Cron de **purge agendado** (tick 1 min) independente do master switch

### 3.3 Portal DNS / Nginx / tenant

- Settings em system_settings (`portal.*`)
- Hosts: `{slug}.publisher.{base}` / `{slug}.subscriber.{base}`
- Isolamento JWT ↔ `tenantSlug` no host (mismatch → 403)
- Cloudflare DNS + LE wildcard DNS-01 (dry-run por defeito na emissão)
- Auto-wire Nginx / snippets em `runtime/portal-hosts`
- FE: `tenantSlug` onde aplicável
- UI secção **Portal DNS / Nginx** em Complementos (opcional; pode ficar `dnsMode=off`)

### 3.4 Purge comercial

- Service: `backend/src/services/commercialPurgeService.ts`
- Frase: `APAGAR DADOS COMERCIAIS DESTA INSTALAÇÃO`
- Scopes: billing, campaigns, playlists, contracts, media_files (BD+disco), subscribers, publishers_extra
- Parcial por `publisherId`; dry-run default; export em `runtime/purges/`
- Tabelas: `installation_purge_runs`, `installation_purge_schedules` (part2 schema)
- API sob `/api/installation/commercial-purge/*`
- UI: acordeão vermelho em Complementos
- **Nunca** chamado pelo OFF do multi-agência

### 3.5 Instância VPS `dev`

- Perfil: `scripts/lib/totemdigital-instancia.sh`
- Clone: `~/TotemDigital-Studio-dev`
- Deploy: `/opt/totemdigital-dev`
- Serviço: `smart-signage-dev`
- Porta API: `3001` · painel HTTP: `8081`
- Logins seed: `dev`/`dev123`, `dev.publisher`/`dev123`
- Fix recente (`bcecb077`): wipe **reutiliza** `DB_PASSWORD` do `.env` e faz `ALTER ROLE`; `apply-schema` falha de verdade se o psql falhar

### 3.6 Testes / harness

- L0: `node scripts/sim-vps-dev-pipeline.mjs` (+ portal sim)
- Plano: `docs/PLANO-TESTES-MULTI-AGENCIA-DEV.md` (L0/L1/L2)
- Unitários: policy lite, `commercialPurgeService`, `installationModulesService` (requer `npm install` no backend)

**HEAD tip típico da branch (ago/2026):** incluir commits de portal, master switch, harness L0, purge+lite, fix wipe password.

---

## 4. Mapa de pastas no VPS (crítico)

| Caminho | Função |
|---------|--------|
| `~/TotemDigital-Studio` | Clone **produção** — **não** fazer checkout MultiAgência aqui |
| `~/TotemDigital-Studio-multiagencia` | Clone de trabalho da branch (correr instalador) |
| `~/TotemDigital-Studio-dev` | Clone da **instância dev** (criado/actualizado pelo instalador) |
| `/opt/smart-signage` | Deploy **produção** |
| `/opt/totemdigital-dev` | Deploy **dev** |
| BD `smartsignage` | Produção |
| BD `smartsignage_dev` | Dev |

GitHub HTTPS **não** aceita password de conta — usar **SSH** ou **PAT**.

---

## 5. Procedimentos operacionais

### 5.1 Auth Git no VPS (SSH)

```bash
ls ~/.ssh/
# se necessário:
ssh-keygen -t ed25519 -C "vps-smartchannel" -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub   # colar em GitHub → SSH keys
ssh -T git@github.com
```

`~/.ssh/config` (opcional):

```text
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519
  IdentitiesOnly yes
```

### 5.2 Clone de trabalho (sem tocar na prod)

```bash
cd ~
git clone --branch TotemDigital-MultiAgencia \
  git@github.com:Julio-Eyras/TotemDigital-Studio.git \
  TotemDigital-Studio-multiagencia
cd ~/TotemDigital-Studio-multiagencia
```

### 5.3 Instalar `dev` do zero

Pré: DNS A `dev.totemdigital.app.br` → IP do VPS.

```bash
cd ~/TotemDigital-Studio-multiagencia
export TDI_GIT_BRANCH=TotemDigital-MultiAgencia

bash scripts/Instala-TotemDigital-Server.sh \
  --modo producao --instancia dev --sim \
  --email EMAIL_VALIDO@dominio \
  --owner-user ismael
```

`--sim` = não interactivo (não é dry-run). Dry-run: acrescente `--dry-run`.

Se o clone `~/TotemDigital-Studio-dev` existir em branch errada / sem `database/apply-schema-v2.sh`:

```bash
cd ~/TotemDigital-Studio-dev
git fetch origin && git checkout TotemDigital-MultiAgencia && git pull --ff-only
# ou: rm -rf ~/TotemDigital-Studio-dev  e reinstalar
```

### 5.4 Actualizar `dev` após push

```bash
cd ~/TotemDigital-Studio-multiagencia && git pull --ff-only
export TDI_GIT_BRANCH=TotemDigital-MultiAgencia
bash scripts/Instala-TotemDigital-Server.sh \
  --modo atualizar --instancia dev --git-pull --sim \
  --email EMAIL_VALIDO@dominio --owner-user ismael
```

### 5.5 Wipe só da BD `dev` (interactivo)

```bash
cd ~/TotemDigital-Studio-multiagencia
bash scripts/Instala-TotemDigital-Server.sh --modo wipe --instancia dev
# confirmar APAGAR + domínio
```

Se `password authentication failed` após wipe (builds antigas): alinhar role à password do `.env`:

```bash
PASS="$(grep -E '^DB_PASSWORD=' ~/TotemDigital-Studio-dev/.env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
sudo -u postgres psql -c "ALTER ROLE smartsignage_dev WITH LOGIN PASSWORD '${PASS}';"
cd ~/TotemDigital-Studio-dev/database
export DB_NAME=smartsignage_dev DB_USER=smartsignage_dev PGPASSWORD="$PASS" SKIP_CONFIRM=true
bash ./apply-schema-v2.sh
# Preferir 127.0.0.1 em testes manuais (evita ::1)
```

Com o fix `bcecb077` puxado, o wipe deve reutilizar `DB_PASSWORD` do `.env`.

### 5.6 Activar multi-agência no painel (fluxo principal pós-install)

1. Login `https://dev.totemdigital.app.br/login` → `dev` / `dev123` (ou owner)
2. **Complementos do sistema**
3. Select **Modo** → **`Multi-agência Pro`** (não `lite` se precisar de anunciantes) → confirmar → reload
4. Confirme chip **Pro** e perfil `multi_agency`
5. Se aviso de restart: `sudo systemctl restart smart-signage-dev`
6. Menu: **Organizações** → **Adicionar organização** (só em perfil multi; Direct Totem/single só edita a org implícita)
7. Menu: **Anunciantes** → cadastrar (só com Pro; lite/off → 403 `MODULE_DISABLED`)
8. Botão **Seed 2ª agência** (secção Portal)
9. Testar OFF → Direct Totem volta, dados intactos; voltar a Pro
10. **Não** usar Purge neste smoke

**Nota:** `api/subscribers` / `api/ota-updates/stats` 403 com `MODULE_DISABLED` = módulo off (lite ou Direct Totem), não falha de auth. Os erros de extensão do browser (`message channel closed`) podem ignorar.

### 5.7 Portal DNS (opcional)

Só se quiser `{slug}.publisher.dev.totemdigital.app.br`:

1. Domínio base: `dev.totemdigital.app.br`
2. Modo DNS: `public_wildcard`
3. IPv4: IP público do VPS
4. Provedor: `manual` ou `cloudflare` (+ Zone ID + `CLOUDFLARE_API_TOKEN` no `.env`)
5. Guardar → Gerar/sync → (opcional) Simular SSL wildcard

Com Portal `off`, o multi-agência funciona no host único `dev.totemdigital.app.br`.

### 5.8 Purge (só dados de teste, consciente)

1. Complementos → Zona de perigo  
2. Pré-visualizar / Dry-run  
3. Frase exacta para execução real  
4. `publisher_id` opcional = purge parcial  

---

## 6. Melhorias já entregues (resumo evolutivo)

1. Master switch + exclusão Direct Totem vs Pro  
2. Hot-reload de workers (Etapa F)  
3. Portal por slug + JWT/tenant + Nginx/Cloudflare/LE  
4. Seed 2ª agência  
5. FE `tenantSlug`  
6. Guia VPS + harness L0  
7. Decisão A/B/C documentada  
8. **Purge comercial** completo (media disco, parcial, schedule)  
9. **`multi_agency_lite`** na API/UI  
10. Fix instalador: password Postgres no wipe + schema com exit code real  

---

## 7. O que falta / próximos passos sugeridos

| Prioridade | Item |
|------------|------|
| Alta | Completar checklist L2 no VPS (`PLANO-TESTES` V01–V10): Pro/lite/off, seed, portal se aplicável, JWT mismatch |
| Alta | Para **anunciantes + OTA + campanhas**: usar modo **Pro (full)** — lite/off devolvem 403 `MODULE_DISABLED` em `/api/subscribers` e `/api/ota-updates` |
| Alta | Garantir que `~/TotemDigital-Studio-dev` e multiagencia estão em `TotemDigital-MultiAgencia` com pull pós-`bcecb077` |
| Média | Estender harness L0 a asserts de `mode lite` + rotas purge (hoje cobre sobretudo docs/presets) |
| Média | L1 (Docker/WSL + Postgres) se quiserem CI sem VPS |
| Baixa | UX Portal (defaults `dev.…` pré-preenchidos); 2FA no purge |
| Produto | Critérios para promover MultiAgência → branch de release / merge política com Direct Totem |

**Não fazer sem alinhamento:** misturar menus Pro+Direct; ligar purge ao OFF; migrations ad-hoc fora do schema definitivo; alterar produção pelo instalador `dev`.

---

## 8. Ficheiros-chave (para a próxima IA)

| Área | Caminhos |
|------|----------|
| Policy / presets | `backend/src/policy/installationModules.ts` |
| Service modo | `backend/src/services/installationModulesService.ts` |
| Purge | `backend/src/services/commercialPurgeService.ts` |
| Rotas | `backend/src/routes/installationModules.ts` |
| Workers | `backend/src/startup/operationalWorkersLifecycle.ts` |
| Portal | `backend/src/services/portalHostService.ts`, `portalSslService.ts` |
| UI | `frontend/src/pages/Settings/SystemModules.tsx` |
| API client | `frontend/src/services/api/index.ts` (`installationModulesApi`) |
| Schema purge | `database/smartchannel-db-v2-refactored-part2-tables-base.sql` |
| Instalador instância | `scripts/lib/totemdigital-instancia.sh`, `scripts/Instala-TotemDigital-Server.sh` |
| Harness | `scripts/sim-vps-dev-pipeline.mjs`, `scripts/sim-portal-pipeline.mjs` |

### Docs satélite

- `docs/MODO-MULTI-AGENCIA-MASTER-SWITCH.md` — decisões + comportamento do switch  
- `docs/DESENHO-PURGE-DADOS-COMERCIAIS.md` — purge (implementado)  
- `docs/VPS-DEV-DO-ZERO-MULTI-AGENCIA.md` — install VPS `dev`  
- `docs/PLANO-TESTES-MULTI-AGENCIA-DEV.md` — L0/L1/L2  
- `docs/MULTI-INSTANCIA-PROD-DEV-TESTE.md` — modelo multi-instância  
- `docs/ETAPA-E-MULTI-AGENCIA-WORKERS.md` / `ETAPA-F-…` — workers  

---

## 9. Armadilhas já vistas (não repetir)

1. **Checkout MultiAgência na pasta de prod** → usar pasta `*-multiagencia` separada.  
2. **Clone `TotemDigital-Studio-dev` antigo** sem `apply-schema-v2.sh` → checkout/pull ou apagar clone.  
3. **Wipe + `.env` preservado + password nova no PG** → auth fail (corrigido em `bcecb077`; alinhar role se build antiga).  
4. **Instalador dizia `[OK] Schema aplicado` mesmo com falha** → corrigido (exit code).  
5. **`localhost` → IPv6 `::1`** em psql → preferir `127.0.0.1`.  
6. **Email placeholder** `SEU_EMAIL@dominio` no LE → usar e-mail real.  
7. GitHub: password de conta **não** funciona; SSH/PAT.  

---

## 10. Prompt sugerido para a próxima IA

```text
Continua o trabalho na branch TotemDigital-MultiAgencia do repo TotemDigital-Studio.
Lê primeiro docs/HANDOFF-MULTI-AGENCIA-CONTINUIDADE.md.
Respeita decisões A/B/C e D1–D6; schema definitivo; não misturar installation.modules com flag_smart_*.
Instância de teste: VPS dev (dev.totemdigital.app.br), isolada da produção.
Objectivo imediato: [descrever tarefa]. Respostas em português.
```

---

## 11. Critério de “fase MultiAgência fechada para handoff de produto”

- [ ] Install `dev` estável (health HTTPS + login)  
- [ ] Pro / lite / off validados no painel  
- [ ] Seed 2ª agência OK  
- [ ] OFF não apaga dados  
- [ ] Purge dry-run OK (execução real só em BD de teste)  
- [ ] Portal off OK; wildcard opcional documentado  
- [ ] Branch remota actualizada; este handoff reflecte HEAD  

*Última actualização de conteúdo alinhada aos commits até `bcecb077` (fix wipe password) e `60564d27` (purge + lite).*
