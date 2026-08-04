# 04 — Manual administrativo

**Público:** `owner_system`, `admin_sql`, `admin`  
**UI central:** Complementos do sistema → `/settings/system-modules`

---

## 1. Responsabilidades do administrador

| Área | Acções |
|------|--------|
| Modo de produto | Direct / Lite / Pro |
| Utilizadores e roles | Criar, desactivar, permissões |
| Organizações | Bootstrap, seed 2ª agência |
| Comercial Lite | Garantir SPA anunciante↔org |
| Comercial Pro | Planos, contratos, billing |
| Portal (opcional) | DNS / Nginx / JWT tenant |
| Purge | Só consciente, dry-run primeiro |
| Operação | Restart serviço, logs, backups |

---

## 2. Alterar o modo (Complementos)

1. Login como owner/admin  
2. **Complementos do sistema**  
3. Select **Modo**: Direct Totem (off) | lite | Pro  
4. Confirmar → reload do painel  
5. Se a UI pedir restart:  
   `sudo systemctl restart smart-signage` ou `smart-signage-dev`

### API equivalente

```http
PUT /api/installation/multi-agency
Authorization: Bearer <token>
Content-Type: application/json

{ "mode": "lite" }
```

Legado: `{ "enabled": true }` = Pro (`full`); `{ "enabled": false }` = Direct (`off`).

### Efeitos

| De → Para | Efeito |
|-----------|--------|
| Qualquer → Lite/Pro | Pode criar org owner se BD vazia; seed 2ª agência se configurado |
| Lite/Pro → Direct | Direct Totem ON; comercial some do menu; **dados mantidos** |
| Qualquer → Purge | **Não** — purge é secção separada |

---

## 3. Bootstrap e seed

Ao activar lite/full:

1. Se **0** publishers activos → cria organização **owner** (`SYSTEM_OWNER_NAME` / email)  
2. Se exactamente **1** org e `portal.seed_second_agency` ≠ false → cria 2ª agência + anunciante demo  
3. Seed Lite: concede **SPA** demo (anunciante → owner e 2ª agência)

Botão **Seed 2ª agência** também pode existir na secção Portal da UI.

---

## 4. Utilizadores e segurança

- Roles típicas: `owner_system`, `admin_sql`, `admin`, operadores, `publisher_user`, `subscriber_user`  
- Só owner/admin_sql mudam **installation.modules** / modo  
- `flag_smart_*` controlam itens avançados por utilizador (não substituem módulos)  
- Rotacionar passwords seed (`dev`/`dev123`) em ambientes expostos

---

## 5. Checklist admin — Multi Lite

1. Modo = **lite** (chip / perfil `multi_agency`)  
2. ≥1 organização com locais e totens activos  
3. Anunciante criado  
4. SPA concedido em **Anunciante ↔ Organização**  
5. Mídia aprovada  
6. Quick-publish OK  
7. Confirmar 403 em `/api/plans`, `/api/billing` (esperado)

---

## 6. Checklist admin — Multi Pro

1. Modo = **Pro**  
2. Planos com `plan_publisher_access` (+ `plan_local_access` se compacto)  
3. Contratos activos com `plan_id`  
4. Campanhas / quick-publish com contrato  
5. Billing / OTA conforme contrato comercial  
6. Workers reconciliados (sem erro na UI)

---

## 7. Portal DNS / Nginx (opcional)

Só se precisarem de `{slug}.publisher.<base>` / `{slug}.subscriber.<base>`:

1. Em Complementos → secção Portal  
2. Domínio base (ex. `dev.totemdigital.app.br`)  
3. DNS mode: `off` | `public_wildcard` | …  
4. Cloudflare opcional (`CLOUDFLARE_API_TOKEN`)  
5. Sync hosts / SSL (dry-run LE por defeito)

Com Portal **off**, multi-agência funciona no host único.

Detalhe: handoff §3.3 e serviços `portalHostService` / `portalSslService`.

---

## 8. Purge comercial (zona de perigo)

- **Nunca** ligado ao OFF do multi-agência  
- Frase exacta: `APAGAR DADOS COMERCIAIS DESTA INSTALAÇÃO`  
- Sempre **dry-run** primeiro  
- Escopos: billing, campaigns, playlists, contracts, media (BD+disco), subscribers, publishers_extra  
- Parcial por `publisherId`  
- Export/audit em `runtime/purges/`  

API sob `/api/installation/commercial-purge/*`

---

## 9. Operação de serviço

```bash
# Dev
sudo systemctl status smart-signage-dev
sudo systemctl restart smart-signage-dev
journalctl -u smart-signage-dev -f

# Produção
sudo systemctl status smart-signage
journalctl -u smart-signage -f
```

Actualizar código: ver [01-INSTALACAO-PARAMETROS.md](./01-INSTALACAO-PARAMETROS.md) §5.3.

---

## 10. Monitorização rápida

| Sinal | Onde |
|-------|------|
| Totem online | Heartbeat / lista de totens |
| Dispatch vazio | Dispatcher (Pro) ou campanha sem mídia / sem SPA |
| 403 módulo | Complementos — módulo off |
| Workers falharam hot-reload | Restart systemd |

---

## 11. Boas práticas

1. Não desenvolver/testar multi na pasta de **produção**  
2. Preferir `dev` para smoke Lite/Pro  
3. Documentar o modo escolhido por cliente  
4. Backup BD antes de wipe/purge  
5. Após mudar modo, hard refresh no browser  

---

## 12. Ver também

- Módulos: [03-MODULOS-E-FORMAS-DE-TRABALHO.md](./03-MODULOS-E-FORMAS-DE-TRABALHO.md)  
- Técnico: [05-MANUAL-TECNICO-MODELO-ER-API.md](./05-MANUAL-TECNICO-MODELO-ER-API.md)  
- Handoff: [../HANDOFF-MULTI-AGENCIA-CONTINUIDADE.md](../HANDOFF-MULTI-AGENCIA-CONTINUIDADE.md)
