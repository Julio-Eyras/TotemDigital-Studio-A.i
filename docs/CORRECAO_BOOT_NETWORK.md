# Correção: Demora no Boot por networkd-wait-online

## Problema

O sistema está demorando muito durante o boot porque o `systemd-networkd-wait-online.service` está esperando a rede WiFi ficar online antes de continuar o boot. Isso pode causar demoras de 30 segundos ou mais.

## Solução

### Opção 1: Script Automático (Recomendado)

Execute o script de correção:

```bash
cd /opt/smart-signage
sudo bash scripts/fix-network-boot-delay.sh
```

Este script irá:
1. Configurar `systemd-networkd-wait-online` com timeout de 10 segundos
2. Atualizar serviços do Smart Signage para usar `network.target` ao invés de `network-online.target`
3. Configurar NetworkManager (se estiver usando)
4. Criar overrides para não bloquear o boot

### Opção 2: Correção Manual

#### 2.1. Configurar systemd-networkd-wait-online

```bash
sudo mkdir -p /etc/systemd/system/systemd-networkd-wait-online.service.d/

sudo tee /etc/systemd/system/systemd-networkd-wait-online.service.d/override.conf > /dev/null << 'EOF'
[Service]
TimeoutStartSec=10s
ExecStart=
ExecStart=/lib/systemd/systemd-networkd-wait-online --timeout=10 --any
EOF
```

#### 2.2. Desabilitar networkd-wait-online (opcional)

Se você não precisa esperar a rede ficar online:

```bash
sudo systemctl disable systemd-networkd-wait-online.service
sudo systemctl mask systemd-networkd-wait-online.service
```

#### 2.3. Atualizar serviço do Smart Signage

```bash
sudo mkdir -p /etc/systemd/system/smart-signage.service.d/

sudo tee /etc/systemd/system/smart-signage.service.d/override.conf > /dev/null << 'EOF'
[Unit]
After=network.target docker.service
Wants=network.target docker.service
EOF
```

#### 2.4. Recarregar systemd

```bash
sudo systemctl daemon-reload
```

### Opção 3: Configurar NetworkManager (se estiver usando)

Se você estiver usando NetworkManager ao invés de systemd-networkd:

```bash
sudo mkdir -p /etc/systemd/system/NetworkManager-wait-online.service.d/

sudo tee /etc/systemd/system/NetworkManager-wait-online.service.d/override.conf > /dev/null << 'EOF'
[Service]
TimeoutStartSec=10s
EOF

sudo systemctl disable NetworkManager-wait-online.service
```

## Verificação

Após aplicar a correção:

1. **Reinicie o sistema:**
   ```bash
   sudo reboot
   ```

2. **Verifique o tempo de boot:**
   ```bash
   systemd-analyze
   ```

3. **Verifique serviços que demoram:**
   ```bash
   systemd-analyze blame
   ```

4. **Verifique se networkd-wait-online está configurado:**
   ```bash
   systemctl status systemd-networkd-wait-online.service
   ```

## Diferenças

### Antes (com network-online.target)
- Sistema espera WiFi ficar online
- Boot pode demorar 30+ segundos
- Serviços só iniciam após rede estar configurada

### Depois (com network.target)
- Sistema só espera interfaces de rede existirem
- Boot mais rápido (10-15 segundos)
- Serviços podem iniciar antes da rede estar configurada
- Serviços devem lidar com reconexão internamente

## Notas Importantes

⚠️ **Atenção:** Com esta mudança, os serviços do Smart Signage podem iniciar antes da rede WiFi estar completamente configurada. Certifique-se de que:

1. Os serviços lidam com falhas de conexão de rede graciosamente
2. Há lógica de retry para conexões de rede
3. O sistema funciona mesmo se a rede não estiver disponível imediatamente

## Reverter Mudanças

Se precisar reverter:

```bash
# Remover overrides
sudo rm -rf /etc/systemd/system/systemd-networkd-wait-online.service.d/
sudo rm -rf /etc/systemd/system/smart-signage.service.d/

# Reabilitar networkd-wait-online
sudo systemctl unmask systemd-networkd-wait-online.service
sudo systemctl enable systemd-networkd-wait-online.service

# Recarregar
sudo systemctl daemon-reload
sudo reboot
```

## Troubleshooting

### Problema: Serviços falham porque rede não está pronta

**Solução:** Adicione lógica de retry nos serviços ou configure para iniciar após network.target estar ativo mas com timeout curto.

### Problema: WiFi não conecta automaticamente

**Solução:** Configure o NetworkManager ou systemd-networkd para conectar automaticamente ao WiFi conhecido.

### Problema: Boot ainda está lento

**Solução:** Verifique outros serviços:
```bash
systemd-analyze blame | head -20
```

