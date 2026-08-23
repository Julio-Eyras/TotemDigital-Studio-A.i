# Player-AD Maestro — cue vs matriz (one-pager)

**Tipo:** plano de produto (lab) — **sem alteração de código**  
**Data:** 22 de agosto de 2026  
**Autor:** Julio Cesar Eyras (J.C.E.) / Eyras Sistemas e Soluções  
**Licença:** proprietária  
**Baseline operacional:** Player-AD **2.13 / 113** · TV_BOX_3 (Allwinner) · Direct / Kit Pronto  
**Irmão (outra camada):** [CONVERSA-PROTOCOLO-DOOH-TDEP-2026-08.md](./CONVERSA-PROTOCOLO-DOOH-TDEP-2026-08.md)

---

## 0. Estatuto

- **Não entra** no pitch de 15 min nem no Kit Pronto.
- **Não substitui** o Player-AD actual (1 box = 1 HDMI = 1 tela).
- **Não é TDEP / TotemNet.** TDEP partilha campanha e inventário *entre CMS*. Isto trata pixels e cue *dentro do sítio*.
- HDMI-CEC **continua fora** (TV_BOX_3 sem CEC utilizável).
- Default **off**. Direct permanece Direct.

Promessa numa frase: *o maestro marca o tempo; cada tela continua tua.*

---

## 1. Dois problemas, dois SKUs

O Player-AD hoje usa Wi‑Fi para CMS, heartbeat e comandos. **Não** é switcher de vídeo.

| SKU de lab | Nome comercial | O que sincroniza | Hardware típico |
|------------|----------------|------------------|-----------------|
| **A — Cue** | Rede sincronizada | Relógio + “agora toca o item X” | N× Player-AD (totens) |
| **B — Matriz** | Espelho LED/TV | O mesmo sinal de pixels | 1 encoder + TVs / sending card LED |

Quem pede “o Player-AD como hub/switch sem fio” está, na prática, a pedir **A**, **B**, ou os dois empilhados. Misturar no mesmo SKU falha no campo.

---

## 2. SKU A — Rede sincronizada (Maestro Cue)

Cada totem continua a ser um Player-AD com cache local. O maestro **não envia o vídeo no ar** no momento do play: envia o **cue**.

```
CMS / Dispatcher
        |
        v
Player-AD maestro (ou o próprio servidor)
   NTP + cue (UDP multicast / MQTT / comando no t0)
        |
        +-- Totem 1  Player-AD  ficheiro em cache  play @ t0
        +-- Totem 2  Player-AD  ficheiro em cache  play @ t0
        +-- Totem N  Player-AD  ficheiro em cache  play @ t0
```

**Meios**

| Camada | Protocolo / meio | Papel |
|--------|------------------|--------|
| Relógio | NTP (mínimo); PTP / IEEE 1588 se genlock | Arranque alinhado |
| Cue | UDP multicast LAN; MQTT; WebSocket | `play itemId @ unix t0` |
| Já existe | `sync_now` / `refresh_dispatch` via servidor | “Quase juntos”, não frame-accurate |
| Rede | Wi‑Fi 6 **SSID só de players** (5/6 GHz) | Não usar o Wi‑Fi de clientes da loja |
| Conteúdo | HTTP(S) do CMS + cache Player-AD | Pré-carregar; play local |

**Serve para:** loja, shopping, fila de totens, “todas as vitrines mudam à mesma hora”.

**Não serve para:** video wall mosaico, o mesmo *live* em 8 TVs, LED como uma única superfície.

**Encaixe no produto actual:** o caminho mais curto. Usa cache, proof-of-play e comandos que já existem; o lab é relógio + cue com `t0`.

---

## 3. SKU B — Espelho LED/TV (Maestro Matriz)

Um decoder/encoder publica o **programa**. Destinos recebem pixels. A TV_BOX_3 **não** deve ser o encoder de N saídas 1080p.

```
CMS / Dispatcher
        |
        v
Player-AD (programa) --HDMI--> encoder (NUC / PC / appliance)
                                  |
                    NDI HX / SRT / HLS / HDMI wireless
                                  |
                    +-- Smart TV (app / Cast / IPTV)
                    +-- LED: receptor HDMI --> sending card
                        (NovaStar, Colorlight, Linsn, …)
```

