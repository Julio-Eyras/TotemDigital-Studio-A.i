# PROPOSTA COMERCIAL
## Script de Exportação de Banco de Dados para Excel

---

**Empresa:** [NOME DA EMPRESA]  
**Cliente:** [NOME DO CLIENTE]  
**Data:** [DATA]  
**Proposta Nº:** PRO-2025-001  
**Validade:** 30 dias  

---

## 1. APRESENTAÇÃO

A presente proposta tem como objetivo apresentar o desenvolvimento de uma **solução automatizada para exportação de dados de banco de dados para planilhas Excel**, utilizando PowerShell e configuração JSON para máxima flexibilidade e reutilização.

### 1.1. Objetivo do Projeto

Desenvolver um script PowerShell que permita:
- Conectar-se a múltiplos bancos de dados (PostgreSQL, SQL Server, MySQL)
- Executar uma lista configurável de queries SQL
- Exportar os resultados para planilhas Excel organizadas
- Parametrizar toda a configuração via arquivo JSON
- Gerar logs detalhados de execução

---

## 2. ESCOPO DO PROJETO

### 2.1. Funcionalidades Principais

#### ✅ **Módulo de Conexão com Banco de Dados**
- Suporte a múltiplos provedores:
  - PostgreSQL
  - SQL Server
  - MySQL
  - SQLite (opcional)
- Gerenciamento de conexões (pooling)
- Tratamento de erros de conexão
- Retry automático em falhas temporárias
- Validação de credenciais antes da execução

#### ✅ **Módulo de Execução de Queries**
- Leitura de queries a partir de arquivo JSON
- Suporte a múltiplas queries em uma única execução
- Execução sequencial com tratamento individual de erros
- Validação básica de sintaxe SQL
- Suporte a queries parametrizadas (variáveis)
- Timeout configurável por query

#### ✅ **Módulo de Exportação para Excel**
- Exportação para formato XLSX (Excel 2007+)
- Criação de múltiplas planilhas (sheets) por arquivo
- Formatação automática:
  - Cabeçalhos em negrito
  - Ajuste automático de largura de colunas
  - Filtros automáticos
  - Formatação de datas e números
- Nomenclatura automática com timestamp
- Organização de arquivos por data

#### ✅ **Sistema de Configuração JSON**
- Arquivo de configuração principal (`config.json`)
- Configuração de banco de dados
- Lista de queries com metadados
- Configurações de exportação
- Validação de estrutura JSON

#### ✅ **Sistema de Logging**
- Logs em console (com cores)
- Logs em arquivo (formato texto)
- Níveis de log (Info, Warning, Error, Debug)
- Rastreamento de execução por query
- Estatísticas de execução (tempo, registros)

#### ✅ **Tratamento de Erros**
- Captura de erros por query
- Continuidade mesmo em caso de falha parcial
- Relatório de erros detalhado
- Logs de troubleshooting

### 2.2. Estrutura de Arquivos

```
export-db-to-excel/
├── Export-DbToExcel.ps1          (Script principal)
├── config.json                    (Configuração principal)
├── queries.json                   (Queries SQL - opcional)
├── README.md                      (Documentação de uso)
├── modules/
│   ├── DatabaseConnection.psm1   (Módulo de conexão)
│   ├── ExcelExport.psm1           (Módulo de exportação)
│   └── Logger.psm1                (Módulo de logging)
├── logs/                          (Logs gerados)
└── exports/                        (Arquivos Excel gerados)
```

### 2.3. Exemplo de Configuração JSON

```json
{
  "database": {
    "provider": "PostgreSQL",
    "host": "localhost",
    "port": 5432,
    "database": "smartsignage",
    "username": "user",
    "password": "pass",
    "connectionTimeout": 30,
    "sslMode": "Prefer"
  },
  "export": {
    "outputDirectory": "./exports",
    "fileFormat": "xlsx",
    "timestampSuffix": true,
    "dateFormat": "yyyyMMdd_HHmmss",
    "createSubfolders": true
  },
  "queries": [
    {
      "name": "totems_ativos",
      "description": "Lista todos os totens ativos",
      "sql": "SELECT * FROM totems WHERE active = true",
      "sheetName": "Totens Ativos",
      "fileName": "totens_ativos.xlsx",
      "timeout": 60
    },
    {
      "name": "registros_24h",
      "description": "Registros das últimas 24 horas",
      "sql": "SELECT * FROM totems WHERE created_at >= NOW() - INTERVAL '24 hours'",
      "sheetName": "Registros 24h",
      "fileName": "registros_24h.xlsx"
    }
  ],
  "logging": {
    "level": "Info",
    "logToFile": true,
    "logDirectory": "./logs",
    "maxLogFiles": 10
  }
}
```

---

## 3. ENTREGÁVEIS

### 3.1. Código e Arquivos

- ✅ Script PowerShell principal (`Export-DbToExcel.ps1`)
- ✅ Módulos PowerShell reutilizáveis (Database, Excel, Logger)
- ✅ Arquivo de configuração template (`config.json`)
- ✅ Arquivo de queries exemplo (`queries.json`)
- ✅ Scripts de exemplo de uso
- ✅ Código fonte comentado e organizado

### 3.2. Documentação

