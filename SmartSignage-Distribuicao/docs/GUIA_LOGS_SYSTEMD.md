# 📋 Guia Completo: Onde Estão os Logs do Smart Signage Pro

## 🎯 Resumo Rápido

Os logs do serviço `smart-signage` são armazenados no **journald do systemd** e podem ser acessados usando o comando `journalctl`.

---

## 📍 Onde os Logs Estão Armazenados

### 1. **Journald (Sistema de Logs do systemd)**

Os logs do serviço `smart-signage` são gerenciados pelo **systemd journald** e estão armazenados em:

```
/var/log/journal/
```

**Nota:** Este diretório pode não estar visível diretamente porque:
- É um diretório binário (não texto puro)
- Requer permissões de root para acessar
- É gerenciado pelo systemd

### 2. **Configuração do Serviço**

O arquivo de serviço (`/etc/systemd/system/smart-signage.service`) está configurado com:

```ini
StandardOutput=journal
StandardError=journal
```

Isso significa que:
- ✅ **stdout** (saída padrão) → vai para o journald
- ✅ **stderr** (erros) → vai para o journald
- ✅ Todos os `console.log()` e `console.error()` do Node.js aparecem nos logs

---

## 🔍 Como Acessar os Logs

### **Comando Principal:**

```bash
sudo journalctl -u smart-signage -f
```

**O que faz:**
- `-u smart-signage` → Filtra apenas logs do serviço `smart-signage`
- `-f` → **Follow** (segue os logs em tempo real, como `tail -f`)

---

## 📊 Comandos Úteis de Logs

### **1. Ver logs em tempo real (seguir logs):**
```bash
sudo journalctl -u smart-signage -f
```
*Use `Ctrl+C` para sair*

### **2. Ver últimas 100 linhas:**
```bash
sudo journalctl -u smart-signage -n 100
```

### **3. Ver logs desde hoje:**
```bash
sudo journalctl -u smart-signage --since today
```

### **4. Ver logs das últimas 2 horas:**
```bash
sudo journalctl -u smart-signage --since "2 hours ago"
```

### **5. Ver logs de um período específico:**
```bash
# Últimas 30 minutos
sudo journalctl -u smart-signage --since "30 minutes ago"

# Desde uma data específica
sudo journalctl -u smart-signage --since "2025-11-15 10:00:00"

# Entre duas datas
sudo journalctl -u smart-signage --since "2025-11-15 10:00:00" --until "2025-11-15 12:00:00"
```

### **6. Ver apenas erros (mensagens com "❌"):**
```bash
sudo journalctl -u smart-signage | grep "❌"
```

### **7. Ver logs com mais detalhes (verbose):**
```bash
sudo journalctl -u smart-signage -f --no-pager
```

### **8. Ver logs em formato JSON (para scripts):**
```bash
sudo journalctl -u smart-signage -o json
```

### **9. Ver logs com timestamps:**
```bash
sudo journalctl -u smart-signage -f --no-pager | while read line; do echo "[$(date '+%Y-%m-%d %H:%M:%S')] $line"; done
```

### **10. Salvar logs em arquivo:**
```bash
sudo journalctl -u smart-signage --since "1 hour ago" > /tmp/smart-signage-logs.txt
```

---

## 🔎 Filtrar Logs Específicos

### **Buscar por texto específico:**
```bash
sudo journalctl -u smart-signage | grep "Smart Playlist"
```

### **Buscar por erro:**
```bash
sudo journalctl -u smart-signage | grep -i error
```

### **Buscar por nível de prioridade:**
```bash
# Apenas erros críticos
sudo journalctl -u smart-signage -p err

# Erros e avisos
sudo journalctl -u smart-signage -p warning
```

---

## 📁 Localização Física dos Arquivos

### **Journald Persistente:**

Se o journald estiver configurado para persistência (padrão em sistemas modernos):

```bash
# Verificar se journald está persistindo logs
sudo journalctl --disk-usage

# Localização dos arquivos binários
ls -lh /var/log/journal/
```

### **Estrutura de Diretórios:**

```
/var/log/journal/
├── <machine-id>/
│   ├── system@*.journal
│   └── user-*.journal
```

**Nota:** Não tente ler esses arquivos diretamente! Use sempre `journalctl`.

