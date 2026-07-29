# Activar HTTPS unificado (site + API na 443) — servidor já instalado

Para instalações **já em produção** com layout dividido (80 + 8080), sem reinstalar tudo.

## Pré-requisitos

- DNS A: `totemdigital.app.br` → IP do servidor
- **`www` é opcional.** Se `www.totemdigital.app.br` não existir (NXDOMAIN), o instalador pede certificado **só do apex**. Criar A/CNAME `www` no registro.br só se quiser `https://www...`.
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

## Problema: Player-AD `code=-1` com HTTPS OK no PC

Se `curl https://totemdigital.app.br/api/health` no servidor/PC devolve 200, mas a TV Box falha:

1. Verifique se existe **AAAA** no DNS:
   ```bash
   dig +short totemdigital.app.br A
   dig +short totemdigital.app.br AAAA
   curl -4 -sS -o /dev/null -w "%{http_code}\n" https://totemdigital.app.br/api/health
   curl -6 -sS -o /dev/null -w "%{http_code}\n" --max-time 8 https://totemdigital.app.br/api/health
   ```
2. Se AAAA existir e o `curl -6` falhar/timeout: o Android **prefere IPv6** e nunca chega ao IPv4.
3. **Correção rápida:** no registro.br, **apague o registo AAAA** de `totemdigital.app.br` (e `www` se houver) até a cloud ter TCP **443** aberto também em IPv6.
4. Alternativa: abrir 443/tcp (IPv6) no firewall Contabo/IBM e confirmar `ss -tlnp | grep 443`.
5. Teste temporário na box: `serverUrl=http://169.58.82.42:8080` (só IPv4).

## Recuperação rápida: 405 no login (cert OK, Nginx ficou em HTTP)

Sintoma: login mostra `405 Not Allowed` (nginx) e `Back: ...`.  
Causa: o Certbot emitiu o certificado, mas o install não leu `/etc/letsencrypt/live/` (ficheiros root-only) e reverteu o Nginx para HTTP — o frontend (build com `REACT_APP_API_URL=https://...`) faz POST em HTTPS sem proxy `/api`.

```bash
cd ~/TotemDigital-Studio
git pull
sudo bash scripts/install-smartsignage.sh --apply-le-https-only

curl -Ik https://totemdigital.app.br/login
curl -sk https://totemdigital.app.br/api/health
```

Use **https://totemdigital.app.br/login**. Alternativa HTTP do painel: `http://totemdigital.app.br:8080/login`.

## Resultado esperado

| URL | Conteúdo |
|-----|----------|
| `https://totemdigital.app.br/` | Site corporativo (se `index.html` existir) ou rotas do painel |
| `https://totemdigital.app.br/api/...` | API |
| `https://totemdigital.app.br/player` | Player web |
| `https://totemdigital.app.br/login` | Painel SPA (fallback Nginx `@panel_spa` com `rewrite … break`) |
| `http://IP:8080/login` | Painel HTTP auxiliar (LAN), se `SYSTEM_HTTP_PORT=8080` |
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

## Nota sobre www

O instalador só inclui `www.` no certificado se `dig` encontrar A/AAAA público. Não usa `getent` (em VPS pode devolver o IPv6 da máquina sem registo real de www). Se já existir certificado só do apex e quiser acrescentar www depois:

```bash
sudo certbot --nginx -d totemdigital.app.br -d www.totemdigital.app.br --expand
```

(Exige DNS A/CNAME de www no registro.br.)

No servidor (layout único na :80, como no log típico):

```bash
# 1) Abrir 443
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw reload

# 2) Certificado só do apex (NÃO use -d www se não houver DNS)
sudo certbot --nginx -d totemdigital.app.br --agree-tos -m SEU_EMAIL --redirect --non-interactive

# 3) Validar
curl -I https://totemdigital.app.br
curl -I https://totemdigital.app.br/api/health
```

Se o e-mail já estiver guardado no Certbot, pode omitir `-m`. Depois configure o Player-AD com `serverUrl: "https://totemdigital.app.br"`.
