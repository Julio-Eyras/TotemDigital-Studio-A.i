# 📊 Export-DbToExcel

Script PowerShell para exportação automatizada de dados de banco de dados para planilhas Excel com formatação profissional.

---

## 🎯 Características

- ✅ **Múltiplos Bancos:** PostgreSQL, SQL Server, MySQL, SQLite
- ✅ **Formatação Automática:** Excel profissional com cabeçalhos, filtros e formatação
- ✅ **Configuração Flexível:** Via arquivo JSON, sem alterar código
- ✅ **Múltiplas Queries:** Execute múltiplas queries em uma única execução
- ✅ **Logging Completo:** Logs em console e arquivo com níveis configuráveis
- ✅ **Tratamento de Erros:** Robusto e resiliente, continua mesmo em falhas parciais

---

## 📋 Requisitos

### Sistema Operacional
- Windows 10/11 ou Windows Server 2016+

### Software
- PowerShell 5.1 ou superior
- .NET Framework 4.7.2 ou superior

### Módulos PowerShell
- `ImportExcel` (será instalado automaticamente se ausente)

### Banco de Dados
- PostgreSQL 10+ (com Npgsql)
- SQL Server 2012+ (com módulo SqlServer)
- MySQL 5.7+ (com driver MySQL .NET)
- SQLite 3+ (com driver System.Data.SQLite)

---

## 🚀 Instalação

### 1. Baixar o Script

Clone ou baixe o repositório:

```powershell
git clone <repository-url>
cd export-db-to-excel
```

### 2. Instalar Módulos Necessários

O script instalará automaticamente o módulo `ImportExcel` se necessário. Para instalação manual:

```powershell
Install-Module -Name ImportExcel -Scope CurrentUser -Force
```

### 3. Configurar

Edite o arquivo `config.json` com suas configurações de banco de dados e queries.

---

## ⚙️ Configuração

