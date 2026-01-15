# Scripts de Teste - Player Client

## Testes de Integração Dispatcher

### test-dispatcher-integration.js

Testa a integração completa do dispatcher com cache local.

**Uso:**
```bash
# Teste padrão (Android)
node test-dispatcher-integration.js

# Teste para webOS
node test-dispatcher-integration.js --platform=webos

# Teste para Tizen
node test-dispatcher-integration.js --platform=tizen

# Com variáveis de ambiente
TOTEM_UIN=MY_TOTEM_UIN API_BASE_URL=http://192.168.1.100:3000 node test-dispatcher-integration.js
```

**Variáveis de Ambiente:**
- `API_BASE_URL` - URL base da API (padrão: http://localhost:3000)
- `TOTEM_UIN` - UIN do totem para teste (padrão: TEST_TOTEM_001)
- `DEVICE_ID` - ID do dispositivo (padrão: gerado automaticamente)
- `PLATFORM` - Plataforma (android, webos, tizen)

**Testes Executados:**
1. Obter token de dispositivo (`/api/player/token`)
2. Obter DispatchPlan (`/api/player/dispatch`)
3. Validar estrutura do DispatchPlan
4. Testar modo offline (simulado)
5. Enviar heartbeat com deviceId (`/api/player/heartbeat`)

**Saída:**
- ✓ Teste passou
- ✗ Teste falhou
- ⚠ Aviso (teste pulado ou informação)

**Exit Code:**
- `0` - Todos os testes passaram
- `1` - Um ou mais testes falharam

## Testes de Cache Local

### test-cache-local.js (Futuro)

Testa o sistema de cache local em cada plataforma.

**Planejado:**
- Download de mídias
- Validação de checksums
- Política LRU
- Modo offline
- Limpeza de cache

## Testes de Servidor HTTP Local

### test-local-server.js (Futuro)

Testa o servidor HTTP local em totens.

**Planejado:**
- Inicialização do servidor
- Servir mídias do cache
- Suporte a Range requests
- Health check endpoint
- CORS headers
