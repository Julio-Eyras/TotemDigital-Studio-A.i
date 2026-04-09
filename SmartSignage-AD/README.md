# SmartSignage-AD

Novo workspace para versao Android-first do ecossistema SmartSignage.

Este diretorio foi criado para evoluir uma stack consolidada com:

- app Android (player + operacao local);
- backend local embarcado (quando necessario);
- frontend administrativo para operacao/manutencao;
- configuracao e scripts de deploy.

## Estrutura inicial

- `app/` - modulo do app Android (cliente principal)
- `backend-local/` - servicos locais/API leve para modo standalone
- `frontend/` - interface administrativa (embarcada/remota)
- `config/` - configuracoes padrao e ambiente
- `scripts/` - instalacao, build, deploy e operacao
- `docs/` - arquitetura e manuais

## Fluxo final recomendado

1. Build/install local no dispositivo Android:

```powershell
cd C:\SmartSignage-Pro\SmartSignage-AD
.\instalar-dispositivo.cmd
```

2. Gerar manual PDF operacional:

```powershell
python .\tools\generate-manual-operacional-pdf.py
```

3. Preparar kit de distribuicao:

```powershell
.\scripts\prepare-distribution-kit.ps1
```

Kit final:

- `install-pendrive-smartsignage-ad/`

## Objetivo

Manter o `SmartSignage-AD` separado dos players por plataforma (`Player-AD`, `Player-WOS`, `Player-LXN`) para permitir evolucao de produto completo de forma modular.