### Arquivo config.json

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
    "createSubfolders": true,
    "applyFormatting": true
  },
  "queries": [
    {
      "name": "totems_ativos",
      "description": "Lista todos os totens ativos",
      "sql": "SELECT * FROM totems WHERE active = true",
      "sheetName": "Totens Ativos",
      "fileName": "totems_ativos",
      "timeout": 60,
      "enabled": true
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

### Estrutura de Configuração

#### Database
- **provider:** Tipo de banco (PostgreSQL, SQLServer, MySQL, SQLite)
- **host:** Endereço do servidor
- **port:** Porta do banco
- **database:** Nome do banco de dados
- **username:** Usuário
- **password:** Senha
- **connectionTimeout:** Timeout de conexão em segundos (padrão: 30)
- **sslMode:** Modo SSL (apenas PostgreSQL: Disable, Prefer, Require)

#### Export
- **outputDirectory:** Diretório para salvar arquivos Excel
- **fileFormat:** Formato de arquivo (atualmente apenas "xlsx")
- **timestampSuffix:** Adicionar timestamp ao nome do arquivo
- **dateFormat:** Formato de data para timestamp (padrão: "yyyyMMdd_HHmmss")
- **createSubfolders:** Criar subpastas por data (YYYY/MM/DD)
- **applyFormatting:** Aplicar formatação automática

#### Queries
- **name:** Nome único da query (obrigatório)
- **description:** Descrição da query (opcional)
- **sql:** Query SQL a ser executada (obrigatório)
- **sheetName:** Nome da planilha no Excel (obrigatório)
- **fileName:** Nome base do arquivo (obrigatório)
- **timeout:** Timeout da query em segundos (padrão: 60)
- **enabled:** Se a query está habilitada (padrão: true)
- **parameters:** Parâmetros para query parametrizada (opcional)

#### Logging
- **level:** Nível de log (Debug, Info, Warning, Error)
- **logToFile:** Se deve salvar logs em arquivo
- **logDirectory:** Diretório para salvar logs
- **maxLogFiles:** Número máximo de arquivos de log a manter

---

## 📖 Uso

### Execução Básica

```powershell
.\Export-DbToExcel.ps1
```

Executa todas as queries configuradas em `config.json`.

### Executar Query Específica

```powershell
.\Export-DbToExcel.ps1 -QueryName "totems_ativos"
```

Executa apenas a query especificada.

### Modo Verbose

```powershell
.\Export-DbToExcel.ps1 -Verbose
```

Executa com logs detalhados (nível Debug).

### Diretório Customizado

```powershell
.\Export-DbToExcel.ps1 -OutputDir "C:\Exports\Custom"
```

Sobrescreve o diretório de saída configurado.

### Sem Formatação

```powershell
.\Export-DbToExcel.ps1 -NoFormatting
```

Desabilita a formatação automática do Excel.

### Modo Dry-Run

```powershell
.\Export-DbToExcel.ps1 -DryRun
```

Executa sem salvar arquivos (apenas valida e testa queries).

### Arquivo de Configuração Customizado

```powershell
.\Export-DbToExcel.ps1 -ConfigFile "config-prod.json"
```

Usa arquivo de configuração diferente.

### Nível de Log Customizado

```powershell
.\Export-DbToExcel.ps1 -LogLevel Debug
```

Define nível de log específico.

---

## 📊 Exemplos de Uso

### Exemplo 1: Exportação Diária

Configurar no Task Scheduler para executar diariamente:

```
Task Scheduler → Criar Tarefa Básica
Programa: powershell.exe
Argumentos: -File "C:\Scripts\Export-DbToExcel.ps1"
Agendamento: Diário às 8:00
```

### Exemplo 2: Exportação de Múltiplas Queries

Configure múltiplas queries no `config.json`:

```json
{
  "queries": [
    {
      "name": "relatorio_vendas",
      "sql": "SELECT * FROM vendas WHERE data >= CURRENT_DATE",
      "sheetName": "Vendas Hoje",
      "fileName": "vendas_hoje"
    },
    {
      "name": "relatorio_clientes",
      "sql": "SELECT * FROM clientes WHERE ativo = true",
      "sheetName": "Clientes Ativos",
      "fileName": "clientes_ativos"
    }
  ]
}
```

### Exemplo 3: Query com Parâmetros

```json
{
  "queries": [
    {
      "name": "vendas_periodo",
      "sql": "SELECT * FROM vendas WHERE data BETWEEN @dataInicio AND @dataFim",
      "parameters": {
        "dataInicio": "2025-01-01",
        "dataFim": "2025-12-31"
      }
    }
  ]
}
```

---

## 🔍 Troubleshooting

### Erro: "Módulo ImportExcel não encontrado"

**Solução:**
```powershell
Install-Module -Name ImportExcel -Scope CurrentUser -Force
```

### Erro: "Provider não suportado"

**Solução:** Verifique se o provider está correto no `config.json`:
- PostgreSQL
- SQLServer
- MySQL
- SQLite

### Erro: "Falha ao conectar ao banco de dados"

**Solução:**
- Verifique se o servidor está acessível
- Verifique credenciais no `config.json`
- Verifique firewall e portas
- Teste conectividade: `Test-NetConnection -ComputerName <host> -Port <port>`

### Erro: "Query falhou"

**Solução:**
- Verifique sintaxe SQL
- Teste a query diretamente no banco
- Verifique permissões do usuário
- Veja logs detalhados com `-Verbose`

### Arquivo Excel não é criado

**Solução:**
- Verifique permissões de escrita no diretório de saída
- Verifique espaço em disco
- Execute com `-Verbose` para ver detalhes
- Verifique logs em `./logs/`

---

## 📝 Logs

### Localização dos Logs

Logs são salvos em: `./logs/export_YYYYMMDD_HHmmss.log`

### Níveis de Log

- **Debug:** Todas as informações (muito detalhado)
- **Info:** Informações gerais (padrão)
- **Warning:** Avisos e erros
- **Error:** Apenas erros

### Formato dos Logs

```
[2025-11-03 14:30:22] [INFO] Conectando ao banco de dados...
[2025-11-03 14:30:23] [SUCCESS] Conexão estabelecida
[2025-11-03 14:30:24] [INFO] Executando query: totems_ativos
[2025-11-03 14:30:25] [SUCCESS] Query executada: 150 registros em 1.2s
```

---

## 🛠️ Estrutura de Arquivos

```
export-db-to-excel/
├── Export-DbToExcel.ps1          (Script principal)
├── config.json                    (Configuração)
├── README.md                      (Documentação)
├── modules/
│   ├── Logger.psm1               (Módulo de logging)
│   ├── DatabaseConnection.psm1   (Módulo de conexão)
│   └── ExcelExport.psm1           (Módulo de exportação)
├── logs/                          (Logs gerados)
└── exports/                        (Arquivos Excel gerados)
```

---

## 📚 Documentação Adicional

- **Especificação Funcional:** `docs/ESPECIFICACAO_FUNCIONAL_EXPORT_DB_EXCEL.md`
- **Resumo Executivo:** `docs/RESUMO_EXECUTIVO_CARACTERISTICAS_EXPORT_DB_EXCEL.md`
- **Proposta Comercial:** `docs/PROPOSTA_COMERCIAL_EXPORT_DB_EXCEL.md`

---

## 🐛 Reportar Problemas

Se encontrar problemas ou bugs:

1. Verifique os logs em `./logs/`
2. Execute com `-Verbose` para mais detalhes
3. Verifique a documentação de troubleshooting
4. Abra uma issue no repositório

---

## 📄 Licença

Este script é fornecido "como está", sem garantias. Use por sua conta e risco.

---

## 👥 Autor

**Smart Signage Solutions**

- Versão: 1.0
- Data: 2025-11-03

---

## 🙏 Agradecimentos

- Módulo `ImportExcel` para funcionalidades de Excel
- Comunidade PowerShell por suporte e recursos

---

**Última atualização:** 2025-11-03

