# Arquitetura de Cache e Armazenamento Local

## 📋 Visão Geral

O Smart Signage Pro foi projetado com **resiliência offline** como requisito fundamental. O sistema utiliza uma **topologia em estrela** onde:

- **Totens** atuam como **hubs locais** (replicadores de rede)
- **Smart TVs** dependem do totem associado para conteúdo
- **Armazenamento local** garante continuidade mesmo sem Internet

---

## 🏗️ Topologia em Estrela

```
                    ┌─────────────────┐
                    │   INTERNET      │
                    │   (Cloud/API)   │
                    └────────┬────────┘
                             │
                             │ (Download assíncrono)
                             │
                    ┌────────▼────────┐
                    │     TOTEM 1     │
                    │  (Hub Local)   │
                    │                │
                    │  ┌──────────┐  │
                    │  │ Cache    │  │
                    │  │ Local    │  │
                    │  │ (SSD)    │  │
                    │  └──────────┘  │
                    └───┬──────┬─────┘
                        │      │
        ┌───────────────┘      └───────────────┐
        │                                      │
        │ (HTTP Local / File Share)            │ (HTTP Local / File Share)
        │                                      │
┌───────▼───────┐                    ┌────────▼────────┐
│  Smart TV 1  │                    │   Smart TV 2    │
│  (webOS)     │                    │   (Tizen)       │
│              │                    │                 │
│  Cache Leve  │                    │   Cache Leve    │
│  (Config)    │                    │   (Config)      │
└──────────────┘                    └─────────────────┘
```

### Características da Topologia

1. **Totem = Hub Local**
   - Armazena mídias para si e para TVs associadas
   - Serve conteúdo via HTTP local ou compartilhamento de arquivos
   - Funciona offline após download inicial

2. **Smart TVs = Clientes Locais**
   - Consomem conteúdo do totem (não diretamente da cloud)
   - Podem ter cache leve (configuração, fallback)
   - Não dependem de streaming contínuo

3. **Internet = Sincronização Assíncrona**
   - Download de novas mídias quando disponível
   - Upload de telemetria e logs
   - Não bloqueia reprodução

---

## 💾 Estratégia de Armazenamento

### 1. Totem (Armazenamento Local Obrigatório)

**Localização:**
- **Linux/Windows**: `/opt/smart-signage/cache/totem_{id}/` ou `C:\SmartSignage\cache\totem_{id}\`
- **Android**: `/sdcard/SmartSignage/cache/totem_{id}/` ou armazenamento interno dedicado

**Conteúdo:**
- **Mídias completas** (vídeos, imagens, áudios) do `DispatchPlan` atual
- **Mídias históricas** (últimos N planos para fallback)
- **Configurações** (`uin`, `deviceId`, `token`, último `DispatchPlan` JSON)
- **Metadados** (checksums, tamanhos, datas de download)

**Tamanho Estimado:**
- **Mínimo recomendado**: 32 GB (SSD preferencial)
- **Ideal**: 128 GB+ para múltiplas campanhas e histórico
- **Por mídia**: 
  - Imagem (1920x1080): ~500 KB - 2 MB
  - Vídeo (1080p, 30s): ~5-15 MB
  - Vídeo (1080p, 60s): ~10-30 MB

**Gestão:**
- **Download automático** quando `DispatchPlan` muda
- **Limpeza automática** de mídias antigas (LRU - Least Recently Used)
- **Validação de integridade** (checksums) antes de usar
- **Priorização**: Mídias do plano atual têm prioridade sobre histórico

### 2. Smart TV (Armazenamento Opcional/Leve)

**Recomendação por Plataforma:**

#### **webOS / Tizen (TVs "puras")**
- **Não forçar cache pesado** (armazenamento limitado, sandbox restritivo)
- **Cache leve apenas**:
  - Configuração (`uin`, `token`, último `DispatchPlan` JSON)
  - Assets pequenos (logo, UI, fallback estático)
  - **Mídias**: Sempre buscar do totem via HTTP local

#### **Android Box / SBC com SSD**
- **Cache completo** (como totem)
- Pode atuar como mini-totem se necessário
- **Mídias**: Cache local + fallback para totem

**Localização:**
- **webOS**: `/media/developer/smartsignage/cache/` (sandbox do app)
- **Tizen**: `/home/owner/smartsignage/cache/` (sandbox do app)
- **Android**: `/sdcard/SmartSignage/cache/` ou armazenamento interno

**Tamanho Estimado:**
- **webOS/Tizen**: 100-500 MB (config + assets pequenos)
- **Android Box**: 16-64 GB (cache completo)

### 3. player-web (Browser - Sem Cache Persistente)

- **Sem armazenamento local** (limitações do browser)
- **Streaming direto** do backend/totem
- **Cache em memória** apenas (durante sessão)

---

## 🔄 Fluxo de Download e Cache

### Fase 1: Inicialização (Primeira Vez)

```
┌─────────────┐
│   TOTEM     │ 1. Solicita token
│  (Player)   │    GET /api/player/token?uin=...
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────┐
│   BACKEND (Cloud)                   │
│   - Valida UIN                      │
│   - Cria device_token               │
│   - Retorna token                   │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────┐
│   TOTEM     │ 2. Solicita DispatchPlan
│  (Player)   │    GET /api/player/dispatch?uin=...&token=...
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────┐
│   DISPATCHER                        │
│   - Gera DispatchPlan               │
│   - Retorna lista de mediaItems     │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────┐
│   TOTEM     │ 3. Download de Mídias
│  (Player)   │    Para cada mediaItem:
│             │    - GET /api/media/{id}/download
│             │    - Salvar em cache local
│             │    - Validar checksum
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   TOTEM     │ 4. Inicia Reprodução
│  (Player)   │    - Usa mídias do cache local
│             │    - Loop contínuo
└─────────────┘
```

### Fase 2: Atualização Periódica (Online)

```
┌─────────────┐
│   TOTEM     │ 1. A cada N minutos (ex: 15 min)
│  (Player)   │    GET /api/player/dispatch?uin=...&token=...
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────┐
│   DISPATCHER                        │
│   - Compara novo DispatchPlan       │
│     com último conhecido             │
│   - Identifica mídias novas/removidas│
└──────┬──────────────────────────────┘
       │
       ├─── Se DispatchPlan mudou ───┐
       │                             │
       ▼                             ▼
