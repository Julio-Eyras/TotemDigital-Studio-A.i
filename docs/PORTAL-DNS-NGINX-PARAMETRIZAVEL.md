# Portal DNS/Nginx parametrizável por organização e anunciante

**Branch:** `TotemDigital-MultiAgencia`  
**Estado:** Fase 2 entregue (Cloudflare DNS + LE wildcard DNS-01 + seed 2ª agência + isolamento JWT)

## Modelo de hosts

| Tipo | Exemplo |
|------|---------|
| Portal de papel | `publisher.totemdigital.app.br` / `subscriber.…` |
| Por organização | `{slug}.publisher.{base}` |
| Por anunciante | `{slug}.subscriber.{base}` |
| LAN / dnsmasq | `{slug}.publisher.local` / `{slug}.subscriber.local` |

## O que foi entregue

1. Colunas `portal_slug` em `publishers` e `subscribers` (schema part2 + índices únicos)
2. Settings: `portal.base_domain`, `portal.dns_mode`, `portal.sync_enabled`, `portal.dns_provider`, `portal.cloudflare_zone_id`, `portal.dns_target_ipv4`, `portal.ssl_*`, `portal.seed_second_agency`
3. API:
   - `GET/PUT /api/installation/portal`
   - `POST /api/installation/portal/sync` (opcional Cloudflare dry-run)
   - `POST /api/installation/portal/dns/cloudflare`
   - `POST /api/installation/portal/ssl/issue` (**dryRun=true por defeito**)
   - `POST /api/installation/portal/seed-second-agency`
4. Scripts:
   - `scripts/sync-portal-hosts.sh` (`--sim` sem root)
   - `scripts/issue-portal-wildcard-cert.sh` (`--sim` / DNS-01 Cloudflare)
   - `scripts/sim-portal-pipeline.mjs` (teste local sem VPS)
5. Isolamento JWT ↔ `tenantSlug` (403 `TENANT_HOST_MISMATCH`; bypass `owner_system`)
6. Seed 2ª agência + anunciante demo ao activar multi-agência (se só existir 1 org)
7. Nginx instância: preferência automática do cert `portal-wildcard-*`; sync auto-activa `include` do snippet
8. Frontend: detecta e persiste `tenantSlug` (`data-portal-slug` + sessionStorage)

## Como activar (VPS)

```bash
cd ~/TotemDigital-Studio && git pull
# aplicar schema (part2) + seeds portal.* via update habitual
bash scripts/Instala-TotemDigital-Server.sh --modo atualizar --instancia dev --git-pull --sim
```

1. Complementos → Portal DNS: domínio base + modo `public_wildcard`
2. Provedor `cloudflare` + Zone ID + IPv4 do VPS; token **só** em env: `CLOUDFLARE_API_TOKEN` / `PORTAL_CLOUDFLARE_API_TOKEN`
3. Em organização/anunciante: definir `portal_slug`
4. **Gerar / sync** (UI ou API); no VPS: `sudo bash scripts/sync-portal-hosts.sh`
5. SSL: `POST .../portal/ssl/issue` com `{ "dryRun": false }` **ou**  
   `sudo bash scripts/issue-portal-wildcard-cert.sh --base-domain BASE --email ops@…`

### Teste simulado (local, sem root)

```bash
node scripts/sim-portal-pipeline.mjs
# opcional (Git Bash / WSL):
bash scripts/issue-portal-wildcard-cert.sh --sim --base-domain sim.test --email ops@sim.test
bash scripts/sync-portal-hosts.sh --sim runtime/portal-pipeline-sim/portal-hosts
```

### Sync automático (opcional)

- Ligar `portal.sync_enabled` **só** com sudoers estreito, ex.:
  `smartsignage ALL=(root) NOPASSWD: /opt/.../scripts/sync-portal-hosts.sh`

## Isolamento JWT ↔ tenantSlug

Quando o host é `{slug}.publisher|subscriber.BASE`:

1. `detectSubdomain` resolve `portal_slug` → `req.portalTenant` (404 `UNKNOWN_TENANT_SLUG` se inexistente)
2. Após autenticação, `enforcePortalTenantAccess` exige JWT alinhado ao tenant
3. Listagens no host tenant devolvem só o registo do slug
4. `resolveTenantScope` respeita `portalTenant`

## Seed 2ª agência

Ao activar multi-agência (`portal.seed_second_agency=true`, default):

1. Se BD vazia → cria org owner (`portal_slug=org-owner`)
2. Se exactamente 1 org → cria `Agência Demo 2` (`agencia-demo-2`) + `Anunciante Demo` (`anunciante-demo`)
3. Idempotente: não duplica se já existirem ≥2 orgs ou slug ocupado
