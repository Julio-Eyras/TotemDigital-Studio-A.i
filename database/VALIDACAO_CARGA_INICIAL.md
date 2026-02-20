# Validação da Carga Inicial V6

## 📋 IDs Esperados e Relacionamentos

### Entidades Principais
- **Subscribers**: 1-5
- **Publishers**: 1-5
- **Totems**: 1-10
- **Locals**: 1-10
- **Campaigns**: 1-5
- **Medias**: 1-6
- **Playlists**: 1-6
- **Subscriber Contracts**: 1-5
- **Publisher Contracts**: 1-5

### Relacionamentos Totem → Local → Publisher
- Totem 1 → Local 1 → Publisher 1 (Shopping)
- Totem 2 → Local 2 → Publisher 1 (Shopping)
- Totem 3 → Local 3 → Publisher 1 (Shopping)
- Totem 4 → Local 4 → Publisher 2 (Farmácia)
- Totem 5 → Local 5 → Publisher 2 (Farmácia)
- Totem 6 → Local 6 → Publisher 3 (Aeroporto)
- Totem 7 → Local 7 → Publisher 3 (Aeroporto)
- Totem 8 → Local 8 → Publisher 4 (Urbano)
- Totem 9 → Local 9 → Publisher 5 (Supermercado)
- Totem 10 → Local 10 → Publisher 5 (Supermercado)

### Relacionamentos Campaign → Subscriber → Contract
- Campaign 1 → Subscriber 1 → Contract 1
- Campaign 2 → Subscriber 2 → Contract 2
- Campaign 3 → Subscriber 3 → Contract 3
- Campaign 4 → Subscriber 4 → Contract 4
- Campaign 5 → Subscriber 5 → Contract 5

### Totem Playlists
- Totem Playlist 1 → Totem 1 → Publisher 1
- Totem Playlist 2 → Totem 2 → Publisher 1
- Totem Playlist 3 → Totem 3 → Publisher 1
- Totem Playlist 4 → Totem 4 → Publisher 2
- Totem Playlist 5 → Totem 5 → Publisher 2
- Totem Playlist 6 → Totem 6 → Publisher 3 ✅ **CORRIGIDO**
- Totem Playlist 7 → Totem 1 → Publisher 1 (recente)
- Totem Playlist 8 → Totem 2 → Publisher 1 (recente)
- Totem Playlist 9 → Totem 3 → Publisher 1 (recente)
- Totem Playlist 10 → Totem 9 → Publisher 5 (recente)
- Totem Playlist 11 → Totem 10 → Publisher 5 (recente)

### Totem Playlist Generation Log
- Log 1 → Totem 1 → Totem Playlist 1 → Publisher 1
- Log 2 → Totem 2 → Totem Playlist 2 → Publisher 1
- Log 3 → Totem 3 → Totem Playlist 3 → Publisher 1
- Log 4 → Totem 4 → Totem Playlist 4 → Publisher 2
- Log 5 → Totem 5 → Totem Playlist 5 → Publisher 2
- Log 6 → Totem 6 → Totem Playlist 6 → Publisher 3 ✅ **CORRIGIDO**
- Log 7 → Totem 1 → Totem Playlist 7 → Publisher 1
- Log 8 → Totem 2 → Totem Playlist 8 → Publisher 1
- Log 9 → Totem 3 → Totem Playlist 9 → Publisher 1
- Log 10 → Totem 4 → Totem Playlist 4 → Publisher 2
- Log 11 → Totem 5 → Totem Playlist 5 → Publisher 2
- Log 12 → Totem 9 → Totem Playlist 10 → Publisher 5
- Log 13 → Totem 10 → Totem Playlist 11 → Publisher 5
- Log 14 → Totem 6 → NULL → Publisher 3 (failed)
- Log 15 → Totem 8 → NULL → Publisher 4 (failed)
- Log 16 → Totem 7 → NULL → Publisher 3 (failed)

## ✅ Status de Validação

- [x] Totem Playlist 6 adicionado
- [ ] Verificar todos os foreign keys
- [ ] Validar todos os relacionamentos
- [ ] Testar carga completa
