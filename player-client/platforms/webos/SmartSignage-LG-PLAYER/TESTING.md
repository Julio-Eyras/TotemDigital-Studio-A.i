# Guia de Testes - webOS Player

## Testes Locais (Emulador)

### 1. Iniciar Emulador

```bash
ares-setup-device
ares-launch --device emulator
```

### 2. Instalar App

```bash
npm run build
npm run install emulator
```

### 3. Ver Logs

```bash
ares-log --device emulator --follow
```

## Testes em TV Real

### Pré-requisitos

1. TV na mesma rede do computador
2. Modo desenvolvedor ativado na TV
3. IP da TV conhecido

### Passos

1. **Descobrir IP da TV**
   - Menu → Configurações → Rede → Informações de Rede

2. **Instalar App**
   ```bash
   export TV_IP=192.168.1.100
   npm run install $TV_IP
   ```

3. **Ver Logs**
   ```bash
   ares-log --device $TV_IP --follow
   ```

## Cenários de Teste

### 1. Autenticação

- [ ] Totem autentica corretamente
- [ ] Token é armazenado
- [ ] Falha de autenticação é tratada
- [ ] Reconexão automática funciona

### 2. Playlist

- [ ] Playlist carrega do servidor
- [ ] Cache local funciona
- [ ] Atualização periódica funciona
- [ ] Playlist vazia é tratada
- [ ] Erro ao carregar playlist é tratado

### 3. Reprodução de Mídia

- [ ] Vídeo reproduz corretamente
- [ ] Imagem exibe corretamente
- [ ] HTML/Web carrega corretamente
- [ ] Transições funcionam
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

### 7. APIs webOS

- [ ] Controle de brilho funciona
- [ ] Tela permanece ligada
- [ ] Modo kiosk funciona

## Checklist de Deploy

Antes de fazer deploy em produção:

- [ ] Todos os testes passam
- [ ] Configuração está correta
- [ ] Certificado de desenvolvedor válido
- [ ] App assinado corretamente
- [ ] Documentação atualizada
- [ ] Logs verificados
- [ ] Performance aceitável

