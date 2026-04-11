# Diagrama: Relacionamentos Publishers → Locals → Totems → Smart TVs

## 📊 **DIAGRAMA ENTIDADE-RELACIONAMENTO**

```
┌─────────────────────────────────────────────────────────────────┐
│                         PUBLISHERS                               │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │ publisher_id (PK)                                         │   │
│  │ name, contact_name, email, phone, whatsapp                │   │
│  │ description                                               │   │
│  │ is_subscriber, is_publisher, client_type                 │   │
│  │ active                                                    │   │
│  └───────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ 1:N
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                            LOCALS                                │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │ local_id (PK)                                             │   │
│  │ publisher_id (FK) ────────────────────────┐             │   │
│  │ name, address, city, state, zip_code       │             │   │
│  │ country, latitude, longitude                │             │   │
│  │ timezone, description                      │             │   │
│  │ is_active                                  │             │   │
│  └───────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ 1:N
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                            TOTEMS                                │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │ totem_id (PK)                                             │   │
│  │ local_id (FK) ────────────────────────┐                   │   │
│  │ identifier, uin, device_id (UNIQUE)   │                   │   │
│  │ name, description                     │                   │   │
│  │ model, manufacturer                   │                   │   │
│  │ firmware_version, hardware_version    │                   │   │
│  │ os_version                             │                   │   │
│  │ status (offline, online, error, ...)  │                   │   │
│  │ last_heartbeat, heartbeat_interval     │                   │   │
│  │ network_info (JSONB)                   │                   │   │
│  │ capabilities (JSONB)                    │                   │   │
│  │ is_active                               │                   │   │
│  └───────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ 1:0..N
                              │ (um totem pode ter 0, 1 ou N TVs)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                          SMART_TVS                               │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │ tv_id (PK)                                                 │   │
│  │ totem_id (FK) ────────────────────────┐                   │   │
│  │ identifier, device_id (UNIQUE)        │                   │   │
│  │ name, brand, model                     │                   │   │
│  │ platform (webOS, Tizen, Android TV)   │                   │   │
│  │ firmware_version                       │                   │   │
│  │ resolution_width, resolution_height    │                   │   │
│  │ orientation (landscape, portrait)      │                   │   │
│  │ status (offline, online, playing, ...) │                   │   │
│  │ last_heartbeat                           │                   │   │
│  │ capabilities (JSONB)                    │                   │   │
│  │ settings (JSONB)                        │                   │   │
│  │ is_active                               │                   │   │
│  └───────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔗 **CARDINALIDADES**

| Relacionamento | Tipo | Observações |
|----------------|------|-------------|
| **Publishers → Locals** | 1:N | Um publisher pode ter múltiplos locais |
| **Locals → Totems** | 1:N | Um local pode ter múltiplos totens |
| **Totems → Smart TVs** | 1:0..N | Um totem pode ter **nenhuma, uma ou múltiplas** Smart TVs |

---

## 📋 **EXEMPLO PRÁTICO**

```
Publisher: "Shopping Center Norte"
  │
  ├─ Local: "Entrada Principal"
  │   │
  │   ├─ Totem: "TOTEM-ENTRADA-001"
  │   │   │
  │   │   ├─ Smart TV: "TV-ENTRADA-001" (LG webOS)
  │   │   └─ Smart TV: "TV-ENTRADA-002" (Samsung Tizen)
  │   │
  │   └─ Totem: "TOTEM-ENTRADA-002"
  │       │
  │       └─ Smart TV: "TV-ENTRADA-003" (Sony Android TV)
  │
  ├─ Local: "Praça de Alimentação"
  │   │
  │   └─ Totem: "TOTEM-PRACA-001"
  │       │
  │       └─ Smart TV: "TV-PRACA-001" (LG webOS)
  │
  └─ Local: "Área do Cinema"
      │
      └─ Totem: "TOTEM-CINEMA-001"
          │
          └─ Smart TV: "TV-CINEMA-001" (Samsung Tizen)
```

**Resumo:**
- 1 Publisher
- 3 Locals
- 4 Totems
- 5 Smart TVs

---

## 🔍 **QUERIES ÚTEIS**

### **1. Listar todos os totens de um publisher:**

```sql
SELECT 
  t.totem_id,
  t.name,
  t.identifier,
  t.status,
  l.name as local_name,
  p.name as publisher_name
FROM totems t
JOIN locals l ON t.local_id = l.local_id
JOIN publishers p ON l.publisher_id = p.publisher_id
WHERE p.publisher_id = 1
  AND t.is_active = true
ORDER BY l.name, t.name;
```

### **2. Listar todas as Smart TVs de um publisher:**

```sql
SELECT 
  st.tv_id,
  st.name,
  st.brand,
  st.model,
  st.status,
  t.name as totem_name,
  l.name as local_name,
  p.name as publisher_name
FROM smart_tvs st
JOIN totems t ON st.totem_id = t.totem_id
JOIN locals l ON t.local_id = l.local_id
JOIN publishers p ON l.publisher_id = p.publisher_id
WHERE p.publisher_id = 1
  AND st.is_active = true
ORDER BY l.name, t.name, st.name;
```

### **3. Estatísticas de um publisher:**

```sql
SELECT 
  p.publisher_id,
  p.name as publisher_name,
  COUNT(DISTINCT l.local_id) as total_locals,
  COUNT(DISTINCT t.totem_id) as total_totems,
  COUNT(DISTINCT st.tv_id) as total_smart_tvs,
  COUNT(DISTINCT CASE WHEN t.status = 'online' THEN t.totem_id END) as online_totems,
  COUNT(DISTINCT CASE WHEN st.status = 'playing' THEN st.tv_id END) as playing_tvs
FROM publishers p
LEFT JOIN locals l ON p.publisher_id = l.publisher_id AND l.is_active = true
LEFT JOIN totems t ON l.local_id = t.local_id AND t.is_active = true
LEFT JOIN smart_tvs st ON t.totem_id = st.totem_id AND st.is_active = true
WHERE p.publisher_id = 1
GROUP BY p.publisher_id, p.name;
```

---

## ✅ **VALIDAÇÕES DO MODELO**

### **1. Relacionamentos Corretos:**
- ✅ Publisher → Local: 1:N (correto)
- ✅ Local → Totem: 1:N (correto)
- ✅ Totem → Smart TV: 1:0..N (correto - permite nenhuma, uma ou múltiplas)

### **2. Foreign Keys:**
- ✅ `locals.publisher_id` → `publishers.publisher_id` (ON DELETE CASCADE)
- ✅ `totems.local_id` → `locals.local_id` (ON DELETE CASCADE)
- ✅ `smart_tvs.totem_id` → `totems.totem_id` (ON DELETE CASCADE)

### **3. Integridade Referencial:**
- ✅ Se publisher for deletado → locals são deletados
- ✅ Se local for deletado → totens são deletados
- ✅ Se totem for deletado → smart TVs são deletadas

---

## 🎯 **CONCLUSÃO**

O modelo ER está **correto** e bem definido:

✅ **Relacionamentos:** Todos corretos  
✅ **Cardinalidades:** Todas corretas  
✅ **Foreign Keys:** Todas definidas  
✅ **Cascata:** Implementada corretamente  

**O que falta:** Implementação no backend (métodos) e frontend (páginas).

