# TotemNet / TDEP 0.1 — one-pager para um parceiro

**Tipo:** nota comercial (lab) — para enviar a um CMS de LED / shopping / rede irmã  
**Data:** 25 de agosto de 2026  
**Autor:** Julio Cesar Eyras (J.C.E.) / Eyras Sistemas e Soluções  
**Licença:** proprietária  
**Irmão técnico:** [TDEP-0.1.md](./TDEP-0.1.md) · debate: [../CONVERSA-PROTOCOLO-DOOH-TDEP-2026-08.md](../CONVERSA-PROTOCOLO-DOOH-TDEP-2026-08.md)

Promessa numa frase: *as telas continuam tuas; o ar ocioso pode ser partilhado.*

---

## 0. Estatuto

- **Não entra** no pitch de 15 min nem no Kit Pronto.
- **Não** é um CMS. Cada um fica com o seu.
- **Não** há `/tdep/v1` em produto. Isto é lab 0.1 (JSON + duas implementações).
- Direct / Kit Pronto continuam **default off**.
- TDEP **não** transporta audiência (sem `audience`, face, mood).

---

## 1. O problema que resolvemos juntos

Uma rede tem totens; outra tem painéis LED. Hoje uma campanha nas duas exige integração à medida.

Com TDEP o anunciante descreve o criativo **uma vez** (com **variantes** de formato). Cada CMS autoriza, toca no **seu** dispositivo e devolve **proof** assinado. O hub **não** fala com a TV box nem com o sending card.

| Vocês | Nós | O protocolo |
|-------|-----|-------------|
| Continuam donos do CMS, da face e do player | Continuamos donos dos totens Direct | Língua de ar: inventário, flight, autorização, proof |

---

## 2. O que o dono da tela não perde

| Regra | Significado |
|-------|-------------|
| Opt-in por face | Ligar um painel **não** liga os outros. Default **off**. |
| Prioridade local | O cardápio da loja **ganha** ao fill do parceiro. |
| Cap | Fase 1: até **10%** do ar ocioso. |
| Kill-switch | Cortar o parceiro em segundos, no vosso CMS. |
| Sem silent takeover | Sem handshake + política, **zero** plays. |

---

## 3. Seis objectos (é só isto)

`Partner` · `Face` · `Availability` · `Creative` (variantes) · `Flight` · `Proof`

Não há factura no `Flight`. Barter / fill primeiro. Dinheiro (CPM, share) fica **fora** do TDEP 0.1 — o vosso billing continua vosso.

Recusas que o seller pode devolver: formato, áudio, categoria, quota, não cedível, rights, kill-switch. Se o JSON trouxer audiência, recusa `AUDIENCE_FORBIDDEN`.

---

## 4. O que pedimos para um piloto

1. Um **Face** (orientação, pixels, mime, áudio sim/não, categorias vetadas).
2. Um criativo com **duas variantes** (ex.: portrait 1080×1920 e landscape 1920×1080). Não esticar.
3. Handshake de máquinas (HMAC ou mTLS). Sem OAuth de browser.
4. Aceitar fill **só** no ocioso, com cap 10%, até haver contrato de slot garantido.
5. Devolver Proof quando o play acontecer (obrigatório se o flight for `guaranteed`).

Não pedimos: trocar de CMS, instalar o nosso Player-AD, abrir a base de dados, nem deixar o hub mandar no dispositivo.

Lab já tem duas implementações no mesmo schema: totens TotemDigital e um CMS LED fictício ([LED-CMS-0.1.md](./LED-CMS-0.1.md)).

---

## 5. Nomes

| Uso | Nome |
|-----|------|
| Comercial | **TotemNet** |
| Técnico | **TDEP** (`tdep/0.1`) |
| Lab de referência | `totemdigital.app.br` (primeiro nó, não o dono da rede) |

Contrato curto e JSON: [TDEP-0.1.md](./TDEP-0.1.md).
