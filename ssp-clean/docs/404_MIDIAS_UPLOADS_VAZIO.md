# 404 em mídias – pasta de uploads vazia

**Causa:** O diretório `/opt/smart-signage/public/assets/uploads` existe mas está **vazio**. Não há pastas `subscriber-X/medias/` nem arquivos. O banco de dados tem registros de mídia apontando para arquivos que não existem em disco.

## Por que acontece

- **Carga inicial / seeds:** O script pode ter inserido linhas na tabela `medias` com `file_path` como `/opt/smart-signage/public/assets/uploads/subscriber-12/medias/sssss.jpg`, mas os arquivos reais nunca foram copiados para o servidor.
- **Novo ambiente:** Em uma instalação nova, ninguém fez upload ainda.
- **Backup restaurado só do banco:** Foi restaurado apenas o banco; a pasta de uploads não foi restaurada.

## O que fazer

### 1. Fazer upload das mídias pela aplicação

- Entrar em **Mídias**, escolher o subscriber e enviar os arquivos de novo.
- O backend cria automaticamente `uploads/subscriber-<id>/medias/` na primeira gravação.

### 2. Se você tem os arquivos em outro lugar (backup)

Copiar para a estrutura esperada:

```bash
# Exemplo: você tem os arquivos em /backup/medias/subscriber-12/
sudo mkdir -p /opt/smart-signage/public/assets/uploads/subscriber-12/medias
sudo cp /caminho/do/backup/subscriber-12/medias/* /opt/smart-signage/public/assets/uploads/subscriber-12/medias/
sudo chown -R smartchannel:www-data /opt/smart-signage/public/assets/uploads
sudo chmod -R 755 /opt/smart-signage/public/assets/uploads
```

Os nomes dos arquivos devem bater com o que está em `medias.file_path` (ou você ajusta o `file_path` no banco).

### 3. Criar apenas a estrutura de pastas (opcional)

Se quiser criar de uma vez as pastas para todos os subscribers que têm mídia no banco (útil para ajustar permissões antes de qualquer upload):

```bash
cd /home/smartchannel/SmartSignage-Pro
./scripts/criar-estrutura-uploads-subscribers.sh
```

Depois:

```bash
sudo chown -R smartchannel:www-data /opt/smart-signage/public/assets/uploads
sudo chmod -R 755 /opt/smart-signage/public/assets/uploads
```

## Resumo

| Situação | Ação |
|----------|------|
| Nenhum arquivo no servidor | Fazer upload pela app ou restaurar cópia dos arquivos em `uploads/subscriber-X/medias/`. |
| Só quer que as pastas existam | Rodar o script acima (opcional). |
| 404 persiste após colocar arquivos | Verificar permissões e `docs/SOLUCAO_404_ASSETS.md`. |

Os 404 **só deixam de ocorrer** quando os arquivos existirem em disco no caminho que o banco usa (ou quando o banco for ajustado para refletir o caminho real).