- ✅ **Manual Técnico** (README.md)
  - Instalação e requisitos
  - Configuração passo a passo
  - Estrutura de arquivos JSON
  - Exemplos de uso
  - Troubleshooting

- ✅ **Manual do Usuário**
  - Como configurar o banco de dados
  - Como criar queries
  - Como executar o script
  - Como interpretar os logs
  - Como personalizar a exportação

- ✅ **Documentação de API** (para módulos)
  - Funções disponíveis
  - Parâmetros e retornos
  - Exemplos de código

### 3.3. Suporte e Treinamento

- ✅ **1 sessão de treinamento** (2 horas) via videoconferência
- ✅ **30 dias de suporte** após entrega (via email)
- ✅ **Documentação de FAQ** (perguntas frequentes)

---

## 4. CRONOGRAMA

| Fase | Atividades | Prazo | Status |
|------|-----------|-------|--------|
| **Fase 1** | Análise de requisitos e setup inicial | 2 dias | ⏳ |
| **Fase 2** | Desenvolvimento dos módulos (Database, Excel, Logger) | 4 dias | ⏳ |
| **Fase 3** | Desenvolvimento do script principal | 3 dias | ⏳ |
| **Fase 4** | Testes e validação | 2 dias | ⏳ |
| **Fase 5** | Documentação e treinamento | 2 dias | ⏳ |
| **Fase 6** | Entrega e suporte inicial | 1 dia | ⏳ |
| **TOTAL** | | **14 dias úteis** | |

**Prazo estimado:** 14 dias úteis (aproximadamente 3 semanas)

---

## 5. INVESTIMENTO

### 5.1. Valor do Projeto

**Valor Total:** R$ 4.200,00 (Quatro mil e duzentos reais)

### 5.2. Forma de Pagamento

- **50% no início do projeto** (R$ 2.100,00)
- **50% na entrega** (R$ 2.100,00)

### 5.3. Incluso no Valor

- ✅ Desenvolvimento completo da solução
- ✅ Código fonte comentado
- ✅ Documentação técnica e manual do usuário
- ✅ 1 sessão de treinamento (2 horas)
- ✅ 30 dias de suporte após entrega
- ✅ Correções de bugs durante o período de suporte

### 5.4. Não Incluído (Extras)

- ❌ Suporte além de 30 dias (R$ 150,00/hora)
- ❌ Desenvolvimento de novas funcionalidades (orçamento separado)
- ❌ Instalação/configuração no ambiente do cliente
- ❌ Suporte em horário comercial estendido

---

## 6. CONDIÇÕES COMERCIAIS

### 6.1. Contrato

- Contrato de prestação de serviços será firmado antes do início
- Definição clara de escopo e entregáveis
- Cláusulas de confidencialidade e propriedade intelectual

### 6.2. Propriedade Intelectual

- Código fonte será entregue ao cliente
- Cliente terá direito de uso, modificação e distribuição
- Desenvolvedor mantém direito de reutilizar módulos genéricos

### 6.3. Garantias

- **Garantia de 30 dias** para correção de bugs
- Correções serão feitas sem custo adicional
- Melhorias e novas funcionalidades fora do escopo serão orçadas separadamente

### 6.4. Suporte

- Suporte via email durante horário comercial
- Tempo de resposta: até 48 horas úteis
- Suporte via videoconferência (agendado) para questões complexas

---

## 7. REQUISITOS TÉCNICOS

### 7.1. Ambiente do Cliente

- Windows 10/11 ou Windows Server 2016+
- PowerShell 5.1 ou superior
- Módulo ImportExcel (será instalado automaticamente)
- Acesso ao banco de dados (rede/firewall configurado)

### 7.2. Permissões Necessárias

- Permissão de leitura no banco de dados
- Permissão de escrita em diretório de exportação
- Permissão de execução de scripts PowerShell

---

## 8. BENEFÍCIOS DA SOLUÇÃO

✅ **Automação completa** - Reduz trabalho manual  
✅ **Flexibilidade** - Configuração via JSON, sem alterar código  
✅ **Reutilizável** - Funciona com múltiplos bancos e queries  
✅ **Escalável** - Fácil adicionar novas queries  
✅ **Confiável** - Tratamento robusto de erros e logs detalhados  
✅ **Manutenível** - Código limpo e documentado  

---

## 9. PRÓXIMOS PASSOS

1. **Aprovação da proposta** pelo cliente
2. **Assinatura do contrato** e NDA (se necessário)
3. **Pagamento inicial** (50%)
4. **Kick-off meeting** (reunião inicial de alinhamento)
5. **Início do desenvolvimento**

---

## 10. CONTATO E ACEITE

**Desenvolvedor:** [NOME]  
**E-mail:** [EMAIL]  
**Telefone:** [TELEFONE]  
**Empresa:** [NOME DA EMPRESA]  
**CNPJ:** [CNPJ]  

---

### ACEITE DA PROPOSTA

**Cliente:** _________________________________  
**Nome:** _________________________________  
**Cargo:** _________________________________  
**Data:** ___/___/_______  
**Assinatura:** _________________________________  

---

**Esta proposta tem validade de 30 dias a partir da data de emissão.**

---

*Documento gerado em: [DATA]*


