# Importação Brasil — TV box signage (guia rápido)

Estimativas para planejamento. **Confirmar com despachante** antes de pedido em volume.

---

## Modalidades comuns

| Modalidade | Quando usar | Prazo típico |
|------------|-------------|--------------|
| **Courier (DHL/FedEx/UPS)** | Amostras 1–5 un | 7–15 dias |
| **Freight aéreo** | 20–100 un | 15–25 dias |
| **Freight marítimo** | 100+ un | 35–60 dias |

---

## Custos além do FOB (landed cost)

```
Custo total ≈ FOB + frete internacional + seguro + despesas aduaneiras + ICMS + honorários despachante
```

| Item | Faixa indicativa (amostra) | Faixa indicativa (lote) |
|------|---------------------------|-------------------------|
| FOB unitário signage | USD 25–55 | USD 20–45 (MOQ 100+) |
| Frete courier 2 un | USD 40–90 | — |
| Frete marítimo LCL | — | USD 200–800+ (volume) |
| II (importação) | 0–16% (NCM do produto)* | idem |
| ICMS | 17–20% (estado destino)* | idem |
| Despachante | R$ 800–2.500/pedido | negociável |

\* **NCM:** classificar com despachante (geralmente equipamento eletrônico / receptor multimídia — confirmar código exato).

---

## Documentos do fornecedor (solicitar no PI)

- [ ] Proforma Invoice (PI) com peso e dimensões
- [ ] Packing list
- [ ] Invoice comercial
- [ ] Certificado origem (se acordo preferencial)
- [ ] Lista de materiais / especificação (para NCM)

---

## Dicas negociação

1. Pedir **DDP** (Delivered Duty Paid) na cotação — preço “porta Brasil” (menos surpresa).
2. Amostras: declarar valor real; marcar **“commercial sample”** se aplicável.
3. Lote: negociar **firmware pré-provisionado** (portrait + boot + APK) na fábrica — reduz trabalho em campo.
4. RMA: definir **quem paga retorno** de unidade com defeito.

---

## Checklist recebimento amostra

1. Conferir modelo/SoC vs PI  
2. `install-player-adb.ps1 -SkipBuild`  
3. Teste portrait + boot + Player-AD  
4. Registrar na [TVBOX-PROCUREMENT-COMPARISON.csv](../TVBOX-PROCUREMENT-COMPARISON.csv)

---

*Guia orientativo — jul/2026*
