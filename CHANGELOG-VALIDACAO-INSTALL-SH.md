# Changelog - Validação Automática no install-smartsignage.sh

**Data:** 2026-01-02  
**Versão do Script:** 2.1.6  
**Versão do Sistema:** 2.1.0

---

## 📋 **Resumo das Alterações**

Foi adicionada validação automática completa do sistema ao script `install-smartsignage.sh`, similar à validação implementada nos scripts do Windows (`VALIDAR-SISTEMA.ps1`).

---

## ✨ **Nova Funcionalidade**

### **Função `validate_system_complete()`**

Nova função que executa validação automática completa do sistema após a instalação, incluindo:

#### **1. Validações de Conectividade**
- ✅ Backend Health Check (`/api/health/check` ou `/api/health`)
- ✅ Frontend acessível (porta varia conforme modo: 80, 8080 ou 3001)

#### **2. Validações de API Detalhadas**
- ✅ Health Check API completo (com extração de status JSON)
- ✅ Verificação de status do banco de dados via Health Check
- ✅ API Docs acessível (`/api-docs` ou `/api/docs.json`)

#### **3. Validações de Banco de Dados**
- ✅ PostgreSQL container rodando (modo Docker)
- ✅ PostgreSQL serviço ativo (modo Single-Server)
- ✅ Conexão ao banco de dados (teste direto com `psql`)
- ✅ Leitura de configurações do `.env`

#### **4. Validações de Logs**
- ✅ Análise de logs do backend
- ✅ Detecção de erros críticos (FATAL, CRITICAL, ECONNREFUSED, etc.)
- ✅ Suporte para Docker (logs via `docker compose logs`)
- ✅ Suporte para Single-Server (logs via arquivo `app.log`)

#### **5. Validações de Portas**
- ✅ Porta 3000 (Backend) em uso
- ✅ Porta do Frontend em uso (varia conforme modo)
- ✅ Uso de `ss` ou `netstat` conforme disponibilidade

#### **6. Relatório Final**
- ✅ Contadores de testes (total, aprovados, falhados)
- ✅ Taxa de sucesso (%)
- ✅ Lista de erros encontrados
- ✅ Relatório salvo em arquivo: `validacao-sistema-YYYYMMDD-HHMMSS.txt`

---

## 🔄 **Integração no Fluxo de Instalação**

A função `validate_system_complete()` é chamada automaticamente após `test_endpoints()` nos seguintes pontos:

1. **Após rebuild com preservação de dados** (linha ~8978)
2. **Após rebuild automático durante instalação Docker** (linha ~9036)
3. **Após instalação completa** (linha ~9049)

---

## 📊 **Exemplo de Saída**

```
===> 6. Relatorio Final

========================================
RESUMO DA VALIDACAO
========================================

Total de testes: 12
Testes aprovados: 11
Testes falhados: 1
Taxa de sucesso: 91.67%

SERVICOS:
- Backend: http://192.168.1.100:3000
- Frontend: http://192.168.1.100:80
- IP do Servidor: 192.168.1.100

ERROS ENCONTRADOS:
Logs sem erros criticos: Encontrados erros criticos

========================================
SISTEMA VALIDADO COM SUCESSO!
========================================
```

---

## 📝 **Relatório Gerado**

Após cada execução, um relatório detalhado é salvo em:

```
$INSTALL_DIR/validacao-sistema-YYYYMMDD-HHMMSS.txt
```

O relatório contém:
- Data e hora da validação
- Versão do sistema
- Modo de instalação (docker/single-server/development)
- Resumo completo de testes
- Lista de erros encontrados
- URLs dos serviços

---

## 🔧 **Compatibilidade**

A validação funciona em todos os modos de instalação:
- ✅ **Docker** - Valida containers, logs do Docker, portas
- ✅ **Single-Server** - Valida serviços systemd, logs de arquivo, portas
- ✅ **Development** - Valida processos locais, portas de desenvolvimento

---

## 🎯 **Benefícios**

1. **Validação Automática:** Não requer intervenção manual
2. **Detecção de Erros:** Identifica problemas logo após a instalação
3. **Relatório Detalhado:** Arquivo de log para análise posterior
4. **Não Bloqueante:** Falhas na validação não interrompem a instalação
5. **Compatível:** Funciona em todos os modos de instalação

---

## 📚 **Scripts Relacionados**

- `VALIDAR-SISTEMA.sh` - Script standalone de validação (Linux)
- `VALIDAR-SISTEMA.ps1` - Script standalone de validação (Windows)
- `EXECUTAR-E-VALIDAR.sh` - Wrapper que executa e valida (Linux)

---

**Última atualização:** 2026-01-02  
**Versão:** 1.0.0