┌─────────────┐            ┌─────────────┐
│   TOTEM     │            │   TOTEM     │
│  (Player)   │            │  (Player)   │
│             │            │             │
│  Download   │            │  Limpeza    │
│  novas      │            │  mídias     │
│  mídias     │            │  antigas    │
│             │            │  (LRU)      │
└─────────────┘            └─────────────┘
```

### Fase 3: Modo Offline (Internet Caiu)

```
┌─────────────┐
│   TOTEM     │ 1. Detecta falha de conexão
│  (Player)   │    (timeout em /api/player/dispatch)
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────┐
│   TOTEM (Modo Offline)              │
│   - Carrega último DispatchPlan     │
│     salvo localmente                │
│   - Verifica mídias no cache        │
│   - Se todas disponíveis:            │
│     → Continua reprodução normal    │
│   - Se faltam mídias:                │
│     → Usa fallback (playlist padrão)│
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────┐
│   TOTEM     │ 2. Continua servindo para TVs
│  (Player)   │    - HTTP local ainda funciona
│             │    - TVs continuam recebendo
│             │      conteúdo do totem
└─────────────┘
```

---

## 🌐 Comunicação Totem ↔ Smart TV

### Opção 1: HTTP Local (Recomendado)

**Totem expõe servidor HTTP local:**
- **Porta**: `8080` (configurável)
- **Endpoint de mídia**: `http://{totem-ip}:8080/media/{mediaId}`
- **Endpoint de plano**: `http://{totem-ip}:8080/api/dispatch?uin={uin}`

**Vantagens:**
- Simples de implementar
- Funciona em qualquer plataforma
- Suporta range requests (streaming parcial)
- Cache HTTP padrão

**Desvantagens:**
- Requer servidor HTTP no totem
- Pode consumir recursos (CPU/memória)

### Opção 2: Compartilhamento de Arquivos (Alternativa)

**Totem expõe compartilhamento:**
- **SMB/CIFS** (Windows/Linux)
- **NFS** (Linux)
- **FTP/SFTP** (qualquer plataforma)

**Vantagens:**
- Menos overhead (sem servidor HTTP)
- Acesso direto a arquivos

**Desvantagens:**
- Mais complexo de configurar
- Pode ter problemas de permissões
- Nem todas as TVs suportam bem

