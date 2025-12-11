# Correção do Chromium no Kiosk
## Problema: Redirecionamento para IP 192.168.1.102

---

## 🔍 **Problema Identificado**

O Chromium estava sendo iniciado com um **IP fixo** (192.168.1.102) no script de autostart do kiosk, causando redirecionamento incorreto.

### **Causa:**
- O script de autostart (`~/.config/autostart/kiosk.sh`) foi criado com IP fixo no momento da instalação
- Se o IP mudar ou se o script foi editado manualmente, o navegador abre o IP errado

---

## ✅ **Correção Aplicada**

### **1. Script de Instalação Atualizado**

O script `install-smartsignage.sh` agora:
- ✅ **Detecta IP dinamicamente** a cada inicialização
- ✅ **Não fixa IP no script** de autostart
- ✅ **Usa variável dinâmica** para URL do player

### **2. Script de Correção Criado**

Criado `scripts/fix-kiosk-url.sh` para:
- ✅ Corrigir scripts existentes com IP fixo
- ✅ Remover referências ao IP 192.168.1.102
- ✅ Atualizar para detecção dinâmica de IP

---

## 🔧 **Como Corrigir**

### **Opção 1: Script Automático**

```bash
# Executar script de correção
chmod +x scripts/fix-kiosk-url.sh
./scripts/fix-kiosk-url.sh

# Reiniciar ambiente gráfico
sudo systemctl restart lightdm
```

### **Opção 2: Correção Manual**

1. **Editar script de autostart:**
   ```bash
   nano ~/.config/autostart/kiosk.sh
   ```

2. **Substituir a linha com URL fixa:**
   ```bash
   # ANTES (ERRADO):
   KIOSK_URL="http://192.168.1.102:80/player"
   
   # DEPOIS (CORRETO):
   SERVER_IP=$(hostname -I | awk '{print $1}')
   if [ -z "$SERVER_IP" ] || [ "$SERVER_IP" == "" ]; then
       SERVER_IP="localhost"
   fi
   KIOSK_URL="http://${SERVER_IP}:80/player"
   ```

3. **Verificar se há múltiplas chamadas ao Chromium:**
   ```bash
   # Verificar processos do Chromium
   ps aux | grep chromium
   
   # Verificar scripts de autostart
   ls -la ~/.config/autostart/
   cat ~/.config/autostart/kiosk.sh
   ```

4. **Reiniciar ambiente gráfico:**
   ```bash
   sudo systemctl restart lightdm
   ```

---

## 🔍 **Verificação**

### **1. Verificar Script de Autostart:**
```bash
# Ver conteúdo do script
cat ~/.config/autostart/kiosk.sh

# Verificar se há IP fixo
grep -i "192.168.1.102" ~/.config/autostart/kiosk.sh
```

### **2. Verificar Processos do Chromium:**
```bash
# Ver processos em execução
ps aux | grep chromium

# Ver comandos completos
ps aux | grep chromium | grep -v grep
```

### **3. Verificar Logs:**
```bash
# Log do kiosk (se criado)
cat /tmp/kiosk.log

# Logs do systemd
sudo journalctl -u lightdm -f
```

---

## 📋 **Estrutura do Script Corrigido**

```bash
#!/bin/bash
# Smart Signage Pro - Script de Inicialização Kiosk

# Aguardar XFCE iniciar completamente
sleep 10

# Esconder cursor após 5 segundos de inatividade
unclutter -idle 5 -root &

# Desabilitar proteção de tela
xset s off
xset -dpms
xset s noblank

# Obter IP do servidor dinamicamente (não usar IP fixo)
SERVER_IP=$(hostname -I | awk '{print $1}')
if [ -z "$SERVER_IP" ] || [ "$SERVER_IP" == "" ]; then
    SERVER_IP="localhost"
fi

# URL do player (sem UIN para entrar em modo demo)
KIOSK_URL="http://${SERVER_IP}:80/player"

# Log para debug
echo "$(date): Iniciando Chromium com URL: $KIOSK_URL" >> /tmp/kiosk.log

# Iniciar navegador em modo kiosk
chromium-browser \
    --kiosk \
    --no-first-run \
    --disable-infobars \
    --disable-session-crashed-bubble \
    --disable-restore-session-state \
    --start-maximized \
    --incognito \
    --disable-translate \
    --disable-features=TranslateUI \
    --noerrdialogs \
    --disable-web-security \
    --disable-dev-shm-usage \
    --autoplay-policy=no-user-gesture-required \
    "$KIOSK_URL" &
```

---

## ✅ **Checklist de Verificação**

- [x] Script de instalação corrigido
- [x] Script de correção criado
- [x] Detecção dinâmica de IP implementada
- [x] Documentação criada
- [ ] Testar em servidor real (requer acesso ao servidor)

---

## 🎯 **Arquivos Modificados**

1. `install-smartsignage.sh` - Corrigido para detectar IP dinamicamente
2. `scripts/fix-kiosk-url.sh` - Script de correção criado
3. `docs/CORRECAO_KIOSK_CHROMIUM.md` - Esta documentação

---

## 💡 **Notas Importantes**

1. **IP Dinâmico:** O script agora detecta o IP a cada inicialização, não fixa no momento da instalação
2. **Modo Demo:** A URL está configurada para `/player` sem UIN, então entrará em modo demo automaticamente
3. **Múltiplas Instâncias:** Se houver múltiplas instâncias do Chromium, verifique se há outros scripts de autostart
4. **Logs:** O script cria log em `/tmp/kiosk.log` para debug

---

**Correção aplicada e documentada!**

