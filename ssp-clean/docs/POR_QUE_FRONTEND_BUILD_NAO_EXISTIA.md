# Por que o arquivo index.html (frontend build) não existia?

**Data:** 2026-02-16

---

## Resumo

O backend tenta servir o `index.html` do frontend quando recebe rotas como `/media` (para suportar SPA quando o acesso é feito direto na porta do backend). O caminho padrão é **`/opt/smart-signage/frontend/build`**. Esse arquivo/diretório pode não existir por vários motivos.

---

## Causas possíveis

### 1. **Frontend nunca foi compilado no servidor**

- Só o backend foi deployado (ex.: `npm run build` no backend, serviço reiniciado).
- O frontend não rodou `npm run build` no servidor (ou o build foi feito em outro lugar e não copiado).

**Solução:** No servidor, compilar o frontend e garantir que o resultado esteja no caminho esperado:

```bash
cd /opt/smart-signage/frontend   # ou INSTALL_DIR/frontend
npm ci
npm run build
# O build fica em frontend/build/
```

---

### 2. **Script de instalação colocou o build em outro diretório**

O `install-smartsignage.sh` pode copiar o build para um **diretório de deploy** diferente:

| Situação | Onde o build fica | Onde o backend olha (padrão) |
|----------|-------------------|------------------------------|
| INSTALL_DIR em `/home/...` e `/opt/smart-signage` existe | `/opt/smart-signage/frontend/build` | `/opt/smart-signage/frontend/build` ✅ |
| INSTALL_DIR em `/home/...` e `/opt/smart-signage` **não** existe | `/var/www/smart-signage` | `/opt/smart-signage/frontend/build` ❌ |
| INSTALL_DIR = `/opt/smart-signage` (não em /home) | `$INSTALL_DIR/frontend/build` (sem cópia) | `/opt/smart-signage/frontend/build` ✅ |

Se o deploy foi para **`/var/www/smart-signage`**, o Nginx usa esse caminho, mas o backend continua usando o padrão **`/opt/smart-signage/frontend/build`**, que pode estar vazio ou não existir.

**Solução:** Dizer ao backend onde está o build, igual ao Nginx. No `.env` do backend (ex.: `/opt/smart-signage/backend/.env` ou `INSTALL_DIR/backend/.env`):

```env
# Mesmo caminho que o Nginx usa (FRONTEND_BUILD_DIR no script de instalação)
FRONTEND_BUILD_PATH=/var/www/smart-signage
# ou, se o build estiver em /opt/smart-signage/frontend/build:
# FRONTEND_BUILD_PATH=/opt/smart-signage/frontend/build
```

Reiniciar o backend após alterar o `.env`.

---

### 3. **Backend rodando de outro diretório (Docker, outro path)**

- O backend sobe com `WorkingDirectory` diferente (ex.: container ou outro servidor).
- O padrão `/opt/smart-signage/frontend/build` não existe nesse ambiente.

**Solução:** Definir `FRONTEND_BUILD_PATH` no ambiente onde o backend roda (`.env` ou variável de ambiente do sistema/container) apontando para o diretório real do build.

---

### 4. **Build foi removido ou pasta vazia**

- Limpeza manual, reinstalação parcial ou script que apagou `frontend/build`.
- Pasta existe mas está vazia (build falhou ou não foi copiado).

**Solução:** Refazer o build do frontend (e, se usar script de instalação, rodar a parte que copia o build para o diretório de deploy).

---

## Como o backend descobre o caminho

No código (ex.: `backend/src/index.ts`):

- Usa `config.email?.frontendBuildPath`.
- Esse valor vem de **`FRONTEND_BUILD_PATH`** no `.env` (ver `backend/src/config/env.ts`).
- Se não estiver definido, o padrão é **`/opt/smart-signage/frontend/build`**.

Ou seja: o arquivo “não existia” porque o backend estava olhando para um diretório onde o build não estava (ou que não existia).

---

## O que fazer na sua instalação

1. **Ver onde o Nginx está servindo o frontend**

   No servidor:

   ```bash
   grep -E "root |FRONTEND_BUILD" /etc/nginx/sites-available/smart-signage
   ```

   O valor de `root` (ou o que o script chama de FRONTEND_BUILD_DIR) é o diretório onde o build **deve** estar.

2. **Ver se o build existe aí**

   ```bash
   ls -la /opt/smart-signage/frontend/build/index.html
   # ou
   ls -la /var/www/smart-signage/index.html
   ```

3. **Se o build estiver em outro path (ex.: `/var/www/smart-signage`)**  
   Colocar no `.env` do backend:

   ```env
   FRONTEND_BUILD_PATH=/var/www/smart-signage
   ```

4. **Se o build não existir em nenhum desses lugares**  
   Gerar o build e (se usar o script) garantir que ele seja copiado para o mesmo diretório que o Nginx usa.

Depois disso, o backend passa a usar o mesmo diretório que o Nginx e deixa de dar erro ao servir `index.html` para rotas como `/media`.

---

## Cenário: build e Nginx já no lugar (como no seu servidor)

Quando você tem:

- `root /opt/smart-signage/frontend/build` no Nginx
- `index.html` e `static/` em `/opt/smart-signage/frontend/build`
- Dono dos arquivos: `www-data` (Nginx consegue servir)

o **backend** usa por padrão o mesmo caminho (`/opt/smart-signage/frontend/build`), então não precisa de `FRONTEND_BUILD_PATH` no `.env`.

O 500 em `/media` pode ter ocorrido porque:

1. Naquele momento o build ainda não estava lá (ou o backend foi iniciado antes do build).
2. A requisição caiu no backend (ex.: proxy ou acesso direto à porta 3000) e o processo não tinha permissão para ler o diretório (improvável se for `755`/`644` e o serviço roda como usuário normal).
3. Erro temporário (disco, permissão durante deploy).

**O que fazer agora:**

1. **Reiniciar o backend** para garantir que ele carregue o caminho e sirva o `index.html` corretamente:
   ```bash
   sudo systemctl restart smart-signage
   ```
2. **Opcional:** no `.env` do backend, deixar explícito (só se quiser):
   ```env
   FRONTEND_BUILD_PATH=/opt/smart-signage/frontend/build
   ```
3. Testar de novo: `http://192.168.1.110/media` deve abrir a SPA (página de Mídia) sem 500.
