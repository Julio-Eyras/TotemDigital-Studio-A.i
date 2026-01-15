# 🧪 Guia Rápido de Teste

## Teste no Navegador (Sem Emulador)

### Passo 1: Abrir o arquivo de teste

1. Navegue até: `player-client/platforms/webos/SmartSignage-LG-PLAYER-HLS/test/`
2. Abra `test-browser.html` no seu navegador (Chrome, Firefox, Edge)
3. Abra o DevTools (F12) para ver os logs do console

### Passo 2: Testar Componentes

Na página de teste, você pode testar cada componente individualmente:

1. **Mock webOS** - Clique em "Inicializar Mock webOS"
2. **DeviceInfo** - Clique em "Testar DeviceInfo"
3. **Player** - Clique em "Testar com HLS Stream" (usa stream público de teste)
4. **CommandFetcher** - Clique em "Testar CommandFetcher" (precisa de backend rodando)
5. **Heartbeat** - Clique em "Testar Heartbeat" (precisa de backend rodando)
6. **Fallback** - Clique em "Testar Fallback"

### Passo 3: Verificar Resultados

- ✅ Verde = Sucesso
- ❌ Vermelho = Erro
- ⚠️ Laranja = Aviso
- 🔵 Azul = Informação

Todos os logs aparecem no console no final da página.

---

## ⚠️ Limitações do Teste no Navegador

### O que FUNCIONA:
- ✅ Estrutura do código
- ✅ Lógica JavaScript
- ✅ Classes e métodos
- ✅ Integração entre componentes
- ✅ Player HLS (streams públicos)

### O que NÃO funciona (precisa webOS real):
- ❌ APIs do webOS (`webOS.systemInfo`)
- ❌ Integração real com backend (sem CORS configurado)
- ❌ Modo kiosk
- ❌ Auto-launch
- ❌ Hardware decoding (mas player funciona normalmente)

---

## 🔧 Teste com Backend Local

Para testar integração completa:

1. **Inicie o backend:**
   ```bash
   cd backend
   npm start
   ```

2. **Configure CORS** (se necessário) no backend para aceitar requisições de `file://` ou `localhost`

3. **Abra o teste** e use:
   - API URL: `http://localhost:3000/api`

---

## 📱 Teste no Emulador webOS (Recomendado)

Para teste completo, use o emulador webOS:

### Pré-requisitos:
1. Instalar webOS SDK
2. Configurar dispositivo no `ares-setup-device`

### Build e Deploy:
```bash
cd player-client/platforms/webos/SmartSignage-LG-PLAYER-HLS

# Build
./scripts/build.sh

# Deploy
./scripts/deploy.sh <device-name>
```

### Ver logs:
```bash
ares-log -d <device-name>
```

---

## ✅ Checklist de Validação

- [ ] DeviceInfo coleta hardware corretamente
- [ ] UIN é gerado único
- [ ] Player reproduz HLS
- [ ] Watchdog detecta problemas
- [ ] CommandFetcher faz polling
- [ ] Heartbeat envia status
- [ ] Fallback ativa quando necessário
- [ ] App inicializa completamente
- [ ] localStorage funciona
- [ ] Erros são tratados graciosamente

---

## 🐛 Problemas Comuns

### "webOS não definido"
- ✅ Normal no navegador - use o Mock
- ✅ No webOS real, deve estar disponível

### "CORS error"
- Configure CORS no backend
- Ou teste via emulador webOS

### "fetch failed"
- Backend não está rodando
- Ou URL incorreta

### "localStorage não disponível"
- webOS pode ter restrições
- Código já tem fallback

