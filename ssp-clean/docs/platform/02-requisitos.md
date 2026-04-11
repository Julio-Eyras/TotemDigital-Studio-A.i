# Requisitos do Sistema - SmartSignage Pro

## Requisitos de Hardware

### Servidor Mínimo

- **CPU**: 2 cores (2.0 GHz+)
- **RAM**: 4 GB
- **Disco**: 50 GB (SSD recomendado)
- **Rede**: 100 Mbps

### Servidor Recomendado

- **CPU**: 4+ cores (2.4 GHz+)
- **RAM**: 8+ GB
- **Disco**: 200+ GB SSD
- **Rede**: 1 Gbps

### Servidor para Produção (Alto Volume)

- **CPU**: 8+ cores (3.0 GHz+)
- **RAM**: 16+ GB
- **Disco**: 500+ GB SSD (ou SAN)
- **Rede**: 10 Gbps
- **Backup**: Sistema de backup dedicado

## Requisitos de Software

### Sistema Operacional

**Suportado:**
- Ubuntu 20.04 LTS ou superior
- Ubuntu 22.04 LTS (recomendado)
- Debian 11 ou superior
- CentOS 8+ / Rocky Linux 8+

**Não Suportado:**
- Windows Server (sem suporte oficial)
- macOS Server (apenas desenvolvimento)

### Banco de Dados

- **PostgreSQL**: 12+ (recomendado: 14+)
- **Extensões**: pg_trgm (para busca), uuid-ossp

### Runtime

- **Node.js**: 18.x ou superior (recomendado: 20.x LTS)
- **npm**: 9+ ou **yarn**: 1.22+

### Servidor Web

- **Nginx**: 1.18+ (recomendado: 1.24+)
- **OpenSSL**: 1.1.1+ (para HTTPS)

### Outros

- **Git**: 2.25+
- **curl**: 7.68+
- **build-essential**: Para compilar dependências nativas

## Requisitos de Rede

### Portas Necessárias

- **80**: HTTP (Nginx)
- **443**: HTTPS (Nginx)
- **3000**: Backend API (interno, pode ser diferente)
- **5432**: PostgreSQL (interno, apenas localhost)

### Firewall

```bash
# Portas abertas
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
```

### DNS

- Domínio configurado (opcional, mas recomendado)
- Registros A/AAAA apontando para IP do servidor
- Certificado SSL (Let's Encrypt recomendado)

## Requisitos de Storage

### Mídias

- **Espaço**: Depende do volume de mídias
- **Estimativa**: ~100 MB por vídeo (30s, 1080p)
- **Recomendação**: 500 GB+ para produção

### Banco de Dados

- **Espaço Inicial**: ~1 GB (schema + dados iniciais)
- **Crescimento**: ~100 MB/mês (estimativa média)
- **Logs**: ~500 MB/mês (depende do volume)

### Backups

- **Espaço**: 2-3x o tamanho do banco
- **Retenção**: 30 dias recomendado
- **Localização**: Servidor separado ou cloud storage

## Requisitos de Totens (Players)

### Hardware Mínimo

- **CPU**: Dual-core 1.5 GHz+
- **RAM**: 2 GB
- **Disco**: 8 GB (para cache)
- **Rede**: Wi-Fi ou Ethernet
- **Display**: Resolução mínima 1920x1080

### Navegadores Suportados

- **Chrome/Chromium**: 90+ (recomendado)
- **Firefox**: 88+
- **Safari**: 14+ (macOS/iOS)
- **Edge**: 90+

### Sistemas Operacionais

- **Linux**: Ubuntu, Debian, Raspberry Pi OS
- **Windows**: Windows 10/11
- **Android**: Android 8+
- **WebOS**: LG WebOS 5.0+
- **Tizen**: Samsung Tizen 5.0+

## Requisitos de Desenvolvimento

### Ferramentas

- **Editor**: VS Code, Cursor, ou similar
- **Git**: Para controle de versão
- **Docker**: Opcional, para desenvolvimento local
- **Postman/Insomnia**: Para testar API

### Dependências de Desenvolvimento

- **Node.js**: 18+ (mesmo do servidor)
- **PostgreSQL**: 12+ (local ou Docker)
- **npm/yarn**: Para instalar dependências

## Requisitos de Segurança

### SSL/TLS

- **Certificado**: Válido e não expirado
- **Versão TLS**: 1.2+ (recomendado: 1.3)
- **Cipher Suites**: Configuração segura

### Firewall

- **Regras**: Apenas portas necessárias abertas
- **Fail2ban**: Recomendado para proteção SSH
- **DDoS**: Proteção contra ataques (opcional)

### Backup

- **Frequência**: Diário (recomendado)
- **Retenção**: 30 dias mínimo
- **Teste**: Restore testado regularmente

## Requisitos de Performance

### Tempo de Resposta

- **API**: < 200ms (p95)
- **Frontend**: < 2s (carregamento inicial)
- **Player**: < 1s (obter plano)

### Throughput

- **API**: 100+ requisições/segundo
- **Concorrência**: 50+ usuários simultâneos
- **Players**: 100+ totens simultâneos

### Disponibilidade

- **Uptime**: 99.5%+ (recomendado: 99.9%)
- **MTTR**: < 1 hora (tempo médio de recuperação)
- **Monitoramento**: 24/7 recomendado

## Requisitos de Conformidade

### LGPD/GDPR

- **Dados Pessoais**: Tratamento conforme LGPD
- **Consentimento**: Registro de consentimentos
- **Acesso**: Direito ao acesso e exclusão
- **Auditoria**: Logs de acesso e alterações

### Acessibilidade

- **WCAG**: Nível AA recomendado
- **Navegação**: Suporte a teclado
- **Contraste**: Contraste adequado de cores

## Checklist de Instalação

- [ ] Servidor com requisitos mínimos atendidos
- [ ] Sistema operacional suportado instalado
- [ ] PostgreSQL 12+ instalado e configurado
- [ ] Node.js 18+ instalado
- [ ] Nginx instalado e configurado
- [ ] Portas de firewall configuradas
- [ ] Domínio e DNS configurados (opcional)
- [ ] Certificado SSL instalado (recomendado)
- [ ] Backup configurado
- [ ] Monitoramento configurado (opcional)

## Próximos Passos

- [Instalação](../technical/04-instalacao.md) - Guia de instalação
- [Configuração](./03-configuracao.md) - Configurações detalhadas
- [Arquitetura](./01-arquitetura.md) - Arquitetura do sistema
