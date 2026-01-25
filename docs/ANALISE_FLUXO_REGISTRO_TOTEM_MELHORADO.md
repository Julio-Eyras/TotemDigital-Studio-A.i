# 🔍 Análise: Fluxo de Registro de Totem - Problema e Solução

## 🎯 Ponto de Vista do Usuário (Correto)

O usuário identificou um **problema crítico** no fluxo atual:

> "O servidor não tem que inserir registro algum pois o totem já foi cadastrado lá no cadastro do publisher e para ter sido validado esta teve seu UIN designado."

**Tradução:**
- ✅ Totem **já foi cadastrado** pelo publisher (antecipadamente)
- ✅ Totem **já tem UIN designado** (não gerado pelo hardware)
- ✅ Servidor **não deveria criar novo registro**
- ✅ Servidor **deveria apenas validar e vincular hardware** ao totem pré-cadastrado

---

## ❌ Problema do Fluxo Atual

### **Fluxo Atual (Incorreto):**

```
1. Totem gera UIN baseado em hardware
   └─> UIN = SHA-256(hardware) → "SSP-3a8f9b2c1d4e5f6"

2. Totem envia auto-registro
   POST /api/player/register
   {
       "uin": "SSP-3a8f9b2c1d4e5f6",
       "hardware": {...}
   }

3. Servidor verifica se UIN existe
   └─> Se existe: Erro 409 "UIN já registrado" ❌
   └─> Se não existe: CRIA NOVO REGISTRO ❌

4. Servidor cria totem no banco
   INSERT INTO totems (...) VALUES (...)
   └─> Status: 'pending_approval'
```

### **Problemas Identificados:**

1. **❌ Permite Auto-Registro Sem Controle:**
   - Qualquer hardware pode gerar UIN e se auto-registrar
   - Não há controle sobre quais totens podem se registrar
   - Publisher não tem controle sobre cadastro de totens

2. **❌ Rejeita UINs Pré-Cadastrados:**
   - Se publisher cadastrou totem com UIN específico
   - Totem tenta usar esse UIN
   - Servidor retorna erro 409 "UIN já registrado"
   - Totem não consegue se vincular ao registro existente

3. **❌ Cria Registros Duplicados:**
   - Se totem já foi cadastrado pelo publisher
   - Servidor cria novo registro com mesmo UIN (se passar validação)
   - Ou rejeita se UIN já existe
   - Não vincula hardware ao totem pré-cadastrado

4. **❌ Falta de Integridade:**
   - Totem pré-cadastrado pelo publisher fica "órfão"
   - Hardware não consegue se vincular ao totem correto
   - Dois registros podem existir (um do publisher, outro auto-registrado)

---

## ✅ Fluxo Correto (Proposto)

### **Fluxo Correto:**

```
1. Publisher cadastra totem antecipadamente
   └─> Via interface ou script create-totem-uin.sh
   └─> UIN pré-designado: "TOTEM-ENTRADA-001"
   └─> Status: 'pending_activation' (aguardando hardware)

2. Totem inicia pela primeira vez
   └─> Usa UIN pré-designado (não gera)
   └─> UIN vem de:
       - URL: ?uin=TOTEM-ENTRADA-001
       - Config encriptado
       - Input manual
       - QR Code

3. Totem envia registro com UIN pré-designado
   POST /api/player/register
   {
       "uin": "TOTEM-ENTRADA-001",  // UIN pré-designado
       "hardware": {
           "macAddress": "aa:bb:cc:dd:ee:ff",
           ...
       }
   }

4. Servidor VALIDA UIN pré-cadastrado
   └─> Busca totem por UIN
   └─> Se não existe: Erro 404 "UIN não cadastrado"
   └─> Se existe: Continua validação

5. Servidor VALIDA hardware
   └─> Verifica se hardware já está vinculado a outro totem
   └─> Se sim: Erro 409 "Hardware já vinculado"
   └─> Se não: Continua

6. Servidor ATUALIZA registro existente
   UPDATE totems SET
       config = {...hardware info...},
       ip_address = '...',
       last_seen = NOW(),
       status = 'pending_approval'  // ou 'online' se já aprovado
   WHERE uin = 'TOTEM-ENTRADA-001'

7. Servidor retorna sucesso
   {
       "success": true,
       "uin": "TOTEM-ENTRADA-001",
       "status": "pending_approval",
       "message": "Hardware vinculado ao totem pré-cadastrado"
   }
```

### **Benefícios:**

1. **✅ Controle Total:**
   - Publisher controla quais totens podem se registrar
   - Apenas totens pré-cadastrados podem se conectar
   - Previne auto-registro não autorizado

2. **✅ Integridade:**
   - Totem pré-cadastrado é vinculado ao hardware correto
   - Não cria registros duplicados
   - Mantém dados do publisher (nome, local, etc.)

3. **✅ Segurança:**
   - Hardware não pode se registrar sem UIN válido
   - UIN deve ser pré-cadastrado pelo publisher
   - Previne clonagem e registros não autorizados

