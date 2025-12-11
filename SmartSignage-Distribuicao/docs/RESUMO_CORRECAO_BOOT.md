# Resumo: Correção de Demora no Boot

## ✅ Mudanças Aplicadas

### Arquivos Corrigidos:

1. ✅ `install-smartsignage.sh` - Mudado `network-online.target` → `network.target`
2. ✅ `scripts/autostart-system.sh` - Adicionado `network.target` e removido `network-online.target`
3. ✅ `backend/deploy-production.js` - Atualizado para usar `network.target`
4. ✅ `player-agent/install-service.sh` - Atualizado para usar `network.target`

### Novo Script Criado:

- ✅ `scripts/fix-network-boot-delay.sh` - Script automático para corrigir o problema

### Documentação Criada:

- ✅ `docs/CORRECAO_BOOT_NETWORK.md` - Guia completo de correção

## 🚀 Como Aplicar

### Para Sistemas Já Instalados:

Execute o script de correção:

```bash
cd /opt/smart-signage
sudo bash scripts/fix-network-boot-delay.sh
```

OU

Execute manualmente:

```bash
# 1. Configurar networkd-wait-online com timeout
sudo mkdir -p /etc/systemd/system/systemd-networkd-wait-online.service.d/
sudo tee /etc/systemd/system/systemd-networkd-wait-online.service.d/override.conf > /dev/null << 'EOF'
[Service]
TimeoutStartSec=10s
ExecStart=
ExecStart=/lib/systemd/systemd-networkd-wait-online --timeout=10 --any
EOF

# 2. Atualizar serviço do Smart Signage
sudo mkdir -p /etc/systemd/system/smart-signage.service.d/
sudo tee /etc/systemd/system/smart-signage.service.d/override.conf > /dev/null << 'EOF'
[Unit]
After=network.target docker.service
Wants=network.target docker.service
EOF

# 3. Recarregar systemd
sudo systemctl daemon-reload
```

### Para Novas Instalações:

As mudanças já estão aplicadas nos scripts de instalação. Novas instalações não terão o problema.

## 📊 Resultado Esperado

- **Antes:** Boot demora 30+ segundos esperando WiFi
- **Depois:** Boot demora 10-15 segundos (sem esperar WiFi)

## ⚠️ Importante

Os serviços do Smart Signage agora podem iniciar antes da rede WiFi estar completamente configurada. Certifique-se de que:

1. Os serviços lidam com falhas de conexão graciosamente
2. Há lógica de retry para conexões de rede
3. O sistema funciona mesmo se a rede não estiver disponível imediatamente

## 🔍 Verificação

Após aplicar, reinicie e verifique:

```bash
sudo reboot

# Após reiniciar:
systemd-analyze
systemd-analyze blame
```