**Transporte de imagem (sem fio ou AV-over-IP)**

| Meio | Latência típica | Uso realista |
|------|-----------------|--------------|
| NDI / NDI HX | ~1–3 frames | Hub tipo switcher na LAN |
| SRT | 20–120 ms (tunável) | Um-para-muitos, inclusive WAN |
| WebRTC (LAN) | 50–200 ms | Smart TV / browser |
| MPEG-TS multicast UDP | baixa no cabo | TVs IPTV; Wi‑Fi **odeia** multicast |
| RTSP / RTMP | média | Encoders, alguns controladores |
| HLS / DASH | 2–15 s | “Quase live”; mau para sync apertado |
| Miracast / Wi‑Fi Display | variável | Demo 1 TV; N destinos frágil |
| Google Cast | 1–3 s | Smart TV; não é switcher |
| WHDI / HDMI wireless 5 GHz | quase cabo | 1–2 TVs, 5–15 m; hardware extra |
| WiGig 60 GHz | quase cabo | Sala curta, linha de vista |
| SDVoE / ST 2110 | broadcast | Quase sempre **cabo 10 GbE** |

**LED:** o módulo não “entra no Wi‑Fi como uma TV”. O sem fio acaba num **HDMI no sending card**. Vários painéis no mesmo wall = processador LED, não Player-AD.

**Smart TV:** operação = HDMI + stick/box, ou app a puxar HLS. Cast/Miracast = demo.

**Controlo de switch (opcional):** NDI routing; MQTT `site/lobby/program`; OSC / Art-Net se o LED já vive em lighting.

---

## 4. O que não prometer

| Pedido | Resposta |
|--------|----------|
| “A box Allwinner vira matriz Wi‑Fi de 8 TVs” | Não. SoC insuficiente. Encoder à parte. |
| “Genlock de cinema no totens Direct” | Não no SKU A v1. NTP + cue. PTP é lab B+/profissional. |
| “Desligar a TV pelo Player-AD” | Não (CEC fora na TV_BOX_3). |
| “TDEP resolve o video wall” | Não. TDEP não transporta pixels. |
| “Multicast de vídeo no Wi‑Fi da loja” | Não. AP próprio; de preferência cabo no SKU B. |
| Preço / pitch Kit Pronto | Lab. Sob consulta. Fora do roteiro de 15 min. |

---

## 5. Empilhamento correcto (quando o sítio pede os dois)

```
TDEP / TotemNet     campanha entre empresas          (outra conversa)
        |
        v
SKU A Cue           N totens, mesmo item, mesmo t0   (Player-AD × N)
        |
        v
SKU B Matriz        1 programa -> LED / TVs espelho  (encoder, não a box)
```

Wi‑Fi de players: SSID dedicado, sem roaming agressivo. Cabo Ethernet no maestro e no encoder do SKU B sempre que existir.

---

## 6. Caminho de maturação (ainda sem código)

1. **Papel (este documento)** — dois SKUs nomeados; TDEP separado.
2. **SKU A lab** — NTP verificável + cue `play @ t0` em 2 boxes; medir desvio (alvo: < 200 ms comercial; < 40 ms se PTP).
3. **SSID de players** — checklist de campo (AP 5/6 GHz, sem clientes da loja).
4. **SKU B lab** — 1 encoder NDI HX ou SRT + 1 TV + 1 HDMI em sending card LED de parceiro. Player-AD só alimenta o encoder.
5. **Só então** comando/UI no Direct. Até lá, não tocar no Player-AD operacional nem no Kit Pronto.

---

## 7. Próximo artefacto (se avançar)

Whitepaper curto **Maestro 0.1**: mensagem de cue (JSON), tolerância de relógio, códigos de recusa (`CLOCK_DRIFT`, `ASSET_MISSING`, `SSID_NOT_AV`), e diagrama de ligação LED (HDMI obrigatório no sending card).

Contacto / titular: Julio Cesar Eyras (J.C.E.) — Eyras Sistemas e Soluções  
Repositório: https://github.com/Julio-Eyras/TotemDigital-Studio