### Opção 3: Streaming Unicast Local (Futuro)

**Totem faz streaming para cada TV:**
- **Protocolo**: HLS local ou MP4 progressive
- **Sincronização**: Possível sincronizar múltiplas TVs

**Vantagens:**
- Sincronização precisa
- Suporta inserções dinâmicas

**Desvantagens:**
- Mais complexo
- Consome mais recursos do totem
- Pode congestionar LAN se muitas TVs

**Recomendação**: Começar com **HTTP Local**, evoluir para streaming se necessário.

---

## 📊 Estratégia de Cache

### Cache no Totem

#### 1. Cache de DispatchPlan

**Localização**: `{cache_dir}/dispatch_plan.json`

**Conteúdo**:
```json
{
  "plan": { /* DispatchPlan completo */ },
  "downloadedAt": "2026-01-14T10:00:00Z",
  "validUntil": "2026-01-14T11:00:00Z",
  "mediaChecksums": {
    "1": "abc123...",
    "2": "def456..."
  }
}
```

**Validade**:
- **TTL**: Até próximo ciclo de atualização (ex: 1 hora)
- **Renovação**: Quando novo plano chega do dispatcher

#### 2. Cache de Mídias

**Estrutura de Diretórios**:
```
{cache_dir}/
├── media/
│   ├── {mediaId}_{checksum}.{ext}
│   ├── {mediaId}_{checksum}.{ext}
│   └── ...
├── thumbnails/
│   ├── {mediaId}_thumb.jpg
│   └── ...
└── metadata/
    └── {mediaId}.json
```

**Política de Limpeza (LRU)**:
- **Manter sempre**: Mídias do plano atual
- **Manter histórico**: Últimos 3-5 planos (se espaço disponível)
- **Remover**: Mídias não usadas há > 7 dias
- **Limite de espaço**: Quando > 80% do disco, remover mais antigas

**Validação**:
- **Checksum**: Verificar integridade antes de usar
- **Tamanho**: Validar tamanho do arquivo
- **Formato**: Validar extensão/MIME type

### Cache na Smart TV

#### 1. Cache de Configuração

**Localização**: `{app_sandbox}/config.json`

**Conteúdo**:
```json
{
  "uin": "TOTEM-001",
  "deviceId": "webos-abc123",
  "token": "...",
  "lastDispatchPlanUrl": "http://192.168.1.10:8080/api/dispatch?uin=...",
  "totemIp": "192.168.1.10"
}
```

#### 2. Cache de Assets Leves

**Localização**: `{app_sandbox}/assets/`

**Conteúdo**:
- Logo da empresa
- Tela de standby/fallback
- UI elements

**Tamanho**: < 10 MB total

---

## 🔒 Resiliência Offline

### Cenário 1: Internet Cai Durante Operação Normal

**Totem:**
1. Detecta timeout em `/api/player/dispatch`
2. Carrega último `DispatchPlan` do cache
3. Verifica mídias no cache local
4. Se todas disponíveis → continua reprodução
5. Se faltam mídias → usa playlist de fallback
6. Continua servindo TVs via HTTP local

**Smart TV:**
1. Detecta timeout ao buscar novo plano do totem
2. Usa último plano conhecido (se cacheado)
3. Busca mídias do totem via HTTP local
4. Se totem offline → mostra tela de standby

### Cenário 2: Totem Reinicia Sem Internet

**Totem:**
1. Carrega configuração persistida (`uin`, `deviceId`)
2. Tenta obter novo token → falha (sem Internet)
3. Usa último token cacheado (se ainda válido)
4. Carrega último `DispatchPlan` do cache
5. Inicia reprodução com mídias locais

**Smart TV:**
1. Detecta que totem reiniciou (timeout HTTP)
2. Aguarda alguns segundos
3. Tenta reconectar ao totem
4. Se totem online (mesmo sem Internet) → continua
5. Se totem offline → mostra standby

### Cenário 3: Mídia Corrompida no Cache

**Totem:**
1. Detecta checksum inválido ao carregar mídia
2. Remove arquivo corrompido
3. Tenta baixar novamente (se online)
4. Se offline → pula mídia e continua com próxima
5. Registra erro para upload posterior

---

## 🚫 Por Que NÃO Usar Streaming Cloud?

### Problemas do Streaming Contínuo

