# Matriz Compact vs Pro - Lacunas e Priorizacao

Data: 2026-04-29

## Objetivo

Documentar, sem alteracoes de codigo, quais funcionalidades da versao Pro ainda nao estao plenamente presentes no fluxo Compact e como priorizar por impacto operacional.

## Lacunas Relevantes da Pro no Compact

### 1) Gestao avancada de exibidores/publicadores

- **Pro:** modulos mais completos para `Publicadores`, `Smart TVs`, `Playlists por Totem` e `Rede Visual`.
- **Compact (atual):** fluxo mais simplificado.
- **Risco no processo:** menor profundidade de diagnostico tecnico em operacao diaria.

### 2) Fluxo financeiro e contratos mais completo

- **Pro:** trilha mais robusta para `Contratos` e `Faturamento` por entidade.
- **Compact (atual):** trilha mais enxuta.
- **Risco no processo:** menor rastreabilidade comercial/financeira.

### 3) Administracao e governanca

- **Pro:** maior granularidade para usuarios, roles e flags.
- **Compact (atual):** controle simplificado.
- **Risco no processo:** maior chance de acesso indevido em times maiores.

### 4) Modulos analiticos e operacionais avancados

- **Pro:** analytics/relatorios com maior profundidade.
- **Compact (atual):** visao operacional mais basica.
- **Risco no processo:** menor suporte para decisao estrategica.

### 5) Automacao e inteligencia de conteudo

- **Pro:** recursos mais ricos em IA/Smart Playlist e regras.
- **Compact (atual):** funcional, porem mais reduzido.
- **Risco no processo:** menor produtividade em cenarios com alto volume de conteudo.

### 6) Separacao multi-tenant nativa

- **Pro:** estrutura naturalmente preparada para multiplos contextos.
- **Compact (atual):** owner e publisher operam acoplados no dia a dia.
- **Risco no processo:** limitacao ao escalar para multiplos tenants.

## Matriz de Priorizacao por Impacto

## Prioridade Alta (resultado imediato)

### Permissoes granulares por role/flag

- **Impacto:** alto
- **Motivo:** reduz risco operacional e melhora seguranca de acesso.

### Contratos + faturamento completos por entidade

- **Impacto:** alto
- **Motivo:** melhora governanca financeira e rastreabilidade comercial.

### Observabilidade operacional (monitoramento + diagnostico)

- **Impacto:** alto
- **Motivo:** acelera suporte e resolucao de incidentes.

## Prioridade Media (eficiencia operacional)

### Rede Visual/topologia mais profunda

- **Impacto:** medio
- **Motivo:** melhora troubleshooting e planejamento de expansao.

### Relatorios e analytics avancados

- **Impacto:** medio
- **Motivo:** fortalece acompanhamento de performance e decisao gerencial.

### Fluxos avancados de playlist/campanha (smart rules/IA)

- **Impacto:** medio
- **Motivo:** aumenta produtividade e consistencia da operacao de conteudo.

## Prioridade Baixa (importante ao escalar)

### Multi-tenant completo no padrao Pro

- **Impacto:** medio/alto no longo prazo
- **Motivo:** torna-se critico quando a operacao deixa de ser mono-contexto.

### Auditoria e trilhas administrativas completas

- **Impacto:** medio no curto prazo, alto em compliance
- **Motivo:** importante para governanca formal, conformidade e historico de mudancas.

## Ordem Recomendada de Execucao

1. Permissoes granulares (roles/flags)
2. Contratos e faturamento completos
3. Observabilidade operacional
4. Analytics e relatorios avancados
5. Rede Visual mais detalhada
6. Automacoes com IA/Smart Playlist
7. Multi-tenant full Pro

## Observacao sobre Compact

No modo Compact, o fluxo padrao deixa owner-system e publisher no mesmo contexto operacional para simplificar o uso. Ainda assim, no modelo de dados, continuam entidades distintas (usuario owner e entidade publisher), apenas acopladas no processo diario.
