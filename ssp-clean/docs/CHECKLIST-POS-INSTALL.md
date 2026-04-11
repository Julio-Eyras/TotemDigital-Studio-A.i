# Checklist pós-install (servidor único)

## Contexto

- **Carga no banco:** Schema v2 + seeds (carga-inicial-v6.sql) e usuário **admin** (senha **admin123**) estão aplicados.
- **O install** pode terminar após "Configurando Nginx" e "Arquivos do player verificados", **antes** de criar o unit systemd e iniciar o backend. Nesse caso:
  - Porta **80** (Nginx) e porta **3000** (API) ficam sem nada a escutar → **ERR_CONNECTION_REFUSED** no browser.
  - Login dá **502** se o Nginx estiver ativo mas o backend não.

## O que fazer no servidor (uma vez)

1. **Criar o serviço do backend** (se ainda não existir):
   ```bash
   cd ~/SmartSignage-Pro
   ./scripts/create-smart-signage-service.sh
   sudo systemctl daemon-reload
   sudo systemctl enable smart-signage
   ```

2. **Subir todos os serviços** (Nginx + backend):
   ```bash
   ./scripts/start-all.sh
   ```
   Ou manualmente:
   ```bash
   sudo systemctl start nginx      # porta 80
   sudo systemctl start smart-signage   # porta 3000
   ```

3. **Confirmar:**
   - Porta 80: `curl -s -o /dev/null -w "%{http_code}" http://localhost:80` → esperado **200**
   - Porta 3000: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health` → esperado **200**
   - No browser: `http://192.168.1.110` → painel; login **admin** / **admin123**

## Portas

| Porta | Serviço        | Nota                          |
|-------|----------------|-------------------------------|
| 80    | Nginx          | Frontend + proxy para /api e /ws |
| 3000  | Backend Node   | API (auth, dashboard, etc.)   |
| 3001  | (opcional)     | Frontend dev; em produção não é usada |

## Diretrizes (TODO alinhado)

- [ ] Install deve, no fluxo single-server, criar `smart-signage.service` e chamar `start_services_in_order` para não depender de passos manuais.
- [ ] Pós-install: usar `start-all.sh` (ou criar serviço + start nginx + start smart-signage) para ter 80 e 3000 ativos.
- [ ] Não alterar carga de dados (carga-inicial-v6.sql) para o admin; `ensure_admin_user()` no install garante o utilizador admin.
