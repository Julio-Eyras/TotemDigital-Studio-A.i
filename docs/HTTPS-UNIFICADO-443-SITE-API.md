# Activar HTTPS unificado (site + API na 443) — servidor já instalado

Para instalações **já em produção** com layout dividido (80 + 8080), sem reinstalar tudo.

## Pré-requisitos

- DNS A: `totemdigital.app.br` → IP do servidor
- Firewall/security group: TCP **80** e **443**
- Repo actualizado em `~/TotemDigital-Studio` (com `install-smartsignage.sh` opção B)

## Opção recomendada: reexecutar só HTTPS do instalador

```bash
cd ~/TotemDigital-Studio
export SMARTSIGNAGE_SPLIT_SITE=true
export SMARTSIGNAGE_SYSTEM_HTTP_PORT=8080
export SMARTSIGNAGE_CORPORATE_HTTP_PORT=80
export SMARTSIGNAGE_LETSENCRYPT=true
export SMARTSIGNAGE_DOMAIN_NAME=totemdigital.app.br
export SMARTSIGNAGE_SSL_EMAIL=seu-email@dominio.com   # se o script pedir / usar env

# Preferir o fluxo interactivo do install e escolher Let's Encrypt (opção 2),
# ou o caminho skip-menu se já tiver as env acima no vosso procedimento habitual.
sudo bash scripts/install-smartsignage.sh --split-corporate-system --system-http-port 8080
```

No menu HTTPS, escolha **2) Let's Encrypt** (agora padrão). O domínio por omissão é `totemdigital.app.br`.

## Resultado esperado

| URL | Conteúdo |
|-----|----------|
| `https://totemdigital.app.br/` | Site corporativo (se `index.html` existir) ou rotas do painel |
| `https://totemdigital.app.br/api/...` | API |
| `https://totemdigital.app.br/player` | Player web |
| `https://totemdigital.app.br/login` | Painel (SPA; ficheiro corporativo não existe → fallback) |
| `http://IP:8080/` | Painel HTTP auxiliar (LAN) |

Player-AD:

```json
"serverUrl": "https://totemdigital.app.br"
```

## Validação

```bash
curl -I http://totemdigital.app.br          # 301 → https
curl -I https://totemdigital.app.br         # 200
curl -I https://totemdigital.app.br/api/health
sudo ss -tlnp | grep -E ':80|:443|:8080'
sudo ufw allow 443/tcp
```

Abra **443** também no firewall da cloud (IBM).
