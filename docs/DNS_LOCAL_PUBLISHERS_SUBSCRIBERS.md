# DNS Local para Publishers e Subscribers

**Data:** 2026-01-03  
**Versão:** 2.1.0

---

## 📋 VISÃO GERAL

O Smart Signage Pro suporta DNS local usando **dnsmasq** para permitir acesso a publishers e subscribers via domínios locais, sem depender de DNS externo ou IPs fixos.

---

## 🎯 BENEFÍCIOS

✅ **Offline-first**: Funciona sem internet  
✅ **Multi-tenant**: Cada publisher/subscriber tem seu domínio  
✅ **Desenvolvimento**: Facilita testes locais  
✅ **Totens**: Ideal para players que precisam de DNS local  
✅ **Sem IP fixo**: Código não depende de IPs

---

## 🔧 CONFIGURAÇÃO AUTOMÁTICA

### Durante Instalação

O script de instalação pergunta se deseja configurar DNS local:

```
Deseja configurar DNS local para publishers e subscribers? (s/N)
```

Se escolher **sim**, o script:
1. Instala dnsmasq
2. Configura systemd-resolved (libera porta 53)
3. Cria configuração com 5 publishers e 5 subscribers de exemplo
4. Reinicia serviços
5. Valida funcionamento

---

## 📝 DOMÍNIOS CONFIGURADOS

### Publishers

```
publisher1.local → 127.0.0.1
publisher2.local → 127.0.0.1
publisher3.local → 127.0.0.1
publisher4.local → 127.0.0.1
publisher5.local → 127.0.0.1

# Serviços por Publisher
api.publisher1.local → 127.0.0.1:3000
mqtt.publisher1.local → 127.0.0.1:1883
player.publisher1.local → 127.0.0.1:80/player
```

### Subscribers

```
subscriber1.local → 127.0.0.1
subscriber2.local → 127.0.0.1
subscriber3.local → 127.0.0.1
subscriber4.local → 127.0.0.1
subscriber5.local → 127.0.0.1

# Serviços por Subscriber
api.subscriber1.local → 127.0.0.1:3000
mqtt.subscriber1.local → 127.0.0.1:1883
```

---

## 🛠️ ADICIONAR PUBLISHERS/SUBSCRIBERS DINAMICAMENTE

### Adicionar Publisher

```bash
sudo scripts/add-publisher-dns.sh <publisher_id>
```

**Exemplo:**
```bash
sudo scripts/add-publisher-dns.sh 6
```

Isso adiciona:
- `publisher6.local`
- `api.publisher6.local`
- `mqtt.publisher6.local`
- `player.publisher6.local`

### Adicionar Subscriber

```bash
sudo scripts/add-subscriber-dns.sh <subscriber_id>
```

**Exemplo:**
```bash
sudo scripts/add-subscriber-dns.sh 6
```

Isso adiciona:
- `subscriber6.local`
- `api.subscriber6.local`
- `mqtt.subscriber6.local`

---

## 🧪 TESTAR DNS LOCAL

### Verificar se está funcionando

```bash
# Testar publisher
nslookup publisher1.local 127.0.0.1
ping publisher1.local

# Testar subscriber
nslookup subscriber1.local 127.0.0.1
ping subscriber1.local

# Testar serviços
nslookup api.publisher1.local 127.0.0.1
nslookup mqtt.publisher1.local 127.0.0.1
```

### Verificar status do dnsmasq

```bash
sudo systemctl status dnsmasq
sudo journalctl -xeu dnsmasq.service
```

---

## 📁 ARQUIVOS DE CONFIGURAÇÃO

### dnsmasq

**Arquivo:** `/etc/dnsmasq.d/smartsignage-publishers-subscribers.conf`

Este arquivo contém todas as entradas DNS para publishers e subscribers.

### systemd-resolved

**Arquivo:** `/etc/systemd/resolved.conf`

```ini
[Resolve]
DNS=127.0.0.1
FallbackDNS=8.8.8.8
DNSStubListener=no
```

**Importante:** `DNSStubListener=no` libera a porta 53 para o dnsmasq.

### resolv.conf

**Arquivo:** `/etc/resolv.conf`

Deve ser um link simbólico para `/run/systemd/resolve/resolv.conf`:

```bash
/etc/resolv.conf -> /run/systemd/resolve/resolv.conf
```

---

## 🔍 TROUBLESHOOTING

### Problema: dnsmasq não inicia

**Erro:** `Job for dnsmasq.service failed`

**Causa:** Conflito de porta 53 com systemd-resolved

**Solução:**
```bash
# Verificar se DNSStubListener=no está configurado
sudo grep DNSStubListener /etc/systemd/resolved.conf

# Se não estiver, configurar:
sudo nano /etc/systemd/resolved.conf
# Adicionar: DNSStubListener=no

# Reiniciar
sudo systemctl restart systemd-resolved
sudo systemctl restart dnsmasq
```

---

### Problema: DNS não resolve

**Sintoma:** `nslookup publisher1.local` não funciona

**Solução:**
```bash
# Verificar se dnsmasq está rodando
sudo systemctl status dnsmasq

# Verificar logs
sudo journalctl -xeu dnsmasq.service

# Testar diretamente
nslookup publisher1.local 127.0.0.1

# Verificar configuração
cat /etc/dnsmasq.d/smartsignage-publishers-subscribers.conf
```

---

### Problema: resolv.conf incorreto

**Sintoma:** Sistema não usa DNS local

**Solução:**
```bash
# Verificar link
ls -la /etc/resolv.conf

# Se não for link, corrigir:
sudo rm /etc/resolv.conf
sudo ln -s /run/systemd/resolve/resolv.conf /etc/resolv.conf

# Reiniciar
sudo systemctl restart systemd-resolved
```

---

## 💡 USO NO CÓDIGO

### Exemplo: Player JavaScript

```javascript
// Usar DNS local em vez de IP fixo
const API_URL = "http://api.publisher1.local:3000";
const MQTT_URL = "mqtt://mqtt.publisher1.local:1883";

// Se o IP mudar, o código continua funcionando!
```

### Exemplo: Backend

```typescript
// Configurar URL base usando DNS local
const PUBLISHER_API = `http://api.publisher${publisherId}.local:3000`;
const SUBSCRIBER_API = `http://api.subscriber${subscriberId}.local:3000`;
```

---

## 🔄 INTEGRAÇÃO COM BANCO DE DADOS

### Adicionar DNS ao criar Publisher/Subscriber

Quando criar um novo publisher ou subscriber no banco, você pode automaticamente adicionar DNS local:

```bash
# Após criar publisher no banco
PUBLISHER_ID=$(psql -U smartsignage -d smartsignage -t -c "SELECT publisher_id FROM publishers ORDER BY publisher_id DESC LIMIT 1")
sudo scripts/add-publisher-dns.sh $PUBLISHER_ID
```

---

## 📊 ESTRUTURA DE DOMÍNIOS

```
# Domínio Base
.local

# Publishers
publisher{N}.local
  ├── api.publisher{N}.local
  ├── mqtt.publisher{N}.local
  └── player.publisher{N}.local

# Subscribers
subscriber{N}.local
  ├── api.subscriber{N}.local
  └── mqtt.subscriber{N}.local
```

Onde `{N}` é o ID do publisher/subscriber no banco de dados.

---

## 🚀 PRÓXIMOS PASSOS

1. **Testar DNS local** após instalação
2. **Adicionar publishers/subscribers** conforme necessário
3. **Usar domínios locais** no código em vez de IPs
4. **Documentar** URLs específicas do seu ambiente

---

**Última atualização:** 2026-01-03
