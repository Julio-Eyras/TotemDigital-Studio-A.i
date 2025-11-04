# Fluxo de Auto-Registro do Player

## Objetivo
Permitir que players (Smart TVs, SBCs, Player em C) se registrem automaticamente no servidor na primeira instalação, gerando seu próprio UIN baseado nas características do hardware.

## Fluxo Proposto

### 1. Primeira Instalação do Player

#### 1.1 Coleta de Hardware
O player coleta as seguintes informações do hardware:
- **MAC Address** (primeira interface de rede ativa)
- **CPU ID** / Serial Number (se disponível)
- **Hostname** / Machine ID
- **Platform** (Linux, Android, etc.)
- **Architecture** (arm, x64, etc.)
- **Outras informações únicas** (DMI UUID, etc.)

#### 1.2 Geração do UIN
O player gera um UIN único baseado em hash das informações de hardware:
```
UIN = SHA256(MAC + CPU_ID + HOSTNAME + PLATFORM + ARCH)
Exemplo: "SSP-3a8f9b2c1d4e5f6a7b8c9d0e1f2a3b4c"
```

#### 1.3 Encriptação
O player encripta as informações usando a chave secreta do sistema:
```
Payload = {
  uin: "SSP-3a8f9b2c...",
  hardware: {
    mac: "aa:bb:cc:dd:ee:ff",
    cpuId: "CPU-123456",
    hostname: "player-001",
    platform: "linux",
    arch: "arm64",
    serial: "SERIAL-789"
  },
  timestamp: 1234567890
}
```

#### 1.4 Envio para Servidor
```
POST /api/player/register
Body: {
  encryptedData: "base64_encrypted_payload",
  publicHash: "hash_para_identificação_rapida"
}
```

### 2. Processamento no Servidor

#### 2.1 Decodificação
- Servidor decodifica o payload usando a chave secreta
- Valida estrutura dos dados
- Extrai UIN e hardware info

#### 2.2 Validação
- Verifica se UIN já existe (duplicidade)
- Verifica se hardware já está registrado (prevenção de clonagem)
- Valida formato do UIN gerado

#### 2.3 Criação Automática
- Cria totem no banco de dados com:
  - UIN gerado pelo player
  - Hardware info armazenado no campo `config`
  - Status: `pending_approval` (aguardando aprovação do admin)
  - Cliente: `1` (cliente padrão) ou fornecido

#### 2.4 Resposta
```
{
  success: true,
  totem: {
    id: 123,
    uin: "SSP-3a8f9b2c...",
    status: "pending_approval",
    message: "Totem registrado aguardando aprovação"
  },
  token: "token_de_validação"
}
```

### 3. Validações Subsequentes

#### 3.1 Player Envia
```
GET /api/player/validate?uin=SSP-3a8f9b2c...&token=...
```

#### 3.2 Servidor Valida
- Verifica UIN existe
- Valida hardware info atual vs. cadastrado
- Retorna status e playlist

### 4. Rastreamento de Hardware

#### 4.1 No Cadastro do Totem
- Campo `config` armazena:
```json
{
  "hardware": {
    "mac": "aa:bb:cc:dd:ee:ff",
    "cpuId": "CPU-123456",
    "hostname": "player-001",
    "platform": "linux",
    "arch": "arm64",
    "serial": "SERIAL-789",
    "registeredAt": "2025-11-04T02:00:00Z",
    "hardwareHash": "hash_do_hardware"
  },
  "resolution": "1920x1080",
  "orientation": "portrait"
}
```

#### 4.2 Detecção de Mudanças
- Se hardware mudar, servidor detecta e pode:
  - Bloquear totem (hardware não corresponde)
  - Solicitar re-registro
  - Alertar administrador

## Implementação

### Player (JavaScript/HTML5)
- Função `collectHardwareInfo()` - coleta hardware
- Função `generateUIN()` - gera UIN baseado em hardware
- Função `registerWithServer()` - envia para servidor
- Função `saveUINLocally()` - salva UIN localmente (localStorage + config.json.enc)

### Backend (Node.js/TypeScript)
- Rota `POST /api/player/register` - recebe e processa registro
- Validação de hardware duplicado
- Criação automática de totem
- Armazenamento de hardware info

### Player em C (Futuro)
- Mesma lógica de coleta de hardware
- Mesma geração de UIN
- Mesma comunicação com servidor

## Segurança

1. **Encriptação**: Todas as comunicações são encriptadas
2. **Validação de Hardware**: Previne clonagem de totens
3. **Aprovação Manual**: Totens ficam `pending_approval` até admin aprovar
4. **Rastreamento**: Hardware info é rastreado e validado a cada conexão

## Benefícios

1. **Instalação Simplificada**: Player se registra automaticamente
2. **Rastreamento**: Hardware é rastreado e validado
3. **Prevenção de Clonagem**: Hardware único previne duplicação
4. **Multiplataforma**: Funciona para Smart TVs, SBCs e player em C

