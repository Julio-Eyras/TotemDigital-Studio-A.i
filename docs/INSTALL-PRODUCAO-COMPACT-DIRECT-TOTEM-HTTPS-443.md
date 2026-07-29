# Install produção: compact + direct-totem + HTTPS 443

Guia **só** para instalação do zero no domínio **`totemdigital.app.br`**, com:

- perfil **compacto** (mono / TotemDigital)
- modo **Publicar em Totem** (`DIRECT_TOTEM_MODE` / `--direct-totem`)
- layout site `:80` + painel `:8080`
- **Let’s Encrypt** → HTTPS unificado na **443**

**Wrapper (recomendado):** `bash scripts/install-totemdigital-prod-https.sh`  
Script base: `bash scripts/install-smartsignage.sh`  
Correr como utilizador normal (ex.: `smartchannel`), **não** `sudo bash` no início.  
Repo actualizado: `cd ~/TotemDigital-Studio && git pull`

Documentação relacionada: [INSTALL-SMARTSIGNAGE-MENU-OPCOES.md](./INSTALL-SMARTSIGNAGE-MENU-OPCOES.md) · [HTTPS-UNIFICADO-443-SITE-API.md](./HTTPS-UNIFICADO-443-SITE-API.md)

---

## Antes do install (checklist)

| Item | Valor / acção |
|------|----------------|
| DNS **A** | `totemdigital.app.br` → IP do VPS |
| DNS **AAAA** | Remover se 443 IPv6 não estiver aberto (Android falha com `code=-1`) |
| `www` | Opcional (NXDOMAIN é OK; cert só do apex) |
| Firewall | TCP **80**, **443**, **8080** (e VPS associado ao grupo Contabo) |
| Domínio no LE | `totemdigital.app.br` |

---

## Opções exactas no menu

Responda **nesta ordem**:

| # | Menu | Escolher | Notas |
|---|------|----------|--------|
| 1 | Modo de instalação | **2** | Single-Server **PRODUÇÃO** (Nginx + Backend + Mosquitto) |
| 2 | Perfil da aplicação | **1** | Compacto / mono (`TOTEMDIGITAL_COMPACT=true`) |
| 3 | Players | **0** ou **10** | **0** = só servidor; **10** = todos (dev). Player-AD Android instala-se à parte no dispositivo |
| 4 | Exposição HTTP | **2** | Site corporativo `:80` + painel noutra porta |
| 5 | IP ou domínio | `totemdigital.app.br` | Ou Enter no IP se preferir; o LE usa o domínio abaixo |
| 6 | Porta site corporativo | **80** | Enter (default) |
| 7 | Porta Smart Signage | **8080** | Enter (default) |
| 8 | Raiz do site | Enter | Default do script (`CORPORATE_WEB_ROOT`) |
| 9 | HTTPS | **2** | Let’s Encrypt — HTTPS unificado na **443** |
| 10 | Domínio LE | `totemdigital.app.br` | Enter se já for o default |
| 11 | E-mail LE | o seu e-mail | Opcional mas recomendado |
| 12 | DNS local | **N** | Não configurar DNS local |
| 13 | Seeds | **N** (ou Enter) | Direct-totem: owner mínimo; sem demo de planos/totens |
| 14 | Remover install anterior | **s** só se quiser wipe | **N** se for zero limpo |

### Direct-totem no menu

O modo **Publicar em Totem** é **ligado por defeito** neste repositório (`--direct-totem`).  
Para garantir na linha de comando (recomendado):

```bash
cd ~/TotemDigital-Studio
bash scripts/install-smartsignage.sh --direct-totem --totemdigital-compact
```

Depois escolha no menu: **2 → 1 → … → exposição 2 → HTTPS 2 → domínio `totemdigital.app.br`**.

---

## Resumo visual (colar / imprimir)

```
Modo .............. 2  (PRODUÇÃO)
Perfil ............ 1  (compacto)
Players ........... 0  (só servidor)  ou  10
Exposição HTTP .... 2  (80 + 8080)
Porta site ........ 80
Porta painel ...... 8080
HTTPS ............. 2  (Let's Encrypt / 443)
Domínio ........... totemdigital.app.br
Direct-totem ...... ON (default / --direct-totem)
Compact ........... ON (opção 1 / --totemdigital-compact)
```

---

## URLs depois do install

| Uso | URL |
|-----|-----|
| Site / apresentação | https://totemdigital.app.br/ |
| Painel (produção) | https://totemdigital.app.br/login |
| Painel auxiliar HTTP | http://IP:8080/login |
| API / Player-AD | https://totemdigital.app.br |
| Player-AD `serverUrl` | `https://totemdigital.app.br` (**sem** porta) |

---

## Wrapper recomendado (encapsula todos os parâmetros)

```bash
cd ~/TotemDigital-Studio
git pull
bash scripts/install-totemdigital-prod-https.sh
# ou com e-mail LE:
bash scripts/install-totemdigital-prod-https.sh --email seu-email@dominio.com
# só ver o comando:
bash scripts/install-totemdigital-prod-https.sh --dry-run
```

Opções do wrapper: `--domain`, `--email`, `--with-players`, `--with-seeds`, `--fresh`, `--interactive`, `--dry-run`.

Equivalente manual (`--skip-menu`):

```bash
cd ~/TotemDigital-Studio
export SMARTSIGNAGE_SPLIT_SITE=true
export SMARTSIGNAGE_CORPORATE_HTTP_PORT=80
export SMARTSIGNAGE_SYSTEM_HTTP_PORT=8080
export SMARTSIGNAGE_LETSENCRYPT=true
export SMARTSIGNAGE_DOMAIN_NAME=totemdigital.app.br
export SMARTSIGNAGE_SSL_EMAIL=seu-email@dominio.com   # opcional
export SMARTSIGNAGE_PUBLIC_HOST=totemdigital.app.br

bash scripts/install-smartsignage.sh \
  --skip-menu \
  --mode single-server-prod \
  --totemdigital-compact \
  --direct-totem \
  --skip-players
```

Confirme no log: Let’s Encrypt activo e layout dividido 80/8080 → 443.

---

## Se o Mosquitto falhar no install (produção)

Sintoma: `Job for mosquitto.service failed` e o script pára **antes** de Nginx/LE/schema.

Causa frequente no Ubuntu Server: **snap** `mosquitto` a ocupar a porta **1883**, ou `passwd`/`acl` só legíveis por root.

No servidor (diagnóstico + limpeza):

```bash
sudo journalctl -u mosquitto -n 80 --no-pager
snap list mosquitto 2>/dev/null || true
ss -tlnp | grep -E ':1883|:9001' || true

sudo snap remove mosquitto 2>/dev/null || true
sudo pkill -x mosquitto 2>/dev/null || true
sudo systemctl restart mosquitto
sudo systemctl status mosquitto --no-pager
```

Depois `git pull` e volte a correr o wrapper (o instalador actual trata snap/portas/ownership).

## Se o HTTPS falhar a meio (servidor já com cert)

Não precisa reinstalar tudo:

```bash
cd ~/TotemDigital-Studio
git pull
bash scripts/apply-https-unified-443.sh
# ou:
# bash scripts/install-smartsignage.sh --apply-le-https-only
```

---

## Validação rápida

```bash
curl -sk https://totemdigital.app.br/api/health
curl -Ik https://totemdigital.app.br/login
curl -sI http://127.0.0.1:8080/login | head -5
dig +short totemdigital.app.br AAAA   # preferível vazio se IPv6 não estiver aberto
```

Login no browser: **https://totemdigital.app.br/login**
