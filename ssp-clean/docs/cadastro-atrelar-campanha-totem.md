# Onde atrelar campanha a totem no cadastro

Caminho na interface e regra de **destino final** da campanha.

---

## Caminho no menu

1. **Menu lateral** → **Assinantes** → **Campanhas**  
   (ou atalho **Campanhas** no menu / Dashboard.)

2. **URL:** `/campaigns`

3. **Listagem** → criar nova campanha ou **editar** uma existente.

4. Na tela da campanha, **abas** no topo:
   - **Principal** – título, categoria, etc.
   - **Publicadores** – onde a campanha será exibida (base).
   - **Totens** – restringir a totens específicos (entre os dos publicadores já escolhidos).
   - Smart TVs, Mídias, Playlists, Agendamento.

---

## Regra do destino final (forma 2 ativa)

O **destino final** da campanha é a **lista de totens oriundos da aba Publicadores**, podendo ser restringida pela aba Totens:

| Aba | Função |
|-----|--------|
| **Publicadores** | Define em **quais publicadores** a campanha pode ser exibida. O conjunto base de totens é: **todos os totens** dos locais desses publicadores (quem tiver contrato/plano com acesso a esses publicadores usa essa base). |
| **Totens** | Lista de totens **derivada dos publicadores** já selecionados. Serve para **restringir** a campanha a **um ou mais totens** dentro dessa base. Se você **não** marcar totens (deixar vazio), a campanha vale para **todos** os totens dos publicadores escolhidos. Se marcar totens, a campanha vale **só** para os totens marcados. |

Ou seja: a **opção 2** (aba Totens / `campaign_totems`) serve para **restringir** a um ou mais totens **entre** os que vêm dos publicadores marcados na aba Publicadores. O destino final considerado pelo dispatcher/mix é sempre essa lista de totens (base = publicadores; opcionalmente filtrada pelo que está na aba Totens).

---

## Resumo do caminho

```
Menu → Assinantes → Campanhas  (ou Campanhas)
  → Abrir/editar campanha
    → Aba "Publicadores"  → selecionar publicadores (base: todos os totens desses publicadores)
    → Aba "Totens"        → opcional: restringir a totens específicos (lista vem dos publicadores)
```

**Destino final:** totens dos publicadores da aba Publicadores; se houver seleção na aba Totens, apenas esses totens.

**URL direta:** `/campaigns`
