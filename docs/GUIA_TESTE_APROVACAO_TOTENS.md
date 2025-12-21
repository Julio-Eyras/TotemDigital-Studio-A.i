# Guia de Teste - Aprovação de Totens e Funcionalidades

Este guia detalha como testar todas as funcionalidades implementadas relacionadas ao auto-registro, aprovação de totens, geração de config encriptado e saída do kiosk com PIN.

## 📋 Índice

1. [Pré-requisitos](#pré-requisitos)
2. [Teste 1: Auto-Registro de Totem](#teste-1-auto-registro-de-totem)
3. [Teste 2: Interface de Aprovação no Painel Admin](#teste-2-interface-de-aprovação-no-painel-admin)
4. [Teste 3: Geração de Config Encriptado](#teste-3-geração-de-config-encriptado)
5. [Teste 4: Validação de Totem Aprovado](#teste-4-validação-de-totem-aprovado)
6. [Teste 5: PIN 1950 para Saída do Kiosk](#teste-5-pin-1950-para-saída-do-kiosk)
7. [Teste 6: Fluxo Completo End-to-End](#teste-6-fluxo-completo-end-to-end)
8. [Troubleshooting](#troubleshooting)

---

## Pré-requisitos

### Servidor Backend
- ✅ Backend rodando na porta 8080 (ou configurada)
- ✅ Banco de dados PostgreSQL configurado e acessível
- ✅ Variáveis de ambiente configuradas:
  - `TOTEM_SECRET_KEY` (opcional, tem valor padrão)
  - `PLAYER_DIR` (opcional, padrão: `/opt/smart-signage/player-web`)
- ✅ Script `generate-player-config.sh` disponível em `scripts/`

### Frontend Admin
- ✅ Frontend rodando e acessível
- ✅ Usuário admin logado no painel

### Player
- ✅ Player HTML acessível em `http://localhost/player/` (ou URL configurada)
- ✅ Navegador configurado para modo kiosk (opcional, para teste de PIN)

---

## Teste 1: Auto-Registro de Totem

### Objetivo
Validar que um player consegue se auto-registrar no servidor quando não possui UIN configurado.

### Passos

1. **Abrir o player sem UIN**
   ```
   Navegador: http://localhost/player/
   (sem parâmetro ?uin=)
   ```

2. **Verificar console do navegador**
   - Abrir DevTools (F12)
   - Ir para aba "Console"
   - Deve aparecer:
     ```
     🚀 Iniciando Smart Signage Player v2.1...
     ⚠️ UIN não encontrado. Tentando auto-registro...
     📡 Iniciando auto-registro no servidor...
     🔧 Hardware coletado: {...}
     🔑 UIN gerado: SSP-xxxxxxxxxxxx
     ✅ Auto-registro concluído: {...}
     ```

3. **Verificar tela de "Aguardando Aprovação"**
   - Deve exibir mensagem: "Aguardando Aprovação"
   - Deve mostrar UIN gerado
   - Deve informar que está aguardando aprovação do administrador

4. **Verificar no banco de dados**
   ```sql
   SELECT totem_id, identifier, uin, status, config
   FROM totems
   WHERE status = 'pending_approval'
   ORDER BY created_at DESC
   LIMIT 1;
   ```
   - `status` deve ser `'pending_approval'`
   - `uin` deve começar com `'SSP-'`
   - `config` deve conter informações de hardware

### Resultado Esperado
✅ Totem criado com status `pending_approval`  
✅ UIN gerado automaticamente baseado em hardware  
✅ Tela de "Aguardando Aprovação" exibida no player  
✅ Hardware info armazenado no campo `config`

---

## Teste 2: Interface de Aprovação no Painel Admin

### Objetivo
Validar que o administrador consegue visualizar e aprovar totens pendentes.

### Passos

1. **Acessar painel admin**
   ```
   URL: http://localhost:8080/
   Login: admin / admin123
   ```

2. **Navegar para Totens**
   - Clicar em "Totens" no menu lateral
   - Deve exibir aba "Pendentes de Aprovação" com badge contando totens pendentes

3. **Visualizar totens pendentes**
   - Clicar na aba "Pendentes de Aprovação"
   - Deve listar totens com status `pending_approval`
   - Cards devem ter borda laranja/amarela destacada
   - Deve mostrar:
     - Nome/Identifier do totem
     - UIN
     - Informações de hardware (se disponíveis)
     - Botão "Aprovar"

4. **Aprovar totem**
   - Clicar no botão "Aprovar" de um totem pendente
   - Diálogo deve abrir mostrando:
     - Nome do totem
     - UIN
     - Localização (se disponível)
     - Informações de hardware
     - Checkbox "Gerar arquivo de configuração encriptado" (marcado por padrão)
   - Clicar em "Aprovar Totem"
   - Deve mostrar mensagem de sucesso

5. **Verificar atualização**
   - Totem deve desaparecer da aba "Pendentes"
   - Totem deve aparecer na aba "Todos os Totems" com status `online`
   - Badge de contagem deve diminuir

### Resultado Esperado
✅ Totens pendentes listados na aba dedicada  
✅ Diálogo de aprovação funcional  
✅ Totem aprovado muda status para `online`  
✅ Interface atualiza automaticamente após aprovação

---

## Teste 3: Geração de Config Encriptado

### Objetivo
Validar que o arquivo de configuração encriptado é gerado corretamente durante a aprovação.

### Passos

1. **Aprovar totem com geração de config**
   - No diálogo de aprovação, deixar checkbox "Gerar arquivo de configuração encriptado" marcado
   - Clicar em "Aprovar Totem"
   - Mensagem de sucesso deve mencionar o caminho do arquivo gerado

2. **Verificar arquivo gerado**
   ```bash
   # Verificar se arquivo existe
   ls -la /opt/smart-signage/player-web/config.json.enc
   
   # Verificar conteúdo (deve ser JSON válido)
   cat /opt/smart-signage/player-web/config.json.enc
   ```
   - Arquivo deve existir
   - Deve ter permissões 600 (apenas owner pode ler)
   - Deve conter:
     ```json
     {
       "encrypted": true,
       "version": "1.0",
       "data": "<base64_encrypted_data>",
       "mac": "<MAC_ADDRESS>",
       "created": "<timestamp>"
     }
     ```

3. **Testar desencriptação (opcional)**
   ```bash
   # Tentar desencriptar usando OpenSSL
   SECRET_KEY="smart-signage-totem-secret-key-2025-change-in-production"
   DATA=$(cat /opt/smart-signage/player-web/config.json.enc | jq -r '.data')
   echo -n "$DATA" | openssl enc -aes-256-cbc -d -base64 -salt -pbkdf2 -iter 10000 -k "$SECRET_KEY"
   ```
   - Deve retornar: `UIN:MAC:TIMESTAMP`

### Resultado Esperado
✅ Arquivo `config.json.enc` criado no diretório do player  
✅ Arquivo com permissões corretas (600)  
✅ Conteúdo JSON válido com dados encriptados  
✅ MAC address correto no arquivo

---

## Teste 4: Validação de Totem Aprovado

### Objetivo
Validar que totem aprovado consegue validar e carregar playlist normalmente.

### Passos

1. **Aprovar totem** (se ainda não aprovado)
   - Seguir passos do Teste 2

2. **Abrir player com UIN do totem aprovado**
   ```
   URL: http://localhost/player/?uin=SSP-xxxxxxxxxxxx
   (substituir pelo UIN real)
   ```

3. **Verificar validação**
   - Console do navegador deve mostrar:
     ```
     ✅ Totem validado: {...}
     📋 Comandos pendentes: 0
     🎬 Playlist: {...}
     ```

4. **Verificar se player sai da tela de aprovação**
   - Se estava na tela "Aguardando Aprovação", deve recarregar automaticamente
   - Deve iniciar reprodução normal (se houver playlist)

5. **Verificar API de validação**
   ```bash
   curl -X GET "http://localhost:8080/api/player/validate?uin=SSP-xxxxxxxxxxxx" \
     -H "Content-Type: application/json"
   ```
   - Deve retornar `200 OK`
   - `valid: true`
   - `totem.status` deve ser `'online'` (não `'pending_approval'`)

### Resultado Esperado
✅ Totem aprovado valida com sucesso  
✅ Player sai da tela de aprovação automaticamente  
✅ Playlist carrega normalmente (se configurada)  
✅ API retorna status correto

---

## Teste 5: PIN 1950 para Saída do Kiosk

### Objetivo
Validar que o PIN 1950 permite sair do modo kiosk.

### Passos

1. **Abrir player em modo kiosk**
   ```
   Navegador: http://localhost/player/?uin=SSP-xxxxxxxxxxxx
   (ou abrir em modo fullscreen - F11)
   ```

2. **Ativar menu de PIN**
   - Clicar com botão direito 5 vezes em 2 segundos
   - Deve aparecer prompt: "Digite o PIN (4 dígitos):"

3. **Testar PIN incorreto**
   - Digitar PIN errado (ex: `1234`)
   - Clicar OK
   - Deve mostrar: "PIN incorreto."
   - Player deve continuar rodando

4. **Testar PIN correto**
   - Clicar com botão direito 5 vezes novamente
   - Digitar PIN: `1950`
   - Clicar OK
   - Deve mostrar: "PIN correto. Saindo do player e retornando ao ambiente gráfico..."
   - Deve chamar API `/api/player/exit-kiosk`

5. **Verificar comando no backend**
   - Logs do backend devem mostrar:
     ```
     ✅ Comando executado para sair do kiosk: pkill -f chromium
     ```

6. **Verificar comportamento do navegador**
   - Navegador deve tentar fechar (se permitido)
   - Ou deve redirecionar para `/player/exit`

### Resultado Esperado
✅ 5 cliques direito ativam prompt de PIN  
✅ PIN incorreto mostra erro mas não sai  
✅ PIN correto (1950) executa saída do kiosk  
✅ Backend executa comandos para fechar navegador  
✅ Comando registrado nos logs

---

## Teste 6: Fluxo Completo End-to-End

### Objetivo
Testar todo o fluxo desde o auto-registro até a reprodução normal.

### Passos

1. **Limpar dados de teste anteriores**
   ```sql
   -- Remover totens de teste (cuidado!)
   DELETE FROM totems WHERE uin LIKE 'SSP-%';
   ```

2. **Auto-registrar totem**
   - Abrir player sem UIN: `http://localhost/player/`
   - Verificar console: deve auto-registrar
   - Anotar UIN gerado

3. **Verificar no painel admin**
   - Login no painel admin
   - Ir em "Totens" → "Pendentes de Aprovação"
   - Deve aparecer o totem recém-registrado

4. **Aprovar totem**
   - Clicar em "Aprovar"
   - Marcar "Gerar arquivo de configuração encriptado"
   - Clicar "Aprovar Totem"
   - Verificar sucesso

5. **Verificar player atualiza automaticamente**
   - Player deve recarregar automaticamente (após ~30 segundos)
   - Deve sair da tela de aprovação
   - Deve tentar validar e carregar playlist

6. **Testar PIN 1950**
   - Clicar direito 5 vezes
   - Digitar `1950`
   - Verificar saída do kiosk

7. **Verificar logs**
   ```bash
   # Backend logs
   tail -f backend/logs/*.log
   
   # Verificar se há erros
   grep -i "erro\|error" backend/logs/*.log
   ```

### Resultado Esperado
✅ Fluxo completo funciona sem erros  
✅ Player auto-registra → Admin aprova → Player ativa → PIN funciona  
✅ Logs não mostram erros críticos  
✅ Todas as APIs respondem corretamente

---

## Troubleshooting

### Problema: Player não auto-registra

**Sintomas:**
- Player fica em tela de loading
- Console mostra erro de conexão

**Soluções:**
1. Verificar se backend está rodando: `curl http://localhost:8080/api/health`
2. Verificar CORS no backend
3. Verificar firewall/network
4. Verificar console do navegador para erros específicos

---

### Problema: Totem não aparece na lista de pendentes

**Sintomas:**
- Totem foi criado no banco mas não aparece no frontend

**Soluções:**
1. Verificar se API `/api/totems/pending` retorna dados:
   ```bash
   curl -H "Authorization: Bearer <token>" http://localhost:8080/api/totems/pending
   ```
2. Verificar se usuário tem permissão de admin
3. Verificar console do navegador para erros
4. Limpar cache do navegador

---

### Problema: Aprovação falha

**Sintomas:**
- Erro ao clicar em "Aprovar Totem"
- Mensagem de erro no frontend

**Soluções:**
1. Verificar logs do backend:
   ```bash
   tail -f backend/logs/*.log
   ```
2. Verificar se totem ainda está com status `pending_approval`:
   ```sql
   SELECT totem_id, status FROM totems WHERE totem_id = <id>;
   ```
3. Verificar permissões do usuário logado
4. Verificar se script `generate-player-config.sh` existe e tem permissão de execução

---

### Problema: Config encriptado não é gerado

**Sintomas:**
- Aprovação funciona mas arquivo não é criado
- Mensagem não menciona caminho do arquivo

**Soluções:**
1. Verificar se checkbox estava marcado
2. Verificar permissões do diretório do player:
   ```bash
   ls -la /opt/smart-signage/player-web/
   chmod 755 /opt/smart-signage/player/
   ```
3. Verificar se script existe:
   ```bash
   ls -la scripts/generate-player-config.sh
   chmod +x scripts/generate-player-config.sh
   ```
4. Verificar logs do backend para erros específicos

---

### Problema: PIN 1950 não funciona

**Sintomas:**
- Clicar direito 5 vezes não mostra prompt
- Prompt aparece mas PIN não funciona

**Soluções:**
1. Verificar se cliques são rápidos (dentro de 2 segundos)
2. Verificar console do navegador para erros JavaScript
3. Verificar se player está em modo kiosk (alguns navegadores bloqueiam eventos)
4. Testar com DevTools aberto para ver logs
5. Verificar se API `/api/player/exit-kiosk` está acessível:
   ```bash
   curl -X POST http://localhost:8080/api/player/exit-kiosk \
     -H "Content-Type: application/json" \
     -d '{"uin":"SSP-xxx","token":"xxx"}'
   ```

---

### Problema: Player não atualiza após aprovação

**Sintomas:**
- Totem aprovado mas player continua na tela de aprovação

**Soluções:**
1. Verificar se verificação automática está funcionando (deve rodar a cada 30s)
2. Verificar console do navegador para erros
3. Verificar se API `/api/player/validate` retorna status correto:
   ```bash
   curl "http://localhost:8080/api/player/validate?uin=SSP-xxx"
   ```
4. Recarregar página manualmente (F5)

---

## Checklist Final

Após todos os testes, verificar:

- [ ] Auto-registro funciona
- [ ] Totens pendentes aparecem no painel
- [ ] Aprovação funciona
- [ ] Config encriptado é gerado (se marcado)
- [ ] Totem aprovado valida corretamente
- [ ] Player sai da tela de aprovação automaticamente
- [ ] PIN 1950 funciona
- [ ] Fluxo completo end-to-end funciona
- [ ] Logs não mostram erros críticos
- [ ] Performance está adequada

---

## Notas Adicionais

### Variáveis de Ambiente Importantes

```bash
# Backend
TOTEM_SECRET_KEY=smart-signage-totem-secret-key-2025-change-in-production
PLAYER_DIR=/opt/smart-signage/player-web
GENERATE_CONFIG_SCRIPT=/opt/smart-signage/scripts/generate-player-config.sh
```

### URLs de Teste

- **Player**: `http://localhost/player/`
- **Player com UIN**: `http://localhost/player/?uin=SSP-xxx`
- **Admin Panel**: `http://localhost:8080/`
- **API Health**: `http://localhost:8080/api/health`

### Comandos Úteis

```bash
# Ver totens pendentes no banco
psql -d smart_signage -c "SELECT totem_id, identifier, uin, status FROM totems WHERE status = 'pending_approval';"

# Ver logs do backend
tail -f backend/logs/*.log

# Testar API de validação
curl "http://localhost:8080/api/player/validate?uin=SSP-xxx"

# Testar API de registro
curl -X POST http://localhost:8080/api/player/register \
  -H "Content-Type: application/json" \
  -d '{"uin":"SSP-TEST","hardware":{"macAddress":"00:00:00:00:00:00","hostname":"test"}}'
```

---

**Última atualização**: 2025-11-04  
**Versão**: 2.1.0

