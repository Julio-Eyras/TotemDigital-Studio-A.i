# Como Atualizar o Frontend Após Clone no Servidor

## 🔍 Problema

Após fazer um `git clone` no servidor, as mudanças no frontend não aparecem porque:

1. **O código está no repositório** ✅ (commit `a854491`)
2. **Mas o build estático não foi gerado** ❌
3. O React precisa compilar o código TypeScript/JSX para JavaScript estático

## ✅ Solução

### Opção 1: Usar o Script de Instalação (Recomendado)

Se você usou o `install-smartsignage.sh`, execute:

```bash
cd /caminho/do/projeto
./install-smartsignage.sh --frontend-only
```

Isso irá:
- Instalar dependências do frontend
- Compilar o frontend (`npm run build`)
- Copiar o build para o diretório de deploy
- Reiniciar o Nginx (se necessário)

### Opção 2: Rebuild Manual

```bash
# 1. Ir para o diretório do frontend
cd frontend

# 2. Instalar dependências (se necessário)
npm install

# 3. Compilar o frontend
npm run build

# 4. Verificar se o build foi criado
ls -la build/

# 5. Se estiver usando Nginx, copiar o build para o diretório de deploy
# (ajuste o caminho conforme sua instalação)
sudo cp -r build/* /opt/smart-signage/frontend/build/

# 6. Reiniciar o Nginx
sudo systemctl restart nginx
# ou
sudo service nginx restart
```

### Opção 3: Rebuild Backend + Frontend

```bash
cd /caminho/do/projeto
./install-smartsignage.sh --backfront-build
```

## 🔄 Verificação

Após o rebuild, verifique:

1. **Build foi criado:**
   ```bash
   ls -la frontend/build/index.html
   ```

2. **Nginx está servindo o build correto:**
   ```bash
   # Verificar configuração do Nginx
   sudo grep -r "root.*frontend.*build" /etc/nginx/
   
   # Verificar se o arquivo está acessível
   sudo ls -la /opt/smart-signage/frontend/build/index.html
   ```

3. **Limpar cache do navegador:**
   - Pressione `Ctrl + Shift + R` (ou `Cmd + Shift + R` no Mac)
   - Ou abra em modo anônimo/privado

## 🐛 Troubleshooting

### Build falha com erros

```bash
# Limpar cache e node_modules
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Nginx não está servindo o novo build

```bash
# Verificar qual diretório o Nginx está usando
sudo nginx -T | grep "root.*frontend"

# Verificar se o build está no lugar certo
ls -la /opt/smart-signage/frontend/build/

# Recarregar configuração do Nginx
sudo nginx -t  # Testar configuração
sudo systemctl reload nginx  # Recarregar sem downtime
```

### Cache do navegador persistente

1. Limpar cache do navegador completamente
2. Usar modo anônimo/privado
3. Adicionar `?v=timestamp` na URL para forçar reload

## 📝 Notas Importantes

- **O build é necessário** porque React compila TypeScript/JSX para JavaScript estático
- **Após cada `git pull`**, se houver mudanças no frontend, é necessário rebuild
- **O diretório `build/`** contém os arquivos estáticos que o Nginx serve
- **Cache do navegador** pode mostrar versão antiga mesmo após rebuild

## 🚀 Script Rápido

Crie um script `rebuild-frontend.sh`:

```bash
#!/bin/bash
cd "$(dirname "$0")/frontend"
echo "🔨 Reconstruindo frontend..."
npm install
npm run build
echo "✅ Frontend reconstruído!"
echo "📁 Build em: $(pwd)/build"
```

Torne executável:
```bash
chmod +x rebuild-frontend.sh
```

Execute:
```bash
./rebuild-frontend.sh
```
