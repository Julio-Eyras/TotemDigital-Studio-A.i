# Guia de Testes - Android TV Player

## Testes Locais (Emulador)

### 1. Criar AVD (Android Virtual Device)

```bash
# No Android Studio
# Tools → Device Manager → Create Device
# Selecionar TV (Android TV)
# API 24+ (Android 7.0+)
```

### 2. Executar App

```bash
./gradlew installDebug
# ou via Android Studio: Run → Run 'app'
```

### 3. Ver Logs

```bash
adb logcat | grep SmartSignage
# ou
adb logcat | grep -E "PlayerViewModel|APIClient|MediaPlayer"
```

## Testes em Dispositivo Real

### Pré-requisitos

1. Dispositivo Android TV conectado via USB ou ADB over network
2. Depuração USB habilitada
3. Dispositivo autorizado para depuração

### Passos

1. **Conectar Dispositivo**
   ```bash
   adb devices
   ```

2. **Instalar App**
   ```bash
   ./gradlew installDebug
   ```

3. **Ver Logs**
   ```bash
   adb logcat | grep SmartSignage
   ```

## Cenários de Teste

### 1. Autenticação

- [ ] Totem autentica corretamente
- [ ] Token é armazenado
- [ ] Falha de autenticação é tratada
- [ ] Reconexão automática funciona

### 2. Playlist

- [ ] Playlist carrega do servidor
- [ ] Atualização periódica funciona
- [ ] Playlist vazia é tratada
- [ ] Erro ao carregar playlist é tratado

### 3. Reprodução de Mídia

- [ ] Vídeo reproduz corretamente (ExoPlayer)
- [ ] Imagem exibe corretamente
- [ ] HTML/Web carrega corretamente
- [ ] Duração é respeitada
- [ ] Próximo item carrega automaticamente

### 4. Agendamento

- [ ] Itens são filtrados por horário
- [ ] Itens são filtrados por dia da semana
- [ ] Itens são filtrados por data
- [ ] Timezone é respeitado

### 5. Heartbeat

- [ ] Heartbeat é enviado periodicamente
- [ ] Reconexão funciona após falha
- [ ] Métricas são enviadas

### 6. Erros

- [ ] Erros são logados localmente
- [ ] Erros são enviados ao backend
- [ ] Erros críticos são tratados
- [ ] Aplicativo se recupera de erros

### 7. Android TV Específico

- [ ] Modo landscape funciona
- [ ] Controle via D-pad funciona
- [ ] Leanback UI funciona
- [ ] App aparece na launcher do Android TV

## Checklist de Deploy

Antes de fazer deploy em produção:

- [ ] Todos os testes passam
- [ ] Configuração está correta
- [ ] APK assinado corretamente
- [ ] ProGuard configurado (release)
- [ ] Documentação atualizada
- [ ] Logs verificados
- [ ] Performance aceitável
- [ ] Testado em dispositivos reais

