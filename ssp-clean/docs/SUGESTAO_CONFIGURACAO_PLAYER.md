# 💡 Sugestões de Configuração do Player

## 📋 Problema Atual

**Como o player descobre o servidor?**
- Atualmente: `window.location.origin` (assume que servidor está no mesmo IP/domínio)
- Limitação: Só funciona se player e backend estão no mesmo servidor
- Problema: Se player está em outro lugar, não sabe onde está o servidor

---

## 🎯 Soluções Sugeridas

### **Opção 1: QR Code de Configuração (Recomendada)**

#### **Como Funcionaria:**

1. **No Admin (Publisher):**
   - Ao cadastrar totem, gera QR Code com:
     ```json
     {
       "serverUrl": "http://192.168.1.110:3000",
       "uin": "UIN-SHOPPING-001-2025",
       "totemId": 123,
       "encrypted": true,
       "data": "U2FsdGVkX1+abc123..." // Dados encriptados
     }
     ```

2. **QR Code Encriptado:**
   - Dados encriptados com chave do totem
   - Inclui: serverUrl, UIN, totemId, timestamp
   - Validade: 24 horas (ou configurável)

3. **No Player:**
   - Tela inicial mostra QR Code para escanear
   - Técnico escaneia com app mobile
   - App decodifica e envia configuração para player
   - Player salva em localStorage/IndexedDB
   - Player reinicia com configuração

4. **App Mobile (Técnico):**
   - Escaneia QR Code
   - Decodifica dados
   - Envia via WebSocket ou HTTP POST para player
   - Player recebe e salva configuração

#### **Vantagens:**
- ✅ Seguro (encriptado)
- ✅ Fácil para técnico (só escanear)
- ✅ Não precisa digitar nada
- ✅ Funciona offline (QR Code tem tudo)
- ✅ Pode incluir múltiplas URLs (fallback)

#### **Desvantagens:**
- ⚠️ Requer app mobile para técnico
- ⚠️ Requer câmera no totem (ou outro método de entrada)

---

### **Opção 2: Configuração via URL (Simples)**

#### **Como Funcionaria:**

```
http://192.168.1.110/player/?uin=UIN-SHOPPING-001-2025&server=http://192.168.1.110:3000
```

- Player lê parâmetros da URL
- Salva em localStorage
- Próximas vezes usa configuração salva

#### **Vantagens:**
- ✅ Muito simples
- ✅ Não requer app mobile
- ✅ Funciona imediatamente

#### **Desvantagens:**
- ⚠️ Menos seguro (URL visível)
- ⚠️ Técnico precisa digitar URL completa

---

### **Opção 3: Configuração via Arquivo Local**

#### **Como Funcionaria:**

1. **Técnico cria arquivo `config.json` no diretório do player:**
   ```json
   {
     "serverUrl": "http://192.168.1.110:3000",
     "uin": "UIN-SHOPPING-001-2025",
     "totemId": 123
   }
   ```

2. **Player carrega na inicialização:**
   - Busca `config.json` no mesmo diretório
   - Se encontrar, usa configuração
   - Salva em localStorage para cache

#### **Vantagens:**
- ✅ Simples
- ✅ Não requer rede
- ✅ Fácil de editar

#### **Desvantagens:**
- ⚠️ Requer acesso ao sistema de arquivos
- ⚠️ Menos seguro (arquivo texto)

---

### **Opção 4: Auto-Discovery (mDNS/Bonjour)**

#### **Como Funcionaria:**

1. **Servidor anuncia via mDNS:**
   - Nome: `smartsignage-server._http._tcp.local`
   - Porta: 3000
   - TXT: `uin=UIN-SHOPPING-001-2025`

2. **Player busca automaticamente:**
   - Usa mDNS para descobrir servidor na rede local
   - Conecta automaticamente
   - Funciona em rede local sem configuração

#### **Vantagens:**
- ✅ Zero configuração
- ✅ Funciona automaticamente
- ✅ Ideal para instalações locais

#### **Desvantagens:**
- ⚠️ Só funciona em rede local
- ⚠️ Requer mDNS no servidor
- ⚠️ Pode ter conflitos se múltiplos servidores

---

### **Opção 5: Híbrida (Recomendada para Produção)**

#### **Combinação de Múltiplas Opções:**

1. **Prioridade 1: Configuração Salva (localStorage/IndexedDB)**
   - Se já configurado, usa configuração salva

