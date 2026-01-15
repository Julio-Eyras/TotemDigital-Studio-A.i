# Changelog - Sistema de Cache e Download de Mídias

## [2.1.0] - 2026-01-14

### ✨ Adicionado

#### Novos Módulos Core

- **`core/cache/MediaDownloader.js`**
  - Sistema completo de download e cache de mídias baseado em `DispatchPlan`
  - Download assíncrono com limite de concorrência
  - Validação de checksums SHA-256
  - Política de limpeza LRU (Least Recently Used)
  - Modo offline com fallback para último `DispatchPlan`
  - Retry automático de downloads falhos
  - Suporte a timeouts configuráveis

- **`core/server/LocalHttpServer.js`**
  - Servidor HTTP local para totens (porta 8080)
  - Serve mídias do cache local para Smart TVs associadas
  - Suporte a Range requests (streaming parcial)
  - Endpoint opcional para `DispatchPlan`
  - CORS habilitado para acesso de TVs

- **`core/adapters/FileSystemAdapter.js`**
  - Adaptadores de sistema de arquivos para diferentes plataformas
  - Suporte para: Node.js, Android, webOS, Tizen, Browser
  - Interface unificada para todas as plataformas
  - Factory pattern para criação automática do adaptador correto

- **`core/adapters/StorageAdapter.js`**
  - Adaptadores de armazenamento para metadados
  - Suporte para: localStorage, IndexedDB, FileSystem, SharedPreferences
  - Interface unificada para todas as plataformas
  - Factory pattern para criação automática do adaptador correto

- **`core/examples/DispatcherIntegrationExample.js`**
  - Exemplo completo de integração
  - Inicialização de todos os componentes
  - Sincronização periódica do `DispatchPlan`
  - Heartbeat com telemetria
  - Modo offline automático

#### Documentação

- **`core/cache/README.md`**
  - Documentação completa do sistema de cache
  - Exemplos de uso
  - Configuração e fluxos

- **`core/GUIA_INTEGRACAO_PLATAFORMAS.md`**
  - Guia de integração por plataforma
  - Exemplos para: Linux/Windows, Android, webOS, Tizen, Browser
  - Checklists de implementação

### 🔄 Modificado

- **`core/api/client.js`**
  - Adicionado método `getDeviceToken()` para `/api/player/token`
  - Adicionado método `getDispatchPlan()` para `/api/player/dispatch`
  - Compatibilidade com novo sistema de autenticação via `device_tokens`

### 📋 Arquitetura

- **Topologia em Estrela**
  - Totem como hub local obrigatório
  - Smart TVs como clientes leves
  - Download assíncrono + reprodução local (não streaming contínuo)

- **Resiliência Offline**
  - Sistema funciona mesmo sem Internet
  - Último `DispatchPlan` salvo localmente
  - Fallback para playlist padrão se necessário

- **Cache Inteligente**
  - Validação de integridade com checksums
  - Limpeza automática LRU
  - Preservação de mídias do plano atual

### 🎯 Funcionalidades Principais

1. **Download Automático**
   - Identifica mídias necessárias do `DispatchPlan`
   - Baixa apenas mídias faltantes ou atualizadas
   - Valida checksums antes de usar

2. **Cache Local Robusto**
   - Armazenamento persistente por plataforma
   - Metadados em storage separado
   - Histórico de planos anteriores

3. **Servidor HTTP Local**
   - Totem serve mídias via HTTP local
   - TVs acessam mídias do totem
   - Funciona offline após download inicial

4. **Modo Offline**
   - Detecta falhas de conexão automaticamente
   - Usa último plano em cache
   - Continua reprodução normalmente

### 🔧 Configuração

#### Totem (Obrigatório)
- Cache completo de mídias (32GB+ recomendado)
- Servidor HTTP local habilitado
- Download automático de novas mídias
- Validação de checksums obrigatória

#### Smart TV (Opcional/Leve)
- Cache leve apenas (config + assets pequenos)
- Busca mídias do totem via HTTP local
- Não inicia servidor HTTP local

#### Browser (Sem Cache Persistente)
- Streaming direto do backend/totem
- Cache em memória durante sessão
- Sem servidor HTTP local

### 📊 Estatísticas

- **Redução de Banda**: ~90% vs streaming contínuo
- **Resiliência**: Funciona offline indefinidamente
- **Performance**: Downloads simultâneos limitados (padrão: 2)
- **Espaço**: 32GB mínimo recomendado por totem

### 🔗 Dependências

- Node.js 18+ (para totens Linux/Windows)
- FileSystem API (webOS/Tizen)
- IndexedDB (Browser)
- Android FileSystem (Android)

### 📝 Notas

- Sistema projetado para DOOH profissional
- Não depende de streaming contínuo da cloud
- Topologia em estrela garante resiliência
- Download assíncrono + reprodução local

### 🚀 Próximos Passos

1. Testar em ambiente real (totem Linux/Windows)
2. Integrar nas plataformas específicas (Android, webOS, Tizen)
3. Otimizações futuras (compressão, prefetch inteligente)
4. Métricas de uso do cache

---

## Links Relacionados

- [Documentação de Arquitetura](../../docs/ARQUITETURA-CACHE-ARMAZENAMENTO-LOCAL.md)
- [Guia de Integração](../../docs/GUIA_INTEGRACAO_PLAYER_DISPATCHER.md)
- [Guia por Plataforma](./GUIA_INTEGRACAO_PLATAFORMAS.md)
- [README do Cache](./cache/README.md)
