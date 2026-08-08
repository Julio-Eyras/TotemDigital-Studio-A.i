# Instalação TotemDigital — índice operacional

Documentação de referência para instalar, atualizar, reparar, apagar e recuperar o TotemDigital nas modalidades suportadas pelo repositório.

**Script oficial do servidor:** `scripts/Instala-TotemDigital-Server.sh`  
**Branch usada nos exemplos:** `TotemDigital-MultiAgencia`  
**Executar como:** utilizador normal com acesso a `sudo` (não iniciar com `sudo bash`)

## Escolha o procedimento

| Necessidade | Documento |
|---|---|
| Produção Direct Totem, instalação nova ou atualização segura | [01-PRODUCAO-DIRECT-TOTEM.md](./01-PRODUCAO-DIRECT-TOTEM.md) |
| DEV e TESTE isolados no mesmo VPS | [02-DEV-TESTE-MULTI-INSTANCIA.md](./02-DEV-TESTE-MULTI-INSTANCIA.md) |
| Reparar, Docker, wipe, backup e restore | [03-MANUTENCAO-BACKUP-RESTORE.md](./03-MANUTENCAO-BACKUP-RESTORE.md) |
| Compilar e instalar Player-AD por ADB ou pendrive | [04-PLAYER-AD.md](./04-PLAYER-AD.md) |

## Modalidades suportadas

| Modo do instalador | Comando-base | Uso |
|---|---|---|
| Instalação | `--modo producao` | Cria uma instalação nova; em produção pode recriar a BD |
| Atualização | `--modo atualizar` | Rebuild e deploy sem apagar a BD |
| Reparação | `--modo reparar` | Corrige `.env`, Nginx, HTTPS e serviço |
| Docker | `--modo docker` | Produção em containers; não suporta DEV/TESTE isolados |
| Wipe | `--modo wipe` | Apaga a BD da instância selecionada; sempre interativo |

## Perfis de instância

| Instância | Clone | Deploy | BD | Serviço | Porta API | Domínio |
|---|---|---|---|---|---:|---|
| Produção | `~/TotemDigital-Studio` | `/opt/smart-signage` | `smartsignage` | `smart-signage` | 3000 | `totemdigital.app.br` |
| DEV | `~/TotemDigital-Studio-dev` | `/opt/totemdigital-dev` | `smartsignage_dev` | `smart-signage-dev` | 3001 | `dev.totemdigital.app.br` |
| TESTE | `~/TotemDigital-Studio-test` | `/opt/totemdigital-test` | `smartsignage_test` | `smart-signage-test` | 3002 | `test.totemdigital.app.br` |

## Regras de segurança

1. Faça backup antes de atualizar produção.
2. Use `--modo atualizar` para deploy normal; não use `--modo producao` numa instalação existente sem compreender o risco.
3. Nunca use `--modo wipe` sem informar `--instancia`.
4. Confirme branch, domínio, serviço e BD antes de executar.
5. Não compartilhe `.env`, `JWT_SECRET`, BD ou diretório de uploads entre produção, DEV e TESTE.
6. O Player-AD é instalado no aparelho, não pelo instalador do servidor.

## Ver ajuda diretamente dos scripts

```bash
bash scripts/Instala-TotemDigital-Server.sh --ajuda
bash scripts/backup-totemdigital-prod.sh --ajuda
bash scripts/restore-totemdigital-prod.sh --ajuda
```

