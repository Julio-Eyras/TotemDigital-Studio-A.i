# Guia de Deploy - webOS Player

## Pré-requisitos

1. **webOS TV SDK**
   - Baixar e instalar do [site oficial da LG](https://webostv.developer.lge.com/)
   - Versão 3.0 ou superior

2. **Certificado de Desenvolvedor**
   - Criar conta no [LG Developer Portal](https://webostv.developer.lge.com/)
   - Obter certificado de desenvolvedor

3. **TV LG com webOS**
   - webOS 3.0 ou superior
   - Conectada à mesma rede do computador de desenvolvimento

## Build

### 1. Configurar

Edite `config/config.json` com suas configurações:
- `apiBaseURL`: URL do backend
- `totemUIN`: UIN do totem
- `totemSecret`: Secret do totem

### 2. Build

```bash
cd platforms/webos
npm run build
# ou
bash build.sh
```

Isso criará o pacote `com.smartsignage.player_1.0.0_all.ipk`

## Instalação

### Desenvolvimento (TV na mesma rede)

```bash
# Definir IP da TV
export TV_IP=192.168.1.100

# Instalar
npm run install $TV_IP
# ou
bash install.sh $TV_IP
```

### Produção

1. **Assinar o pacote**
   ```bash
   ares-sign --device <TV_IP> com.smartsignage.player_1.0.0_all.ipk
   ```

2. **Publicar no LG Content Store**
   - Fazer upload do pacote assinado
   - Seguir processo de certificação da LG

## Configuração da TV

### Habilitar Modo Desenvolvedor

1. Menu → Configurações → Geral
2. Modo Desenvolvedor → Ativar
3. Anotar IP da TV

### Conectar via SSH (opcional)

```bash
ares-shell --device <TV_IP>
```

## Troubleshooting

### App não inicia
- Verificar logs: `ares-log --device <TV_IP>`
- Verificar certificado de desenvolvedor
- Verificar permissões no `appinfo.json`

### Erro de conexão com backend
- Verificar `apiBaseURL` no `config.json`
- Verificar se TV e servidor estão na mesma rede
- Verificar firewall

### Mídia não carrega
- Verificar URLs das mídias
- Verificar CORS no backend
- Verificar permissões de rede no `appinfo.json`

## Logs

Ver logs em tempo real:
```bash
ares-log --device <TV_IP> --follow
```

## Atualização

Para atualizar o app:
```bash
# Rebuild
npm run build

# Reinstalar
npm run install $TV_IP
```

