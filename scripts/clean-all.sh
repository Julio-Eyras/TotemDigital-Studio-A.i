#!/bin/bash
# Smart Signage Pro v2.0 - Script de Limpeza Total
# Remove TODOS os containers, imagens, volumes, redes Docker e diretórios do projeto

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

banner() {
  clear
  echo -e "${RED}╔══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${RED}║                    ⚠️  ATENÇÃO CRÍTICA ⚠️                     ║${NC}"
  echo -e "${RED}╚══════════════════════════════════════════════════════════════╝${NC}"
  echo
  echo -e "${RED}            Smart Signage Pro - LIMPEZA TOTAL${NC}"
  echo
}

confirm() {
  echo -e "${RED}═══════════════════════════════════════════════════════════════${NC}"
  echo -e "${RED}Este script irá realizar uma LIMPEZA TOTAL do ambiente Docker e${NC}"
  echo -e "${RED}dos diretórios do projeto Smart Signage Pro. Isso inclui:${NC}"
  echo
  echo -e "${RED}  ❌ Todos os containers Docker (em execução ou parados)${NC}"
  echo -e "${RED}  ❌ Todas as imagens Docker (incluindo as do Smart Signage Pro)${NC}"
  echo -e "${RED}  ❌ Todos os volumes Docker (banco de dados, uploads, backups, etc.)${NC}"
  echo -e "${RED}  ❌ Todas as redes Docker não utilizadas${NC}"
  echo -e "${RED}  ❌ Cache de build do Docker${NC}"
  echo -e "${RED}  ❌ O diretório de instalação do projeto: /opt/smart-signage${NC}"
  echo
  echo -e "${RED}⚠️  ESTA AÇÃO É IRREVERSÍVEL E RESULTARÁ NA PERDA DE TODOS OS DADOS!${NC}"
  echo -e "${RED}═══════════════════════════════════════════════════════════════${NC}"
  echo
  read -r -p "Digite exatamente 'APAGAR TUDO' para confirmar: " CONF
  if [[ "${CONF:-}" != "APAGAR TUDO" ]]; then
    echo -e "${GREEN}Limpeza cancelada pelo usuário.${NC}"
    exit 0
  fi
}

clean_compose() {
  echo -e "${YELLOW}[1/8]${NC} Derrubando stacks docker-compose se existir..."
  if [[ -d "/opt/smart-signage" ]]; then
    cd /opt/smart-signage 2>/dev/null && {
      if command -v docker &> /dev/null && docker compose version &> /dev/null; then
        docker compose down --volumes --remove-orphans 2>/dev/null || true
      elif command -v docker-compose &> /dev/null; then
        docker-compose down --volumes --remove-orphans 2>/dev/null || true
      fi
    } || true
  fi
  echo -e "${GREEN}✅ Docker Compose derrubado${NC}"
}

clean_containers() {
  echo -e "${YELLOW}[2/8]${NC} Parando e removendo todos os containers..."
  docker ps -aq 2>/dev/null | xargs -r docker stop 2>/dev/null || true
  docker ps -aq 2>/dev/null | xargs -r docker rm -f 2>/dev/null || true
  echo -e "${GREEN}✅ Todos os containers removidos${NC}"
}

clean_images() {
  echo -e "${YELLOW}[3/8]${NC} Removendo todas as imagens Docker..."
  docker images -aq 2>/dev/null | xargs -r docker rmi -f 2>/dev/null || true
  docker image prune -af 2>/dev/null || true
  echo -e "${GREEN}✅ Todas as imagens removidas${NC}"
}

clean_volumes() {
  echo -e "${YELLOW}[4/8]${NC} Removendo volumes Docker (${RED}DADOS SERÃO PERDIDOS${NC})..."
  docker volume prune -af 2>/dev/null || true
  echo -e "${GREEN}✅ Todos os volumes removidos${NC}"
}

clean_networks() {
  echo -e "${YELLOW}[5/8]${NC} Removendo redes Docker não utilizadas..."
  docker network prune -f 2>/dev/null || true
  echo -e "${GREEN}✅ Redes removidas${NC}"
}

clean_build_cache() {
  echo -e "${YELLOW}[6/8]${NC} Limpando cache de build do Docker..."
  docker builder prune -af 2>/dev/null || true
  echo -e "${GREEN}✅ Cache de build limpo${NC}"
}

system_prune() {
  echo -e "${YELLOW}[7/8]${NC} Limpando sistema Docker completamente..."
  docker system prune -af --volumes 2>/dev/null || true
  echo -e "${GREEN}✅ Sistema Docker limpo${NC}"
}

remove_dirs() {
  echo -e "${YELLOW}[8/8]${NC} Removendo diretórios do projeto..."
  
  if [[ -d "/opt/smart-signage" ]]; then
    echo -e "${YELLOW}Removendo /opt/smart-signage...${NC}"
    sudo rm -rf /opt/smart-signage || {
      echo -e "${RED}⚠️  Não foi possível remover com sudo, tentando sem...${NC}"
      rm -rf /opt/smart-signage 2>/dev/null || true
    }
    echo -e "${GREEN}✅ /opt/smart-signage removido${NC}"
  else
    echo -e "${BLUE}   Diretório /opt/smart-signage não encontrado${NC}"
  fi
  
  # Verificar outros diretórios possíveis
  if [[ -d "$HOME/smartsignage-pro" ]] || [[ -d "$HOME/smart-signage" ]] || [[ -d "$HOME/smartsignage-pro-main" ]]; then
    echo
    echo -e "${CYAN}Diretórios encontrados no home:${NC}"
    [[ -d "$HOME/smartsignage-pro" ]] && echo "  - $HOME/smartsignage-pro"
    [[ -d "$HOME/smart-signage" ]] && echo "  - $HOME/smart-signage"
    [[ -d "$HOME/smartsignage-pro-main" ]] && echo "  - $HOME/smartsignage-pro-main"
    echo
    read -r -p "Remover também esses diretórios? (y/N): " RMD
    if [[ "${RMD:-}" =~ ^([yY][eE][sS]|[yY])$ ]]; then
      [[ -d "$HOME/smartsignage-pro" ]] && rm -rf "$HOME/smartsignage-pro" && echo -e "${GREEN}✅ $HOME/smartsignage-pro removido${NC}"
      [[ -d "$HOME/smart-signage" ]] && rm -rf "$HOME/smart-signage" && echo -e "${GREEN}✅ $HOME/smart-signage removido${NC}"
      [[ -d "$HOME/smartsignage-pro-main" ]] && rm -rf "$HOME/smartsignage-pro-main" && echo -e "${GREEN}✅ $HOME/smartsignage-pro-main removido${NC}"
    else
      echo -e "${BLUE}   Diretórios no home mantidos${NC}"
    fi
  fi
}

main() {
  banner
  confirm
  
  echo
  echo -e "${CYAN}Iniciando limpeza total...${NC}"
  echo
  
  clean_compose
  sleep 1
  
  clean_containers
  sleep 1
  
  clean_images
  sleep 1
  
  clean_volumes
  sleep 1
  
  clean_networks
  sleep 1
  
  clean_build_cache
  sleep 1
  
  system_prune
  sleep 1
  
  remove_dirs
  
  echo
  echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║              ✅ LIMPEZA TOTAL CONCLUÍDA! ✅                ║${NC}"
  echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
  echo
  echo -e "${GREEN}O ambiente está completamente limpo e pronto para uma nova instalação.${NC}"
  echo
}

main "$@"


