# Testes - SmartSignage LG Player HLS

## Teste no Navegador

Para testar o código sem precisar do emulador webOS:

1. Abra `test-browser.html` em um navegador moderno (Chrome, Firefox, Edge)
2. A página irá:
   - Mockar as APIs do webOS
   - Carregar todos os scripts
   - Permitir testar cada componente individualmente
   - Exibir logs no console

## Teste no Emulador webOS

Para teste completo:

1. Instale o webOS SDK
2. Execute o emulador: `ares-install` e `ares-launch`
3. Use os scripts em `scripts/`:
   ```bash
   ./scripts/build.sh
   ./scripts/deploy.sh <device-name>
   ```

## Teste Manual

### 1. DeviceInfoService
- Deve coletar informações do hardware
- Deve gerar UIN único
- Deve salvar no localStorage

### 2. HLSPlayer
- Deve criar elemento video
- Deve reproduzir streams HLS
- Watchdog deve detectar freezes

### 3. CommandFetcher
- Deve fazer polling a cada 15s
- Deve processar comandos recebidos

### 4. HeartbeatService
- Deve enviar heartbeat a cada 30s
- Deve incluir status e uptime

### 5. FallbackManager
- Deve ativar fallback quando stream falha
- Deve tentar retornar ao stream principal

## Problemas Conhecidos

### webOS APIs
Algumas APIs podem não estar disponíveis em todas as versões:
- `webOS.systemInfo` - pode variar entre versões
- MAC Address pode não ser acessível via API padrão
- Serial Number pode requerer permissões especiais

### Fallbacks Necessários
O código já implementa fallbacks para:
- APIs não disponíveis → retorna 'unknown'
- localStorage não disponível → usa memória
- Streams indisponíveis → ativa fallback local

