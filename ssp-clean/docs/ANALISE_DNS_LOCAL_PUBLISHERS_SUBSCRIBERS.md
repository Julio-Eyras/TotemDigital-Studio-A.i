# Análise: DNS Local para Publishers e Subscribers

**Data:** 2026-01-03  
**Contexto:** Integração de DNS local (dnsmasq) no script de instalação

---

## 🔍 REVISÃO: Sistema Atual

### Estrutura do Sistema

O Smart Signage Pro tem **DOIS tipos principais de entidades**:

1. **Publishers** (Publicadores)
   - Gerenciam locais físicos
   - Controlam totens e Smart TVs
   - Subdomínio: `publisher.$DOMAIN_NAME`

2. **Subscribers** (Assinantes)
   - Anunciantes que contratam espaços
   - Acessam publishers para exibir conteúdo
   - Subdomínio: `subscriber.$DOMAIN_NAME`

### Configuração Atual no Nginx

O script já configura subdomínios no Nginx:
- `publisher.$DOMAIN_NAME` → Interface Publisher
- `subscriber.$DOMAIN_NAME` → Interface Subscriber

**Mas isso requer DNS externo configurado!**

---

## 🎯 PROPOSTA REVISADA: DNS Local

### Objetivo

Criar DNS local para permitir:
- `publisher1.local`, `publisher2.local`, etc. → 127.0.0.1
- `subscriber1.local`, `subscriber2.local`, etc. → 127.0.0.1
- `api.publisher1.local`, `mqtt.publisher1.local` → 127.0.0.1
- `api.subscriber1.local`, `mqtt.subscriber1.local` → 127.0.0.1

### Benefícios

✅ **Offline-first**: Funciona sem internet  
✅ **Multi-tenant**: Cada publisher/subscriber tem seu domínio  
✅ **Desenvolvimento**: Facilita testes locais  
✅ **Totens**: Ideal para players que precisam de DNS local  
✅ **Sem IP fixo**: Código não depende de IPs

---

## 📋 ESTRUTURA PROPOSTA

### 1. Domínios Base

```
# Publishers
publisher1.local → 127.0.0.1
publisher2.local → 127.0.0.1
publisher3.local → 127.0.0.1
...

# Subscribers
subscriber1.local → 127.0.0.1
subscriber2.local → 127.0.0.1
subscriber3.local → 127.0.0.1
...
```

### 2. Serviços por Entidade

```
# Para cada Publisher
api.publisher1.local → 127.0.0.1:3000
mqtt.publisher1.local → 127.0.0.1:1883
player.publisher1.local → 127.0.0.1:80/player

# Para cada Subscriber
api.subscriber1.local → 127.0.0.1:3000
mqtt.subscriber1.local → 127.0.0.1:1883
```

### 3. Configuração dnsmasq

```bash
# /etc/dnsmasq.d/smartsignage-publishers-subscribers.conf

# Domínios base
local=/publisher.local/
local=/subscriber.local/

# Publishers
address=/publisher1.local/127.0.0.1
address=/publisher2.local/127.0.0.1
address=/publisher3.local/127.0.0.1

# Subscribers
address=/subscriber1.local/127.0.0.1
address=/subscriber2.local/127.0.0.1
address=/subscriber3.local/127.0.0.1

# Serviços por Publisher
address=/api.publisher1.local/127.0.0.1
address=/mqtt.publisher1.local/127.0.0.1
address=/player.publisher1.local/127.0.0.1

address=/api.publisher2.local/127.0.0.1
address=/mqtt.publisher2.local/127.0.0.1

# Serviços por Subscriber
address=/api.subscriber1.local/127.0.0.1
address=/mqtt.subscriber1.local/127.0.0.1

address=/api.subscriber2.local/127.0.0.1
address=/mqtt.subscriber2.local/127.0.0.1
```

---

## 🔧 IMPLEMENTAÇÃO PROPOSTA

### Função: `setup_local_dns()`

**Onde adicionar:** Após `install_dependencies()`, antes de `setup_nginx()`

**O que fazer:**

1. **Perguntar ao usuário:**
   ```
   Deseja configurar DNS local para publishers e subscribers? (s/N)
     - Permite usar publisher1.local, subscriber1.local, etc.
     - Facilita desenvolvimento e testes
     - Não requer DNS externo para serviços internos
   ```

2. **Instalar dnsmasq:**
   ```bash
   sudo apt install -y dnsmasq
   ```

3. **Configurar systemd-resolved:**
   ```bash
   # /etc/systemd/resolved.conf
   [Resolve]
   DNS=127.0.0.1
   FallbackDNS=8.8.8.8
   DNSStubListener=no  # CRÍTICO: libera porta 53
   ```

4. **Criar configuração dnsmasq:**
   ```bash
   # /etc/dnsmasq.d/smartsignage-publishers-subscribers.conf
   # (conteúdo acima)
   ```

5. **Ajustar resolv.conf:**
   ```bash
   sudo rm /etc/resolv.conf
   sudo ln -s /run/systemd/resolve/resolv.conf /etc/resolv.conf
   ```

6. **Reiniciar serviços:**
   ```bash
   sudo systemctl restart systemd-resolved
   sudo systemctl restart dnsmasq
   ```

