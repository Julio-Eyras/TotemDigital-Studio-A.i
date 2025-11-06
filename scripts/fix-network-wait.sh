#!/bin/bash

# ================================================================
# Corrige demora no boot causada por systemd-networkd-wait-online
# em servidores que usam Wi-Fi (sem cabo Ethernet).
# Também permite restaurar o estado original com a opção "--undo"
# ---------------------------------------------------------------
# Autor: Julio César Eyras (SmartDisplay Project)
# ================================================================

NETPLAN_FILE=$(find /etc/netplan -type f -name "*.yaml" | head -n 1)
BACKUP_FILE="${NETPLAN_FILE}.bak_before_fix"

# Função: Corrigir o problema
apply_fix() {
  echo "🚀 Aplicando correção de boot lento (network-wait)..."

  echo "→ Desabilitando e mascarando systemd-networkd-wait-online.service"
  sudo systemctl disable systemd-networkd-wait-online.service >/dev/null 2>&1
  sudo systemctl mask systemd-networkd-wait-online.service >/dev/null 2>&1

  if [ -z "$NETPLAN_FILE" ]; then
    echo "⚠️ Nenhum arquivo YAML encontrado em /etc/netplan/"
  else
    echo "→ Arquivo Netplan detectado: $NETPLAN_FILE"

    # Faz backup se ainda não existir
    if [ ! -f "$BACKUP_FILE" ]; then
      sudo cp "$NETPLAN_FILE" "$BACKUP_FILE"
      echo "💾 Backup criado: $BACKUP_FILE"
    fi

    # Adiciona optional: true se não existir
    if grep -q "optional:" "$NETPLAN_FILE"; then
      echo "✅ 'optional' já presente — nenhuma modificação feita."
    else
      echo "→ Adicionando 'optional: true' ao Netplan..."
      sudo sed -i '/dhcp4:[[:space:]]*true/ a \      optional: true' "$NETPLAN_FILE"
    fi

    echo "→ Aplicando alterações de rede..."
    sudo netplan apply
  fi

  echo "✅ Correção aplicada com sucesso!"
  echo "⏱️ Tempo atual de boot:"
  systemd-analyze
}

# Função: Restaurar configuração original
undo_fix() {
  echo "♻️ Restaurando configuração original..."
  
  echo "→ Reabilitando systemd-networkd-wait-online.service"
  sudo systemctl unmask systemd-networkd-wait-online.service >/dev/null 2>&1
  sudo systemctl enable systemd-networkd-wait-online.service >/dev/null 2>&1

  if [ -f "$BACKUP_FILE" ]; then
    echo "→ Restaurando backup original do Netplan..."
    sudo cp "$BACKUP_FILE" "$NETPLAN_FILE"
    sudo netplan apply
    echo "✅ Netplan restaurado de $BACKUP_FILE"
  else
    echo "⚠️ Nenhum backup encontrado em $BACKUP_FILE — nada a restaurar."
  fi

  echo "✅ Restauração concluída!"
}

# Execução principal
if [ "$1" == "--undo" ]; then
  undo_fix
else
  apply_fix
fi