1. **Congestionamento de Rede**
   - Cada tela = 1 fluxo HTTP/video contínuo
   - 10 telas = 10x consumo de banda
   - 100 telas = 100x consumo de banda
   - Qualquer jitter/queda derruba experiência

2. **Custos Cloud**
   - **Egress**: Saída de dados da cloud ($$$)
   - **CDN**: Se usar CDN, custos multiplicam
   - **Bandwidth**: Consumo contínuo vs. download pontual

3. **Dependência de Internet**
   - Qualquer queda = tela preta
   - Sem resiliência offline
   - Não adequado para DOOH profissional

4. **Qualidade Inconsistente**
   - Buffering em redes instáveis
   - Qualidade degradada em baixa largura de banda
   - Latência de início de reprodução

### Quando Streaming Faz Sentido?

**Streaming deve ser EXCEÇÃO, não regra:**

1. **Conteúdo ao Vivo**
   - Transmissões em tempo real
   - Eventos especiais
   - Notícias urgentes

2. **Inserções Dinâmicas**
   - Conteúdo gerado sob demanda
   - Personalização extrema por contexto

3. **Testes/Desenvolvimento**
   - Validação rápida sem download

**Para 99% dos casos**: Download + Cache Local é superior.

---

## 📈 Estimativas de Espaço e Banda

### Espaço Necessário por Totem

**Cenário Conservador** (1 campanha, 10 mídias):
- 5 imagens (2 MB cada) = 10 MB
- 5 vídeos (15 MB cada) = 75 MB
- **Total**: ~85 MB

**Cenário Médio** (3 campanhas, 30 mídias):
- 15 imagens (2 MB cada) = 30 MB
- 15 vídeos (15 MB cada) = 225 MB
- **Total**: ~255 MB

**Cenário Intensivo** (10 campanhas, 100 mídias + histórico):
- 50 imagens (2 MB cada) = 100 MB
- 50 vídeos (15 MB cada) = 750 MB
- Histórico (3 planos anteriores) = 2.5 GB
- **Total**: ~3.4 GB

**Recomendação**: **32 GB mínimo, 128 GB ideal** por totem.

### Banda Necessária para Download

**Download Inicial** (1x por campanha):
- Cenário Conservador: 85 MB
- Cenário Médio: 255 MB
- Cenário Intensivo: 850 MB

**Atualizações Periódicas** (apenas mídias novas):
- Típico: 10-50 MB por atualização
- Frequência: 1-4x por dia

**Comparação com Streaming**:
- **Streaming contínuo**: 5-10 Mbps por tela (24/7)
- **Download + Cache**: 5-10 Mbps por totem (apenas durante download, ~1-2 horas/dia)

**Economia**: ~90% de redução no consumo de banda.

---

## ✅ Checklist de Implementação

### Totem

- [ ] Criar estrutura de diretórios de cache
- [ ] Implementar download de mídias do `DispatchPlan`
- [ ] Implementar validação de checksums
- [ ] Implementar política de limpeza LRU
- [ ] Implementar persistência de último `DispatchPlan`
- [ ] Implementar servidor HTTP local (porta 8080)
- [ ] Implementar detecção de modo offline
- [ ] Implementar fallback para playlist padrão

### Smart TV (webOS/Tizen)

- [ ] Implementar cache de configuração
- [ ] Implementar cache de assets leves
- [ ] Implementar busca de mídias do totem (HTTP local)
- [ ] Implementar detecção de totem offline
- [ ] Implementar tela de standby

### Smart TV (Android Box)

- [ ] Implementar cache completo (como totem)
- [ ] Implementar download direto do backend (se necessário)
- [ ] Implementar fallback para totem

### player-web

- [ ] Manter streaming direto (sem cache persistente)
- [ ] Implementar cache em memória durante sessão

---

## 🎯 Resumo Executivo

1. **Totem = Hub Local**: Armazena mídias para si e TVs associadas
2. **Cache Local Obrigatório**: Totem deve ter armazenamento local robusto
3. **TVs = Clientes Leves**: Cache opcional/leve, dependem do totem
4. **Download > Streaming**: Download assíncrono + reprodução local
5. **Resiliência Offline**: Sistema funciona mesmo sem Internet
6. **Topologia em Estrela**: Totem centraliza e distribui conteúdo localmente

**Resultado**: Sistema robusto, eficiente e adequado para DOOH profissional.