7. **Validar:**
   ```bash
   nslookup publisher1.local
   nslookup subscriber1.local
   ```

---

## 📝 SCRIPTS AUXILIARES PROPOSTOS

### 1. `scripts/add-publisher-dns.sh`

```bash
#!/bin/bash
# Adiciona DNS local para um publisher
# Uso: ./add-publisher-dns.sh <publisher_id>

PUBLISHER_ID=$1
if [[ -z "$PUBLISHER_ID" ]]; then
    echo "Uso: $0 <publisher_id>"
    exit 1
fi

echo "address=/publisher${PUBLISHER_ID}.local/127.0.0.1" | sudo tee -a /etc/dnsmasq.d/smartsignage-publishers-subscribers.conf
echo "address=/api.publisher${PUBLISHER_ID}.local/127.0.0.1" | sudo tee -a /etc/dnsmasq.d/smartsignage-publishers-subscribers.conf
echo "address=/mqtt.publisher${PUBLISHER_ID}.local/127.0.0.1" | sudo tee -a /etc/dnsmasq.d/smartsignage-publishers-subscribers.conf

sudo systemctl restart dnsmasq
echo "✅ DNS local configurado para publisher${PUBLISHER_ID}.local"
```

### 2. `scripts/add-subscriber-dns.sh`

```bash
#!/bin/bash
# Adiciona DNS local para um subscriber
# Uso: ./add-subscriber-dns.sh <subscriber_id>

SUBSCRIBER_ID=$1
if [[ -z "$SUBSCRIBER_ID" ]]; then
    echo "Uso: $0 <subscriber_id>"
    exit 1
fi

echo "address=/subscriber${SUBSCRIBER_ID}.local/127.0.0.1" | sudo tee -a /etc/dnsmasq.d/smartsignage-publishers-subscribers.conf
echo "address=/api.subscriber${SUBSCRIBER_ID}.local/127.0.0.1" | sudo tee -a /etc/dnsmasq.d/smartsignage-publishers-subscribers.conf
echo "address=/mqtt.subscriber${SUBSCRIBER_ID}.local/127.0.0.1" | sudo tee -a /etc/dnsmasq.d/smartsignage-publishers-subscribers.conf

sudo systemctl restart dnsmasq
echo "✅ DNS local configurado para subscriber${SUBSCRIBER_ID}.local"
```

---

## 🎯 INTEGRAÇÃO COM BANCO DE DADOS

### Opção 1: Configuração Estática (Inicial)

Criar 3-5 publishers e 3-5 subscribers de exemplo no DNS local durante instalação.

### Opção 2: Configuração Dinâmica (Futuro)

Quando criar publisher/subscriber no banco:
- Chamar script auxiliar automaticamente
- Ou criar API endpoint que adiciona DNS local

---

## ⚠️ PONTOS DE ATENÇÃO

### 1. Conflito systemd-resolved

✅ **Solução:** `DNSStubListener=no` libera porta 53  
⚠️ **Atenção:** Pode afetar outros serviços que dependem do resolved

### 2. Quando Usar

- **Servidor Principal:** Útil para desenvolvimento/testes
- **Totens/Players:** Mais relevante (offline-first)
- **Produção:** Pode não ser necessário se houver DNS externo

### 3. Escalabilidade

- Adicionar publishers/subscribers dinamicamente requer reiniciar dnsmasq
- Considerar cache ou reload sem restart completo

### 4. Segurança

- DNS local só responde em 127.0.0.1 (seguro)
- Não expõe serviços externamente

---

## 📊 COMPARAÇÃO: DNS Externo vs Local

| Aspecto | DNS Externo | DNS Local |
|---------|-------------|-----------|
| **Requer Internet** | ✅ Sim | ❌ Não |
| **Configuração** | Complexa | Simples |
| **Multi-tenant** | Limitado | Ilimitado |
| **Offline** | ❌ Não funciona | ✅ Funciona |
| **Totens** | Depende de IP | Independente |
| **Produção** | Recomendado | Opcional |

---

## ✅ RECOMENDAÇÃO FINAL

### Implementar:

1. ✅ Função `setup_local_dns()` **opcional** no script de instalação
2. ✅ Perguntar ao usuário se deseja configurar
3. ✅ Criar 3 publishers e 3 subscribers de exemplo
4. ✅ Scripts auxiliares para adicionar dinamicamente
5. ✅ Documentação completa

### Estrutura de Domínios:

```
# Publishers
publisher1.local, publisher2.local, publisher3.local
api.publisher1.local, mqtt.publisher1.local, player.publisher1.local

# Subscribers
subscriber1.local, subscriber2.local, subscriber3.local
api.subscriber1.local, mqtt.subscriber1.local
```

---

## 🔄 PRÓXIMOS PASSOS

1. **Aguardar aprovação** do usuário
2. **Implementar função** `setup_local_dns()` no script
3. **Criar scripts auxiliares** para adicionar publishers/subscribers
4. **Documentar** em `docs/DNS_LOCAL_PUBLISHERS_SUBSCRIBERS.md`
5. **Testar** em ambiente isolado

---

**Última atualização:** 2026-01-03