2. **Prioridade 2: Parâmetros URL**
   - Se `?server=...` na URL, usa e salva

3. **Prioridade 3: QR Code**
   - Se não configurado, mostra tela com QR Code
   - Técnico escaneia e configura

4. **Prioridade 4: Auto-Discovery (mDNS)**
   - Se nada funcionar, tenta descobrir servidor na rede

5. **Prioridade 5: Fallback**
   - `window.location.origin` (comportamento atual)

#### **Fluxo:**
```
Player inicia
  ↓
Tem config salva? → SIM → Usa config salva
  ↓ NÃO
Tem ?server= na URL? → SIM → Usa e salva
  ↓ NÃO
Mostra tela QR Code → Técnico escaneia → Configura
  ↓ NÃO
Tenta mDNS → Encontra? → SIM → Usa e salva
  ↓ NÃO
Usa window.location.origin (fallback)
```

---

## 🎨 Interface Sugerida para QR Code

### **Tela de Configuração Inicial:**

```
┌─────────────────────────────────────┐
│   Smart Signage Player              │
│   Configuração Necessária            │
│                                      │
│   ┌─────────────────────────────┐   │
│   │                             │   │
│   │      [QR CODE AQUI]         │   │
│   │                             │   │
│   └─────────────────────────────┘   │
│                                      │
│   Escaneie com o app do técnico     │
│   para configurar este totem        │
│                                      │
│   UIN: UIN-SHOPPING-001-2025        │
│   Status: Aguardando configuração   │
└─────────────────────────────────────┘
```

### **Após Configuração:**

```
┌─────────────────────────────────────┐
│   Smart Signage Player              │
│   ✅ Configurado                     │
│                                      │
│   Servidor: http://192.168.1.110    │
│   UIN: UIN-SHOPPING-001-2025        │
│   Status: Conectando...             │
└─────────────────────────────────────┘
```

---

## 🔐 Segurança

### **QR Code Encriptado:**

```javascript
// Dados do QR Code
const qrData = {
  serverUrl: "http://192.168.1.110:3000",
  uin: "UIN-SHOPPING-001-2025",
  totemId: 123,
  timestamp: Date.now(),
  expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24h
};

// Encriptar com AES-256 usando chave do totem
const encrypted = encrypt(JSON.stringify(qrData), totemSecretKey);

// QR Code contém apenas dados encriptados
const qrCode = generateQRCode(encrypted);
```

### **Validação no Player:**

```javascript
// Player recebe dados encriptados
const decrypted = decrypt(qrData, totemSecretKey);
const config = JSON.parse(decrypted);

// Validar expiração
if (config.expiresAt < Date.now()) {
  throw new Error('QR Code expirado');
}

// Validar UIN
if (config.uin !== expectedUIN) {
  throw new Error('QR Code inválido para este totem');
}
```

---

## 📱 App Mobile do Técnico

### **Funcionalidades:**

1. **Escanear QR Code:**
   - Usa câmera do celular
   - Decodifica dados encriptados
   - Valida assinatura

2. **Enviar para Player:**
   - Via WebSocket (se player suporta)
   - Via HTTP POST (player tem endpoint de configuração)
   - Via arquivo compartilhado (se player tem acesso)

3. **Gerenciar Totens:**
   - Lista de totens configurados
   - Reconfigurar totem
   - Ver status de conexão

---

## 🚀 Implementação Sugerida (Fase 1)

### **Passo 1: Configuração via URL (Rápido)**
- Adicionar parâmetro `?server=...` na URL
- Salvar em localStorage
- Usar configuração salva nas próximas vezes

### **Passo 2: Tela de Configuração**
- Se não tem config salva, mostrar tela
- Opção 1: Digitar URL manualmente
- Opção 2: Escanear QR Code (futuro)

### **Passo 3: QR Code (Futuro)**
- Gerar QR Code no admin
- Implementar leitura no player
- App mobile para técnico

---

## 💬 Qual Solução Você Prefere?

1. **QR Code** (mais profissional, requer app mobile)
2. **URL Parameters** (mais simples, implementação rápida)
3. **Arquivo Local** (simples, requer acesso ao sistema)
4. **Auto-Discovery** (zero config, só rede local)
5. **Híbrida** (combina todas, mais robusta)

**Sugestão:** Começar com **Opção 2 (URL Parameters)** para resolver imediatamente, depois adicionar **QR Code** quando tiver app mobile.
