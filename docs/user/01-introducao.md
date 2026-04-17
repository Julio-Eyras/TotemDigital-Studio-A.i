# Guia de Introdução — SmartSignage Pro / TotemDigital

## O que é o SmartSignage Pro?

O SmartSignage Pro é uma plataforma completa de gerenciamento de sinalização digital (Digital Signage) que permite criar, gerenciar e distribuir conteúdo multimídia para totens digitais em tempo real.

## O que é o TotemDigital?

O **TotemDigital** é a **variante monousuária** do mesmo produto: **um núcleo físico** no PostgreSQL (totens, mídias, playlists, dispatch), com **menos entidades na operação diária** e seed típico para um único publisher/subscriber. Diagramas **antes/depois** (E.R. e fluxo de dispatch) estão em **[TotemDigital monousuário: E.R. e fluxo](../platform/06-totemdigital-monousuario-er-e-fluxo.md)**. O **diagrama ER completo** do schema está em **[diagramas PNG](../diagrams/SmartSignage-ER-sistema-completo.png)** (visão geral) e **[variante com detalhe](../diagrams/SmartSignage-ER-sistema-completo-detalhe.png)** — use zoom nos nós `totems`, `totem_playlists`, `campaigns`, `medias`, `locals` e `publishers` para cruzar com esse guia.

## Principais Funcionalidades

### 🎯 Gerenciamento de Conteúdo
- **Campanhas**: Crie e gerencie campanhas publicitárias com agendamento temporal
- **Playlists**: Organize mídias (vídeos, imagens) em playlists para exibição
- **Mídias**: Upload e gerenciamento de arquivos de vídeo, imagem e HTML5

### 📺 Gerenciamento de Totens
- **Totens**: Cadastro e monitoramento de dispositivos de exibição
- **Locais**: Organize totens por localização física
- **Publishers**: Gerencie grupos de locais e totens

### ⚡ Dispatcher Inteligente
- **Decisão Automática**: Sistema inteligente que resolve conflitos de agendamentos
- **Validação Temporal**: Verifica horários e dias da semana
- **Validação Técnica**: Garante compatibilidade de mídias com totens
- **Cache Inteligente**: Otimiza performance com cache de planos de exibição

### 📊 Analytics e Relatórios
- **Eventos**: Registro de reproduções, visualizações e interações
- **Relatórios**: Análise de desempenho de campanhas e totens
- **Auditoria**: Log completo de decisões e alterações

## Conceitos Fundamentais

### Hierarquia do Sistema

```
Publisher (Empresa/Organização)
  └── Local (Loja/Filial)
      └── Totem (Dispositivo de Exibição)
          └── Campanha (Agendamento)
              └── Playlist (Sequência de Mídias)
                  └── Mídias (Vídeos/Imagens)
```

### Fluxo de Exibição

1. **Criação**: Usuário cria campanha com playlist e agendamento
2. **Agendamento**: Sistema valida horários e disponibilidade
3. **Dispatcher**: Motor decide qual conteúdo exibir em cada totem
4. **Player**: Totem solicita plano de exibição e reproduz conteúdo
5. **Eventos**: Sistema registra reproduções e interações

## Tipos de Usuários

### Subscriber (Anunciante)
- Cria campanhas e conteúdo
- Visualiza relatórios de suas campanhas
- Gerencia suas próprias playlists e mídias

### Publisher (Proprietário de Totens)
- Gerencia totens e locais
- Aprova/rejeita campanhas de subscribers
- Visualiza analytics de seus totens

### Admin (Administrador)
- Acesso completo ao sistema
- Gerencia usuários, roles e permissões
- Configurações globais do sistema

## Próximos Passos

1. **[Manual do Usuário](./02-manual-usuario.md)** - Aprenda a usar todas as funcionalidades
2. **[Tutoriais](./04-tutoriais.md)** - Passo a passo para tarefas comuns
3. **[FAQ](./03-faq.md)** - Respostas para dúvidas frequentes

