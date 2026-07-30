# Complementos do sistema (módulos de produto) — Fase A

**Branch:** `TotemDigital.app`  
**Estado:** Fase A (foundation) — catálogo, persistência, painel admin.  
**Próximo:** Fase B — gates de menu/API por módulo.

## Conceito

| Camada | Controla | Quem gere |
|--------|----------|-----------|
| **Módulos** (`installation.modules`) | Produto da **instalação** (tem financeiro? multi-agência?) | `owner_system` / `admin_sql` |
| **`flag_smart_*`** | Permissão do **utilizador** (este login vê billing?) | Admin em Usuários → Flags |

Não misturar: módulo off = feature inexistente na instalação; flag = quem usa quando o módulo está on.

## O que a Fase A entrega

1. Catálogo em `backend/src/policy/installationModules.ts`
2. Setting `system_settings.installation.modules` (JSON; `{}` = defaults do perfil)
3. Capabilities incluem `modules` em `GET /api/dashboard/ui-context`
4. API admin:
   - `GET /api/installation/modules`
   - `PUT /api/installation/modules` body `{ modules: { billing: true, ... } }`
5. UI: **Complementos do sistema** → `/settings/system-modules`
6. Dependências validadas no save (ex.: billing requer plans)

## O que a Fase A *não* faz

- Ainda **não** esconde menus nem bloqueia rotas com base nos toggles (mensagem explícita no painel).
- Perfil legado (`single_publisher` / `multi_agency` / env Direct Totem) continua a mandar na UI operacional.

## Testar na dev

```bash
cd ~/TotemDigital-Studio && git fetch && git checkout TotemDigital.app && git pull
bash scripts/Instala-TotemDigital-Server.sh --modo atualizar --instancia dev --git-pull --sim
```

Login owner/admin_sql → menu **Complementos do sistema** → alterar → Guardar → confirmar em BD:

```sql
SELECT setting_value FROM system_settings WHERE setting_key = 'installation.modules';
```

## Fase B (concluída na branch)

Ver `docs/COMPLEMENTOS-SISTEMA-MODULOS-FASE-B.md`: gates de menu/API + sync de modos.

## Autorização

Só `owner_system` e `admin_sql` (não `admin` genérico).
