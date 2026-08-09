# Player-AD — Fluxo de funcionamento

```text
Inicialização
  → carrega configuração e identidade
  → autentica e envia heartbeat
  → recebe agenda, comandos e versão do plano
  → baixa/valida mídias necessárias
  → reproduz o plano
  → envia início/fim/erro
  → repete heartbeat adaptativo
```

## Tela ativa

O heartbeat começa na cadência configurada e aumenta gradualmente quando não há
mudanças. O dispatch completo é buscado somente quando a versão do plano muda,
quando chega comando de atualização ou como proteção de segurança.

## Tela desligada por agenda

A reprodução para, a fila é preparada para reiniciar pela primeira mídia e o
processo permanece vivo. O heartbeat utiliza o perfil reduzido, continua
recebendo comandos e informa `displayIdle=true`.

## Atualização OTA

```text
Admin ativa e designa APK
  → heartbeat oferece a versão
  → player verifica elegibilidade
  → download autenticado
  → valida SHA-256
  → solicita instalação Android
  → reporta estado
  → reinicia e confirma nova versão no heartbeat
```