4. **✅ Rastreabilidade:**
   - Totem mantém dados do cadastro original
   - Hardware é vinculado ao totem correto
   - Histórico completo de quando hardware foi vinculado

---

## 🔧 Implementação Correta

### **Mudanças Necessárias no Backend:**

#### **1. Endpoint `/api/player/register` - Lógica Corrigida:**

```typescript
router.post('/register', async (req, res) => {
    const { uin, hardware } = req.body;
    
    // 1. VALIDAR: UIN deve existir (pré-cadastrado)
    const existingTotem = await totemService.getTotemByUin(uin);
    
    if (!existingTotem) {
        // UIN não cadastrado - totem deve ser pré-cadastrado pelo publisher
        return res.status(404).json({ 
            error: 'UIN não cadastrado',
            message: 'Este UIN não está cadastrado no sistema. O totem deve ser cadastrado pelo publisher antes de se conectar.',
            suggestion: 'Entre em contato com o administrador para cadastrar este totem.'
        });
    }
    
    // 2. VALIDAR: Hardware não deve estar vinculado a outro totem
    const hardwareHash = hardware.hardwareHash || hardware.macAddress;
    const existingHardware = await db.findFirst(`
        SELECT totem_id, uin 
        FROM totems 
        WHERE config->>'hardware'->>'mac' = ? 
           OR config->>'hardware'->>'hardwareHash' = ?
        AND totem_id != ?
    `, [hardware.macAddress, hardwareHash, existingTotem.totem_id]);
    
    if (existingHardware && existingHardware.totem_id !== existingTotem.totem_id) {
        return res.status(409).json({ 
            error: 'Hardware já vinculado',
            message: 'Este hardware já está vinculado a outro totem',
            existingTotem: {
                id: existingHardware.totem_id,
                uin: existingHardware.uin
            }
        });
    }
    
    // 3. ATUALIZAR: Vincular hardware ao totem pré-cadastrado
    const config = {
        ...existingTotem.config,  // Preservar dados do publisher
        hardware: {
            mac: hardware.macAddress || null,
            hostname: hardware.hostname || null,
            platform: hardware.platform || null,
            arch: hardware.arch || null,
            serial: hardware.serial || null,
            hardwareHash: hardware.hardwareHash || null,
            registeredAt: new Date().toISOString(),
            userAgent: hardware.userAgent || null
        }
    };
    
    await db.executeRaw(`
        UPDATE totems SET
            config = ?::jsonb,
            ip_address = ?,
            last_seen = CURRENT_TIMESTAMP,
            status = CASE 
                WHEN status = 'pending_activation' THEN 'pending_approval'
                ELSE status
            END,
            updated_at = CURRENT_TIMESTAMP
        WHERE uin = ?
    `, [JSON.stringify(config), req.ip, uin]);
    
    // 4. RETORNAR: Sucesso com status atualizado
    const updatedTotem = await totemService.getTotemByUin(uin);
    
    return res.json({
        success: true,
        uin: uin,
        status: updatedTotem.status,
        message: 'Hardware vinculado ao totem pré-cadastrado com sucesso',
        totem: updatedTotem
    });
});
```

### **2. Novo Status: `pending_activation`**

Totens cadastrados pelo publisher devem começar com status `pending_activation`:

```sql
INSERT INTO totems (
    uin,
    identifier,
    status,  -- 'pending_activation' (aguardando hardware)
    is_active,  -- false
    ...
) VALUES (...);
```

**Estados do Totem:**
- `pending_activation`: Cadastrado pelo publisher, aguardando hardware se conectar
- `pending_approval`: Hardware conectado, aguardando aprovação do admin
- `online`: Aprovado e ativo
- `offline`: Inativo

### **3. Script de Cadastro Prévio (Já Existe):**

O script `scripts/create-totem-uin.sh` já permite cadastrar totens com UIN pré-designado:

```bash
./scripts/create-totem-uin.sh "TOTEM-ENTRADA-001" "Totem Entrada Principal" 1 "Descrição"
```

**O que o script faz:**
- Cria totem no banco com UIN pré-designado
- Status inicial: `pending_activation`
- Aguarda hardware se conectar

---

## 📊 Comparação: Fluxo Atual vs. Fluxo Correto

### **Fluxo Atual (Incorreto):**

| Etapa | Ação | Problema |
|-------|------|----------|
| 1 | Totem gera UIN | ❌ UIN não controlado |
| 2 | Totem envia registro | ❌ Sem validação prévia |
| 3 | Servidor verifica UIN | ❌ Se existe, rejeita |
| 4 | Servidor cria registro | ❌ Cria novo (sem controle) |

### **Fluxo Correto (Proposto):**

