# Portal DNS/Nginx parametrizável por organização e anunciante

**Branch:** `TotemDigital-MultiAgencia`  
**Estado:** Fase 1 entregue (slug + settings + sync + Nginx wildcard)

## Modelo de hosts

| Tipo | Exemplo |
|------|---------|
| Portal de papel | `publisher.totemdigital.app.br` / `subscriber.…` |
| Por organização | `{slug}.publisher.{base}` |
| Por anunciante | `{slug}.subscriber.{base}` |
| LAN / dnsmasq | `{slug}.publisher.local` / `{slug}.subscriber.local` |

## O que foi entregue

1. Colunas `portal_slug` em `publishers` e `subscribers` (schema part2 + índices únicos)
2. Settings: `portal.base_domain`, `portal.dns_mode` (`off` \| `public_wildcard` \| `local_dnsmasq`), `portal.sync_enabled`
3. API:
   - `GET/PUT /api/installation/portal`
   - `POST /api/installation/portal/sync` → gera snippets em `runtime/portal-hosts/`
4. Script: `scripts/sync-portal-hosts.sh` (copia para `/etc/nginx/snippets` e dnsmasq)
5. Template multi-instância com wildcards + headers `X-Subdomain-Type` / `X-Tenant-Slug`
6. Middleware e frontend detectam `{slug}.publisher|subscriber.…`
7. UI: Complementos → **Portal DNS / Nginx**; formulários de organização/anunciante com campo slug
8. Isolamento JWT ↔ `tenantSlug`: resolve slug→id no host; 403 `TENANT_HOST_MISMATCH` se o token não for do tenant (bypass só `owner_system`)

## Como activar (VPS)

```bash
cd ~/TotemDigital-Studio && git pull
# aplicar schema (part2) + seeds portal.* via update habitual
bash scripts/Instala-TotemDigital-Server.sh --modo atualizar --instancia dev --git-pull --sim
```

1. Complementos → Portal DNS: domínio base + modo `public_wildcard`
2. Em organização/anunciante: definir `portal_slug` (ex. `rede-x`, `loja-abc`)
3. **Gerar / sync Nginx+DNS** (ou `sudo bash scripts/sync-portal-hosts.sh`)
4. DNS público: `*.publisher.BASE` e `*.subscriber.BASE` → IP do VPS  
5. Certificado HTTPS: wildcard (DNS-01) recomendado para HTTPS nos subdomínios

### Sync automático (opcional)

- Ligar `portal.sync_enabled` **só** com sudoers estreito, ex.:
  `smartsignage ALL=(root) NOPASSWD: /opt/.../scripts/sync-portal-hosts.sh`

## Ainda não coberto

- Emissão automática de certificados LE wildcard
- Integração API do provedor DNS (Cloudflare/etc.) one-click remoto

## Isolamento JWT ↔ tenantSlug

Quando o host é `{slug}.publisher|subscriber.BASE`:

1. `detectSubdomain` resolve `portal_slug` → `req.portalTenant` (404 `UNKNOWN_TENANT_SLUG` se inexistente)
2. Após autenticação, `enforcePortalTenantAccess` exige JWT alinhado ao tenant
   - publisher: `user.publisherId === portalTenant.publisherId`
   - subscriber/client: `user.subscriberId` (ou `clientId`) === `portalTenant.subscriberId`
   - bypass: apenas `owner_system`
3. Listagens `GET /api/publishers` e `GET /api/subscribers` no host tenant devolvem só o registo do slug
4. `resolveTenantScope` (dashboard/analytics) respeita `portalTenant`
