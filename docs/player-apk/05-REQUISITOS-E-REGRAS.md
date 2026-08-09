# Player-AD — Requisitos e regras

## Requisitos mínimos

- Android 7.0 / API 24 ou superior;
- rede HTTPS estável e relógio sincronizado;
- armazenamento suficiente para APK, cache e backup;
- permissão para instalação de pacote no método adotado;
- acesso ao domínio do servidor e aos endpoints `/api/player/*`.

## Regras de identidade

- Package obrigatório: `br.com.smartchannel.playerad`.
- UIN e Device ID devem ser normalizados em maiúsculas.
- Um dispositivo não deve reutilizar identidade de outro TV Box.

## Regras de release

- Uma única versão designada por plataforma e canal.
- Produção aceita somente pacote ativo.
- Nunca substituir silenciosamente o arquivo de uma release já registrada.
- SHA-256, versão, build, commit e certificado devem acompanhar o artefato.
- Não designar versão sem homologação física.

## Segurança

- APK e documentos são entregues por rotas autenticadas.
- Tokens não devem ser gravados em URLs ou logs.
- O certificado de assinatura deve permanecer compatível com a frota.
- Downloads e mudanças de designação devem ser auditáveis.