| Etapa | Ação | Benefício |
|-------|------|-----------|
| 1 | Publisher cadastra totem | ✅ Controle total |
| 2 | Totem usa UIN pré-designado | ✅ UIN validado |
| 3 | Totem envia registro | ✅ Com UIN válido |
| 4 | Servidor valida UIN | ✅ Deve existir |
| 5 | Servidor vincula hardware | ✅ Atualiza registro existente |

---

## 🎯 Casos de Uso

### **Caso 1: Totem Pré-Cadastrado (Fluxo Correto)**

```
1. Publisher cadastra totem:
   - UIN: "TOTEM-ENTRADA-001"
   - Nome: "Totem Entrada Principal"
   - Local: "Shopping Center - Entrada"
   - Status: pending_activation

2. Totem físico é instalado:
   - UIN configurado: "TOTEM-ENTRADA-001"
   - Hardware: MAC aa:bb:cc:dd:ee:ff

3. Totem conecta:
   POST /api/player/register
   {
       "uin": "TOTEM-ENTRADA-001",
       "hardware": { "macAddress": "aa:bb:cc:dd:ee:ff" }
   }

4. Servidor valida e vincula:
   ✅ UIN existe (pré-cadastrado)
   ✅ Hardware não está vinculado
   ✅ Atualiza registro: vincula hardware
   ✅ Status: pending_activation → pending_approval

5. Admin aprova:
   ✅ Totem fica online
   ✅ Mantém dados do publisher (nome, local, etc.)
```

### **Caso 2: Totem Não Cadastrado (Rejeitado)**

```
1. Totem tenta se conectar:
   POST /api/player/register
   {
       "uin": "TOTEM-NAO-CADASTRADO",
       "hardware": {...}
   }

2. Servidor valida:
   ❌ UIN não existe no banco

3. Servidor rejeita:
   {
       "error": "UIN não cadastrado",
       "message": "Este UIN não está cadastrado no sistema. O totem deve ser cadastrado pelo publisher antes de se conectar."
   }

4. Totem mostra mensagem:
   "Totem não cadastrado. Entre em contato com o administrador."
```

### **Caso 3: Hardware Já Vinculado (Rejeitado)**

```
1. Totem A já está vinculado:
   - UIN: "TOTEM-A"
   - Hardware: MAC aa:bb:cc:dd:ee:ff

2. Totem B tenta usar mesmo hardware:
   POST /api/player/register
   {
       "uin": "TOTEM-B",
       "hardware": { "macAddress": "aa:bb:cc:dd:ee:ff" }
   }

3. Servidor valida:
   ❌ Hardware já vinculado a TOTEM-A

4. Servidor rejeita:
   {
       "error": "Hardware já vinculado",
       "message": "Este hardware já está vinculado a outro totem",
       "existingTotem": { "uin": "TOTEM-A" }
   }
```

---

## 🔐 Segurança e Integridade

### **Vantagens do Fluxo Correto:**

1. **Controle de Acesso:**
   - Apenas totens pré-cadastrados podem se conectar
   - Publisher controla quais totens são permitidos
   - Previne auto-registro não autorizado

2. **Rastreabilidade:**
   - Totem mantém dados do cadastro original
   - Histórico completo de quando hardware foi vinculado
   - Auditoria de mudanças

3. **Integridade de Dados:**
   - Não cria registros duplicados
   - Hardware vinculado ao totem correto
   - Dados do publisher preservados

4. **Prevenção de Clonagem:**
   - Hardware não pode ser usado em múltiplos totens
   - Validação de hardware único por totem
   - Detecção de tentativas de clonagem

---

## 📝 Resumo

### **Problema Identificado:**

O fluxo atual permite que totens se auto-registrem sem controle, criando novos registros no banco. Isso é **incoerente** porque:

1. Totens deveriam ser pré-cadastrados pelo publisher
2. UINs deveriam ser pré-designados (não gerados pelo hardware)
3. Servidor não deveria criar novos registros
4. Servidor deveria apenas validar e vincular hardware

### **Solução Proposta:**

1. **Publisher cadastra totem** com UIN pré-designado
2. **Totem usa UIN pré-designado** (não gera)
3. **Servidor valida** que UIN existe (pré-cadastrado)
4. **Servidor vincula hardware** ao totem existente (UPDATE, não INSERT)
5. **Mantém dados do publisher** (nome, local, etc.)

### **Benefícios:**

- ✅ Controle total sobre quais totens podem se registrar
- ✅ Integridade de dados (não cria duplicados)
- ✅ Segurança (apenas totens pré-cadastrados)
- ✅ Rastreabilidade (histórico completo)

---

## ✅ Conclusão

O usuário está **absolutamente correto**. O fluxo atual é **incoerente** e precisa ser corrigido para:

1. **Validar** que UIN foi pré-cadastrado pelo publisher
2. **Vincular** hardware ao totem existente (não criar novo)
3. **Preservar** dados do cadastro original do publisher
4. **Manter** integridade e controle sobre registros

A implementação correta transforma o endpoint `/api/player/register` de um **criador de registros** em um **validador e vinculador de hardware** a totens pré-cadastrados.
