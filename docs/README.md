# SmartSignage Pro — Documentação (`docs/`)

Índice curado para operação, schema e players. Muitos análises históricas permanecem como ficheiros soltos nesta pasta; para **modelo de dados atual** e **limpeza**, use primeiro os links abaixo.

---

## Diagramas (PNG)

| Ficheiro | Descrição |
|----------|-----------|
| [**diagrams/SmartSignage-ER-sistema-completo.png**](./diagrams/SmartSignage-ER-sistema-completo.png) | **Diagrama ER de todo o sistema**: uma caixa por `part*.sql` do schema v2, com **todas** as tabelas listadas (legível em ecrã normal, formato vertical). |
| [**diagrams/SmartSignage-ER-sistema-completo-detalhe.png**](./diagrams/SmartSignage-ER-sistema-completo-detalhe.png) | Variante com **um nó por tabela** + subconjunto de FKs (útil com zoom; gerado pelo mesmo script). |

Regenerar: `python3 scripts/generate-er-system-png.py` ou com detalhe: `python3 scripts/generate-er-system-png.py --detalhe` (requer Graphviz `dot`).

---

## Modelo de dados e Smart TV / totens

| Documento | Descrição |
|-----------|-----------|
| [**MODELO_ER_MIDIAS_SMART_TV_E_TOTENS.md**](./MODELO_ER_MIDIAS_SMART_TV_E_TOTENS.md) | **Modelo ER** atual: `medias`, `campaigns`, `campaign_medias`, `campaign_playlists`, `totems`, `smart_tvs`, dispatch consolidado. |
| [**duas-formas-propaganda-chegar-ao-totem.md**](./duas-formas-propaganda-chegar-ao-totem.md) | Elegibilidade campanha ↔ totem (contrato/plano vs `campaign_totems`). |
| [**cadastro-atrelar-campanha-totem.md**](./cadastro-atrelar-campanha-totem.md) | UI: abas Publicadores e Totens. |
| [**analise-dispatcher-midias-vazias-e-duplicados.md**](./analise-dispatcher-midias-vazias-e-duplicados.md) | Mix, listas vazias e duplicados. |
| [Plano de Implementação para Sistema de Publicidade em Smart TV.md](./Plano%20de%20Implementação%20para%20Sistema%20de%20Publicidade%20em%20Smart%20TV.md) | Plano por plataforma (LG/Tizen/Android); ver aviso no topo do ficheiro sobre endpoints atuais. |
| ZIP legado (diagrama estático): `ModeloERparaGerenciarMídiasEmTvsSmart.zip` | Opcional; preferir o **Markdown** linkado acima + SQL em `database/`. |

---

## Schema, instalação e validação (v6)

| Recurso | Caminho |
|---------|---------|
| Schema SQL (fonte de verdade) | `database/smartchannel-db-v2-refactored-part*.sql` |
| Seed / demo v6 | `database/carga-inicial-v6.sql` |
| Validação | `database/validate-v6.js` (requer `pg`) |
| Política “sem migrations paliativas” | [INTEGRACAO_SCHEMA_PRINCIPAL.md](./INTEGRACAO_SCHEMA_PRINCIPAL.md) |
| Instalação servidor | [README_INSTALACAO_SERVIDOR.md](./README_INSTALACAO_SERVIDOR.md) |
| Portas | [PORTAS_E_SERVICOS_EXCLUSIVOS.md](./PORTAS_E_SERVICOS_EXCLUSIVOS.md) |

---

## Limpeza do repositório

| Documento | Descrição |
|-----------|-----------|
| [**LIMPEZA_E_ARQUIVOS_CANDIDATOS_EXCLUSAO.md**](./LIMPEZA_E_ARQUIVOS_CANDIDATOS_EXCLUSAO.md) | Lista de pastas/ficheiros **candidatos** a arquivo ou exclusão (com riscos). |

---

## Documentação de utilizador e técnica (estrutura clássica)

### Utilizador
- [Introdução](./user/01-introducao.md)
- [Manual do utilizador](./user/02-manual-usuario.md)
- [FAQ](./user/03-faq.md)
- [Tutoriais](./user/04-tutoriais.md)

### Técnica
- [API](./technical/01-api.md)
- [Desenvolvimento](./technical/02-desenvolvimento.md)
- [Migração](./technical/03-migracao.md)
- [Instalação](./technical/04-instalacao.md)
- [Changelog](./technical/05-changelog.md)

### Plataforma
- [Arquitetura](./platform/01-arquitetura.md)
- [Requisitos](./platform/02-requisitos.md)
- [Configuração](./platform/03-configuracao.md)
- [Workflows](./platform/04-workflows.md)
- [Recursos e regras](./platform/05-recursos-regras.md)

---

**Versão da documentação (índice):** 2.1.x  
**Última atualização deste índice:** abril de 2026
