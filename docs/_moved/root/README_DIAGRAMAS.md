# Guia de Diagramas - SmartSignage Pro

**Versão:** 2.1.0  
**Data:** Dezembro 2025

---

## 📊 Visão Geral

Este documento serve como guia para navegação e uso dos diagramas funcionais do sistema SmartSignage Pro.

---

## 🎯 Tipos de Diagramas

### 1. Diagramas Técnicos (`DIAGRAMA_FUNCIONAL_SISTEMA.md`)

Documentam a arquitetura técnica, fluxos de dados e interações entre componentes.

#### Arquitetura Geral do Sistema
- Visão de alto nível de todos os componentes
- Relacionamentos entre frontend, backend, banco de dados e serviços externos
- Útil para: entendimento geral do sistema, onboarding de desenvolvedores

#### Modelo de Negócio - Entidades e Relacionamentos
- Diagrama ER completo
- Todas as tabelas e relacionamentos
- Útil para: entendimento do modelo de dados, design de queries

#### Fluxo de Mixagem de Playlists
- Sequência detalhada de como uma mixagem é gerada
- Interações entre serviços
- Útil para: depuração, entendimento do processo

#### Fluxo Completo de Conteúdo
- Jornada completa desde criação até exibição
- Todos os passos do processo
- Útil para: apresentações, documentação de processos

#### Processo de Geração de Mix para Totem
- Detalhamento dos 5 passos de geração
- Como dados são processados
- Útil para: otimização, entendimento de algoritmos

---

### 2. Diagramas de Negócio (`DIAGRAMA_VISAO_NEGOCIO.md`)

Documentam o modelo de negócio, valor entregue e jornadas dos usuários.

#### Visão Geral do Modelo de Negócio
- Ecossistema completo
- Fluxo de valor entre atores
- Útil para: apresentações comerciais, entendimento do negócio

#### Modelo de Receita
- Como o sistema monetiza
- Fluxo financeiro
- Útil para: planejamento financeiro, apresentações para investidores

#### Fluxo Detalhado de Valor
- Sequência de valor entregue
- Interações entre atores
- Útil para: definição de processos, treinamento

#### Personas e Jornadas
- Jornadas dos principais atores
- Experiência do usuário
- Útil para: UX, definição de features

---

## 🛠️ Como Visualizar

### Opção 1: GitHub/GitLab
Os diagramas são renderizados automaticamente em repositórios Git que suportam Mermaid.

### Opção 2: VS Code
Instale a extensão "Markdown Preview Mermaid Support" ou "Mermaid Preview"

### Opção 3: Mermaid Live Editor
1. Acesse: https://mermaid.live/
2. Copie o código do diagrama (entre ```mermaid e ```)
3. Cole no editor
4. Visualize e exporte como PNG/SVG

### Opção 4: Documentação Online
Muitos geradores de documentação (Docusaurus, GitBook, etc.) suportam Mermaid nativamente.

---

## 📖 Como Usar

### Para Desenvolvedores
1. Comece com "Arquitetura Geral do Sistema"
2. Explore "Fluxo de Mixagem de Playlists" para entender o core
3. Use "Modelo de Negócio" como referência para queries

### Para Product Managers / Business
1. Comece com "Visão Geral do Modelo de Negócio"
2. Explore "Fluxo Detalhado de Valor"
3. Use "Personas e Jornadas" para entender usuários

### Para Apresentações
1. Use diagramas de negócio para stakeholders
2. Use diagramas técnicos para equipes técnicas
3. Customize conforme necessário

---

## 🔄 Manutenção

### Quando Atualizar
- Quando novos componentes são adicionados
- Quando fluxos mudam significativamente
- Quando novos atores/processos são introduzidos

### Como Atualizar
1. Edite o arquivo `.md` correspondente
2. Atualize o diagrama Mermaid
3. Verifique renderização
4. Atualize este README se necessário

---

## 📝 Convenções

### Cores e Estilos
- **Componentes do Sistema**: Retângulos simples
- **Processos**: Retângulos arredondados
- **Decisões**: Losangos
- **Dados**: Cilindros
- **Atores**: Figuras de pessoa

### Nomenclatura
- Use português para termos de negócio
- Use inglês para termos técnicos padrão
- Seja consistente com a documentação

---

## 🎨 Exemplos de Uso

### Exemplo 1: Onboarding de Desenvolvedor
```
1. Ler "Arquitetura Geral do Sistema"
2. Estudar "Fluxo de Mixagem de Playlists"
3. Explorar "Modelo de Negócio"
4. Implementar feature seguindo diagramas
```

### Exemplo 2: Apresentação Comercial
```
1. Mostrar "Visão Geral do Modelo de Negócio"
2. Explicar "Modelo de Receita"
3. Demonstrar "Fluxo Detalhado de Valor"
4. Destacar "Diferenciais Competitivos"
```

### Exemplo 3: Planejamento de Feature
```
1. Identificar impacto em diagramas existentes
2. Atualizar diagramas se necessário
3. Documentar mudanças
4. Validar com equipe
```

---

## 📚 Referências

- [Mermaid Documentation](https://mermaid.js.org/)
- [Mermaid Live Editor](https://mermaid.live/)
- Documentação do Sistema: `INDICE_DOCUMENTACAO.md`

---

**Última atualização:** Dezembro 2025

