# Ponte FX → ACE 0.1

**Lab.** O SmartDisplayFX continua a disparar efeitos. O ACE só recebe **bools anónimos**.

| Evento FX | ACE |
|-----------|-----|
| `touch` | `interaction.touch` |
| `tag_id` (UID descartado) | `interaction.nfc` (ou `qr` se `extra.channel=qr`) |
| `facial_recognition` | `IDENTITY_LEAK` — não entra |
| `gesture` | ignorado no 0.1 |
| `handleAiEvent` com `mood` / `age` / face | `IDENTITY_LEAK` — não entra |

O FX **não** deixa de usar `mood` para efeitos visuais. Esse caminho não alimenta o Dispatcher.

Hint ACE sanitizado pode ir no MQTT (`ace.hint`) e `fx_rules.ace_category` pode casar PREMIUM/STANDARD/FILL — sem UID.

`totemId` tem de ser numérico (`totems.totem_id`). UIN em texto é ignorado no 0.1.