---

## 🛠️ Verificar Status do Journald

### **Verificar se journald está funcionando:**
```bash
sudo systemctl status systemd-journald
```

### **Verificar espaço usado pelos logs:**
```bash
sudo journalctl --disk-usage
```

### **Limpar logs antigos (manter apenas últimos 7 dias):**
```bash
sudo journalctl --vacuum-time=7d
```

### **Limpar logs acima de um tamanho específico:**
```bash
sudo journalctl --vacuum-size=500M
```

---

## 📝 Exemplos Práticos

### **Exemplo 1: Debug de criação de Smart Playlist**

```bash
# Terminal 1: Seguir logs em tempo real
sudo journalctl -u smart-signage -f

# Terminal 2: Tentar criar Smart Playlist no navegador
# Os logs aparecerão no Terminal 1
```

### **Exemplo 2: Ver erros das últimas 24 horas**

```bash
sudo journalctl -u smart-signage --since "24 hours ago" | grep "❌"
```

### **Exemplo 3: Exportar logs para análise**

```bash
# Exportar logs das últimas 2 horas
sudo journalctl -u smart-signage --since "2 hours ago" > /tmp/smart-signage-debug.log

# Ver o arquivo
cat /tmp/smart-signage-debug.log
```

---

## 🎯 O Que Você Verá nos Logs

Quando você usar `sudo journalctl -u smart-signage -f`, verá:

1. **Logs de inicialização:**
   ```
   [2025-11-15 10:00:00] Smart Signage v2.1 iniciando...
   [2025-11-15 10:00:01] Conectando ao banco de dados...
   [2025-11-15 10:00:02] ✅ Banco de dados conectado
   ```

2. **Logs de requisições HTTP:**
   ```
   [2025-11-15 10:05:23] 📝 [Smart Playlist] Dados recebidos: {...}
   [2025-11-15 10:05:23] 📝 [Smart Playlist] Usuário: {...}
   ```

3. **Logs de erro:**
   ```
   [2025-11-15 10:05:24] ❌ Erro ao criar smart playlist: clientId é obrigatório
   [2025-11-15 10:05:24] ❌ Stack trace: Error: ...
   ```

4. **Logs do sistema:**
   ```
   [2025-11-15 10:10:00] Serviço reiniciado
   ```

---

## ⚠️ Troubleshooting

### **Problema: "No journal files were found"**

**Solução:**
```bash
# Verificar se journald está rodando
sudo systemctl status systemd-journald

# Se não estiver, iniciar
sudo systemctl start systemd-journald
sudo systemctl enable systemd-journald
```

### **Problema: Logs não aparecem**

**Solução:**
```bash
# Verificar se o serviço está rodando
sudo systemctl status smart-signage

# Verificar se há logs recentes
sudo journalctl -u smart-signage --since "5 minutes ago"

# Verificar configuração do serviço
sudo cat /etc/systemd/system/smart-signage.service | grep -E "(StandardOutput|StandardError)"
```

### **Problema: Logs muito antigos não aparecem**

**Solução:**
```bash
# Verificar configuração de retenção
sudo journalctl --disk-usage

# Se necessário, aumentar retenção
sudo nano /etc/systemd/journald.conf
# Alterar: SystemMaxRetentionSec=1month
```

---

## 📚 Referências

- **Documentação do systemd journald:** `man journalctl`
- **Arquivo de serviço:** `/etc/systemd/system/smart-signage.service`
- **Configuração do journald:** `/etc/systemd/journald.conf`

---

## ✅ Resumo Final

| O que você quer fazer | Comando |
|----------------------|---------|
| Ver logs em tempo real | `sudo journalctl -u smart-signage -f` |
| Ver últimas 100 linhas | `sudo journalctl -u smart-signage -n 100` |
| Ver logs desde hoje | `sudo journalctl -u smart-signage --since today` |
| Ver apenas erros | `sudo journalctl -u smart-signage \| grep "❌"` |
| Salvar logs em arquivo | `sudo journalctl -u smart-signage > logs.txt` |

**Localização física:** `/var/log/journal/` (arquivos binários do systemd)

**Acesso recomendado:** Sempre use `journalctl`, nunca tente ler os arquivos `.journal` diretamente!

