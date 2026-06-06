# Site corporativo Smart Signage

Arquivos estáticos do site institucional (HTML, CSS, JS e imagens).

## Implantação

No layout dividido (`--split-corporate-system` / `SMARTSIGNAGE_NGINX_SPLIT`), o Nginx serve estes arquivos a partir de `CORPORATE_WEB_ROOT` (padrão `/var/www/corporate-site`). Copie o conteúdo desta pasta para esse diretório no servidor.

O instalador (`scripts/install-smartsignage.sh`) não sobrescreve um `index.html` personalizado; apenas remove landing legada gerada pelo instalador quando identificada pelo marcador interno.

## Origem

Repositório upstream: [emerixe/site_corporativo_SmartSignage](https://github.com/emerixe/site_corporativo_SmartSignage) (commit `190bf8f`).
