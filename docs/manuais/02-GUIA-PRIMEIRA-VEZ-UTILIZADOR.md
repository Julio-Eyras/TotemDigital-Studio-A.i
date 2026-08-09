# 02 — Guia do utilizador (primeira vez)

Objectivo: em **menos de 30 minutos**, perceber o painel e publicar o primeiro conteúdo no modo correcto.

---

## 1. Antes de começar

1. URL do painel (ex.: `https://dev.totemdigital.app.br` ou produção).
2. Credenciais (seed `dev`/`dev123` ou owner do install).
3. Saber qual **modo** a instalação deve usar (pergunte ao admin):
   - **Direct Totem** — uma org, publicar nos seus totens
   - **Multi Lite** — várias orgs + anunciantes, sem planos/billing
   - **Multi Pro** — agência completa

Se ainda estiver em Direct e precisar de anunciantes → pedir ao admin para activar **lite** ou **Pro** em Complementos.

---

## 2. Login e primeiro ecrã

1. Abrir `/login`
2. Entrar com utilizador/senha
3. Menu lateral: depende do modo (Direct é curto; Lite/Pro mostram Organizações, Anunciantes, etc.)

**Complementos do sistema** (`/settings/system-modules`) — só owner/admin: define o modo da instalação.

---

## 3. Fluxo A — Direct Totem (primeira publicação)

1. **Sua organização** → confirmar dados  
2. **Unidades / Locais** → criar local se vazio  
3. **Totens / Dispositivos** → registar totem (UIN / device)  
4. **Biblioteca de Mídias** → carregar vídeo/imagem  
5. **Publicar em Totem** → escolher mídia + totem → publicar  
6. No player: `serverUrl` aponta para o servidor; UIN correcto → deve receber o plano

---

## 4. Fluxo B — Multi Lite (anunciante → ecrãs)

Ordem **obrigatória** (sem planos):

```text
Organizações (com locais/totens)
        ↓
Cadastro de Anunciantes
        ↓
Anunciante ↔ Organização  (SPA — conceder acesso)
        ↓
Mídias do anunciante (aprovadas)
        ↓
Publicar em tela (Quick Publish)  — sem contrato
```

### Passo a passo

1. **Organizações** → criar/editar orgs; locais; totens activos  
2. **Anunciantes → Cadastro de Anunciantes** → criar (só nome basta)  
3. **Anunciantes → Anunciante ↔ Organização** → Conceder acesso  
   - Anunciante + Organização  
   - Contrato **opcional** no Lite (deixar vazio)  
4. Mídias do anunciante → upload → **aprovar**  
5. **Publicar em tela** → escolher anunciante → telas elegíveis → mídias → publicar  

Se a lista de totens estiver vazia: falta SPA ou totens inactivos / sem local.

---

## 5. Fluxo C — Multi Pro (com planos)

1. Criar **Planos** e `plan_publisher_access` / `plan_local_access`  
2. Criar **Contrato** do anunciante com `plan_id`  
3. (Ou) SPA derivado da reconciliação plano↔contrato  
4. Quick-publish / campanhas **com** contrato activo  
5. Billing / OTA / dispatcher conforme necessidade  

No Pro, o motor de entrega usa sobretudo **contrato + plano**; SPA também é aceite.

---

## 6. Conceitos rápidos (UI)

| Menu | Significado |
|------|-------------|
| Organizações | Quem **possui** os ecrãs |
| Anunciantes | Quem **aluga** espaço nos ecrãs |
| Anunciante ↔ Organização | Permissão Lite (e manual no Pro) |
| Publicar em tela | Atalho operacional (quick-publish) |
| Campanhas | Agendamento / prioridade / mix |
| Complementos | Modo da instalação (Direct/Lite/Pro) |

---

## 7. Checklist “está a funcionar?”

| Check | Direct | Lite |
|-------|--------|------|
| Totem online (heartbeat) | □ | □ |
| Mídia aprovada | □ | □ |
| Publicação sem erro | □ | □ |
| SPA concedido | — | □ |
| Conteúdo no ecrã | □ | □ |

---

## 8. Problemas comuns (utilizador)

| Problema | Causa provável | O que fazer |
|----------|----------------|-------------|
| Não vejo Anunciantes | Modo Direct | Pedir Lite/Pro |
| Criar anunciante OK mas não publico | Sem SPA / sem contrato (Pro) | Conceder SPA (Lite) ou contrato+plano (Pro) |
| 403 ao abrir Planos/Billing | Lite | Esperado — só Pro |
| Totens vazios no Quick Publish | Sem acesso comercial | SPA ou plano |
| Player preto | UIN / URL / campanha sem mídia | Conferir config + dispatch |

---

## 9. Próximos documentos

- Campos e funcionalidades de **Publicar em Totem**: [07-MANUAL-PUBLICAR-EM-TOTEM.md](./07-MANUAL-PUBLICAR-EM-TOTEM.md)  
- Formas de trabalho: [03-MODULOS-E-FORMAS-DE-TRABALHO.md](./03-MODULOS-E-FORMAS-DE-TRABALHO.md)  
- Admin (modo, purge, portal): [04-MANUAL-ADMINISTRATIVO.md](./04-MANUAL-ADMINISTRATIVO.md)
