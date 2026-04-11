# Correção: Script de Instalação - Nginx Assets

**Data:** 2026-02-16  
**Arquivo:** `scripts/install-smartsignage.sh`

---

## 🔧 Alterações Realizadas

### Problema Identificado
O script de instalação estava configurando o Nginx para servir arquivos de assets diretamente usando `alias`, o que causa problemas de permissão quando o Nginx (www-data) não tem acesso aos arquivos pertencentes a outros usuários.

### Solução Implementada
Todas as configurações de `location /assets/` foram alteradas para usar `proxy_pass` ao invés de `alias`, fazendo o Nginx fazer proxy para o backend (porta 3000), que já serve os arquivos corretamente via `express.static`.

---

## 📋 Locais Corrigidos

Foram corrigidas **6 ocorrências** de `location /assets/` no script:

1. **Linha ~4704** - Configuração principal (domínio principal)
2. **Linha ~4816** - Configuração alternativa (sem HTTPS)
3. **Linha ~5095** - Configuração com subdomínios (domínio principal)
4. **Linha ~5205** - Configuração com subdomínios (domínio principal - segunda ocorrência)
5. **Linha ~5291** - Configuração para subdomínio Publisher
6. **Linha ~5372** - Configuração para subdomínio Subscriber

---

## ✅ Configuração Antes vs Depois

### ❌ Antes (com problema de permissão):
```nginx
location /assets/ {
    alias /opt/smart-signage/public/assets/;
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

### ✅ Depois (corrigido):
```nginx
location /assets/ {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

---

## 🎯 Benefícios

1. ✅ **Sem problemas de permissão** - Nginx não precisa ler arquivos diretamente
2. ✅ **Backend já serve corretamente** - Express.static já está configurado
3. ✅ **Consistência** - Todas as configurações usam o mesmo padrão
4. ✅ **Compatibilidade** - Verificação de validação aceita ambos os formatos (proxy_pass ou alias)

---

## 📝 Notas

- A verificação de validação (linha ~7306) ainda aceita ambos os formatos para compatibilidade com instalações antigas
- Novas instalações usarão automaticamente `proxy_pass`
- Instalações existentes podem usar o script `corrigir-nginx-assets.py` para atualizar

---

## 🧪 Verificação

Após uma nova instalação, verifique:

```bash
# Verificar configuração gerada
grep -A 8 "location /assets/" /etc/nginx/sites-available/smart-signage

# Deve mostrar proxy_pass, não alias
```

---

## 📚 Scripts Relacionados

- `scripts/corrigir-nginx-assets.py` - Script para corrigir instalações existentes
- `scripts/fix-nginx-assets-now.sh` - Script bash alternativo
- `docs/SOLUCAO_404_ASSETS.md` - Documentação completa do problema e soluções
