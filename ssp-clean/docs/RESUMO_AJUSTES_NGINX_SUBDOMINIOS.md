# Resumo: Ajustes na Configuração Nginx para Subdomínios

## 📋 O que foi feito

### 1. **Reorganização da Configuração Nginx**

**Antes:**
- Porta 80: Apenas Player (público)
- Porta 8080: Painel Administrativo + Subdomínios (publisher, subscriber)

**Depois:**
- Porta 80: Todos os serviços (Domínio Principal, Publisher, Subscriber, Player)
- Removida a necessidade de porta 8080

### 2. **Uso de Domínio Real**

A configuração agora usa o `DOMAIN_NAME` quando disponível:

```bash
# Se DOMAIN_NAME estiver definido (ex: "sistema.com"):
- Domínio Principal: sistema.com, www.sistema.com
- Publisher: publisher.sistema.com
- Subscriber: subscriber.sistema.com

# Se DOMAIN_NAME não estiver definido:
- Domínio Principal: _ (qualquer domínio)
- Publisher: publisher.* (qualquer subdomínio publisher)
- Subscriber: subscriber.* (qualquer subdomínio subscriber)
```

### 3. **Headers de Subdomínio**

Cada server block agora envia o header correto:

- **Domínio Principal**: `X-Subdomain-Type: main`
- **Publisher**: `X-Subdomain-Type: publisher`
- **Subscriber**: `X-Subdomain-Type: subscriber`

### 4. **Estrutura da Configuração**

```
Porta 80:
├── Domínio Principal (sistema.com)
│   ├── Frontend SPA
│   ├── Backend API (/api/)
│   ├── Player (/player/)
│   └── Assets (/assets/)
│
├── Publisher (publisher.sistema.com)
│   ├── Frontend SPA
│   ├── Backend API (/api/) com header X-Subdomain-Type: publisher
│   └── Assets (/assets/)
│
└── Subscriber (subscriber.sistema.com)
    ├── Frontend SPA
    ├── Backend API (/api/) com header X-Subdomain-Type: subscriber
    └── Assets (/assets/)
```

---

## 🔧 Arquivos Modificados

### `install-smartsignage.sh`

**Função:** `setup_nginx()`

**Mudanças:**
1. Removida a separação de portas (80 vs 8080)
2. Adicionada lógica para determinar domínios baseados em `DOMAIN_NAME`
3. Configuração de 3 server blocks na porta 80:
   - Domínio principal
   - Publisher subdomain
   - Subscriber subdomain
4. Cada server block envia o header `X-Subdomain-Type` apropriado

---

## ✅ Benefícios

1. **Simplicidade**: Todos os serviços na porta 80 padrão
2. **Flexibilidade**: Funciona com ou sem domínio configurado
3. **Compatibilidade**: Mantém suporte a padrões wildcard quando necessário
4. **Detecção Automática**: Backend recebe header correto para identificar subdomínio

---

## 🧪 Como Testar

### 1. Verificar Configuração Nginx

```bash
# Testar sintaxe
sudo nginx -t

# Ver configuração gerada
cat /etc/nginx/sites-available/smart-signage
```

### 2. Testar Subdomínios

```bash
# Com domínio configurado
curl -H "Host: publisher.sistema.com" http://localhost/api/health -v
curl -H "Host: subscriber.sistema.com" http://localhost/api/health -v

# Verificar header X-Subdomain-Type
curl -H "Host: publisher.sistema.com" http://localhost/api/health -H "X-Subdomain-Type: publisher" -v
```

### 3. Verificar Logs

```bash
# Ver logs de acesso
sudo tail -f /var/log/nginx/access.log

# Ver logs de erro
sudo tail -f /var/log/nginx/error.log
```

---

## 📝 Próximos Passos

1. **Testar em ambiente real** com domínio configurado
2. **Verificar se o frontend detecta corretamente** os subdomínios
3. **Validar isolamento de dados** por subdomínio no backend
4. **Configurar SSL/TLS** para subdomínios (Let's Encrypt)

---

## 🔍 Notas Técnicas

### Variáveis Usadas

- `DOMAIN_NAME`: Domínio principal (ex: "sistema.com")
- `MAIN_DOMAIN`: Domínio principal ou "_" se não definido
- `MAIN_SERVER_NAME`: server_name completo (com www se aplicável)
- `PUBLISHER_DOMAIN`: publisher.$DOMAIN_NAME ou "publisher.*"
- `SUBSCRIBER_DOMAIN`: subscriber.$DOMAIN_NAME ou "subscriber.*"

### Ordem de Prioridade

O Nginx processa os server blocks na seguinte ordem:
1. Nome exato do domínio
2. Nome com wildcard (*)
3. Server block padrão (_)

Isso garante que subdomínios específicos sejam capturados antes do padrão.

---

**Data:** 2024-12-XX
**Versão:** 1.0
**Status:** ✅ Implementado
