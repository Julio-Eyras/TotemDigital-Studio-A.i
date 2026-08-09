# Player-AD — Workflow operacional

## Publicação de uma versão

1. Atualizar `versionName` e `versionCode`.
2. Executar testes unitários e `assembleRelease`.
3. Validar package, certificado, versão e SHA-256.
4. Instalar por ADB em um TV Box de homologação.
5. Validar reprodução, agenda, heartbeat, comandos e retomada.
6. Enviar o APK ao módulo OTA como rascunho.
7. Testar em canal controlado.
8. Ativar e designar explicitamente a versão para `android/production`.
9. Acompanhar download, instalação, reinício e versão reportada.

## Critérios de aprovação

- build reproduzível e identificado pelo commit;
- nenhum crash durante o ciclo de homologação;
- atualização sobreposta preserva configuração;
- SHA-256 do servidor igual ao artefato aprovado;
- certificado igual ao da frota instalada;
- documentação atualizada.

## Rollback

Pause imediatamente a versão problemática, designe novamente o último pacote
aprovado e execute rollback assistido. Android não permite downgrade silencioso
em todos os aparelhos; valide o procedimento por modelo.
